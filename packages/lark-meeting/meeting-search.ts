import { db } from "@repo/database";
import { getTenantAccessToken } from "./feishu-client";

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

  return {
    topic: meeting.topic ?? null,
    startTime: meeting.start_time ?? null,
    endTime: meeting.end_time ?? null,
    hostUserId: meeting.host_user?.id ?? null,
    participantCount: Number(meeting.participant_count ?? 0),
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

// 缓存会议到数据库
export async function cacheMeeting(
  meeting: FeishuMeetingItem,
  detail?: { transcriptDocToken?: string | null; transcriptText?: string | null },
) {
  return db.feishuMeeting.upsert({
    where: { meetingId: meeting.id },
    update: {
      topic: meeting.topic,
      meetingNo: meeting.meetingNo,
      startTime: meeting.startTime ? new Date(Number(meeting.startTime) * 1000) : null,
      endTime: meeting.endTime ? new Date(Number(meeting.endTime) * 1000) : null,
      ...(detail?.transcriptText ? { transcriptText: detail.transcriptText, transcriptFetched: true } : {}),
    },
    create: {
      meetingId: meeting.id,
      meetingNo: meeting.meetingNo,
      topic: meeting.topic,
      startTime: meeting.startTime ? new Date(Number(meeting.startTime) * 1000) : null,
      endTime: meeting.endTime ? new Date(Number(meeting.endTime) * 1000) : null,
      ...(detail?.transcriptText ? { transcriptText: detail.transcriptText, transcriptFetched: true } : {}),
    },
  });
}

// 获取缓存的会议列表
export async function getCachedMeetings(limit = 50) {
  return db.feishuMeeting.findMany({
    orderBy: { startTime: "desc" },
    take: limit,
    include: {
      _count: { select: { MeetingRecord: true } },
    },
  });
}
