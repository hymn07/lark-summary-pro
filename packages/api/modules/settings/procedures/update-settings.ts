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
      exclusionRules: z.array(z.string()).optional(),
      specialRequirements: z
        .array(z.object({ topic: z.string(), focus: z.string() }))
        .optional(),
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
