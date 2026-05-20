import { generateText } from "ai";
import { MeetingMinutesSchema, type MeetingDetail, type MeetingMinutes } from "./types";
import { getTextModel } from "./model-factory";

// 调用 LLM 生成结构化会议纪要
// 注意：DeepSeek 不支持 json_schema，需要用 generateText + JSON.parse
export async function generateMinutes(
  detail: MeetingDetail,
  prompt: string,
  mockTranscript?: string,
): Promise<MeetingMinutes | null> {
  try {
    const transcript = mockTranscript ?? await getTranscriptText(detail);
    if (!transcript) return null; // 无逐字稿不生成（不编造）

    const systemPrompt = `${prompt}

会议信息：
- 标题：${detail.topic ?? "未知"}
- 参会人数：${detail.participantCount}
- 参会人：${detail.participants.map((p) => p.userName ?? p.userId).join("、")}

重要：请只输出 JSON，不要包含任何其他文字。`;

    const { text } = await generateText({
      model: await getTextModel(),
      system: systemPrompt,
      prompt: `以下是会议逐字稿，请生成会议纪要（只输出JSON）：\n\n${transcript}`,
    });

    // 提取 JSON（模型可能在 JSON 外面包了 ```json ... ```）
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("LLM 输出中没有 JSON:", text.slice(0, 200));
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return MeetingMinutesSchema.parse(parsed);
  } catch (error) {
    const e = error as Error & { url?: string; statusCode?: number };
    console.error("LLM 生成失败:", e.message);
    if (e.url) console.error("  请求 URL:", e.url);
    if (e.statusCode) console.error("  状态码:", e.statusCode);
    return null;
  }
}

async function getTranscriptText(detail: MeetingDetail): Promise<string | null> {
  const { db } = await import("@repo/database");

  // 先从 FeishuMeeting 缓存读取（自动获取和手动上传都有）
  const cached = await db.feishuMeeting.findUnique({
    where: { meetingId: detail.id },
    select: { transcriptText: true, userTranscriptText: true },
  });

  // 优先用自动获取的，其次用手动上传的
  if (cached?.transcriptText) return cached.transcriptText;
  if (cached?.userTranscriptText) return cached.userTranscriptText;

  // 缓存没有 → 尝试实时拉取（通过 docToken）
  if (detail.transcriptDocToken) {
    try {
      const { fetchTranscriptContent } = await import("./meeting-fetcher");
      return await fetchTranscriptContent(detail.transcriptDocToken);
    } catch { /* fall through */ }
  }

  return null;
}
