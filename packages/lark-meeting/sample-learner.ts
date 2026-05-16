import { generateText } from "ai";
import { getTextModel } from "./model-factory";

// 举一反三：从 1-3 篇示例纪要中学习风格，生成核心 Prompt
export async function learnFromSamples(
  samples: string[],
): Promise<{ corePrompt: string; styleDescription: string }> {
  const sampleTexts = samples.map((s, i) => `### 示例 ${i + 1}\n${s}`).join("\n\n---\n\n");

  const { text } = await generateText({
    model: await getTextModel(),
    prompt: `你是一个 AI Prompt 工程师。用户提供了 ${samples.length} 篇他们满意的会议纪要作为参考。

请分析这些样本的写作风格，输出一个 JSON 对象（只输出 JSON）：
{
  "styleDescription": "风格描述，2-3句话，中文，给用户看的",
  "corePrompt": "完整的 System Prompt，告诉 AI 如何按用户风格生成会议纪要。包含：输出风格（简洁/详尽）、组织方式（按主题/按时间）、重点偏好、格式要求。用中文撰写。"
}

样本：
${sampleTexts}`,
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI 未返回有效 JSON");

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    corePrompt: parsed.corePrompt || "",
    styleDescription: parsed.styleDescription || "",
  };
}
