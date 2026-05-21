import { db } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { ORPCError } from "@orpc/server";

export const updateVersion = protectedProcedure
  .route({
    method: "PATCH",
    path: "/prompt-versions/:id",
    tags: ["Prompt Versions"],
    summary: "更新 Prompt 版本的名称和风格描述",
  })
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      styleDescription: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const existing = await db.promptVersion.findUnique({
      where: { id: input.id },
    });
    if (!existing) throw new ORPCError("NOT_FOUND");
    if (existing.createdById !== context.user.id) {
      throw new ORPCError("FORBIDDEN");
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.styleDescription !== undefined) data.styleDescription = input.styleDescription;

    return db.promptVersion.update({
      where: { id: input.id },
      data,
    });
  });
