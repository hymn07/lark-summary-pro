import { db } from "@repo/database";
import { getTenantAccessToken, batchGetUserNames } from "./feishu-client";

// 搜索最近会议列表（需要 user_access_token）
export async function searchMeetings(
  userAccessToken: string,
  pageSize = 20,
): Promise<FeishuMeetingItem[]> {
  const res = await fetch("https://open.feishu.cn/open-apis/vc/v1/meetings/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${userAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ page_size: pageSize }),
  });

  if (!res.ok) return [];

  const json = await res.json();
  return (json.data?.meeting_list ?? []).map((m: Record<string, unknown>) => ({
    id: m.id as string,
    topic: (m.topic as string) ?? null,
    meetingNo: (m.meeting_no as string) ?? null,
    startTime: (m.start_time as string) ?? null,
    endTime: (m.end_time as string) ?? null,
    status: m.status as number,
  }));
}

export interface FeishuMeetingItem {
  id: string;
  topic: string | null;
  meetingNo: string | null;
  startTime: string | null;
  endTime: string | null;
  status: number;
}

// 获取会议详情（含参会人和逐字稿 token）
export async function getMeetingDetail(meetingId: string): Promise<{
  topic: string | null;
  startTime: string | null;
  endTime: string | null;
  hostUserId: string | null;
  participantCount: number;
  participants: { userId: string; userName: string | null; isHost: boolean; isExternal: boolean }[];
  transcriptDocToken: string | null;
  noteDocToken: string | null;
} | null> {
  const token = await getTenantAccessToken();
  if (!token) return null;

  const res = await fetch(
    `https://open.feishu.cn/open-apis/vc/v1/meetings/${meetingId}?with_participants=true&user_id_type=open_id`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) return null;

  const json = await res.json();
  const meeting = json.data?.meeting;
  if (!meeting) return null;

  const participants = (meeting.participants ?? []).map((p: Record<string, unknown>) => ({
    userId: (p.user_id ?? p.open_id ?? "") as string,
    userName: (p.user_name ?? null) as string | null,
    isHost: (p.is_host ?? false) as boolean,
    isExternal: (p.is_external ?? false) as boolean,
  }));

  // 批量查询参会人姓名（VC API 不保证返回姓名）
  const unknownIds = (participants as Array<{ userId: string; userName: string | null; isExternal: boolean }>)
    .filter((p) => !p.isExternal && !p.userName)
    .map((p) => p.userId);
  if (unknownIds.length > 0) {
    const nameMap = await batchGetUserNames(unknownIds);
    for (const p of participants) {
      if (!p.userName && nameMap.has(p.userId)) {
        p.userName = nameMap.get(p.userId)!;
      }
    }
  }

  return {
    topic: meeting.topic ?? null,
    startTime: meeting.start_time ?? null,
    endTime: meeting.end_time ?? null,
    hostUserId: meeting.host_user?.id ?? null,
    participantCount: Number(meeting.participant_count ?? 0),
    participants,
    transcriptDocToken: meeting.related_artifacts?.verbatim_doc_token ?? null,
    noteDocToken: meeting.related_artifacts?.note_doc_token ?? null,
  };
}

// 获取逐字稿文本内容
export async function getTranscriptContent(docToken: string): Promise<string | null> {
  const token = await getTenantAccessToken();
  if (!token) return null;

  const res = await fetch(
    `https://open.feishu.cn/open-apis/docx/v1/documents/${docToken}/raw_content`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) return null;

  const json = await res.json();
  return json.data?.content ?? null;
}

export interface CacheMeetingDetail {
  transcriptDocToken?: string | null;
  transcriptText?: string | null;
  noteDocToken?: string | null;
  participants?: { userId: string; userName: string | null; isHost: boolean; isExternal: boolean }[];
  meetingUrl?: string | null;
}

// 缓存会议到数据库
export async function cacheMeeting(
  meeting: FeishuMeetingItem,
  detail?: CacheMeetingDetail,
) {
  return db.feishuMeeting.upsert({
    where: { meetingId: meeting.id },
    update: {
      topic: meeting.topic,
      meetingNo: meeting.meetingNo,
      startTime: meeting.startTime ? new Date(Number(meeting.startTime) * 1000) : null,
      endTime: meeting.endTime ? new Date(Number(meeting.endTime) * 1000) : null,
      ...(detail?.transcriptText ? { transcriptText: detail.transcriptText, transcriptFetched: true } : {}),
      ...(detail?.noteDocToken ? { noteDocToken: detail.noteDocToken } : {}),
      ...(detail?.participants ? { participantsJson: detail.participants } : {}),
      ...(detail?.meetingUrl ? { meetingUrl: detail.meetingUrl } : {}),
    },
    create: {
      meetingId: meeting.id,
      meetingNo: meeting.meetingNo,
      topic: meeting.topic,
      startTime: meeting.startTime ? new Date(Number(meeting.startTime) * 1000) : null,
      endTime: meeting.endTime ? new Date(Number(meeting.endTime) * 1000) : null,
      source: "feishu",
      ...(detail?.transcriptText ? { transcriptText: detail.transcriptText, transcriptFetched: true } : {}),
      ...(detail?.noteDocToken ? { noteDocToken: detail.noteDocToken } : {}),
      ...(detail?.participants ? { participantsJson: detail.participants } : {}),
      ...(detail?.meetingUrl ? { meetingUrl: detail.meetingUrl } : {}),
    },
  });
}

// 同步用户最近 90 天的飞书会议和妙记到缓存
export async function syncUserMeetings(userAccessToken: string, days = 90) {
  const endTime = new Date().toISOString();
  const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  console.log(`[Sync] 同步最近 ${days} 天会议: ${startTime.slice(0, 10)} ~ ${endTime.slice(0, 10)}`);

  // Step 1: 搜索会议列表（user token）
  const meetingRes = await fetch("https://open.feishu.cn/open-apis/vc/v1/meetings/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${userAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      page_size: 30,
      meeting_filter: { start_time: { start_time: startTime, end_time: endTime } },
    }),
  });

  let meetings: { id: string; topic?: string; meeting_no?: string; start_time?: string; end_time?: string }[] = [];
  if (meetingRes.ok) {
    const mj = await meetingRes.json();
    meetings = mj.data?.items ?? [];
    console.log(`[Sync] 找到 ${meetings.length} 个会议`);
  } else {
    console.log(`[Sync] 搜索会议失败: ${meetingRes.status}`);
    return [];
  }

  // Step 2: 逐个获取会议详情和录制（tenant token）
  const { getTenantAccessToken } = await import("./feishu-client");
  const tenantToken = await getTenantAccessToken();
  const cached: string[] = [];

  for (const m of meetings) {
    try {
      const meetingId = m.id;

      // 检查是否已缓存
      const existing = await db.feishuMeeting.findUnique({
        where: { meetingId },
        select: { id: true, noteDocToken: true, participantsJson: true, transcriptText: true },
      });
      const hasTranscript = existing?.transcriptText;
      const hasParticipants = existing?.participantsJson;
      const hasNoteToken = existing?.noteDocToken;

      // 获取会议详情（补充参与者）
      let participants: Record<string, unknown>[] = [];
      let topic = m.topic ?? null;
      if (!hasParticipants && tenantToken) {
        const detail = await getMeetingDetail(meetingId);
        if (detail) {
          topic = detail.topic ?? topic;
          participants = detail.participants.map((p) => ({
            userId: p.userId,
            userName: p.userName ?? "未知",
            isHost: p.isHost,
            isExternal: p.isExternal,
          }));
        }
      }

      // 获取录制 URL（就是妙记链接）
      let noteDocToken: string | null = hasNoteToken ?? null;
      if (!noteDocToken && tenantToken) {
        const recRes = await fetch(
          `https://open.feishu.cn/open-apis/vc/v1/meetings/${meetingId}/recording`,
          { headers: { Authorization: `Bearer ${tenantToken}` } },
        );
        if (recRes.ok) {
          const rj = await recRes.json();
          const recUrl: string | undefined = rj.data?.recording?.url;
          if (recUrl) {
            // 从 URL 提取妙记 token: https://meetings.feishu.cn/minutes/obcnnvwpkols4a698zgz21i9
            const tokenMatch = recUrl.match(/\/minutes\/([a-zA-Z0-9]+)/);
            if (tokenMatch) {
              noteDocToken = tokenMatch[1];
            }
          }
        }
      }

      // 尝试获取逐字稿（如果还没有）
      let transcriptText: string | undefined;
      if (!hasTranscript && noteDocToken && tenantToken) {
        try {
          const docToken = noteDocToken; // 妙记 token 也可用于读取内容
          const contentRes = await fetch(
            `https://open.feishu.cn/open-apis/docx/v1/documents/${docToken}/raw_content`,
            { headers: { Authorization: `Bearer ${tenantToken}` } },
          );
          if (contentRes.ok) {
            const cj = await contentRes.json();
            if (cj.data?.content) {
              transcriptText = cj.data.content;
            }
          }
        } catch { /* ignore */ }
      }

      // Upsert 到缓存
      await db.feishuMeeting.upsert({
        where: { meetingId },
        update: {
          topic,
          meetingNo: m.meeting_no ?? null,
          startTime: m.start_time ? new Date(Number(m.start_time) * 1000) : null,
          endTime: m.end_time ? new Date(Number(m.end_time) * 1000) : null,
          ...(participants.length > 0 ? { participantsJson: participants, participantCount: participants.length } : {}),
          ...(noteDocToken && !hasNoteToken ? { noteDocToken } : {}),
          ...(transcriptText ? { transcriptText, transcriptFetched: true } : {}),
        },
        create: {
          meetingId,
          topic,
          meetingNo: m.meeting_no ?? null,
          source: "feishu",
          startTime: m.start_time ? new Date(Number(m.start_time) * 1000) : null,
          endTime: m.end_time ? new Date(Number(m.end_time) * 1000) : null,
          participantsJson: participants,
          participantCount: participants.length,
          noteDocToken,
          transcriptText,
          transcriptFetched: !!transcriptText,
        },
      });
      cached.push(meetingId);
      console.log(`[Sync] 已缓存: ${topic ?? meetingId} 妙记=${noteDocToken?.slice(0, 8) ?? "无"}${transcriptText ? " 逐字稿=" + transcriptText.length + "字" : ""}`);
    } catch (e) {
      console.error(`[Sync] 缓存失败 ${m.id}:`, e);
    }
  }

  return cached;
}

// 获取缓存的会议列表（飞书 + 手动，不包含已删除）
export async function getCachedMeetings(limit = 50) {
  return db.feishuMeeting.findMany({
    where: { isDeleted: false },
    orderBy: { startTime: "desc" },
    take: limit,
    include: {
      _count: { select: { meetingRecords: true } },
      meetingRecords: {
        where: { isDeleted: false },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });
}
