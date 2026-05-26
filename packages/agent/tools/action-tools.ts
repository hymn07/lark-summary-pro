import { tool } from "@repo/ai";
import { db } from "@repo/database";
import { generateForUser } from "@repo/lark-meeting/pipeline";
import { z } from "zod";

export function createActionTools() {
	const generateMeetingMinutes = tool({
		description: `手动触发单次会议的纪要生成。执行完整的处理流水线（获取详情→前置路由→Prompt 组装→LLM 生成→文档创建）。
当用户说「帮我生成纪要」「给这个会议出纪要」「重新生成」时调用。
写操作：执行前告知用户，执行后汇报结果。
需要 meetingId（飞书会议 ID）+ userId。`,
		inputSchema: z.object({
			meetingId: z.string().describe("飞书会议 ID"),
			userId: z.string().describe("用户 ID"),
		}),
		execute: async ({ meetingId, userId }) => {
			const result = await generateForUser(meetingId, userId);

			return {
				status: result.status,
				meetingRecordId: result.meetingRecordId,
				docUrl: result.docUrl,
				skippedReason: result.skippedReason,
				errorMessage: result.errorMessage,
				message:
					result.status === "completed"
						? `纪要生成成功，文档链接: ${result.docUrl}`
						: result.status === "skipped"
							? `跳过: ${result.skippedReason}`
							: `生成失败: ${result.errorMessage}`,
			};
		},
	});

	const retryMeetingRecord = tool({
		description: `重试失败的会议纪要生成。仅限 status=failed 或 status=skipped 的记录。
当用户说「重试一下」「重新生成这个纪要」「这个失败了帮我重跑」时调用。`,
		inputSchema: z.object({
			recordId: z.string().describe("MeetingRecord ID"),
		}),
		execute: async ({ recordId }) => {
			const record = await db.meetingRecord.findUnique({
				where: { id: recordId },
			});

			if (!record) {
				return { error: "会议记录不存在" };
			}

			if (record.status !== "failed" && record.status !== "skipped") {
				return {
					error: `只能重试失败或跳过的记录，当前状态: ${record.status}`,
				};
			}

			try {
				await db.meetingRecord.update({
					where: { id: recordId },
					data: {
						status: "processing",
						errorMessage: null,
						skippedReason: null,
					},
				});

				const result = await generateForUser(
					record.meetingId,
					record.userId,
				);

				return {
					status: result.status,
					meetingRecordId: result.meetingRecordId,
					docUrl: result.docUrl,
					errorMessage: result.errorMessage,
					message:
						result.status === "completed"
							? `重试成功，文档链接: ${result.docUrl}`
							: `重试失败: ${result.errorMessage}`,
				};
			} catch (error) {
				return {
					error: `重试异常: ${error instanceof Error ? error.message : "未知错误"}`,
				};
			}
		},
	});

	return { generateMeetingMinutes, retryMeetingRecord };
}
