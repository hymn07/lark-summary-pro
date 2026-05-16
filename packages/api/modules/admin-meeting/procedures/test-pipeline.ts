import { handleMeetingEnded } from "@repo/lark-meeting";
import { runMockPipeline } from "@repo/lark-meeting/mock-pipeline";
import { z } from "zod";
import { adminProcedure } from "../../../orpc/procedures";

export const testPipeline = adminProcedure
  .route({
    method: "POST",
    path: "/admin/test-pipeline",
    tags: ["Admin - Test"],
    summary: "模拟会议结束事件，测试完整流水线",
  })
  .input(
    z.object({
      meetingId: z.string().min(1).describe("飞书会议 ID（输入 mock 使用模拟数据）"),
      topic: z.string().optional().describe("会议主题"),
    }),
  )
  .handler(async ({ input }) => {
    // mock 模式：跳过飞书 API，使用内置模拟数据
    if (input.meetingId === "mock") {
      const result = await runMockPipeline(input.topic ?? "测试会议");
      return { mode: "mock", ...result };
    }

    // 真实模式：调用飞书 API
    const mockEvent = {
      meeting: {
        id: input.meetingId,
        topic: input.topic ?? "测试会议",
        meetingSource: 1,
        startTime: String(Math.floor(Date.now() / 1000) - 1800),
        endTime: String(Math.floor(Date.now() / 1000)),
      },
    };

    const results = await handleMeetingEnded(mockEvent);
    return { mode: "live", message: "流水线已执行", results };
  });
