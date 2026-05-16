import { db } from "@repo/database";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { protectedProcedure } from "../../../orpc/procedures";
import { searchMeetings, cacheMeeting, getCachedMeetings, getMeetingDetail, getTranscriptContent } from "@repo/lark-meeting/meeting-search";

// 获取会议列表（从飞书同步+返回缓存）
export const listFeishuMeetings = protectedProcedure
  .route({
    method: "GET",
    path: "/meetings/feishu-list",
    tags: ["Meeting Records"],
    summary: "获取飞书会议列表",
  })
  .handler(async () => {
    return getCachedMeetings(50);
  });

// 获取单个会议详情（含逐字稿）
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

    // 如果还没拉过逐字稿，尝试拉取
    if (!cached.transcriptFetched) {
      try {
        const detail = await getMeetingDetail(cached.meetingId);
        if (detail?.transcriptDocToken) {
          const text = await getTranscriptContent(detail.transcriptDocToken);
          if (text) {
            await db.feishuMeeting.update({
              where: { id: input.id },
              data: { transcriptText: text, transcriptFetched: true },
            });
            cached.transcriptText = text;
            cached.transcriptFetched = true;
          }
        }
      } catch {
        // 拉取失败不影响返回
      }
    }

    return cached;
  });

// 为指定会议生成纪要
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
