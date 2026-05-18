import { db } from "@repo/database";
import type { PipelineContext, MeetingMinutes } from "./types";
import { getTenantAccessToken } from "./feishu-client";

// 获取用户的飞书 access token（过期自动刷新）
async function getUserAccessToken(userId: string): Promise<string | null> {
  const account = await db.account.findFirst({
    where: { userId, providerId: "lark" },
  });
  if (!account?.accessToken) return null;

  // 检查是否过期（提前 5 分钟刷新）
  if (account.accessTokenExpiresAt && new Date(account.accessTokenExpiresAt) <= new Date(Date.now() + 5 * 60 * 1000)) {
    if (!account.refreshToken) return null;
    try {
      // Feishu OAuth 2.0 refresh token endpoint
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

// 转移文档所有权给用户（用 tenant_access_token，因为应用是创建者）
async function transferOwner(docToken: string, userOpenId: string): Promise<boolean> {
  const token = await getTenantAccessToken();
  if (!token) return false;

  try {
    const res = await fetch(
      `https://open.feishu.cn/open-apis/drive/v1/permissions/${docToken}/members/transfer_owner?type=docx&need_notification=false`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          member_type: "openid",
          member_id: userOpenId,
        }),
      },
    );
    const json = await res.json();
    if (json.code !== 0) {
      console.error("转移文档所有权失败:", json.msg);
      return false;
    }
    return true;
  } catch (e) {
    console.error("转移文档所有权异常:", e);
    return false;
  }
}

// 获取用户的 open_id
async function getUserOpenId(userId: string): Promise<string | null> {
  const account = await db.account.findFirst({
    where: { userId, providerId: "lark" },
  });
  return account?.accountId ?? null;
}

// 在用户指定文件夹创建飞书文档并写入纪要内容
// 三层降级：user token → tenant token + transfer → 纯 tenant token
export async function createFeishuDoc(
  ctx: PipelineContext,
  minutes: MeetingMinutes,
  userId?: string,
): Promise<string | null> {
  let token: string | null = null;
  let usedUserToken = false;

  // 第一层：尝试 user_access_token（文档直接归用户所有）
  if (userId) {
    token = await getUserAccessToken(userId);
    if (token) usedUserToken = true;
  }

  // 第二层：降级 tenant_access_token（后面用 transfer_owner 补救）
  if (!token) {
    token = await getTenantAccessToken();
  }
  if (!token) return null;

  try {
    // Step 1: 创建空文档
    const folderToken = ctx.userSettings?.saveFolderToken;
    const createBody: Record<string, unknown> = {
      title: minutes.title || `会议纪要 - ${new Date().toLocaleDateString("zh-CN")}`,
    };
    if (folderToken && usedUserToken) {
      // folder_token 只在 user token 场景有效（用户自己的文件夹）
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

    let createResText = "";
    if (!createRes.ok) {
      createResText = await createRes.text();
      console.error("创建文档失败:", createResText);
      // 如果是 user token 权限不足，降级为 tenant token 重试
      if (usedUserToken && createResText.includes("99991679")) {
        console.log("user token 权限不足，降级为 tenant token 创建 + transfer_owner");
        token = await getTenantAccessToken();
        if (!token) return null;
        usedUserToken = false;
        // 重试创建
        const retryRes = await fetch("https://open.feishu.cn/open-apis/docx/v1/documents", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ title: createBody.title }),
        });
        if (!retryRes.ok) {
          console.error("降级创建也失败:", await retryRes.text());
          return null;
        }
        const retryJson = await retryRes.json();
        const retryDocId: string = retryJson.data?.document?.document_id;
        if (!retryDocId) return null;

        // 写入内容
        const retryContent = formatMinutesAsBlocks(minutes);
        const retryBlockRes = await fetch(
          `https://open.feishu.cn/open-apis/docx/v1/documents/${retryDocId}/blocks/${retryDocId}/children`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ children: retryContent, index: -1 }),
          },
        );
        if (!retryBlockRes.ok) console.error("写入内容失败:", await retryBlockRes.text());

        // 转移所有权
        if (userId) {
          const openId = await getUserOpenId(userId);
          if (openId) await transferOwner(retryDocId, openId);
        }
        return `https://feishu.cn/docx/${retryDocId}`;
      }
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
    }

    // Step 3: 如果不是 user token 创建的，尝试转移所有权给用户
    if (!usedUserToken && userId) {
      const openId = await getUserOpenId(userId);
      if (openId) {
        const transferred = await transferOwner(documentId, openId);
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
    block_type: 2, // 文本块
    text: {
      elements: [{ text_run: { content: minutes.summary } }],
    },
  });

  // 要点
  if (minutes.keyPoints.length > 0) {
    blocks.push({
      block_type: 4, // heading2
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
