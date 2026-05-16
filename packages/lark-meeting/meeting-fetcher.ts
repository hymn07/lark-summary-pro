import type { MeetingDetail, MeetingParticipant } from "./types";
import { getTenantAccessToken } from "./feishu-client";

// 调用飞书 API 获取会议详情和逐字稿
// 使用 tenant_access_token（应用身份），可拉取企业内任意会议
export async function fetchMeetingDetail(meetingId: string): Promise<MeetingDetail | null> {
  const token = await getTenantAccessToken();
  if (!token) return null;

  try {
    const res = await fetch(
      `https://open.feishu.cn/open-apis/vc/v1/meetings/${meetingId}?with_participants=true&user_id_type=open_id`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) return null;

    const json = await res.json();
    const meeting = json.data?.meeting;
    if (!meeting) return null;

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
    return null;
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
