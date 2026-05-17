import { generateText } from "ai";
import type { MeetingDetail, PipelineContext, PreRouteResult } from "./types";
import { getFastModel } from "./model-factory";

// 前置路由：用小模型判断是否需要跳过 + 提取重点关注内容
export async function runPreRoute(
  detail: MeetingDetail,
  ctx: PipelineContext,
): Promise<PreRouteResult> {
  const instructions = ctx.userSettings?.extraInstructions;
  if (!instructions?.trim()) {
    return { shouldSkip: false, extractedRequirements: undefined };
  }

  try {
    const { text } = await generateText({
      model: await getFastModel(),
      prompt: `你是一个会议纪要的预处理器。根据用户的额外指令，判断本次会议是否需要跳过（不生成纪要），以及需要重点关注什么内容。

会议信息：
- 标题：${detail.topic ?? "未知"}
- 参会人数：${detail.participantCount}
- 参会人：${detail.participants.map((p) => p.userName ?? p.userId).join("、")}

用户额外指令（自由文本，可能包含排除规则和/或重点关注要求）：
${instructions}

请只输出一个 JSON 对象（不要其他文字）：
{"shouldSkip": true/false, "skipReason": "跳过原因（如果跳过）", "extractedRequirements": "提取出的重点关注内容（如果不跳过，提取相关部分）"}`,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { shouldSkip: false };

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      shouldSkip: parsed.shouldSkip === true,
      skipReason: parsed.skipReason,
      extractedRequirements: parsed.extractedRequirements,
    };
  } catch {
    return { shouldSkip: false };
  }
}
