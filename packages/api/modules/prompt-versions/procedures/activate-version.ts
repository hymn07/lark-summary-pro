import { db } from "@repo/database";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { protectedProcedure } from "../../../orpc/procedures";

export const activateVersion = protectedProcedure
  .route({
    method: "PATCH",
    path: "/prompt-versions/:id/activate",
    tags: ["Prompt Versions"],
    summary: "激活某个 Prompt 版本",
  })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const version = await db.promptVersion.findUnique({
      where: { id: input.id },
    });
    if (!version) throw new ORPCError("NOT_FOUND");
    if (version.createdById !== context.user.id) throw new ORPCError("FORBIDDEN");

    // 取消用户所有版本的活跃状态
    await db.promptVersion.updateMany({
      where: { createdById: context.user.id, isActive: true },
      data: { isActive: false },
    });
    // 激活目标版本
    await db.promptVersion.update({
      where: { id: input.id },
      data: { isActive: true },
    });

    // 同步更新 UserSettings
    await db.userSettings.upsert({
      where: { userId: context.user.id },
      update: { activePromptVersionId: input.id },
      create: { userId: context.user.id, activePromptVersionId: input.id },
    });

    return { success: true };
  });
