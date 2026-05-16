import { db, encryptField } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { learnFromSamples } from "@repo/lark-meeting";

export const createVersion = protectedProcedure
  .route({
    method: "POST",
    path: "/prompt-versions",
    tags: ["Prompt Versions"],
    summary: "创建新的 Prompt 版本（含举一反三）",
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
      corePrompt = input.corePrompt;
      styleDescription = input.styleDescription ?? null;
    } else if (input.sampleContents?.length) {
      const result = await learnFromSamples(input.sampleContents);
      corePrompt = result.corePrompt;
      styleDescription = result.styleDescription;
    } else {
      throw new Error("请提供 sampleContents（AI 学习）或 corePrompt（手动编写）");
    }

    return db.promptVersion.create({
      data: {
        name: input.name,
        corePrompt: encryptField(corePrompt),
        styleDescription,
        createdById: context.user.id,
        isActive: false,
      },
    });
  });
