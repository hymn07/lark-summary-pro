import { db } from "@repo/database";
import type { FeishuMeetingEndedEvent, PipelineContext, ProcessResult } from "./types";
import { fetchMeetingDetail } from "./meeting-fetcher";
import { routeParticipants } from "./participant-router";
import { runPreRoute } from "./pre-router";
import { assemblePrompt } from "./prompt-assembler";
import { generateMinutes } from "./llm-generator";
import { createFeishuDoc } from "./doc-creator";

// 主入口：飞书事件 → 多份纪要
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
    log("Step 1 失败: 无法获取会议详情");
    await createProcessingLog(meetingId, "fetch_detail", "failed", "无法获取会议详情");
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

  // Step 2-6: 对每个用户独立处理
  for (const ctx of contexts) {
    const userLog = (msg: string) => log(`[用户${ctx.userId}] ${msg}`);
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

      // Step 5: 创建飞书文档
      userLog("Step 5: 创建飞书文档...");
      const docUrl = await createFeishuDoc(ctx, minutes);
      if (!docUrl) {
        userLog("Step 5 失败");
        await createMeetingRecord(ctx, detail, "failed", null, undefined, "文档创建失败");
        results.push({ status: "failed", errorMessage: "文档创建失败" });
        continue;
      }
      userLog(`Step 5 完成: ${docUrl}`);

      // Step 6: 记录成功
      const record = await createMeetingRecord(ctx, detail, "completed", docUrl);
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
