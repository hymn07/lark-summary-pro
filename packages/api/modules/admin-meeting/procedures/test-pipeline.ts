import { handleMeetingEnded } from "@repo/lark-meeting";
import { z } from "zod";
import { adminProcedure } from "../../../orpc/procedures";

// 测试端点：模拟一个飞书会议结束事件，触发完整流水线
export const testPipeline = adminProcedure
  .route({
    method: "POST",
    path: "/admin/test-pipeline",
    tags: ["Admin - Test"],
    summary: "模拟会议结束事件，测试完整流水线",
  })
  .input(
    z.object({
      meetingId: z.string().min(1).describe("飞书会议 ID"),
      topic: z.string().optional().describe("会议主题"),
    }),
  )
  .handler(async ({ input }) => {
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
    return { message: "流水线已执行", results };
  });
