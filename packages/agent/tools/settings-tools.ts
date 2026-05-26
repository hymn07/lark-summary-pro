import { tool } from "@repo/ai";
import { db } from "@repo/database";
import { z } from "zod";

export function createSettingsTools() {
	const getUserSettings = tool({
		description: `获取用户设置：自动纪要开关、额外指令、活跃的 Prompt 版本、保存文件夹等。
当用户说「我的设置」「自动纪要有开吗」「我的纪要风格是什么」时调用。`,
		inputSchema: z.object({
			userId: z.string().describe("用户 ID"),
		}),
		execute: async ({ userId }) => {
			const settings = await db.userSettings.findUnique({
				where: { userId },
				include: {
					activePromptVersion: {
						select: {
							id: true,
							name: true,
							styleDescription: true,
						},
					},
				},
			});

			if (!settings) {
				return { error: "用户设置不存在" };
			}

			return {
				autoEnabled: settings.autoEnabled,
				saveFolderToken: settings.saveFolderToken,
				extraInstructions: settings.extraInstructions,
				meetingsSyncedAt: settings.meetingsSyncedAt?.toISOString(),
				activePromptVersion: settings.activePromptVersion,
			};
		},
	});

	const updateUserSettings = tool({
		description: `更新用户设置。
当用户说「打开/关闭自动纪要」「改成XX风格」「把额外指令改为XX」「加一条关注规则：XX」时调用。
写操作：执行前先告知用户即将做什么修改。`,
		inputSchema: z.object({
			userId: z.string().describe("用户 ID"),
			autoEnabled: z.boolean().optional().describe("自动纪要开关"),
			extraInstructions: z
				.string()
				.optional()
				.describe("额外指令（自由文本）"),
			activePromptVersionId: z
				.string()
				.optional()
				.describe("活跃 Prompt 版本 ID，null 表示改回默认"),
		}),
		execute: async ({
			userId,
			autoEnabled,
			extraInstructions,
			activePromptVersionId,
		}) => {
			const data: Record<string, unknown> = {};
			const changes: string[] = [];

			if (autoEnabled !== undefined) {
				data.autoEnabled = autoEnabled;
				changes.push(`自动纪要: ${autoEnabled ? "开" : "关"}`);
			}
			if (extraInstructions !== undefined) {
				data.extraInstructions = extraInstructions;
				changes.push("额外指令已更新");
			}
			if (activePromptVersionId !== undefined) {
				data.activePromptVersionId = activePromptVersionId || null;
				changes.push(
					activePromptVersionId
						? "已切换到指定 Prompt 版本"
						: "已恢复默认 Prompt",
				);
			}

			if (changes.length === 0) {
				return { error: "没有指定要修改的字段" };
			}

			await db.userSettings.update({
				where: { userId },
				data,
			});

			return {
				message: `设置已更新: ${changes.join("；")}`,
				changes,
			};
		},
	});

	return { getUserSettings, updateUserSettings };
}
