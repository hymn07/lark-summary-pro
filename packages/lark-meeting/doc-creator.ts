import { db } from "@repo/database";
import type { PipelineContext, MeetingMinutes } from "./types";
import { getTenantAccessToken, addDocCollaborator, transferDocOwner } from "./feishu-client";

// 获取用户的 open_id
async function getUserOpenId(userId: string): Promise<string | null> {
  const account = await db.account.findFirst({
    where: { userId, providerId: "lark" },
  });
  return account?.accountId ?? null;
}

// 获取用户的飞书 access token（过期自动刷新）
// 用于 meeting-search 同步会议等场景，文档创建不再使用
export async function getUserAccessToken(userId: string): Promise<string | null> {
  const account = await db.account.findFirst({
    where: { userId, providerId: "lark" },
  });
  if (!account?.accessToken) return null;

  if (account.accessTokenExpiresAt && new Date(account.accessTokenExpiresAt) <= new Date(Date.now() + 5 * 60 * 1000)) {
    if (!account.refreshToken) return null;
    try {
      const refreshUrl = new URL("https://open.feishu.cn/open-apis/authen/v2/oauth/token");
      refreshUrl.searchParams.set("client_id", process.env.FEISHU_APP_ID ?? "");
      refreshUrl.searchParams.set("client_secret", process.env.FEISHU_APP_SECRET ?? "");
      refreshUrl.searchParams.set("grant_type", "refresh_token");
      refreshUrl.searchParams.set("refresh_token", account.refreshToken);

      const res = await fetch(refreshUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
      if (!res.ok) return null;
      const json = await res.json();
      const tokenData = json.data ?? json;
      if (tokenData.access_token) {
        await db.account.update({
          where: { id: account.id },
          data: {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token ?? account.refreshToken,
            accessTokenExpiresAt: tokenData.expires_in
              ? new Date(Date.now() + tokenData.expires_in * 1000)
              : null,
          },
        });
        return tokenData.access_token;
      }
    } catch {
      return null;
    }
  }

  return account.accessToken;
}

// 创建飞书文档并写入纪要内容（全部建在应用下，用户加成协作者）
export async function createFeishuDoc(
  ctx: PipelineContext,
  minutes: MeetingMinutes,
  userId?: string,
): Promise<string | null> {
  const token = await getTenantAccessToken();
  if (!token) return null;

  try {
    // Step 1: 创建空文档
    const createBody: Record<string, unknown> = {
      title: minutes.title || `会议纪要 - ${new Date().toLocaleDateString("zh-CN")}`,
    };

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
        body: JSON.stringify({ children: content, index: -1 }),
      },
    );

    if (!blockRes.ok) {
      console.error("写入文档内容失败:", await blockRes.text());
      // 内容写入失败不影响 URL 返回，文档已创建
    }

    // Step 3: 添加用户为协作者 → 转移所有权
    if (userId) {
      const openId = await getUserOpenId(userId);
      if (openId) {
        // 先添加协作者，再转移所有权（两步都要，否则转移可能失败）
        await addDocCollaborator(documentId, openId);
        const transferred = await transferDocOwner(documentId, openId);
        if (transferred) {
          console.log(`文档所有权已转移: ${documentId} → ${openId}`);
        }
      }
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
    block_type: 2,
    text: {
      elements: [{ text_run: { content: minutes.summary } }],
    },
  });

  // 要点
  if (minutes.keyPoints.length > 0) {
    blocks.push({
      block_type: 4,
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
      block_type: 4,
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
      block_type: 4,
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
