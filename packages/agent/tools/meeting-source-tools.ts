import { tool } from "@repo/ai";
import { db } from "@repo/database";
import { z } from "zod";

export function createMeetingSourceTools() {
	const getFeishuMeetings = tool({
		description: `获取源会议列表（飞书 + 手动上传）。
当用户说「有哪些源会议」「飞书会议列表」「手动上传的会议」时调用。`,
		inputSchema: z.object({
			limit: z.number().min(1).max(50).default(20),
			source: z
				.enum(["feishu", "manual"])
				.optional()
				.describe("来源筛选"),
		}),
		execute: async ({ limit, source }) => {
			const where: Record<string, unknown> = { isDeleted: false };
			if (source) {
				where.source = source;
			}

			const meetings = await db.feishuMeeting.findMany({
				where,
				orderBy: { startTime: "desc" },
				take: limit,
				select: {
					meetingId: true,
					topic: true,
					startTime: true,
					endTime: true,
					source: true,
					participantCount: true,
					participantsJson: true,
					noteDocToken: true,
					meetingUrl: true,
					transcriptFetched: true,
					uploadedFileName: true,
				},
			});

			return {
				total: meetings.length,
				results: meetings.map((m) => ({
					meetingId: m.meetingId,
					topic: m.topic,
					startTime: m.startTime?.toISOString(),
					source: m.source,
					participantCount: m.participantCount,
					hasTranscript: m.transcriptFetched,
					noteDocToken: m.noteDocToken,
					meetingUrl: m.meetingUrl,
					uploadedFileName: m.uploadedFileName,
				})),
			};
		},
	});

	const getFeishuMeetingDetail = tool({
		description: `获取单个源会议的详细信息，含逐字稿和参会人列表。
当用户说「这场会议的逐字稿」「XX 会议的参会人」「会议原文」时调用。
需要 meetingId 参数（飞书会议 ID），可用 get_feishu_meetings 先获取。`,
		inputSchema: z.object({
			meetingId: z.string().describe("飞书会议 ID"),
		}),
		execute: async ({ meetingId }) => {
			const meeting = await db.feishuMeeting.findUnique({
				where: { meetingId },
			});

			if (!meeting) {
				return { error: "源会议不存在" };
			}

			const meetingRecords = await db.meetingRecord.findMany({
				where: { meetingId, isDeleted: false },
				select: {
					id: true,
					topic: true,
					status: true,
					aiSummary: true,
					docUrl: true,
				},
			});

			return {
				meetingId: meeting.meetingId,
				topic: meeting.topic,
				startTime: meeting.startTime?.toISOString(),
				endTime: meeting.endTime?.toISOString(),
				source: meeting.source,
				participantCount: meeting.participantCount,
				participants: meeting.participantsJson,
				transcript: meeting.transcriptText?.slice(0, 5000),
				userTranscript: meeting.userTranscriptText?.slice(0, 5000),
				hasTranscript: meeting.transcriptFetched,
				noteDocToken: meeting.noteDocToken,
				meetingUrl: meeting.meetingUrl,
				uploadedFileName: meeting.uploadedFileName,
				associatedRecords: meetingRecords.map((r) => ({
					id: r.id,
					topic: r.topic,
					status: r.status,
					aiSummary: r.aiSummary,
					docUrl: r.docUrl,
				})),
			};
		},
	});

	return { getFeishuMeetings, getFeishuMeetingDetail };
}
