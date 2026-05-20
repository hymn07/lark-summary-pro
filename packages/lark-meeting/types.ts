import { z } from "zod";

// 飞书事件体（企业会议结束 v1）
// SDK 返回的是 snake_case 格式
export const FeishuMeetingEndedEventSchema = z.object({
  meeting: z.object({
    id: z.string(),
    topic: z.string().optional(),
    meeting_source: z.number().optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    host_user: z
      .object({
        id: z.object({
          open_id: z.string().optional(),
          user_id: z.string().optional(),
          union_id: z.string().optional(),
        }),
      })
      .optional(),
  }),
});

export type FeishuMeetingEndedEvent = z.infer<typeof FeishuMeetingEndedEventSchema>;

// 会议详情
export interface MeetingDetail {
  id: string;
  topic: string | null;
  startTime: string | null;
  endTime: string | null;
  hostUserId: string | null;
  participantCount: number;
  participants: MeetingParticipant[];
  transcriptDocToken: string | null;
  noteDocToken: string | null;
}

export interface MeetingParticipant {
  userId: string;
  userName: string | null;
  isHost: boolean;
  isExternal: boolean;
}

// 前置路由结果
export const PreRouteResultSchema = z.object({
  shouldSkip: z.boolean(),
  skipReason: z.string().optional(),
  extractedRequirements: z.string().optional(),
});

export type PreRouteResult = z.infer<typeof PreRouteResultSchema>;

// LLM 生成的会议纪要
export const MeetingMinutesSchema = z.object({
  title: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  decisions: z.array(z.string()).optional(),
  actionItems: z.array(
    z.object({
      task: z.string(),
      assignee: z.string().optional(),
    }),
  ).optional(),
});

export type MeetingMinutes = z.infer<typeof MeetingMinutesSchema>;

// 处理流水线上下文
export interface PipelineContext {
  meetingId: string;
  userId: string;
  userSettings: {
    autoEnabled: boolean;
    saveFolderToken: string | null;
    extraInstructions: string | null;
    activePromptVersionId: string | null;
  } | null;
  corePrompt: string | null;
}

// 处理结果
export interface ProcessResult {
  status: "completed" | "skipped" | "failed";
  meetingRecordId?: string;
  docUrl?: string;
  skippedReason?: string;
  errorMessage?: string;
}
