import { tool } from "@repo/ai";
import { db } from "@repo/database";
import { learnFromSamples } from "@repo/lark-meeting/sample-learner";
import { z } from "zod";

export function createPromptTools() {
	const listPromptVersions = tool({
		description: `列出用户的 Prompt 版本列表，含活跃状态和默认标记。
当用户说「我的 Prompt」「有哪些纪要风格」「Prompt 版本」时调用。`,
		inputSchema: z.object({
			userId: z.string().describe("用户 ID"),
		}),
		execute: async ({ userId }) => {
			const versions = await db.promptVersion.findMany({
				where: { createdById: userId },
				orderBy: { createdAt: "desc" },
				select: {
					id: true,
					name: true,
					styleDescription: true,
					isDefault: true,
					isActive: true,
					createdAt: true,
				},
			});

			const defaultVersion = await db.promptVersion.findFirst({
				where: { isDefault: true },
				select: { id: true, name: true, styleDescription: true },
			});

			return {
				userVersions: versions.map((v) => ({
					id: v.id,
					name: v.name,
					styleDescription: v.styleDescription,
					isDefault: v.isDefault,
					isActive: v.isActive,
					createdAt: v.createdAt?.toISOString(),
				})),
				systemDefault: defaultVersion,
			};
		},
	});

	const createPromptFromSamples = tool({
		description: `举一反三：从样本文本学习风格，生成新的 Prompt 版本并保存到数据库。
需要 userId、版本名称和样本文本。
当用户说「学一下我的风格」「用这篇作为样本创建 Prompt」「帮我生成一个XX风格的 Prompt」时调用。
AI 操作：会调用 LLM 分析样本并生成 Prompt。`,
		inputSchema: z.object({
			userId: z.string().describe("用户 ID"),
			name: z.string().describe("版本名称，如'简洁版'"),
			samples: z
				.array(z.string())
				.min(1)
				.max(3)
				.describe("样本文本内容（1-3 篇）"),
		}),
		execute: async ({ userId, name, samples }) => {
			try {
				const { corePrompt, styleDescription } =
					await learnFromSamples(samples);

				const version = await db.promptVersion.create({
					data: {
						name,
						corePrompt,
						styleDescription,
						createdById: userId,
					},
				});

				return {
					success: true,
					promptVersionId: version.id,
					name: version.name,
					styleDescription: version.styleDescription,
					message: `已生成 Prompt 版本「${name}」: ${styleDescription}`,
				};
			} catch (error) {
				return {
					success: false,
					error: `生成失败: ${error instanceof Error ? error.message : "未知错误"}`,
				};
			}
		},
	});

	return { listPromptVersions, createPromptFromSamples };
}
