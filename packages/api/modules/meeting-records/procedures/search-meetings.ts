import { db } from "@repo/database";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { protectedProcedure } from "../../../orpc/procedures";
import { searchMeetings, cacheMeeting, getCachedMeetings, getMeetingDetail, getTranscriptContent } from "@repo/lark-meeting/meeting-search";

// 获取会议列表（飞书同步+缓存+手动上传）
export const listFeishuMeetings = protectedProcedure
  .route({
    method: "GET",
    path: "/meetings/feishu-list",
    tags: ["Meeting Records"],
    summary: "获取会议列表（飞书 + 手动）",
  })
  .handler(async ({ context }) => {
    // 后台同步：用用户 token 拉取最近 90 天会议+妙记
    const { syncUserMeetings } = await import("@repo/lark-meeting/meeting-search");
    const account = await db.account.findFirst({
      where: { userId: context.user.id, providerId: "lark" },
    });
    if (account?.accessToken) {
      syncUserMeetings(account.accessToken).catch((e) => console.error("[Sync] 后台同步失败:", e));
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
        meetingRecords: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!cached) throw new ORPCError("NOT_FOUND");

    // 飞书会议：如果还没拉过逐字稿或没有参会人数据，尝试从飞书拉取
    if (cached.source === "feishu" && (!cached.transcriptFetched || !cached.participantsJson)) {
      try {
        const detail = await getMeetingDetail(cached.meetingId);
        if (detail) {
          const updates: Record<string, unknown> = {};
          if (!cached.transcriptFetched && detail.transcriptDocToken) {
            const text = await getTranscriptContent(detail.transcriptDocToken);
            if (text) {
              updates.transcriptText = text;
              updates.transcriptFetched = true;
            }
          }
          if (!cached.participantsJson && detail.participants.length > 0) {
            updates.participantsJson = detail.participants;
            updates.participantCount = detail.participantCount;
          }
          if (!cached.noteDocToken && detail.noteDocToken) {
            updates.noteDocToken = detail.noteDocToken;
          }
          if (Object.keys(updates).length > 0) {
            await db.feishuMeeting.update({ where: { id: input.id }, data: updates });
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
      participants: z.array(z.object({ userId: z.string(), userName: z.string(), isHost: z.boolean(), isExternal: z.boolean() })).optional(),
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
        startTime: input.startTime ? new Date(input.startTime) : new Date(),
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
    const fm = await db.feishuMeeting.findUnique({ where: { id: input.feishuMeetingId } });
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
        await db.meetingRecord.delete({ where: { id: processingRecord.id } });
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
          errorMessage: e instanceof Error ? e.message : "流水线执行失败",
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
  .input(z.object({ id: z.string(), deleteRecords: z.boolean().default(false) }))
  .handler(async ({ input }) => {
    const meeting = await db.feishuMeeting.findUnique({ where: { id: input.id } });
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
    const record = await db.meetingRecord.findUnique({ where: { id: input.id } });
    if (!record) throw new ORPCError("NOT_FOUND");

    await db.meetingRecord.update({
      where: { id: input.id },
      data: { isDeleted: true },
    });

    return { success: true };
  });
