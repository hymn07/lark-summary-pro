import { generateObject } from "ai";
import { z } from "zod";
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
    const result = await generateObject({
      model: await getFastModel(),
      schema: z.object({
        shouldSkip: z.boolean(),
        skipReason: z.string().optional(),
        extractedRequirements: z.string().optional(),
      }),
      prompt: `你是一个会议纪要的预处理器。根据用户的排除规则和特殊要求，判断是否需要跳过一个会议，并提取特殊需求。

会议信息：
- 标题：${detail.topic ?? "未知"}
- 参会人数：${detail.participantCount}
- 参会人：${detail.participants.map((p) => p.userName ?? p.userId).join("、")}

用户排除规则（命中任一即跳过）：
${settings.exclusionRules.map((r, i) => `${i + 1}. ${r}`).join("\n") || "无"}

用户特殊要求：
${settings.specialRequirements.map((r, i) => `${i + 1}. 话题：${r.topic} → 重点关注：${r.focus}`).join("\n") || "无"}

请判断：
1. 该会议是否命中排除规则？如果命中，说明原因
2. 如果没有排除，用户的特殊要求中有哪些与本次会议相关？提炼出应该注入到会议纪要 prompt 中的具体要求`,
    });
    return result.object;
  } catch {
    return { shouldSkip: false };
  }
}
