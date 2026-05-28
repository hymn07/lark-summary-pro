import { db, decryptField } from "@repo/database";
import type { FeishuMeetingEndedEvent, PipelineContext, ProcessResult, MeetingMinutes } from "./types";
import { fetchMeetingDetail, tryFetchTranscript } from "./meeting-fetcher";
import { routeParticipants } from "./participant-router";
import { runPreRoute } from "./pre-router";
import { assemblePrompt } from "./prompt-assembler";
import { generateMinutes } from "./llm-generator";
import { createFeishuDoc } from "./doc-creator";
import { createTodoNotification } from "./todo-sync";

async function extractAndNotifyTodos(
	userId: string,
	recordId: string,
	actionItems: Array<Record<string, unknown>>,
	topic: string,
): Promise<void> {
	try {
		const todos = actionItems.map((a) => ({
			task: (a.task as string) ?? "",
			owner: a.owner as string | undefined,
			deadline: a.deadline as string | undefined,
			priority: (a.priority as string) === "high" ? "high"
				: (a.priority as string) === "low" ? "low"
				: "medium",
		})).filter((t) => t.task);

		if (todos.length === 0) return;

		await createTodoNotification(userId, recordId, todos, topic);
	} catch (e) {
		console.error("Todo extraction failed:", e);
	}
}

// 确保向后兼容：补全旧版字段
function normalizeMinutes(minutes: MeetingMinutes): void {
  if (!minutes.summary && minutes.abstract) {
    (minutes as Record<string, unknown>).summary = minutes.abstract;
  }
  if (!minutes.abstract && minutes.summary) {
    (minutes as Record<string, unknown>).abstract = minutes.summary;
  }
  if ((!minutes.keyPoints || minutes.keyPoints.length === 0) && minutes.discussionPoints?.length) {
    (minutes as Record<string, unknown>).keyPoints = minutes.discussionPoints.map((d) => d.summary);
  }
}

// 手动生成：指定用户在指定会议直接生成纪要（不经过参会人路由）
export async function generateForUser(
  meetingId: string,
  userId: string,
): Promise<ProcessResult> {
  const log = (msg: string) => console.log(`[ManualPipeline ${meetingId}] ${msg}`);

  log("获取会议详情...");
  const detail = await fetchMeetingDetail(meetingId);
  if (!detail) {
    return { status: "failed", errorMessage: "无法获取会议详情" };
  }

  // 构建当前用户的上下文
  const settings = await db.userSettings.findUnique({ where: { userId } });
  if (!settings || !settings.autoEnabled) {
    return { status: "skipped", skippedReason: "未开启自动纪要" };
  }

  let corePrompt: string | null = null;
  if (settings.activePromptVersionId) {
    const version = await db.promptVersion.findUnique({
      where: { id: settings.activePromptVersionId },
    });
    corePrompt = version?.corePrompt ? decryptField(version.corePrompt) : null;
  }
  if (!corePrompt) {
    const defaultVersion = await db.promptVersion.findFirst({
      where: { isDefault: true },
      orderBy: { createdAt: "desc" },
    });
    corePrompt = defaultVersion?.corePrompt ? decryptField(defaultVersion.corePrompt) : null;
  }

  const ctx: PipelineContext = {
    meetingId: detail.id,
    userId,
    userSettings: {
      autoEnabled: settings.autoEnabled,
      saveFolderToken: settings.saveFolderToken,
      extraInstructions: settings.extraInstructions ?? null,
      activePromptVersionId: settings.activePromptVersionId,
    },
    corePrompt,
  };

  try {
    // Step 2: 前置路由
    log("前置路由...");
    const preRoute = await runPreRoute(detail, ctx);
    if (preRoute.shouldSkip) {
      const record = await createMeetingRecord(ctx, detail, "skipped", null, preRoute.skipReason);
      return { status: "skipped", meetingRecordId: record.id, skippedReason: preRoute.skipReason };
    }

    // Step 3: Prompt 组装
    log("Prompt 组装...");
    const prompt = await assemblePrompt(ctx, preRoute.extractedRequirements);

    // Step 4: LLM 生成
    log("LLM 生成...");
    const minutes = await generateMinutes(detail, prompt);
    if (!minutes) {
      await createMeetingRecord(ctx, detail, "failed", null, undefined, "LLM 生成失败");
      return { status: "failed", errorMessage: "LLM 生成失败" };
    }
    normalizeMinutes(minutes);
    log(`LLM 完成: ${minutes.title}`);

    // Step 5: 创建飞书文档（用 user token）
    log("创建飞书文档...");
    const docUrl = await createFeishuDoc(ctx, minutes, userId);
    if (!docUrl) {
      await createMeetingRecord(ctx, detail, "failed", null, undefined, "文档创建失败");
      return { status: "failed", errorMessage: "文档创建失败" };
    }
    log(`文档创建: ${docUrl}`);

    // Step 6: 记录成功
    const record = await createMeetingRecord(ctx, detail, "completed", docUrl, undefined, undefined, minutes);
    await createProcessingLog(record.id, "completed", "success", "纪要生成成功");

    // Fire-and-forget: extract todos if any actionItems found
    const actionItems = minutes?.actionItems as Array<Record<string, unknown>> | undefined;
    if (actionItems?.length) {
      void extractAndNotifyTodos(ctx.userId, record.id, actionItems, detail.topic ?? "未命名会议");
    }

    return { status: "completed", meetingRecordId: record.id, docUrl };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    log(`处理失败: ${errorMessage}`);
    await createMeetingRecord(ctx, detail, "failed", null, undefined, errorMessage);
    return { status: "failed", errorMessage };
  }
}

// 主入口：飞书事件 → 多份纪要（自动触发）
export async function handleMeetingEnded(
  event: FeishuMeetingEndedEvent,
): Promise<ProcessResult[]> {
  const meetingId = event.meeting.id;
  const results: ProcessResult[] = [];

  const log = (msg: string) => console.log(`[Pipeline ${meetingId}] ${msg}`);

  log(`收到事件: ${event.meeting.topic}`);

  // Step 1: 获取会议详情
  log("Step 1: 获取会议详情...");
  const detail = await fetchMeetingDetail(meetingId);
  if (!detail) {
    log("Step 1 失败: 无法获取会议详情（会议可能不存在或未开启妙记）");
    return [];
  }
  log(`Step 1 成功: 参会${detail.participantCount}人`);

  // Step 1.1: 缓存会议到 FeishuMeeting + 尝试拉逐字稿
  let transcriptText: string | null = null;
  const noteDocToken = detail.noteDocToken;

  const existing = await db.feishuMeeting.findUnique({ where: { meetingId }, select: { noteDocToken: true, transcriptText: true } });
  transcriptText = existing?.transcriptText ?? null;

  await db.feishuMeeting.upsert({
    where: { meetingId },
    update: {
      topic: detail.topic,
      startTime: detail.startTime ? new Date(Number(detail.startTime) * 1000) : null,
      endTime: detail.endTime ? new Date(Number(detail.endTime) * 1000) : null,
      hostUserId: detail.hostUserId,
      participantCount: detail.participantCount,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      participantsJson: detail.participants as any,
      ...(noteDocToken && !existing?.noteDocToken ? { noteDocToken } : {}),
    },
    create: {
      meetingId,
      topic: detail.topic,
      source: "feishu",
      startTime: detail.startTime ? new Date(Number(detail.startTime) * 1000) : null,
      endTime: detail.endTime ? new Date(Number(detail.endTime) * 1000) : null,
      hostUserId: detail.hostUserId,
      participantCount: detail.participantCount,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      participantsJson: detail.participants as any,
      noteDocToken,
    },
  });

  // 尝试拉逐字稿（可能还没好，此时设重试）
  if (!transcriptText) {
    // 找一个参会人 userId 用于取 user_access_token
    const candidateIds = new Set<string>();
    if (detail.hostUserId) candidateIds.add(detail.hostUserId);
    for (const p of detail.participants) candidateIds.add(p.userId);
    const accounts = candidateIds.size > 0 ? await db.account.findMany({
      where: { providerId: "lark", accountId: { in: [...candidateIds] } },
      select: { userId: true, accountId: true },
      orderBy: { updatedAt: "desc" },
    }) : [];
    const account = accounts.find((a) => a.accountId?.startsWith("ou_")) ?? accounts[0];
    const result = await tryFetchTranscript(meetingId, account?.userId ?? undefined);
    transcriptText = result.transcriptText;

    if (!transcriptText) {
      // 如果没有逐字稿（也没用户手动上传的）→ 设 5 分钟后重试
      const hasUserTranscript = await db.feishuMeeting.findUnique({ where: { meetingId }, select: { userTranscriptText: true } });
      if (!hasUserTranscript?.userTranscriptText) {
        await db.feishuMeeting.update({
          where: { meetingId },
          data: {
            transcriptRetryAt: new Date(Date.now() + 5 * 60 * 1000),
            transcriptRetryCount: { increment: 0 },
          },
        });
        log("暂无逐字稿，5 分钟后重试");
        return [];
      }
    }
  }

  // 没有逐字稿文本（自动和手动都没有）→ 不生成，等重试
  const userTranscript = (await db.feishuMeeting.findUnique({ where: { meetingId }, select: { userTranscriptText: true } }))?.userTranscriptText;
  if (!transcriptText && !userTranscript) {
    return [];
  }

  // meeting_source: 1=本企业 2=外部 — 只要收到事件就处理（企业成员参与即有权限）

  // Step 1.5: 参会人路由
  log("Step 1.5: 参会人路由...");
  const contexts = await routeParticipants(detail);
  if (contexts.length === 0) {
    log("Step 1.5: 无匹配的内部用户");
    return [];
  }
  log(`Step 1.5 成功: 匹配到 ${contexts.length} 个用户`);

  // 拆分用户：批量组（默认模板+无额外指令）vs 个性组（其余）
  const batchGroup = contexts.filter(
    (c) => !c.userSettings?.activePromptVersionId && !c.userSettings?.extraInstructions?.trim(),
  );
  const individualGroup = contexts.filter(
    (c) => c.userSettings?.activePromptVersionId || c.userSettings?.extraInstructions?.trim(),
  );

  // 批量组：共享 1 次 LLM，每人各建一份文档（省 LLM 成本，文档隔离）
  if (batchGroup.length > 0) {
    log(`批量组: ${batchGroup.length} 人（默认模板+无额外指令）→ 共享 1 次 LLM`);
    const batchCtx = batchGroup[0];
    try {
      // 用默认模板组装 Prompt（无需前置路由，无额外指令）
      const prompt = await assemblePrompt(batchCtx);
      const minutes = await generateMinutes(detail, prompt);

      if (!minutes) {
        log("批量 LLM 生成失败");
        for (const ctx of batchGroup) {
          const record = await createMeetingRecord(ctx, detail, "failed", null, undefined, "LLM 生成失败");
          results.push({ status: "failed", meetingRecordId: record.id, errorMessage: "LLM 生成失败" });
        }
      } else {
        normalizeMinutes(minutes);
        log(`批量 LLM 完成: ${minutes.title}`);
        // 给每人各建一份文档 + 协作者
        for (const ctx of batchGroup) {
          const userLog = (msg: string) => log(`[批量/用户${ctx.userId}] ${msg}`);
          const docUrl = await createFeishuDoc(ctx, minutes, ctx.userId);
          if (!docUrl) {
            userLog("文档创建失败");
            const record = await createMeetingRecord(ctx, detail, "failed", null, undefined, "文档创建失败");
            results.push({ status: "failed", meetingRecordId: record.id, errorMessage: "文档创建失败" });
            continue;
          }
          userLog(`文档创建: ${docUrl}`);
          const record = await createMeetingRecord(ctx, detail, "completed", docUrl, undefined, undefined, minutes);
          results.push({ status: "completed", meetingRecordId: record.id, docUrl });
          await createProcessingLog(record.id, "completed", "success", "纪要生成成功（批量）");
          const batchItems = minutes?.actionItems as Array<Record<string, unknown>> | undefined;
          if (batchItems?.length) {
            void extractAndNotifyTodos(ctx.userId, record.id, batchItems, detail.topic ?? "未命名会议");
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      log(`批量处理失败: ${errorMessage}`);
      for (const ctx of batchGroup) {
        await createMeetingRecord(ctx, detail, "failed", null, undefined, errorMessage);
        results.push({ status: "failed", errorMessage });
      }
    }
  }

  // 个性组：每人独立处理（不同模板或有个性指令）
  for (const ctx of individualGroup) {
    const userLog = (msg: string) => log(`[个性/用户${ctx.userId}] ${msg}`);
    try {
      // Step 2: 前置路由
      userLog("Step 2: 前置路由...");
      const preRoute = await runPreRoute(detail, ctx);
      if (preRoute.shouldSkip) {
        userLog(`跳过: ${preRoute.skipReason}`);
        const record = await createMeetingRecord(ctx, detail, "skipped", null, preRoute.skipReason);
        results.push({ status: "skipped", meetingRecordId: record.id, skippedReason: preRoute.skipReason });
        continue;
      }
      userLog("Step 2 完成");

      // Step 3: Prompt 组装
      userLog("Step 3: Prompt 组装...");
      const prompt = await assemblePrompt(ctx, preRoute.extractedRequirements);
      userLog("Step 3 完成");

      // Step 4: LLM 生成
      userLog("Step 4: LLM 生成...");
      const minutes = await generateMinutes(detail, prompt);
      if (!minutes) {
        userLog("Step 4 失败");
        await createMeetingRecord(ctx, detail, "failed", null, undefined, "LLM 生成失败");
        results.push({ status: "failed", errorMessage: "LLM 生成失败" });
        continue;
      }
      normalizeMinutes(minutes);
      userLog(`Step 4 完成: ${minutes.title}`);

      // Step 5: 创建飞书文档（tenant token + 协作者）
      userLog("Step 5: 创建飞书文档...");
      const docUrl = await createFeishuDoc(ctx, minutes, ctx.userId);
      if (!docUrl) {
        userLog("Step 5 失败");
        await createMeetingRecord(ctx, detail, "failed", null, undefined, "文档创建失败");
        results.push({ status: "failed", errorMessage: "文档创建失败" });
        continue;
      }
      userLog(`Step 5 完成: ${docUrl}`);

      // Step 6: 记录成功
      const record = await createMeetingRecord(ctx, detail, "completed", docUrl, undefined, undefined, minutes);
      results.push({ status: "completed", meetingRecordId: record.id, docUrl });
      userLog("Step 6 完成: 纪要已保存");

      await createProcessingLog(record.id, "completed", "success", "纪要生成成功");
      const indItems = minutes?.actionItems as Array<Record<string, unknown>> | undefined;
      if (indItems?.length) {
        void extractAndNotifyTodos(ctx.userId, record.id, indItems, detail.topic ?? "未命名会议");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      log(`处理失败: ${errorMessage}`);
      await createMeetingRecord(ctx, detail, "failed", null, undefined, errorMessage);
      results.push({ status: "failed", errorMessage });
    }
  }
  log(`完成: ${results.length} 条结果`);

  return results;
}

async function createMeetingRecord(
  ctx: PipelineContext,
  detail: { topic: string | null; startTime: string | null; endTime: string | null; hostUserId: string | null; participantCount: number },
  status: "completed" | "skipped" | "failed",
  docUrl: string | null,
  skippedReason?: string,
  errorMessage?: string,
  minutes?: MeetingMinutes | string,
) {
  let aiSummary: string | undefined;
  let minutesContent: string | undefined;
  let minutesJson: unknown | undefined;
  let searchText: string | undefined;

  if (minutes && typeof minutes !== "string") {
    aiSummary = minutes.summary || minutes.abstract;
    minutesJson = minutes;
    minutesContent = buildMinutesMarkdown(minutes);
    searchText = buildSearchText(minutes);
  } else if (typeof minutes === "string") {
    aiSummary = minutes;
  }

  return db.meetingRecord.create({
    data: {
      meetingId: ctx.meetingId,
      topic: detail.topic,
      startTime: detail.startTime ? new Date(Number(detail.startTime) * 1000) : null,
      endTime: detail.endTime ? new Date(Number(detail.endTime) * 1000) : null,
      hostUserId: detail.hostUserId,
      participantCount: detail.participantCount,
      status,
      userId: ctx.userId,
      promptVersionId: ctx.corePrompt ? ctx.userSettings?.activePromptVersionId : null,
      docUrl,
      aiSummary,
      minutesContent,
      minutesJson: minutesJson as unknown as Record<string, never> | undefined,
      searchText,
      skippedReason,
      errorMessage,
    },
  });
}

// 生成完整 Markdown 纪要文本
function buildMinutesMarkdown(minutes: MeetingMinutes): string {
  const lines: string[] = [];
  lines.push(`# ${minutes.title || "会议纪要"}`);
  lines.push("");
  lines.push(minutes.abstract || minutes.summary || "");
  lines.push("");

  if (minutes.categories?.length) {
    lines.push(`> 分类：${minutes.categories.join(" · ")}`);
    lines.push("");
  }

  if (minutes.discussionPoints?.length) {
    lines.push("## 讨论要点");
    for (const dp of minutes.discussionPoints) {
      const speakers = dp.speakers.length ? `（${dp.speakers.join("、")}）` : "";
      lines.push(`- **${dp.topic}**${speakers}: ${dp.summary}${dp.conclusion ? ` → ${dp.conclusion}` : ""}`);
    }
    lines.push("");
  }

  if (minutes.entities?.length) {
    lines.push("## 涉及实体");
    for (const e of minutes.entities) {
      lines.push(`- **${e.name}** [${e.type}]${e.role ? ` ${e.role}` : ""}${e.assessment ? `: ${e.assessment}` : ""}`);
    }
    lines.push("");
  }

  if (minutes.decisions?.length) {
    lines.push("## 会议决策");
    for (const d of minutes.decisions) {
      lines.push(`- **${d.decision}**${d.decidedBy ? ` (${d.decidedBy})` : ""}${d.status ? ` [${d.status}]` : ""}`);
    }
    lines.push("");
  }

  if (minutes.metrics?.length) {
    lines.push("## 关键数据");
    for (const m of minutes.metrics) {
      lines.push(`- **${m.name}**${m.value ? `: ${m.value}${m.unit ?? ""}` : ""}${m.trend ? ` [${m.trend}]` : ""}`);
    }
    lines.push("");
  }

  if (minutes.risks?.length) {
    lines.push("## 风险 & 问题");
    for (const r of minutes.risks) {
      lines.push(`- [${r.severity}] **${r.risk}**${r.owner ? ` @${r.owner}` : ""}${r.status ? ` [${r.status}]` : ""}`);
    }
    lines.push("");
  }

  if (minutes.actionItems?.length) {
    lines.push("## 待办事项");
    for (const a of minutes.actionItems) {
      lines.push(`- [ ] ${a.task}${a.owner ? ` @${a.owner}` : ""}${a.deadline ? ` ⏰${a.deadline}` : ""}${a.priority ? ` [${a.priority}]` : ""}`);
    }
    lines.push("");
  }

  if (minutes.keyQuotes?.length) {
    lines.push("## 关键发言");
    for (const q of minutes.keyQuotes) {
      lines.push(`> "${q.quote}" ${q.speaker ? `— ${q.speaker}` : ""}`);
    }
    lines.push("");
  }

  if (minutes.followUps?.length) {
    lines.push("## 后续关注");
    for (const f of minutes.followUps) {
      lines.push(`- **${f.topic}**${f.trigger ? ` → ${f.trigger}` : ""}${f.owner ? ` @${f.owner}` : ""}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// 生成搜索优化文本（去重拼接所有可检索字段）
function buildSearchText(minutes: MeetingMinutes): string {
  const parts: string[] = [];
  if (minutes.title) parts.push(minutes.title);
  if (minutes.abstract) parts.push(minutes.abstract);
  if (minutes.summary) parts.push(minutes.summary);
  if (minutes.categories?.length) parts.push(minutes.categories.join(" "));

  if (minutes.discussionPoints) {
    for (const dp of minutes.discussionPoints) {
      parts.push(dp.topic, dp.summary);
      if (dp.conclusion) parts.push(dp.conclusion);
    }
  }

  if (minutes.entities) {
    for (const e of minutes.entities) {
      parts.push(e.name);
      if (e.role) parts.push(e.role);
      if (e.assessment) parts.push(e.assessment);
    }
  }

  if (minutes.decisions) {
    for (const d of minutes.decisions) {
      parts.push(d.decision);
      if (d.rationale) parts.push(d.rationale);
    }
  }

  if (minutes.metrics) {
    for (const m of minutes.metrics) {
      parts.push(m.name);
      if (m.context) parts.push(m.context);
    }
  }

  if (minutes.risks) {
    for (const r of minutes.risks) {
      parts.push(r.risk);
      if (r.mitigation) parts.push(r.mitigation);
    }
  }

  if (minutes.actionItems) {
    for (const a of minutes.actionItems) {
      parts.push(a.task);
      if (a.owner) parts.push(a.owner);
    }
  }

  if (minutes.keyQuotes) {
    for (const q of minutes.keyQuotes) {
      parts.push(q.quote);
      if (q.speaker) parts.push(q.speaker);
    }
  }

  if (minutes.sentiment?.highlights) parts.push(...minutes.sentiment.highlights);
  if (minutes.sentiment?.concerns) parts.push(...minutes.sentiment.concerns);

  if (minutes.followUps) {
    for (const f of minutes.followUps) {
      parts.push(f.topic);
    }
  }

  if (minutes.keywords?.length) parts.push(...minutes.keywords);

  // 去重
  return [...new Set(parts.filter(Boolean))].join(" ");
}

async function createProcessingLog(
  recordIdOrMeetingId: string,
  step: string,
  status: string,
  detail?: string,
) {
  return db.processingLog.create({
    data: {
      meetingRecordId: recordIdOrMeetingId,
      step,
      status,
      detail,
    },
  });
}
