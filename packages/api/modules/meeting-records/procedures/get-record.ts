import { db } from "@repo/database";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { protectedProcedure } from "../../../orpc/procedures";

export const getRecord = protectedProcedure
  .route({
    method: "GET",
    path: "/meeting-records/:id",
    tags: ["Meeting Records"],
    summary: "会议纪要详情",
  })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const record = await db.meetingRecord.findUnique({
      where: { id: input.id },
      include: { processingLogs: { orderBy: { createdAt: "asc" } } },
    });
    if (!record) throw new ORPCError("NOT_FOUND");
    if (record.userId !== context.user.id) throw new ORPCError("FORBIDDEN");
    return record;
  });
