import { generateText } from "ai";
import type { MeetingDetail, PipelineContext, PreRouteResult } from "./types";
import { getFastModel } from "./model-factory";

// 前置路由：用小模型判断排除规则 + 提取特殊要求
export async function runPreRoute(
  detail: MeetingDetail,
  ctx: PipelineContext,
): Promise<PreRouteResult> {
  const settings = ctx.userSettings;
  if (!settings || (settings.exclusionRules.length === 0 && settings.specialRequirements.length === 0)) {
    return { shouldSkip: false };
  }

  try {
    const { text } = await generateText({
      model: await getFastModel(),
      prompt: `你是一个会议纪要的预处理器。请判断会议是否需要跳过，以及有什么特殊要求。

会议信息：
- 标题：${detail.topic ?? "未知"}
- 参会人数：${detail.participantCount}
- 参会人：${detail.participants.map((p) => p.userName ?? p.userId).join("、")}

用户排除规则（命中任一即跳过）：
${settings.exclusionRules.map((r, i) => `${i + 1}. ${r}`).join("\n") || "无"}

用户特殊要求：
${settings.specialRequirements.map((r, i) => `${i + 1}. 话题：${r.topic} → 重点关注：${r.focus}`).join("\n") || "无"}

请只输出一个 JSON 对象（不要其他文字）：
{"shouldSkip": true/false, "skipReason": "跳过原因（如果跳过）", "extractedRequirements": "提取出的特殊要求（如果不跳过）"}`,
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
