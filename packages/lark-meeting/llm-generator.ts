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

    const systemPrompt = `${prompt}

会议信息：
- 标题：${detail.topic ?? "未知"}
- 参会人数：${detail.participantCount}
- 参会人：${detail.participants.map((p) => p.userName ?? p.userId).join("、")}

重要：请只输出 JSON，不要包含任何其他文字。`;

    const { text } = await generateText({
      model: await getTextModel(),
      system: systemPrompt,
      prompt: transcript
        ? `以下是会议逐字稿，请生成会议纪要（只输出JSON）：\n\n${transcript}`
        : `请根据会议基本信息生成会议纪要（只输出JSON）`,
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
  if (!detail.transcriptDocToken) return null;
  try {
    const { fetchTranscriptContent } = await import("./meeting-fetcher");
    return await fetchTranscriptContent(detail.transcriptDocToken);
  } catch {
    return null;
  }
}
