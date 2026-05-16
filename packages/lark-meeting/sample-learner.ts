import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";

// 举一反三：从 1-3 篇示例纪要中学习风格，生成核心 Prompt
export async function learnFromSamples(
  samples: string[],
): Promise<{ corePrompt: string; styleDescription: string }> {
  const sampleTexts = samples.map((s, i) => `### 示例 ${i + 1}\n${s}`).join("\n\n---\n\n");

  const result = await generateObject({
    model: await getTextModel(),
    schema: z.object({
      styleDescription: z.string().describe("用户会议纪要的风格描述，2-3句话，中文"),
      corePrompt: z
        .string()
        .describe(
          "一个完整的 System Prompt，告诉 AI 如何按照用户风格生成会议纪要。" +
            "包含：输出风格（简洁/详尽）、组织方式（按主题/按时间）、重点偏好、格式要求。" +
            "用中文撰写。",
        ),
    }),
    prompt: `你是一个 AI Prompt 工程师。用户提供了 ${samples.length} 篇他们满意的会议纪要作为参考。

请分析这些样本的写作风格，生成两样东西：
1. 一个简短的风格描述（给用户看的，让他们知道这是什么风格）
2. 一个完整的 System Prompt（给 AI 用的，用户看不到），让 AI 以后按这个风格生成会议纪要

样本：
${sampleTexts}`,
  });

  return {
    corePrompt: result.object.corePrompt,
    styleDescription: result.object.styleDescription,
  };
}

async function getTextModel(): Promise<LanguageModel> {
  // TODO: 从 SystemConfig 读取模型提供商配置
  throw new Error("模型未配置：请在管理后台添加 LLM 提供商");
}
