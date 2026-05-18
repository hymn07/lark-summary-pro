import { db } from "@repo/database";
import type { MeetingDetail, MeetingParticipant } from "./types";
import { getTenantAccessToken } from "./feishu-client";

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

    return {
      id: meeting.id,
      topic: meeting.topic ?? null,
      startTime: meeting.start_time ?? null,
      endTime: meeting.end_time ?? null,
      hostUserId: meeting.host_user?.id ?? null,
      participantCount: Number(meeting.participant_count ?? 0),
      participants: (meeting.participants ?? []).map(
        (p: Record<string, unknown>) =>
          ({
            userId: p.id as string,
            userName: (p.name as string) ?? null,
            isHost: (p.is_host as boolean) ?? false,
            isExternal: (p.is_external as boolean) ?? false,
          }) satisfies MeetingParticipant,
      ),
      transcriptDocToken: meeting.related_artifacts?.verbatim_doc_token ?? null,
    };
  } catch {
    // 异常回退到缓存
    return cached ? buildDetailFromCache(cached) : null;
  }
}

// 获取逐字稿文本内容
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
