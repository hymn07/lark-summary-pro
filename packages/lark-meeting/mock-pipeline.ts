// Mock 流水线测试 — 跳过飞书 API，直接测试 LLM 生成 → 文档创建
import { db } from "@repo/database";
import type { MeetingDetail, MeetingParticipant, PipelineContext } from "./types";
import { runPreRoute } from "./pre-router";
import { assemblePrompt } from "./prompt-assembler";
import { generateMinutes } from "./llm-generator";

// 模拟会议数据
function mockMeetingDetail(topic: string): MeetingDetail {
  const mockParticipant: MeetingParticipant = {
    userId: "mock-user-001",
    userName: "测试用户",
    isHost: true,
    isExternal: false,
  };
  return {
    id: `mock-${Date.now()}`,
    topic,
    startTime: String(Math.floor(Date.now() / 1000) - 1800),
    endTime: String(Math.floor(Date.now() / 1000)),
    hostUserId: "mock-user-001",
    participantCount: 3,
    participants: [
      mockParticipant,
      { userId: "mock-user-002", userName: "张三", isHost: false, isExternal: false },
      { userId: "mock-user-003", userName: "李四", isHost: false, isExternal: false },
    ],
    transcriptDocToken: null,
  };
}

// 模拟逐字稿
const MOCK_TRANSCRIPT = `主持人：大家好，今天我们讨论一下Q2的产品规划。
张三：我觉得我们应该优先做移动端适配，用户反馈很多了。
李四：移动端确实重要，但后端稳定性也需要投入，最近线上出了几次问题。
主持人：这两个都很重要，我们看看资源怎么分配。张三你先整理一下移动端的需求清单，李四你负责排查最近线上的问题。
张三：好的，我本周五之前整理出来。
李四：没问题，我先梳理一下近两周的 incident。`;

export async function runMockPipeline(topic: string) {
  const detail = mockMeetingDetail(topic || "测试会议");
  console.log(`[MockPipeline] 开始模拟测试: ${detail.topic}`);
  console.log(`[MockPipeline] 参会${detail.participantCount}人，逐字稿${MOCK_TRANSCRIPT.length}字`);

  // 构建 mock context
  const ctx: PipelineContext = {
    meetingId: detail.id,
    userId: "mock-user-001",
    userSettings: {
      autoEnabled: true,
      saveFolderToken: null,
      exclusionRules: [],
      specialRequirements: [],
      activePromptVersionId: null,
    },
    corePrompt: null, // 用默认 Prompt
  };

  try {
    // Step 2: 前置路由
    console.log("[MockPipeline] Step 2: 前置路由...");
    const preRoute = await runPreRoute(detail, ctx);
    if (preRoute.shouldSkip) {
      return { status: "skipped", reason: preRoute.skipReason };
    }
    console.log("[MockPipeline] Step 2 完成");

    // Step 3: Prompt 组装
    console.log("[MockPipeline] Step 3: Prompt 组装...");
    const prompt = await assemblePrompt(ctx, preRoute.extractedRequirements);
    console.log("[MockPipeline] Step 3 完成");

    // Step 4: LLM 生成（用 mock 逐字稿替代飞书逐字稿）
    console.log("[MockPipeline] Step 4: LLM 生成...");
    // 临时替换 transcriptDocToken 以使用 mock 逐字稿
    const detailWithTranscript = { ...detail, transcriptDocToken: "mock-transcript" };
    const minutes = await generateMinutes(detailWithTranscript, prompt, MOCK_TRANSCRIPT);
    if (!minutes) {
      return { status: "failed", error: "LLM 生成失败" };
    }
    console.log(`[MockPipeline] Step 4 完成: ${JSON.stringify(minutes, null, 2)}`);

    return { status: "completed", minutes };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "未知错误";
    console.error(`[MockPipeline] 失败:`, msg);
    return { status: "failed", error: msg };
  }
}
