import { db, decryptField } from "@repo/database";
import type { FeishuMeetingEndedEvent, PipelineContext, ProcessResult } from "./types";
import { fetchMeetingDetail } from "./meeting-fetcher";
import { routeParticipants } from "./participant-router";
import { runPreRoute } from "./pre-router";
import { assemblePrompt } from "./prompt-assembler";
import { generateMinutes } from "./llm-generator";
import { createFeishuDoc } from "./doc-creator";

// 手动生成：指定用户在指定会议直接生成纪要（不经过参会人路由）
export async function generateForUser(
  meetingId: string,
  userId: string,
): Promise<ProcessResult> {
  const log = (msg: string) => console.log(`[ManualPipeline ${meetingId}] ${msg}`);

  log("获取会议详情...");
  const detail = await fetchMeetingDetail(meetingId);
  if (!detail) {
    return { status: "failed", errorMessage: "无法获取会议详情" };
  }

  // 构建当前用户的上下文
  const settings = await db.userSettings.findUnique({ where: { userId } });
  if (!settings || !settings.autoEnabled) {
    return { status: "skipped", skippedReason: "未开启自动纪要" };
  }

  let corePrompt: string | null = null;
  if (settings.activePromptVersionId) {
    const version = await db.promptVersion.findUnique({
      where: { id: settings.activePromptVersionId },
    });
    corePrompt = version?.corePrompt ? decryptField(version.corePrompt) : null;
  }
  if (!corePrompt) {
    const defaultVersion = await db.promptVersion.findFirst({
      where: { isDefault: true },
      orderBy: { createdAt: "desc" },
    });
    corePrompt = defaultVersion?.corePrompt ? decryptField(defaultVersion.corePrompt) : null;
  }

  const ctx: PipelineContext = {
    meetingId: detail.id,
    userId,
    userSettings: {
      autoEnabled: settings.autoEnabled,
      saveFolderToken: settings.saveFolderToken,
      extraInstructions: settings.extraInstructions ?? null,
      activePromptVersionId: settings.activePromptVersionId,
    },
    corePrompt,
  };

  try {
    // Step 2: 前置路由
    log("前置路由...");
    const preRoute = await runPreRoute(detail, ctx);
    if (preRoute.shouldSkip) {
      const record = await createMeetingRecord(ctx, detail, "skipped", null, preRoute.skipReason);
      return { status: "skipped", meetingRecordId: record.id, skippedReason: preRoute.skipReason };
    }

    // Step 3: Prompt 组装
    log("Prompt 组装...");
    const prompt = await assemblePrompt(ctx, preRoute.extractedRequirements);

    // Step 4: LLM 生成
    log("LLM 生成...");
    const minutes = await generateMinutes(detail, prompt);
    if (!minutes) {
      await createMeetingRecord(ctx, detail, "failed", null, undefined, "LLM 生成失败");
      return { status: "failed", errorMessage: "LLM 生成失败" };
    }
    log(`LLM 完成: ${minutes.title}`);

    // Step 5: 创建飞书文档（用 user token）
    log("创建飞书文档...");
    const docUrl = await createFeishuDoc(ctx, minutes, userId);
    if (!docUrl) {
      await createMeetingRecord(ctx, detail, "failed", null, undefined, "文档创建失败");
      return { status: "failed", errorMessage: "文档创建失败" };
    }
    log(`文档创建: ${docUrl}`);

    // Step 6: 记录成功
    const record = await createMeetingRecord(ctx, detail, "completed", docUrl, undefined, undefined, minutes.summary);
    await createProcessingLog(record.id, "completed", "success", "纪要生成成功");
    return { status: "completed", meetingRecordId: record.id, docUrl };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    log(`处理失败: ${errorMessage}`);
    await createMeetingRecord(ctx, detail, "failed", null, undefined, errorMessage);
    return { status: "failed", errorMessage };
  }
}

// 主入口：飞书事件 → 多份纪要（自动触发）
export async function handleMeetingEnded(
  event: FeishuMeetingEndedEvent,
): Promise<ProcessResult[]> {
  const meetingId = event.meeting.id;
  const results: ProcessResult[] = [];

  const log = (msg: string) => console.log(`[Pipeline ${meetingId}] ${msg}`);

  log(`收到事件: ${event.meeting.topic}`);

  // Step 1: 获取会议详情
  log("Step 1: 获取会议详情...");
  const detail = await fetchMeetingDetail(meetingId);
  if (!detail) {
    log("Step 1 失败: 无法获取会议详情（会议可能不存在或未开启妙记）");
    return [];
  }
  log(`Step 1 成功: 参会${detail.participantCount}人`);

  // 非本企业会议 → 跳过
  if (event.meeting.meetingSource !== 1) {
    log(`跳过: meetingSource=${event.meeting.meetingSource}`);
    return [];
  }

  // Step 1.5: 参会人路由
  log("Step 1.5: 参会人路由...");
  const contexts = await routeParticipants(detail);
  if (contexts.length === 0) {
    log("Step 1.5: 无匹配的内部用户");
    return [];
  }
  log(`Step 1.5 成功: 匹配到 ${contexts.length} 个用户`);

  // 拆分用户：批量组（默认模板+无额外指令）vs 个性组（其余）
  const batchGroup = contexts.filter(
    (c) => !c.userSettings?.activePromptVersionId && !c.userSettings?.extraInstructions?.trim(),
  );
  const individualGroup = contexts.filter(
    (c) => c.userSettings?.activePromptVersionId || c.userSettings?.extraInstructions?.trim(),
  );

  // 批量组：共享 1 次 LLM，每人各建一份文档（省 LLM 成本，文档隔离）
  if (batchGroup.length > 0) {
    log(`批量组: ${batchGroup.length} 人（默认模板+无额外指令）→ 共享 1 次 LLM`);
    const batchCtx = batchGroup[0];
    try {
      // 用默认模板组装 Prompt（无需前置路由，无额外指令）
      const prompt = await assemblePrompt(batchCtx);
      const minutes = await generateMinutes(detail, prompt);

      if (!minutes) {
        log("批量 LLM 生成失败");
        for (const ctx of batchGroup) {
          const record = await createMeetingRecord(ctx, detail, "failed", null, undefined, "LLM 生成失败");
          results.push({ status: "failed", meetingRecordId: record.id, errorMessage: "LLM 生成失败" });
        }
      } else {
        log(`批量 LLM 完成: ${minutes.title}`);
        // 给每人各建一份文档 + 协作者
        for (const ctx of batchGroup) {
          const userLog = (msg: string) => log(`[批量/用户${ctx.userId}] ${msg}`);
          const docUrl = await createFeishuDoc(ctx, minutes, ctx.userId);
          if (!docUrl) {
            userLog("文档创建失败");
            const record = await createMeetingRecord(ctx, detail, "failed", null, undefined, "文档创建失败");
            results.push({ status: "failed", meetingRecordId: record.id, errorMessage: "文档创建失败" });
            continue;
          }
          userLog(`文档创建: ${docUrl}`);
          const record = await createMeetingRecord(ctx, detail, "completed", docUrl, undefined, undefined, minutes.summary);
          results.push({ status: "completed", meetingRecordId: record.id, docUrl });
          await createProcessingLog(record.id, "completed", "success", "纪要生成成功（批量）");
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      log(`批量处理失败: ${errorMessage}`);
      for (const ctx of batchGroup) {
        await createMeetingRecord(ctx, detail, "failed", null, undefined, errorMessage);
        results.push({ status: "failed", errorMessage });
      }
    }
  }

  // 个性组：每人独立处理（不同模板或有个性指令）
  for (const ctx of individualGroup) {
    const userLog = (msg: string) => log(`[个性/用户${ctx.userId}] ${msg}`);
    try {
      // Step 2: 前置路由
      userLog("Step 2: 前置路由...");
      const preRoute = await runPreRoute(detail, ctx);
      if (preRoute.shouldSkip) {
        userLog(`跳过: ${preRoute.skipReason}`);
        const record = await createMeetingRecord(ctx, detail, "skipped", null, preRoute.skipReason);
        results.push({ status: "skipped", meetingRecordId: record.id, skippedReason: preRoute.skipReason });
        continue;
      }
      userLog("Step 2 完成");

      // Step 3: Prompt 组装
      userLog("Step 3: Prompt 组装...");
      const prompt = await assemblePrompt(ctx, preRoute.extractedRequirements);
      userLog("Step 3 完成");

      // Step 4: LLM 生成
      userLog("Step 4: LLM 生成...");
      const minutes = await generateMinutes(detail, prompt);
      if (!minutes) {
        userLog("Step 4 失败");
        await createMeetingRecord(ctx, detail, "failed", null, undefined, "LLM 生成失败");
        results.push({ status: "failed", errorMessage: "LLM 生成失败" });
        continue;
      }
      userLog(`Step 4 完成: ${minutes.title}`);

      // Step 5: 创建飞书文档（tenant token + 协作者）
      userLog("Step 5: 创建飞书文档...");
      const docUrl = await createFeishuDoc(ctx, minutes, ctx.userId);
      if (!docUrl) {
        userLog("Step 5 失败");
        await createMeetingRecord(ctx, detail, "failed", null, undefined, "文档创建失败");
        results.push({ status: "failed", errorMessage: "文档创建失败" });
        continue;
      }
      userLog(`Step 5 完成: ${docUrl}`);

      // Step 6: 记录成功
      const record = await createMeetingRecord(ctx, detail, "completed", docUrl, undefined, undefined, minutes.summary);
      results.push({ status: "completed", meetingRecordId: record.id, docUrl });
      userLog("Step 6 完成: 纪要已保存");

      await createProcessingLog(record.id, "completed", "success", "纪要生成成功");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      log(`处理失败: ${errorMessage}`);
      await createMeetingRecord(ctx, detail, "failed", null, undefined, errorMessage);
      results.push({ status: "failed", errorMessage });
    }
  }
  log(`完成: ${results.length} 条结果`);

  return results;
}

async function createMeetingRecord(
  ctx: PipelineContext,
  detail: { topic: string | null; startTime: string | null; endTime: string | null; hostUserId: string | null; participantCount: number },
  status: "completed" | "skipped" | "failed",
  docUrl: string | null,
  skippedReason?: string,
  errorMessage?: string,
  aiSummary?: string,
) {
  return db.meetingRecord.create({
    data: {
      meetingId: ctx.meetingId,
      topic: detail.topic,
      startTime: detail.startTime ? new Date(Number(detail.startTime) * 1000) : null,
      endTime: detail.endTime ? new Date(Number(detail.endTime) * 1000) : null,
      hostUserId: detail.hostUserId,
      participantCount: detail.participantCount,
      status,
      userId: ctx.userId,
      promptVersionId: ctx.corePrompt ? ctx.userSettings?.activePromptVersionId : null,
      docUrl,
      aiSummary,
      skippedReason,
      errorMessage,
    },
  });
}

async function createProcessingLog(
  recordIdOrMeetingId: string,
  step: string,
  status: string,
  detail?: string,
) {
  return db.processingLog.create({
    data: {
      meetingRecordId: recordIdOrMeetingId,
      step,
      status,
      detail,
    },
  });
}
