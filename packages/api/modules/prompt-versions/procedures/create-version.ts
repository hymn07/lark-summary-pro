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
      sampleContents: z.array(z.string()).min(1).max(3),
    }),
  )
  .handler(async ({ input, context }) => {
    const { corePrompt, styleDescription } = await learnFromSamples(
      input.sampleContents,
    );

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
