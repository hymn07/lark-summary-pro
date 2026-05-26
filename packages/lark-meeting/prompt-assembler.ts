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
- 按主题分组，而非按发言时间顺序组织
- 识别会议中提到的所有实体（公司、项目、产品、人名、团队等），并判断对其的评价
- 提取所有量化指标和数据，标注趋势方向
- 标记风险和问题，评估严重程度
- 记录关键发言的直接引用
- 判断会议整体情绪和分歧点
- 标注需要后续关注的事项和触发条件`;

const OUTPUT_FORMAT_REQUIREMENT = `\n## 输出格式
请按以下 JSON 格式输出（只输出 JSON，不得包含其他文字）：

{
  "title": "会议标题",
  "abstract": "2-3句话执行摘要",
  "summary": "完整摘要，等同于 abstract",
  "categories": ["会议类型标签，如'周会','项目评审','投委会','客户汇报'等，可多个"],
  "discussionPoints": [
    {
      "topic": "议题名称",
      "summary": "讨论内容摘要",
      "speakers": ["发言人名1", "发言人名2"],
      "conclusion": "阶段性结论（如有）"
    }
  ],
  "keyPoints": ["要点1", "要点2"],
  "entities": [
    {
      "name": "实体名称",
      "type": "company|project|product|person|team|event|document|other",
      "role": "角色描述，如'被投企业''客户''供应商''竞品'（可选）",
      "mentions": "如何被提及（可选）",
      "assessment": "对该实体的评价/判断（可选）"
    }
  ],
  "decisions": [
    {
      "decision": "决策内容",
      "decidedBy": "决策人（可选）",
      "rationale": "决策理由（可选）",
      "impact": "决策影响（可选）",
      "status": "proposed|confirmed|deferred|rejected（可选）"
    }
  ],
  "actionItems": [
    {
      "task": "任务内容",
      "owner": "负责人（可选）",
      "deadline": "截止日期（可选）",
      "priority": "high|medium|low（可选）",
      "dependsOn": "依赖项（可选）"
    }
  ],
  "metrics": [
    {
      "name": "指标名称",
      "value": "数值（可选）",
      "unit": "单位（可选）",
      "trend": "up|down|flat|new（可选）",
      "comparison": "对比描述，如'环比+5%'（可选）",
      "context": "背景说明（可选）"
    }
  ],
  "risks": [
    {
      "risk": "风险描述",
      "severity": "critical|high|medium|low",
      "status": "identified|mitigating|resolved|accepted（可选）",
      "mitigation": "缓解措施（可选）",
      "owner": "负责人（可选）"
    }
  ],
  "keyQuotes": [
    {
      "quote": "引述原文",
      "speaker": "说话人（可选）",
      "topic": "所属话题（可选）"
    }
  ],
  "sentiment": {
    "overall": "positive|neutral|negative|mixed",
    "highlights": ["积极信号（可选）"],
    "concerns": ["担忧信号（可选）"]
  },
  "followUps": [
    {
      "topic": "关注事项",
      "trigger": "触发条件，如'下次周会''Q3财报后'（可选）",
      "owner": "负责人（可选）"
    }
  ],
  "keywords": ["关键词1", "关键词2"]
}

注意：
- 空数组用 []，空字符串用 ""，不要用 null
- entities.type 必须从给定枚举中选择
- 只输出有实际内容的字段，如果某字段确实无内容，用空数组或空字符串
- keywords 用于全文检索，请覆盖所有可能被搜索的术语（实体名、话题、缩写、行业术语等）`;
