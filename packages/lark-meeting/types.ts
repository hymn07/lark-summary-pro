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

// LLM 生成的会议纪要（增强版：10 维度结构化提取）
export const MeetingMinutesSchema = z.object({
  // ── 基础 ──
  title: z.string(),
  abstract: z.string().describe("2-3 句执行摘要"),
  summary: z.string().describe("完整摘要（向后兼容，等同于 abstract）"),

  // ── 分类标签（多标签，用于检索过滤）──
  categories: z.array(z.string()).optional().describe(
    '会议类型标签，如 ["投委会", "项目评审", "周会", "客户汇报", "生产例会"]',
  ),

  // ── 讨论要点 ──
  discussionPoints: z.array(z.object({
    topic: z.string().describe("议题名称"),
    summary: z.string().describe("讨论摘要"),
    speakers: z.array(z.string()).describe("发言人"),
    conclusion: z.string().optional().describe("阶段性结论"),
  })).optional().describe("结构化讨论要点"),

  // ── 向后兼容：旧版 keyPoints（从 discussionPoints 计算）──
  keyPoints: z.array(z.string()).describe("向后兼容字段，等同于 discussionPoints[].summary 的平铺"),

  // ── 实体（公司/项目/人/产品/文档等）──
  entities: z.array(z.object({
    name: z.string().describe("实体名称"),
    type: z.enum(["company", "project", "product", "person", "team", "event", "document", "other"]).describe("实体类型"),
    role: z.string().optional().describe("角色，如'被投企业'、'客户'、'供应商'、'竞品'"),
    mentions: z.string().optional().describe("在会议中如何被提及"),
    assessment: z.string().optional().describe("对该实体的评价/判断"),
  })).optional().describe("会议中提到的关键实体"),

  // ── 决策 ──
  decisions: z.array(z.object({
    decision: z.string().describe("决策内容"),
    decidedBy: z.string().optional().describe("决策人"),
    rationale: z.string().optional().describe("决策理由"),
    impact: z.string().optional().describe("决策影响"),
    status: z.enum(["proposed", "confirmed", "deferred", "rejected"]).optional().describe("决策状态"),
  })).optional().describe("会议中做出的决策"),

  // ── 行动项 ──
  actionItems: z.array(z.object({
    task: z.string().describe("任务内容"),
    owner: z.string().optional().describe("负责人"),
    deadline: z.string().optional().describe("截止日期"),
    priority: z.enum(["high", "medium", "low"]).optional().describe("优先级"),
    dependsOn: z.string().optional().describe("依赖项"),
  })).optional().describe("会议确定的行动项"),

  // ── 数据指标 ──
  metrics: z.array(z.object({
    name: z.string().describe("指标名称"),
    value: z.string().optional().describe("指标数值"),
    unit: z.string().optional().describe("单位"),
    trend: z.enum(["up", "down", "flat", "new"]).optional().describe("趋势方向"),
    comparison: z.string().optional().describe("对比描述，如'环比+5%'、'低于目标3pp'"),
    context: z.string().optional().describe("背景说明"),
  })).optional().describe("会议中讨论的关键数据指标"),

  // ── 风险/问题 ──
  risks: z.array(z.object({
    risk: z.string().describe("风险描述"),
    severity: z.enum(["critical", "high", "medium", "low"]).describe("严重程度"),
    status: z.enum(["identified", "mitigating", "resolved", "accepted"]).optional().describe("当前状态"),
    mitigation: z.string().optional().describe("缓解措施"),
    owner: z.string().optional().describe("负责人"),
  })).optional().describe("会议中识别的风险和问题"),

  // ── 关键引用 ──
  keyQuotes: z.array(z.object({
    quote: z.string().describe("引述原文"),
    speaker: z.string().optional().describe("说话人"),
    topic: z.string().optional().describe("所属话题"),
  })).optional().describe("会议中值得记录的关键发言"),

  // ── 情绪与判断 ──
  sentiment: z.object({
    overall: z.enum(["positive", "neutral", "negative", "mixed"]).describe("整体情绪"),
    highlights: z.array(z.string()).optional().describe("积极信号"),
    concerns: z.array(z.string()).optional().describe("担忧信号"),
  }).optional().describe("会议整体情绪和判断倾向"),

  // ── 后续关注 ──
  followUps: z.array(z.object({
    topic: z.string().describe("关注事项"),
    trigger: z.string().optional().describe("触发条件，如'下次周会'、'Q3财报后'"),
    owner: z.string().optional().describe("负责人"),
  })).optional().describe("需要在后续会议或特定时间点跟进的事项"),

  // ── 关键词（全文检索优化）──
  keywords: z.array(z.string()).optional().describe(
    "会议核心关键词，用于搜索优化。覆盖实体名、话题、关键术语、缩写等",
  ),
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
