import { db } from "@repo/database";
import { tryFetchTranscript } from "./meeting-fetcher";
import { generateForUser } from "./pipeline";
import { routeParticipants } from "./participant-router";
import { fetchMeetingDetail } from "./meeting-fetcher";

let retryTimer: ReturnType<typeof setInterval> | null = null;

// 从会议参会人中匹配一个系统用户，用于获取 user_access_token
async function findMeetingUserId(meeting: {
  hostUserId: string | null;
  participantsJson: unknown;
}): Promise<string | null> {
  // 收集所有可能的 userId（host + participants）
  const candidateIds = new Set<string>();
  if (meeting.hostUserId) candidateIds.add(meeting.hostUserId);

  const participants = (meeting.participantsJson as Array<{ userId: string }> | undefined) ?? [];
  for (const p of participants) {
    if (p.userId) candidateIds.add(p.userId);
  }

  if (candidateIds.size === 0) return null;

  // 查系统用户（通过 open_id 匹配 account.accountId）
  const accounts = await db.account.findMany({
    where: { providerId: "lark", accountId: { in: [...candidateIds] } },
    select: { userId: true, accountId: true },
    orderBy: { updatedAt: "desc" },
  });

  // 优先 ou_ 格式的
  const match = accounts.find((a) => a.accountId?.startsWith("ou_")) ?? accounts[0];
  return match?.userId ?? null;
}

// 每 60 秒扫描需要重试逐字稿的会议
export function startTranscriptRetrier(): void {
  if (retryTimer) return;

  retryTimer = setInterval(async () => {
    try {
      const pending = await db.feishuMeeting.findMany({
        where: {
          source: "feishu",
          isDeleted: false,
          transcriptRetryAt: { not: null, lte: new Date() },
          transcriptRetryCount: { lt: 2 },
        },
      });

      for (const meeting of pending) {
        const log = (msg: string) => console.log(`[TranscriptRetry ${meeting.meetingId}] ${msg}`);
        log(`第 ${meeting.transcriptRetryCount + 1} 次重试...`);

        // 找一个参会用户的 userId 来取 user_access_token
        const userId = await findMeetingUserId(meeting);
        const result = await tryFetchTranscript(meeting.meetingId, userId ?? undefined);

        if (result.transcriptText) {
          log("逐字稿拉取成功，触发纪要生成");
          await generateForMeeting(meeting.meetingId);
        } else {
          const nextCount = meeting.transcriptRetryCount + 1;
          if (nextCount >= 2) {
            log("已重试 2 次，放弃");
            await db.feishuMeeting.update({
              where: { meetingId: meeting.meetingId },
              data: { transcriptRetryAt: null, transcriptRetryCount: nextCount },
            });
          } else {
            log("仍未就绪，15 分钟后重试");
            await db.feishuMeeting.update({
              where: { meetingId: meeting.meetingId },
              data: {
                transcriptRetryAt: new Date(Date.now() + 15 * 60 * 1000),
                transcriptRetryCount: nextCount,
              },
            });
          }
        }
      }
    } catch (err) {
      console.error("Transcript retrier 扫描异常:", err);
    }
  }, 60_000);

  console.log("逐字稿重试扫描已启动（每 60s）");
}

export function stopTranscriptRetrier(): void {
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
}

// 为一场会议所有 autoEnabled 用户生成纪要（逐字稿已就绪时调用）
export async function generateForMeeting(meetingId: string): Promise<void> {
  const log = (msg: string) => console.log(`[GenerateForMeeting ${meetingId}] ${msg}`);

  const detail = await fetchMeetingDetail(meetingId);
  if (!detail) { log("无法获取会议详情"); return; }

  const contexts = await routeParticipants(detail);
  if (contexts.length === 0) { log("无匹配用户"); return; }

  for (const ctx of contexts) {
    const userLog = (msg: string) => log(`[用户${ctx.userId}] ${msg}`);
    try {
      const result = await generateForUser(meetingId, ctx.userId);
      if (result.status === "completed") {
        userLog("纪要生成成功");
      } else {
        userLog(`处理失败: ${result.errorMessage ?? result.skippedReason}`);
      }
    } catch (err) {
      userLog(`异常: ${err}`);
    }
  }

  log(`完成: ${contexts.length} 个用户`);
}
