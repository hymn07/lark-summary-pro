import { tool } from "@repo/ai";
import { db } from "@repo/database";
import { z } from "zod";

/**
 * search_meetings — 核心检索工具
 * 关键词搜索会议纪要（searchText contains 匹配），支持时间范围 + 状态过滤
 */
export function createSearchTools() {
	const searchMeetings = tool({
		description: `搜索会议纪要。支持关键词、时间范围、状态筛选。
当用户说「最近开了什么会」「XX 公司的会议」「有什么风险」「Q3 的会」「关于 XX 的讨论」时调用。
返回匹配的会议列表，每个含标题、摘要、分类标签和前几个关键实体。`,
		inputSchema: z.object({
			query: z
				.string()
				.optional()
				.describe("搜索关键词，空格分隔表示 AND 逻辑"),
			dateFrom: z.string().optional().describe("开始日期 ISO 格式"),
			dateTo: z.string().optional().describe("结束日期 ISO 格式"),
			status: z
				.enum(["completed", "processing", "failed", "skipped"])
				.optional(),
			limit: z.number().min(1).max(20).default(10),
			userId: z
				.string()
				.optional()
				.describe("用户 ID，不提供则查所有用户"),
		}),
		execute: async ({ query, dateFrom, dateTo, status, limit, userId }) => {
			const keywords =
				query?.split(/\s+/).filter((w) => w.length > 1) ?? [];
			const where: Record<string, unknown> = { isDeleted: false };

			if (userId) {
				where.userId = userId;
			}
			if (status) {
				where.status = status;
			}

			if (dateFrom || dateTo) {
				const startTime: Record<string, Date> = {};
				if (dateFrom) {
					startTime.gte = new Date(dateFrom);
				}
				if (dateTo) {
					startTime.lte = new Date(dateTo);
				}
				if (Object.keys(startTime).length > 0) {
					where.startTime = startTime;
				}
			}

			if (keywords.length > 0) {
				where.AND = keywords.map((kw) => ({
					searchText: { contains: kw, mode: "insensitive" },
				}));
			}

			const records = await db.meetingRecord.findMany({
				where,
				orderBy: { startTime: "desc" },
				take: limit,
				select: {
					id: true,
					topic: true,
					startTime: true,
					status: true,
					aiSummary: true,
					minutesJson: true,
					docUrl: true,
					userId: true,
				},
			});

			return {
				total: records.length,
				results: records.map((r) => {
					const mj = r.minutesJson as Record<string, unknown> | null;
					const entities =
						(mj?.entities as Array<{
							name: string;
							type: string;
						}>) ?? [];
					const decisions =
						(mj?.decisions as Array<{ decision: string }>) ?? [];
					const categories = (mj?.categories as string[]) ?? [];
					return {
						id: r.id,
						topic: r.topic,
						startTime: r.startTime?.toISOString(),
						status: r.status,
						aiSummary: r.aiSummary,
						docUrl: r.docUrl,
						topEntities: entities.slice(0, 3).map((e) => e.name),
						topDecisions: decisions
							.slice(0, 3)
							.map((d) => d.decision),
						categories,
					};
				}),
			};
		},
	});

	const getMeeting = tool({
		description: `获取单个会议纪要的完整详情，包含所有结构化字段。
当用户说「XX 会议的详情」「帮我看看这场会」「这个会议的风险/决策/待办是什么」时调用。
需要 meetingRecordId 参数，可用 search_meetings 先获取 ID。`,
		inputSchema: z.object({
			id: z.string().describe("MeetingRecord ID"),
		}),
		execute: async ({ id }) => {
			const record = await db.meetingRecord.findUnique({
				where: { id },
				include: {
					feishuMeeting: {
						select: {
							topic: true,
							noteDocToken: true,
							meetingUrl: true,
							participantsJson: true,
						},
					},
				},
			});

			if (!record) {
				return { error: "会议记录不存在" };
			}

			return {
				id: record.id,
				topic: record.topic,
				startTime: record.startTime?.toISOString(),
				status: record.status,
				aiSummary: record.aiSummary,
				docUrl: record.docUrl,
				errorMessage: record.errorMessage,
				skippedReason: record.skippedReason,
				minutes: record.minutesJson,
				minutesContent: record.minutesContent?.slice(0, 3000),
				sourceMeeting: record.feishuMeeting
					? {
							topic: record.feishuMeeting.topic,
							noteDocToken: record.feishuMeeting.noteDocToken,
							meetingUrl: record.feishuMeeting.meetingUrl,
							participants: record.feishuMeeting.participantsJson,
						}
					: null,
			};
		},
	});

	const listMeetingRecords = tool({
		description: `列出会议纪要记录，按时间倒序。支持状态筛选。
当用户说「最近有哪些会议纪要」「会议记录列表」「本周/今天的会议纪要」时调用。`,
		inputSchema: z.object({
			status: z
				.enum(["completed", "processing", "failed", "skipped"])
				.optional(),
			limit: z.number().min(1).max(20).default(10),
			userId: z.string().optional(),
		}),
		execute: async ({ status, limit, userId }) => {
			const where: Record<string, unknown> = { isDeleted: false };
			if (status) {
				where.status = status;
			}
			if (userId) {
				where.userId = userId;
			}

			const records = await db.meetingRecord.findMany({
				where,
				orderBy: { createdAt: "desc" },
				take: limit,
				select: {
					id: true,
					topic: true,
					startTime: true,
					status: true,
					aiSummary: true,
					docUrl: true,
				},
			});

			return {
				total: records.length,
				results: records.map((r) => ({
					id: r.id,
					topic: r.topic,
					startTime: r.startTime?.toISOString(),
					status: r.status,
					aiSummary: r.aiSummary,
					docUrl: r.docUrl,
				})),
			};
		},
	});

	return { searchMeetings, getMeeting, listMeetingRecords };
}
