import type { PipelineContext, MeetingMinutes } from "./types";

// 在用户指定文件夹创建飞书文档并写入纪要内容
export async function createFeishuDoc(
  ctx: PipelineContext,
  minutes: MeetingMinutes,
): Promise<string | null> {
  const token = await getTenantAccessToken();
  if (!token) return null;

  try {
    // Step 1: 创建空文档
    const folderToken = ctx.userSettings?.saveFolderToken;
    const createBody: Record<string, unknown> = {
      title: minutes.title || `会议纪要 - ${new Date().toLocaleDateString("zh-CN")}`,
    };
    if (folderToken) {
      createBody.folder_token = folderToken;
    }

    const createRes = await fetch("https://open.feishu.cn/open-apis/docx/v1/documents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createBody),
    });

    if (!createRes.ok) {
      console.error("创建文档失败:", await createRes.text());
      return null;
    }

    const createJson = await createRes.json();
    const documentId: string = createJson.data?.document?.document_id;
    if (!documentId) return null;

    // Step 2: 写入内容
    const content = formatMinutesAsBlocks(minutes);
    const blockRes = await fetch(
      `https://open.feishu.cn/open-apis/docx/v1/documents/${documentId}/blocks/${documentId}/children`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ children: content }),
      },
    );

    if (!blockRes.ok) {
      console.error("写入文档内容失败:", await blockRes.text());
      // 文档已创建但内容写入失败，仍然返回 URL
    }

    return `https://feishu.cn/docx/${documentId}`;
  } catch (error) {
    console.error("创建飞书文档失败:", error);
    return null;
  }
}

// 将会议纪要格式化为飞书文档 Block
function formatMinutesAsBlocks(minutes: MeetingMinutes) {
  const blocks: Record<string, unknown>[] = [];

  // 摘要
  blocks.push({
    block_type: 2, // 文本块
    text: {
      elements: [{ text_run: { content: minutes.summary } }],
      style: {},
    },
  });

  // 要点
  if (minutes.keyPoints.length > 0) {
    blocks.push({
      block_type: 3, // 标题
      heading2: {
        elements: [{ text_run: { content: "关键要点" } }],
      },
    });
    for (const point of minutes.keyPoints) {
      blocks.push({
        block_type: 2,
        text: {
          elements: [{ text_run: { content: `· ${point}` } }],
        },
      });
    }
  }

  // 决策
  if (minutes.decisions && minutes.decisions.length > 0) {
    blocks.push({
      block_type: 3,
      heading2: {
        elements: [{ text_run: { content: "会议决策" } }],
      },
    });
    for (const d of minutes.decisions) {
      blocks.push({
        block_type: 2,
        text: {
          elements: [{ text_run: { content: `· ${d}` } }],
        },
      });
    }
  }

  // 待办
  if (minutes.actionItems && minutes.actionItems.length > 0) {
    blocks.push({
      block_type: 3,
      heading2: {
        elements: [{ text_run: { content: "待办事项" } }],
      },
    });
    for (const item of minutes.actionItems) {
      const text = item.assignee ? `- [ ] ${item.task} (@${item.assignee})` : `- [ ] ${item.task}`;
      blocks.push({
        block_type: 2,
        text: {
          elements: [{ text_run: { content: text } }],
        },
      });
    }
  }

  return blocks;
}

async function getTenantAccessToken(): Promise<string | null> {
  // TODO: 需要从 SystemConfig 读取 feishu_app_id 和 feishu_app_secret
  return null;
}
