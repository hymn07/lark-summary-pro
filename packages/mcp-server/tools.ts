import { z } from "zod";
import { db } from "@repo/database";
import { learnFromSamples, getConfig, setConfig } from "@repo/lark-meeting";

// MCP Tool 注册表
// 每个 Tool 包含 name、description、inputSchema、handler
// description 最关键——Agent 靠它决定是否调用

export const tools = {
  // ── 会议纪要（只读）──

  get_meeting_record: {
    name: "get_meeting_record",
    description:
      "获取某次会议纪要的详细信息。当用户询问某次具体会议的纪要内容、处理状态或生成日志时调用。" +
      "需要会议纪要 ID。",
    inputSchema: z.object({ id: z.string() }),
    handler: async ({ id }: { id: string }) => {
      return db.meetingRecord.findUnique({
        where: { id },
        include: { processingLogs: { orderBy: { createdAt: "asc" } } },
      });
    },
  },

  list_meeting_records: {
    name: "list_meeting_records",
    description:
      "列出用户的会议纪要列表，支持按状态筛选和分页。当用户询问「最近生成了哪些纪要」「有哪些失败的」时调用。" +
      "可选参数：status（processing/completed/skipped/failed）、limit（默认20）、cursor（分页游标）。",
    inputSchema: z.object({
      status: z.enum(["processing", "completed", "skipped", "failed"]).optional(),
      limit: z.number().min(1).max(100).default(20),
      cursor: z.string().optional(),
    }),
    handler: async (input: { status?: string; limit?: number; cursor?: string }) => {
      const where: Record<string, unknown> = {};
      if (input.status) where.status = input.status;

      const records = await db.meetingRecord.findMany({
        where,
        take: (input.limit ?? 20) + 1,
        ...(input.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
        orderBy: { createdAt: "desc" },
      });

      const hasMore = records.length > (input.limit ?? 20);
      const data = hasMore ? records.slice(0, input.limit ?? 20) : records;

      return { data, hasMore, nextCursor: hasMore ? data[data.length - 1].id : undefined };
    },
  },

  retry_meeting_record: {
    name: "retry_meeting_record",
    description:
      "重试失败的会议纪要生成。当用户说「重新生成这个纪要」「再试一次」时调用。" +
      "只能重试状态为 failed 或 skipped 的记录。需要纪要 ID。",
    inputSchema: z.object({ id: z.string() }),
    handler: async ({ id }: { id: string }) => {
      const record = await db.meetingRecord.findUnique({ where: { id } });
      if (!record) throw new Error("纪要不存在");
      if (record.status !== "failed" && record.status !== "skipped") {
        throw new Error("只能重试失败或跳过的记录");
      }
      await db.meetingRecord.update({
        where: { id },
        data: { status: "processing", errorMessage: null },
      });
      return { success: true };
    },
  },

  // ── 用户设置 ──

  get_user_settings: {
    name: "get_user_settings",
    description:
      "获取用户当前的设置，包括自动纪要开关、保存位置、排除规则、特殊要求、活跃 Prompt 版本。" +
      "当用户询问「我的设置是什么」「当前用的什么风格」时调用。需要用户 ID。",
    inputSchema: z.object({ userId: z.string() }),
    handler: async ({ userId }: { userId: string }) => {
      return db.userSettings.findUnique({ where: { userId } });
    },
  },

  update_user_settings: {
    name: "update_user_settings",
    description:
      "更新用户设置。当用户说「开启/关闭自动纪要」「修改额外指令」「切换 Prompt 版本」时调用。" +
      "可以部分更新，只传要修改的字段。",
    inputSchema: z.object({
      userId: z.string(),
      autoEnabled: z.boolean().optional(),
      saveFolderToken: z.string().nullable().optional(),
      extraInstructions: z.string().nullable().optional(),
      activePromptVersionId: z.string().nullable().optional(),
    }),
    handler: async (input: {
      userId: string;
      autoEnabled?: boolean;
      saveFolderToken?: string | null;
      extraInstructions?: string | null;
      activePromptVersionId?: string | null;
    }) => {
      const { userId, ...data } = input;
      return db.userSettings.upsert({
        where: { userId },
        update: data,
        create: { userId, ...data },
      });
    },
  },

  // ── Prompt 版本 ──

  get_prompt_versions: {
    name: "get_prompt_versions",
    description:
      "获取用户的 Prompt 版本列表。当用户询问「有哪些风格版本」「当前用的什么 Prompt」时调用。" +
      "需要用户 ID。",
    inputSchema: z.object({ userId: z.string() }),
    handler: async ({ userId }: { userId: string }) => {
      return db.promptVersion.findMany({
        where: { createdById: userId },
        orderBy: { createdAt: "desc" },
      });
    },
  },

  create_prompt_from_samples: {
    name: "create_prompt_from_samples",
    description:
      "举一反三：从 1-3 篇示例会议纪要中学习风格，生成新的 Prompt 版本。" +
      "当用户说「学习这几篇纪要的风格」「根据这些样本生成 Prompt」时调用。" +
      "AI 会返回一个风格描述给用户确认，以及一个不可见的核心 Prompt。",
    inputSchema: z.object({
      userId: z.string(),
      name: z.string().min(1).max(100),
      sampleContents: z.array(z.string()).min(1).max(3),
    }),
    handler: async ({
      userId,
      name,
      sampleContents,
    }: {
      userId: string;
      name: string;
      sampleContents: string[];
    }) => {
      const { corePrompt, styleDescription } = await learnFromSamples(sampleContents);
      const version = await db.promptVersion.create({
        data: {
          name,
          corePrompt,
          styleDescription,
          createdById: userId,
          isActive: false,
        },
      });
      return { id: version.id, name, styleDescription };
    },
  },

  // ── 系统配置（仅管理员） ──

  get_system_config: {
    name: "get_system_config",
    description:
      "获取系统配置，包括成员接入模式、飞书应用 ID。当管理员询问「当前是开放模式还是审批模式」时调用。",
    inputSchema: z.object({}),
    handler: async () => {
      const [memberMode, feishuAppId] = await Promise.all([
        getConfig("member_access_mode"),
        getConfig("feishu_app_id"),
      ]);
      return { memberAccessMode: memberMode ?? "open", feishuAppId };
    },
  },
};

export type ToolName = keyof typeof tools;

export function getTool(name: ToolName) {
  return tools[name];
}

export function getAllTools() {
  return Object.values(tools);
}
