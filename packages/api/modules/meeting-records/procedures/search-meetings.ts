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
  .handler(async () => {
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

// 为指定会议生成纪要（飞书或手动）
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

    // 手动上传的会议：直接用缓存的逐字稿
    if (fm.source === "manual") {
      const { handleMeetingEnded } = await import("@repo/lark-meeting");
      const result = await handleMeetingEnded({
        meeting: {
          id: fm.meetingId,
          topic: fm.topic ?? "未命名会议",
          meetingSource: 1,
          startTime: String(Math.floor((fm.startTime?.getTime() ?? Date.now()) / 1000)),
          endTime: String(Math.floor((fm.endTime?.getTime() ?? Date.now()) / 1000)),
        },
      });
      return result;
    }

    // 飞书会议：用 event 触发 pipeline
    const { handleMeetingEnded } = await import("@repo/lark-meeting");
    const result = await handleMeetingEnded({
      meeting: {
        id: fm.meetingId,
        topic: fm.topic ?? "未知会议",
        meetingSource: 1,
        startTime: String(Math.floor((fm.startTime?.getTime() ?? Date.now()) / 1000)),
        endTime: String(Math.floor((fm.endTime?.getTime() ?? Date.now()) / 1000)),
      },
    });

    return result;
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
