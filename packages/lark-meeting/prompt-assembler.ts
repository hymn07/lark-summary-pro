import type { PipelineContext } from "./types";

// 组装最终的 Prompt：核心 Prompt + 用户特殊要求 + 输出格式要求
export async function assemblePrompt(
  ctx: PipelineContext,
  extractedRequirements?: string,
): Promise<string> {
  const parts: string[] = [];

  // 1. 核心 Prompt（用户版本 或 管理员默认版本）
  if (ctx.corePrompt) {
    parts.push(ctx.corePrompt);
  } else {
    parts.push(DEFAULT_CORE_PROMPT);
  }

  // 2. 用户特殊要求（来自前置路由提取）
  if (extractedRequirements) {
    parts.push(`\n## 本次会议的特殊要求\n${extractedRequirements}`);
  }

  // 3. 输出格式要求
  parts.push(OUTPUT_FORMAT_REQUIREMENT);

  return parts.join("\n");
}

// 系统默认的会议纪要生成 Prompt
const DEFAULT_CORE_PROMPT = `你是一个专业的会议纪要助手。根据会议逐字稿，生成结构化的会议纪要。

要求：
- 用中文撰写
- 客观、准确，不添加原文没有的信息
- 对口语化的表达进行适当精炼
- 按主题分组，而非按发言时间顺序组织`;

const OUTPUT_FORMAT_REQUIREMENT = `\n## 输出格式
请按以下 JSON 格式输出：
{
  "title": "会议标题",
  "summary": "2-3句话概括会议内容和结论",
  "keyPoints": ["要点1", "要点2", ...],
  "decisions": ["决策1", "决策2", ...],
  "actionItems": [{"task": "待办事项", "assignee": "负责人（如有）"}, ...]
}`;
