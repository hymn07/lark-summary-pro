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
      sampleContents: z.array(z.string()).min(1).max(3).optional(),
      corePrompt: z.string().optional(),
      styleDescription: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    let corePrompt: string;
    let styleDescription: string | null;

    if (input.corePrompt) {
      // 手动模式
      corePrompt = input.corePrompt;
      styleDescription = input.styleDescription ?? null;
    } else if (input.sampleContents?.length) {
      // AI 学习模式
      const result = await learnFromSamples(input.sampleContents);
      corePrompt = result.corePrompt;
      styleDescription = result.styleDescription;
    } else {
      throw new Error("请提供 sampleContents（AI 学习）或 corePrompt（手动编写）");
    }

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
