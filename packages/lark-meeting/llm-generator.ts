import { generateObject } from "ai";
import { MeetingMinutesSchema, type MeetingDetail, type MeetingMinutes } from "./types";
import { getTextModel } from "./model-factory";

// 调用 LLM 生成结构化会议纪要
export async function generateMinutes(
  detail: MeetingDetail,
  prompt: string,
  mockTranscript?: string,
): Promise<MeetingMinutes | null> {
  try {
    // 先获取逐字稿文本（mockTranscript 用于测试，跳过飞书 API）
    const transcript = mockTranscript ?? await getTranscriptText(detail);

    const systemPrompt = `${prompt}

会议信息：
- 标题：${detail.topic ?? "未知"}
- 参会人数：${detail.participantCount}
- 参会人：${detail.participants.map((p) => p.userName ?? p.userId).join("、")}`;

    const result = await generateObject({
      model: await getTextModel(), // 使用主力模型
      schema: MeetingMinutesSchema,
      system: systemPrompt,
      prompt: transcript
        ? `以下是会议逐字稿，请生成会议纪要：\n\n${transcript}`
        : `请根据会议基本信息生成会议纪要（注意：无法获取逐字稿，仅基于标题和参会人生成简要记录）`,
    });

    return result.object;
  } catch (error) {
    const e = error as Error & { cause?: unknown; url?: string; statusCode?: number };
    console.error("LLM 生成失败:", e.message);
    if (e.url) console.error("  请求 URL:", e.url);
    if (e.statusCode) console.error("  状态码:", e.statusCode);
    if (e.cause) console.error("  原因:", e.cause);
    return null;
  }
}

async function getTranscriptText(detail: MeetingDetail): Promise<string | null> {
  if (!detail.transcriptDocToken) return null;

  try {
    const { fetchTranscriptContent } = await import("./meeting-fetcher");
    return await fetchTranscriptContent(detail.transcriptDocToken);
  } catch {
    return null;
  }
}
