import { db } from "@repo/database";
import { generateText } from "@repo/ai";
import { getFastModel } from "@repo/lark-meeting/model-factory";
import { MEMORY_CONFIG } from "./config";
import { z } from "zod";

const BatchClassificationSchema = z.object({
	results: z.array(z.object({
		messageId: z.string(),
		intentCategory: z.string(),
		referencedFields: z.array(z.string()),
		unknownFields: z.array(z.object({
			fieldName: z.string(),
			description: z.string(),
			userIntent: z.string(),
		})),
		confidence: z.number(),
	})),
});

function buildBatchPrompt(messages: { id: string; content: string }[]): string {
	const items = messages
		.map((m, i) => `<message id="${m.id}">${m.content.slice(0, 500)}</message>`)
		.join("\n");

	return `你是一个对话分析器。分析以下用户发给 AI 助手的问题，对每条消息进行分类。

已知的会议纪要提取维度（10 个）：
title, abstract, summary, categories, discussionPoints(speakers,topic,conclusion),
entities(name,type,role), decisions(decision,rationale,impact),
actionItems(task,owner,deadline,priority), metrics(name,value,unit,trend),
risks(risk,severity,mitigation), sentiment(overall), followUps(topic,trigger),
keywords

意图类别：
- meeting_search: 搜索/查找会议
- meeting_detail: 查看会议详情
- minutes_generation: 生成纪要
- minutes_clarification: 对纪要内容追问
- schema_field_query: 问的问题恰好对应某个现有维度
- schema_field_extend: 问的问题不在 10 个维度中，是新的关注点
- retry_or_fix: 重试/修复
- settings_query: 查设置
- settings_update: 改设置
- stats_query: 统计数据
- general_chat: 闲聊
- other: 其他

对每条消息输出 JSON。unknownFields 列出的内容不能是上述 10 个维度中已有的。

待分析的消息（${messages.length} 条）：
${items}

输出格式：
{ "results": [{ "messageId": "...", "intentCategory": "...", "referencedFields": [...], "unknownFields": [{"fieldName":"...","description":"...","userIntent":"..."}], "confidence": 0.9 }] }`;
}

export async function classifyMessages(): Promise<number> {
	const messages = await db.conversationMessage.findMany({
		where: {
			processedAt: null,
			role: "user",
		},
		select: { id: true, content: true },
		orderBy: { createdAt: "asc" },
		take: MEMORY_CONFIG.classification.batchSize,
	});

	if (messages.length === 0) return 0;

	const model = await getFastModel();
	const prompt = buildBatchPrompt(messages);

	for (let attempt = 0; attempt < MEMORY_CONFIG.classification.maxRetries; attempt++) {
		try {
			const { text } = await generateText({
				model,
				prompt,
				maxOutputTokens: 4096,
			});

			const json = JSON.parse(
				text.replace(/```json|```/g, "").trim()
			);
			const parsed = BatchClassificationSchema.parse(json);

			for (const r of parsed.results) {
				await db.conversationMessage.update({
					where: { id: r.messageId },
					data: {
						intentCategory: r.intentCategory,
						referencedFields: r.referencedFields,
						unknownFields: r.unknownFields as unknown as Record<string, never>[],
						intentConfidence: r.confidence,
						processedAt: new Date(),
					},
				});
			}

			return parsed.results.length;
		} catch (e) {
			if (attempt === MEMORY_CONFIG.classification.maxRetries - 1) {
				console.error("Classification failed after retries:", e);
				return 0;
			}
		}
	}

	return 0;
}
