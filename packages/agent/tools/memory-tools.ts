import { tool } from "@repo/ai";
import { db } from "@repo/database";
import { z } from "zod";

export function createMemoryTools() {
	const queryMemoryInsights = tool({
		description:
			"查询 AI 记忆系统发现的洞察。包括用户频繁问的问题类型、新发现的提取维度。scope 区分个人/公共。",
		inputSchema: z.object({
			scope: z.enum(["personal", "public", "all"]).optional().default("all"),
			type: z.enum(["missing_dimension", "frequent_intent"]).optional(),
			status: z.enum(["proposed", "reviewed", "accepted", "rejected"]).optional(),
			limit: z.number().min(1).max(20).optional().default(10),
		}),
		execute: async ({ scope, type, status, limit }) => {
			const where: Record<string, unknown> = {};
			if (scope && scope !== "all") where.scope = scope;
			if (type) where.type = type;
			if (status) where.status = status;

			const insights = await db.memoryInsight.findMany({
				where,
				orderBy: { createdAt: "desc" },
				take: limit,
			});

			return insights.map((i) => ({
				id: i.id,
				type: i.type,
				scope: i.scope,
				title: i.title,
				description: i.description,
				confidence: i.confidence,
				status: i.status,
				createdAt: i.createdAt,
			}));
		},
	});

	const getDimensionProposals = tool({
		description:
			"查看维度提案列表。公共提案 (scope=public) 影响所有用户，个人提案 (scope=personal) 只影响该用户。",
		inputSchema: z.object({
			scope: z.enum(["personal", "public", "all"]).optional().default("all"),
			status: z.enum(["pending_review", "approved", "rejected", "implemented"]).optional(),
			limit: z.number().min(1).max(20).optional().default(10),
		}),
		execute: async ({ scope, status, limit }) => {
			const where: Record<string, unknown> = {};
			if (scope && scope !== "all") where.scope = scope;
			if (status) where.status = status;

			const proposals = await db.dimensionProposal.findMany({
				where,
				orderBy: { evidenceCount: "desc" },
				take: limit,
			});

			return proposals.map((p) => ({
				id: p.id,
				fieldName: p.fieldName,
				displayName: p.displayName,
				description: p.description,
				scope: p.scope,
				evidenceCount: p.evidenceCount,
				uniqueUsers: p.uniqueUsers,
				confidence: p.confidence,
				status: p.status,
			}));
		},
	});

	const getChatMemory = tool({
		description:
			"获取当前用户的个人对话记忆和偏好。包括用户关注的话题和可能感兴趣的新提取维度。",
		inputSchema: z.object({
			limit: z.number().min(1).max(10).optional().default(5),
			userId: z.string().describe("当前用户 ID"),
		}),
		execute: async ({ limit, userId }) => {
			const [insights, proposals] = await Promise.all([
				db.memoryInsight.findMany({
					where: { userId, scope: "personal" },
					orderBy: { createdAt: "desc" },
					take: limit,
				}),
				db.dimensionProposal.findMany({
					where: {
						OR: [
							{ scope: "public", status: "approved" },
							{ scope: "personal", userId },
						],
					},
					orderBy: { evidenceCount: "desc" },
					take: limit,
				}),
			]);

			return {
				personalInsights: insights.map((i) => ({
					title: i.title,
					description: i.description,
				})),
				proposals: proposals.map((p) => ({
					fieldName: p.fieldName,
					displayName: p.displayName,
					scope: p.scope,
				})),
			};
		},
	});

	return {
		queryMemoryInsights,
		getDimensionProposals,
		getChatMemory,
	} as const;
}
