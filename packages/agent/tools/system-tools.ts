import { tool } from "@repo/ai";
import { db } from "@repo/database";
import { z } from "zod";

export function createSystemTools() {
	const getStats = tool({
		description: `获取系统统计信息：会议处理总数、成功率、最近趋势等。
当用户说「系统最近怎么样」「处理了多少会议」「成功率多少」「这个月开了多少会」时调用。`,
		inputSchema: z.object({
			userId: z
				.string()
				.optional()
				.describe("用户 ID，不提供则统计全系统"),
			days: z
				.number()
				.min(1)
				.max(365)
				.default(30)
				.describe("统计最近 N 天"),
		}),
		execute: async ({ userId, days }) => {
			const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

			const whereBase: Record<string, unknown> = {
				isDeleted: false,
				createdAt: { gte: since },
			};
			if (userId) {
				whereBase.userId = userId;
			}

			const [total, completed, failed, skipped, processing] =
				await Promise.all([
					db.meetingRecord.count({ where: whereBase }),
					db.meetingRecord.count({
						where: { ...whereBase, status: "completed" },
					}),
					db.meetingRecord.count({
						where: { ...whereBase, status: "failed" },
					}),
					db.meetingRecord.count({
						where: { ...whereBase, status: "skipped" },
					}),
					db.meetingRecord.count({
						where: { ...whereBase, status: "processing" },
					}),
				]);

			const successRate =
				total > 0 ? Math.round((completed / total) * 100) : 0;

			return {
				days,
				total,
				completed,
				failed,
				skipped,
				processing,
				successRate: `${successRate}%`,
				scope: userId ? "personal" : "system",
			};
		},
	});

	const getSystemConfig = tool({
		description: `获取系统配置，如成员接入模式、飞书应用 ID、默认模型等。
仅管理员可调用（后端 middleware 验证）。
当用户说「系统配置」「用了什么模型」「成员模式是什么」时调用。`,
		inputSchema: z.object({}),
		execute: async () => {
			const configs = await db.systemConfig.findMany();

			const map: Record<string, string> = {};
			for (const c of configs) {
				map[c.key] = c.value;
			}

			return {
				memberAccessMode: map.member_access_mode,
				feishuAppId: map.feishu_app_id,
				defaultFastModel: map.default_fast_model,
				defaultTextModel: map.default_text_model,
			};
		},
	});

	return { getStats, getSystemConfig };
}
