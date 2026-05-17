import { db } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";

export const updateSettings = protectedProcedure
  .route({
    method: "PATCH",
    path: "/settings",
    tags: ["Settings"],
    summary: "更新用户设置",
  })
  .input(
    z.object({
      autoEnabled: z.boolean().optional(),
      saveFolderToken: z.string().nullable().optional(),
      extraInstructions: z.string().nullable().optional(),
      activePromptVersionId: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    return db.userSettings.upsert({
      where: { userId: context.user.id },
      update: input,
      create: { userId: context.user.id, ...input },
    });
  });
