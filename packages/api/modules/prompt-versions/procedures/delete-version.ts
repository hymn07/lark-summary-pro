import { db } from "@repo/database";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { protectedProcedure } from "../../../orpc/procedures";

export const deleteVersion = protectedProcedure
  .route({
    method: "DELETE",
    path: "/prompt-versions/:id",
    tags: ["Prompt Versions"],
    summary: "删除 Prompt 版本",
  })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const version = await db.promptVersion.findUnique({
      where: { id: input.id },
    });
    if (!version) throw new ORPCError("NOT_FOUND");
    if (version.createdById !== context.user.id) throw new ORPCError("FORBIDDEN");

    await db.promptVersion.delete({ where: { id: input.id } });
    return { success: true };
  });
