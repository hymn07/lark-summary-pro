import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { fetchMinutesTranscript } from "@repo/lark-meeting/meeting-fetcher";
import {
	getCachedMeetings,
	getMeetingDetail,
	getTranscriptContent,
} from "@repo/lark-meeting/meeting-search";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";

// 获取会议列表（飞书同步+缓存+手动上传）
export const listFeishuMeetings = protectedProcedure
	.route({
		method: "GET",
		path: "/meetings/feishu-list",
		tags: ["Meeting Records"],
		summary: "获取会议列表（飞书 + 手动）",
	})
	.handler(async ({ context }) => {
		const account = await db.account.findFirst({
			where: { userId: context.user.id, providerId: "lark" },
		});

		// 只在首次访问时后台同步（meetingsSyncedAt 为 null）
		if (account?.accessToken) {
			const settings = await db.userSettings.findUnique({
				where: { userId: context.user.id },
			});
			if (!settings?.meetingsSyncedAt) {
				const { syncUserMeetings } = await import(
					"@repo/lark-meeting/meeting-search"
				);
				syncUserMeetings(account.accessToken)
					.then(async () => {
						await db.userSettings.upsert({
							where: { userId: context.user.id },
							update: { meetingsSyncedAt: new Date() },
							create: {
								userId: context.user.id,
								meetingsSyncedAt: new Date(),
							},
						});
					})
					.catch((e) => console.error("[Sync] 后台同步失败:", e));
			}
		}
		return getCachedMeetings(50);
	});

// 获取单个会议详情（含逐字稿和参会人）
export const getFeishuMeetingDetail = protectedProcedure
	.route({
		method: "GET",
		path: "/meetings/feishu-detail/:id",
		tags: ["Meeting Records"],
		summary: "获取会议详情含逐字稿",
	})
	.input(z.object({ id: z.string() }))
	.handler(async ({ input }) => {
		const cached = await db.feishuMeeting.findUnique({
			where: { id: input.id },
			include: {
				meetingRecords: {
					where: { isDeleted: false },
					orderBy: { createdAt: "desc" },
				},
			},
		});
		if (!cached) throw new ORPCError("NOT_FOUND");

		// 飞书会议：如果还没拉过逐字稿或没有参会人数据，尝试从飞书拉取
		if (
			cached.source === "feishu" &&
			(!cached.transcriptFetched || !cached.participantsJson)
		) {
			try {
				const detail = await getMeetingDetail(cached.meetingId);
				if (detail) {
					const updates: Record<string, unknown> = {};
					if (!cached.transcriptFetched) {
						// 优先用妙记 minutes API，降级 docx API
						let text: string | null = null;
						if (detail.noteDocToken) {
							text = await fetchMinutesTranscript(
								detail.noteDocToken,
								context.user.id,
							);
						}
						if (!text && detail.transcriptDocToken) {
							text = await getTranscriptContent(
								detail.transcriptDocToken,
							);
						}
						if (text) {
							updates.transcriptText = text;
							updates.transcriptFetched = true;
						}
					}
					if (
						!cached.participantsJson &&
						detail.participants.length > 0
					) {
						updates.participantsJson = detail.participants;
						updates.participantCount = detail.participantCount;
					}
					if (detail.noteDocToken && !cached.noteDocToken) {
						updates.noteDocToken = detail.noteDocToken;
					}
					if (Object.keys(updates).length > 0) {
						await db.feishuMeeting.update({
							where: { id: input.id },
							data: updates,
						});
						Object.assign(cached, updates);
					}
				}
			} catch {
				// 拉取失败不影响返回
			}
		}

		return cached;
	});

// 手动创建会议记录
export const createManualMeeting = protectedProcedure
	.route({
		method: "POST",
		path: "/meetings/manual",
		tags: ["Meeting Records"],
		summary: "手动添加会议记录",
	})
	.input(
		z.object({
			topic: z.string().min(1),
			transcriptText: z.string().min(1),
			startTime: z.string().optional(),
			endTime: z.string().optional(),
			meetingUrl: z.string().optional(),
			participants: z
				.array(
					z.object({
						userId: z.string(),
						userName: z.string(),
						isHost: z.boolean(),
						isExternal: z.boolean(),
					}),
				)
				.optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const meetingId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

		const meeting = await db.feishuMeeting.create({
			data: {
				meetingId,
				topic: input.topic,
				source: "manual",
				transcriptText: input.transcriptText,
				transcriptFetched: true,
				uploadedFileName: input.topic,
				meetingUrl: input.meetingUrl ?? null,
				startTime: input.startTime
					? new Date(input.startTime)
					: new Date(),
				endTime: input.endTime ? new Date(input.endTime) : null,
				participantsJson: input.participants ?? [],
				participantCount: input.participants?.length ?? 0,
				createdById: context.user.id,
			},
		});

		return meeting;
	});

// 为指定会议生成纪要（手动触发，直接给当前用户生成）
export const generateForMeeting = protectedProcedure
	.route({
		method: "POST",
		path: "/meetings/generate",
		tags: ["Meeting Records"],
		summary: "为指定会议生成纪要",
	})
	.input(z.object({ feishuMeetingId: z.string() }))
	.handler(async ({ input, context }) => {
		const fm = await db.feishuMeeting.findUnique({
			where: { id: input.feishuMeetingId },
		});
		if (!fm) throw new ORPCError("NOT_FOUND");

		// Step 0: 先创建"处理中"记录，让 UI 立即看到状态
		const processingRecord = await db.meetingRecord.create({
			data: {
				meetingId: fm.meetingId,
				topic: fm.topic ?? "未命名会议",
				startTime: fm.startTime,
				endTime: fm.endTime,
				participantCount: fm.participantCount ?? 0,
				status: "processing",
				userId: context.user.id,
			},
		});

		try {
			// 手动生成：直接用 generateForUser，不经过参会人路由
			const { generateForUser } = await import("@repo/lark-meeting");
			const result = await generateForUser(fm.meetingId, context.user.id);

			if (result.status === "completed") {
				await db.meetingRecord.delete({
					where: { id: processingRecord.id },
				});
				return [result];
			}

			// 未完成 → 更新处理中记录
			await db.meetingRecord.update({
				where: { id: processingRecord.id },
				data: {
					status: result.status === "failed" ? "failed" : "skipped",
					errorMessage: result.errorMessage ?? null,
					skippedReason: result.skippedReason ?? null,
				},
			});
			return [result];
		} catch (e) {
			await db.meetingRecord.update({
				where: { id: processingRecord.id },
				data: {
					status: "failed",
					errorMessage:
						e instanceof Error ? e.message : "流水线执行失败",
				},
			});
			throw e;
		}
	});

// 删除会议记录（软删除）
export const deleteFeishuMeeting = protectedProcedure
	.route({
		method: "DELETE",
		path: "/meetings/feishu/:id",
		tags: ["Meeting Records"],
		summary: "软删除会议记录",
	})
	.input(
		z.object({ id: z.string(), deleteRecords: z.boolean().default(false) }),
	)
	.handler(async ({ input }) => {
		const meeting = await db.feishuMeeting.findUnique({
			where: { id: input.id },
		});
		if (!meeting) throw new ORPCError("NOT_FOUND");

		if (input.deleteRecords) {
			await db.meetingRecord.updateMany({
				where: { meetingId: meeting.meetingId },
				data: { isDeleted: true },
			});
		}

		await db.feishuMeeting.update({
			where: { id: input.id },
			data: { isDeleted: true },
		});

		return { success: true };
	});

// 删除会议纪要（软删除）
export const deleteMeetingRecord = protectedProcedure
	.route({
		method: "DELETE",
		path: "/meeting-records/:id",
		tags: ["Meeting Records"],
		summary: "软删除会议纪要",
	})
	.input(z.object({ id: z.string() }))
	.handler(async ({ input }) => {
		const record = await db.meetingRecord.findUnique({
			where: { id: input.id },
		});
		if (!record) throw new ORPCError("NOT_FOUND");

		await db.meetingRecord.update({
			where: { id: input.id },
			data: { isDeleted: true },
		});

		return { success: true };
	});

// 手动同步会议（用户点击"刷新"触发）
export const syncMeetings = protectedProcedure
	.route({
		method: "POST",
		path: "/meetings/sync",
		tags: ["Meeting Records"],
		summary: "手动同步最近 90 天会议",
	})
	.handler(async ({ context }) => {
		const account = await db.account.findFirst({
			where: { userId: context.user.id, providerId: "lark" },
		});
		if (!account?.accessToken) {
			throw new ORPCError("BAD_REQUEST", { message: "未关联飞书账号" });
		}

		const { syncUserMeetings } = await import(
			"@repo/lark-meeting/meeting-search"
		);
		await syncUserMeetings(account.accessToken);

		await db.userSettings.upsert({
			where: { userId: context.user.id },
			update: { meetingsSyncedAt: new Date() },
			create: { userId: context.user.id, meetingsSyncedAt: new Date() },
		});

		return getCachedMeetings(50);
	});

// 手动获取逐字稿（用户点击"获取逐字稿"触发）
export const fetchTranscript = protectedProcedure
	.route({
		method: "POST",
		path: "/meetings/:id/fetch-transcript",
		tags: ["Meeting Records"],
		summary: "手动拉取逐字稿并触发生成",
	})
	.input(z.object({ id: z.string() }))
	.handler(async ({ input, context }) => {
		const meeting = await db.feishuMeeting.findUnique({
			where: { id: input.id },
		});
		if (!meeting) throw new ORPCError("NOT_FOUND");

		const { tryFetchTranscript } = await import(
			"@repo/lark-meeting/meeting-fetcher"
		);
		const result = await tryFetchTranscript(
			meeting.meetingId,
			context.user.id,
		);

		if (result.transcriptText) {
			const { generateForMeeting } = await import("@repo/lark-meeting");
			generateForMeeting(meeting.meetingId).catch((e) =>
				console.error("手动获取逐字稿后生成失败:", e),
			);
		}

		return {
			transcriptFetched: !!result.transcriptText,
			noteDocToken: result.noteDocToken,
		};
	});

// 上传逐字稿（用户手动上传或输入文本）
export const uploadTranscript = protectedProcedure
	.route({
		method: "POST",
		path: "/meetings/:id/upload-transcript",
		tags: ["Meeting Records"],
		summary: "手动上传逐字稿并触发生成",
	})
	.input(z.object({ id: z.string(), text: z.string().min(1) }))
	.handler(async ({ input, context }) => {
		const meeting = await db.feishuMeeting.findUnique({
			where: { id: input.id },
		});
		if (!meeting) throw new ORPCError("NOT_FOUND");

		await db.feishuMeeting.update({
			where: { id: input.id },
			data: { userTranscriptText: input.text },
		});

		const { generateForMeeting } = await import("@repo/lark-meeting");
		generateForMeeting(meeting.meetingId).catch((e) =>
			console.error("上传逐字稿后生成失败:", e),
		);

		return { success: true };
	});
