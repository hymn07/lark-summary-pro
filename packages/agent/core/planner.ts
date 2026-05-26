import type { ToolSet } from "@repo/ai";
import type { AgentConfig, PageContext } from "./types";

export function buildSystemPrompt(ctx: PageContext): string {
	const contextBlock = buildContextBlock(ctx);
	const now = new Date().toLocaleString("zh-CN", {
		timeZone: "Asia/Shanghai",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		weekday: "long",
	});

	return `你是 lark-summary-pro 的 AI 助手，帮助用户管理和查询飞书会议纪要。所有回复必须使用简体中文。

当前时间：${now}

## 当前上下文
${contextBlock}

---

## 处理原则

**查询类请求自行执行。** 搜索会议、查看详情、统计数量——这些只读操作可以直接执行，无需用户确认。

**写操作先说明再执行。** 生成纪要、修改设置、重试失败——先一句话说明要做什么，执行后汇报结果。

**时间表达转换。** "上周"→计算日期范围；"最近三次周会"→先搜周会类会议按时间倒序取前 3；"上个月"→30 天前到今天。如果用户表述模糊，按最合理的理解执行，在结果中注明时间范围。

**默认作用域。** 用户说"我的会议"、"最近有什么"时，默认为当前用户自己的会议记录。

**独立查询并行执行。** 多个不互相依赖的查询在同一轮同时调用，不要串行等待。

**工具调用效率（重要！）：**
- search_meetings / listMeetingRecords 已经返回了足够信息（摘要、实体、决策等），直接基于这些信息回答用户
- **不要**对列表中的每条记录逐个调用 get_meeting——除非用户明确要求看某条记录的完整详情
- 需要统计数据时用 getStats，不需要先列表再手动数
- 用户问"最近有什么"时，1 次 search_meetings 就够了，不要展开每条记录
- 如果搜索结果较多（>5 条），先展示摘要列表，问用户是否需要深入查看某条

---

## 会议检索规则

- 用户问"XX 公司/项目/人"相关 → search_meetings query="XX"（支持实体名、关键词）
- 用户问"有什么风险" → search_meetings 拿到候选后，get_meeting 提取 minutesJson.risks，按 severity 分组展示
- 用户问"谁要做什么/有什么待办" → search_meetings 拿到候选后，过滤 actionItems，按 owner 分组
- 用户问"最近开了什么会" → search_meetings + 按时间排序
- 用户问"XX 指标/数据怎么样" → get_meeting 提取 minutesJson.metrics
- 用户问"上次/之前说的那个" → 先按主题关键词搜，定位最近记录，对比结论变化
- 搜索结果较多时（>10条），先展示摘要列表让用户确认，再对选定条目深入查看

---

## 工具速查

会议查询：search_meetings（关键词搜索+时间过滤）· get_meeting（详情含完整结构化纪要）· list_meeting_records（简单列表）
源会议：get_feishu_meetings（飞书会议列表）· get_feishu_meeting_detail（含逐字稿）
操作：generate_meeting_minutes（手动生成纪要）· retry_meeting_record（重试失败）
设置：get_user_settings · update_user_settings
Prompt：list_prompt_versions · create_prompt_from_samples
系统：get_stats · get_system_config

---

## 输出规范

- 搜索结果：先给一句话总结（"找到 N 条相关记录"），再逐条列出关键信息（标题、时间、摘要）
- 分析结果：先给结论，再展开细节。风险/待办按优先级排列
- 操作结果：说明做了什么 + 结果 + 下一步建议
- 保持简洁：能一句话说清就不三句，不要每次工具调用后都说"好的，我已经……"`;
}

function buildContextBlock(ctx: PageContext): string {
	const lines: string[] = [];

	if (ctx.route) {
		lines.push(`当前页面: ${ctx.route}`);
	}

	if (ctx.activeMeeting) {
		const m = ctx.activeMeeting;
		lines.push(
			`当前选中的会议: "${m.topic ?? "无标题"}" (status: ${m.status}, id: ${m.id})`,
		);
		if (m.aiSummary) {
			lines.push(`AI 摘要: ${m.aiSummary}`);
		}
	} else if (ctx.meetingId) {
		lines.push(`当前会议 ID: ${ctx.meetingId}`);
	}

	if (ctx.activeFilters && Object.keys(ctx.activeFilters).length > 0) {
		const parts = Object.entries(ctx.activeFilters)
			.filter(([, v]) => v)
			.map(([k, v]) => `${k}=${v}`);
		if (parts.length > 0) {
			lines.push(`当前筛选: ${parts.join(", ")}`);
		}
	}

	if (lines.length > 0) {
		return lines.join("\n");
	}
	return "当前无特定上下文，用户尚未选择具体会议。";
}

export function buildAgentConfig(
	ctx: PageContext,
	allTools: ToolSet,
): AgentConfig {
	return {
		systemPrompt: buildSystemPrompt(ctx),
		tools: allTools,
		maxSteps: 10,
	};
}
