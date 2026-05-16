import { db } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";

export const listRecords = protectedProcedure
  .route({
    method: "GET",
    path: "/meeting-records",
    tags: ["Meeting Records"],
    summary: "会议纪要列表",
  })
  .input(
    z.object({
      status: z.enum(["processing", "completed", "skipped", "failed"]).optional(),
      limit: z.number().min(1).max(100).default(20),
      cursor: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const where: Record<string, unknown> = { userId: context.user.id };
    if (input.status) where.status = input.status;

    const records = await db.meetingRecord.findMany({
      where,
      take: input.limit + 1,
      ...(input.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
      orderBy: { createdAt: "desc" },
    });

    const hasMore = records.length > input.limit;
    const data = hasMore ? records.slice(0, input.limit) : records;

    return {
      data,
      hasMore,
      nextCursor: hasMore ? data[data.length - 1].id : undefined,
    };
  });
