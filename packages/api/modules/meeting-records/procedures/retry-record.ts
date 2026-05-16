import { db } from "@repo/database";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { protectedProcedure } from "../../../orpc/procedures";

export const retryRecord = protectedProcedure
  .route({
    method: "POST",
    path: "/meeting-records/:id/retry",
    tags: ["Meeting Records"],
    summary: "重试失败的纪要生成",
  })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const record = await db.meetingRecord.findUnique({
      where: { id: input.id },
    });
    if (!record) throw new ORPCError("NOT_FOUND");
    if (record.userId !== context.user.id) throw new ORPCError("FORBIDDEN");
    if (record.status !== "failed" && record.status !== "skipped") {
      throw new ORPCError("BAD_REQUEST", { message: "只能重试失败或跳过的记录" });
    }

    await db.meetingRecord.update({
      where: { id: input.id },
      data: { status: "processing", errorMessage: null },
    });

    return { success: true };
  });
