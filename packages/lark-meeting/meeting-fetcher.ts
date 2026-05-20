import { db } from "@repo/database";
import type { MeetingDetail, MeetingParticipant } from "./types";
import { getTenantAccessToken, batchGetUserNames } from "./feishu-client";

// 从 FeishuMeeting 缓存构建 MeetingDetail
function buildDetailFromCache(cached: {
  meetingId: string;
  topic: string | null;
  startTime: Date | null;
  endTime: Date | null;
  hostUserId: string | null;
  participantCount: number | null;
  participantsJson: unknown;
}): MeetingDetail {
  const participants = (cached.participantsJson as MeetingParticipant[]) ?? [];
  return {
    id: cached.meetingId,
    topic: cached.topic,
    startTime: cached.startTime ? String(Math.floor(cached.startTime.getTime() / 1000)) : null,
    endTime: cached.endTime ? String(Math.floor(cached.endTime.getTime() / 1000)) : null,
    hostUserId: cached.hostUserId,
    participantCount: cached.participantCount ?? participants.length,
    participants,
    transcriptDocToken: null,
    noteDocToken: null,
  };
}

// 调用飞书 API 获取会议详情和逐字稿
// 使用 tenant_access_token（应用身份），可拉取企业内任意会议
// API 失败时回退到 FeishuMeeting 缓存
export async function fetchMeetingDetail(meetingId: string): Promise<MeetingDetail | null> {
  // 先查缓存
  const cached = await db.feishuMeeting.findUnique({ where: { meetingId } });

  // 手动上传的会议：直接从缓存读取
  if (meetingId.startsWith("manual-")) {
    return cached ? buildDetailFromCache(cached) : null;
  }

  const token = await getTenantAccessToken();
  if (!token) {
    // 无 token 时回退到缓存
    return cached ? buildDetailFromCache(cached) : null;
  }

  try {
    const res = await fetch(
      `https://open.feishu.cn/open-apis/vc/v1/meetings/${meetingId}?with_participants=true&user_id_type=open_id`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) {
      // API 失败回退到缓存
      return cached ? buildDetailFromCache(cached) : null;
    }

    const json = await res.json();
    const meeting = json.data?.meeting;
    if (!meeting) {
      return cached ? buildDetailFromCache(cached) : null;
    }

    // 从 VC API 解析参会人
    const rawParticipants: MeetingParticipant[] = (meeting.participants ?? []).map(
      (p: Record<string, unknown>) =>
        ({
          userId: p.id as string,
          userName: (p.name as string) ?? null,
          isHost: (p.is_host as boolean) ?? false,
          isExternal: (p.is_external as boolean) ?? false,
        }) satisfies MeetingParticipant,
    );

    // 批量查询参会人姓名（VC API 不保证返回姓名）
    const unknownIds = rawParticipants
      .filter((p) => !p.isExternal && !p.userName)
      .map((p) => p.userId);
    if (unknownIds.length > 0) {
      const nameMap = await batchGetUserNames(unknownIds);
      for (const p of rawParticipants) {
        if (!p.userName && nameMap.has(p.userId)) {
          p.userName = nameMap.get(p.userId)!;
        }
      }
    }

    return {
      id: meeting.id,
      topic: meeting.topic ?? null,
      startTime: meeting.start_time ?? null,
      endTime: meeting.end_time ?? null,
      hostUserId: meeting.host_user?.id ?? null,
      participantCount: Number(meeting.participant_count ?? 0),
      participants: rawParticipants,
      transcriptDocToken: meeting.related_artifacts?.verbatim_doc_token ?? null,
      noteDocToken: meeting.related_artifacts?.note_doc_token ?? null,
    };
  } catch {
    // 异常回退到缓存
    return cached ? buildDetailFromCache(cached) : null;
  }
}

// 获取逐字稿文本内容（从 docx 文档）
export async function fetchTranscriptContent(docToken: string): Promise<string | null> {
  const token = await getTenantAccessToken();
  if (!token) return null;

  try {
    const res = await fetch(
      `https://open.feishu.cn/open-apis/docx/v1/documents/${docToken}/raw_content`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) return null;

    const json = await res.json();
    return json.data?.content ?? null;
  } catch {
    return null;
  }
}

// 获取用户 access token（用于需要用户身份的 API）
async function getUserToken(userId: string): Promise<string | null> {
  const { getUserAccessToken } = await import("./doc-creator");
  return getUserAccessToken(userId);
}

// 从妙记导出逐字稿（优先 user token，降级 tenant token）
export async function fetchMinutesTranscript(
  minuteToken: string,
  userId?: string,
): Promise<string | null> {
  // 优先用 user token（妙记权限通常关联到用户身份）
  let token: string | null = null;
  if (userId) {
    token = await getUserToken(userId);
  }
  // 降级 tenant token
  if (!token) {
    token = await getTenantAccessToken();
  }
  if (!token) return null;

  try {
    const url = `https://open.feishu.cn/open-apis/minutes/v1/minutes/${minuteToken}/transcript?need_speaker=true&need_timestamp=true`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// 尝试拉取逐字稿并更新缓存（用于延迟重试和手动触发）
// 返回 transcriptText 或 null
export async function tryFetchTranscript(
  meetingId: string,
  userId?: string,
): Promise<{
  transcriptText: string | null;
  noteDocToken: string | null;
}> {
  const detail = await fetchMeetingDetail(meetingId);
  if (!detail) return { transcriptText: null, noteDocToken: null };

  const updates: Record<string, unknown> = {};

  // noteDocToken 可能从 related_artifacts 拿不到，需要调 recording API 提取
  let minuteToken = detail.noteDocToken;
  if (!minuteToken) {
    const token = await getTenantAccessToken();
    if (token) {
      try {
        const recRes = await fetch(
          `https://open.feishu.cn/open-apis/vc/v1/meetings/${meetingId}/recording`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (recRes.ok) {
          const rj = await recRes.json();
          const recUrl: string | undefined = rj.data?.recording?.url;
          if (recUrl) {
            const tokenMatch = recUrl.match(/\/minutes\/([a-zA-Z0-9]+)/);
            if (tokenMatch) {
              minuteToken = tokenMatch[1];
              updates.noteDocToken = minuteToken;
            }
          }
        }
      } catch { /* ignore */ }
    }
  } else {
    updates.noteDocToken = detail.noteDocToken;
  }

  // 优先用妙记 token 调 minutes transcript API
  let transcriptText: string | null = null;

  if (minuteToken) {
    transcriptText = await fetchMinutesTranscript(minuteToken, userId);
    if (transcriptText) {
      updates.transcriptText = transcriptText;
      updates.transcriptFetched = true;
      updates.transcriptRetryAt = null;
      updates.transcriptRetryCount = 0;
    }
  }

  // 降级：如果没有妙记 token，尝试用 verbatim_doc_token 调 docx API
  if (!transcriptText && detail.transcriptDocToken) {
    transcriptText = await fetchTranscriptContent(detail.transcriptDocToken);
    if (transcriptText) {
      updates.transcriptText = transcriptText;
      updates.transcriptFetched = true;
      updates.transcriptRetryAt = null;
      updates.transcriptRetryCount = 0;
    }
  }

  // 更新参会人
  if (detail.participants.length > 0) {
    updates.participantsJson = detail.participants;
    updates.participantCount = detail.participantCount;
  }

  if (Object.keys(updates).length > 0) {
    await db.feishuMeeting.update({ where: { meetingId }, data: updates });
  }

  return { transcriptText: transcriptText ?? null, noteDocToken: detail.noteDocToken };
}
