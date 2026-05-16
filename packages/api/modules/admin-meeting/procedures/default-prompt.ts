import { db, encryptField } from "@repo/database";
import { z } from "zod";
import { adminProcedure } from "../../../orpc/procedures";
import { learnFromSamples } from "@repo/lark-meeting";

export const getDefaultPrompt = adminProcedure
  .route({
    method: "GET",
    path: "/admin/default-prompt",
    tags: ["Admin - Prompt"],
    summary: "获取默认 Prompt",
  })
  .handler(async () => {
    return db.promptVersion.findFirst({
      where: { isDefault: true },
      orderBy: { createdAt: "desc" },
    });
  });

export const setDefaultPrompt = adminProcedure
  .route({
    method: "POST",
    path: "/admin/default-prompt",
    tags: ["Admin - Prompt"],
    summary: "设置默认 Prompt（含举一反三）",
  })
  .input(
    z.object({
      name: z.string().min(1).max(100),
      sampleContents: z.array(z.string()).min(1).max(3),
    }),
  )
  .handler(async ({ input, context }) => {
    const { corePrompt, styleDescription } = await learnFromSamples(
      input.sampleContents,
    );

    // 取消旧默认
    await db.promptVersion.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });

    return db.promptVersion.create({
      data: {
        name: input.name,
        corePrompt: encryptField(corePrompt),
        styleDescription,
        createdById: context.user.id,
        isDefault: true,
        isActive: true,
      },
    });
  });
