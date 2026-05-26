import { db } from "@repo/database";
import type { PipelineContext, MeetingMinutes } from "./types";
import { getTenantAccessToken, addDocCollaborator, transferDocOwner } from "./feishu-client";

// 获取用户的飞书 open_id（优先返回 ou_ 格式的 open_id）
async function getUserOpenId(userId: string): Promise<string | null> {
  const accounts = await db.account.findMany({
    where: { userId, providerId: "lark" },
    orderBy: { updatedAt: "desc" },
  });
  for (const acc of accounts) {
    if (acc.accountId?.startsWith("ou_")) return acc.accountId;
  }
  return accounts[0]?.accountId ?? null;
}

// 获取用户的飞书 access token（过期自动刷新）
// 用于 meeting-search 同步会议等场景，文档创建不再使用
export async function getUserAccessToken(userId: string): Promise<string | null> {
  const accounts = await db.account.findMany({
    where: { userId, providerId: "lark" },
    orderBy: { updatedAt: "desc" },
  });
  // 优先取 ou_ 格式（飞书 open_id）的记录，其次取最新
  const account = accounts.find((a) => a.accountId?.startsWith("ou_")) ?? accounts[0];
  if (!account?.accessToken) return null;

  // 如果 accessTokenExpiresAt 不存在，或已过期（提前 5 分钟）→ 刷新
  const needsRefresh = !account.accessTokenExpiresAt ||
    new Date(account.accessTokenExpiresAt) <= new Date(Date.now() + 5 * 60 * 1000);

  if (needsRefresh) {
    if (!account.refreshToken) return account.accessToken; // 没有 refresh token，先试旧的
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
      if (!res.ok) return account.accessToken; // 刷新失败，试旧的
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
      // 刷新异常，返回现有 token 试一试
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

  const heading2 = (text: string) => ({
    block_type: 4,
    heading2: { elements: [{ text_run: { content: text } }] },
  });
  const bullet = (text: string) => ({
    block_type: 2,
    text: { elements: [{ text_run: { content: `· ${text}` } }] },
  });
  const para = (text: string) => ({
    block_type: 2,
    text: { elements: [{ text_run: { content: text } }] },
  });

  // 摘要
  blocks.push(para(minutes.abstract || minutes.summary));

  // 分类标签
  if (minutes.categories && minutes.categories.length > 0) {
    blocks.push(para(`🏷 ${minutes.categories.join(" · ")}`));
  }

  // 讨论要点
  if (minutes.discussionPoints && minutes.discussionPoints.length > 0) {
    blocks.push(heading2("讨论要点"));
    for (const dp of minutes.discussionPoints) {
      const speakers = dp.speakers.length > 0 ? `【${dp.speakers.join("、")}】` : "";
      blocks.push(bullet(`**${dp.topic}** ${speakers}`));
      blocks.push(para(`  ${dp.summary}`));
      if (dp.conclusion) blocks.push(para(`  → 结论：${dp.conclusion}`));
    }
  } else if (minutes.keyPoints.length > 0) {
    // 向后兼容：旧版没有 discussionPoints 时用 keyPoints
    blocks.push(heading2("关键要点"));
    for (const point of minutes.keyPoints) {
      blocks.push(bullet(point));
    }
  }

  // 实体
  if (minutes.entities && minutes.entities.length > 0) {
    blocks.push(heading2("涉及实体"));
    for (const e of minutes.entities) {
      const roleTag = e.role ? `[${e.role}] ` : "";
      const assess = e.assessment ? ` — ${e.assessment}` : "";
      blocks.push(bullet(`**${e.name}** ${roleTag}(${e.type})${assess}`));
    }
  }

  // 决策
  if (minutes.decisions && minutes.decisions.length > 0) {
    blocks.push(heading2("会议决策"));
    for (const d of minutes.decisions) {
      const by = d.decidedBy ? `（${d.decidedBy}）` : "";
      const status = d.status ? ` [${d.status}]` : "";
      blocks.push(bullet(`**${d.decision}**${by}${status}`));
      if (d.rationale) blocks.push(para(`  理由：${d.rationale}`));
      if (d.impact) blocks.push(para(`  影响：${d.impact}`));
    }
  }

  // 数据指标
  if (minutes.metrics && minutes.metrics.length > 0) {
    blocks.push(heading2("关键数据"));
    for (const m of minutes.metrics) {
      const val = m.value ? `: ${m.value}${m.unit ?? ""}` : "";
      const trend = m.trend ? ` [${m.trend}]` : "";
      const comp = m.comparison ? ` (${m.comparison})` : "";
      blocks.push(bullet(`**${m.name}**${val}${trend}${comp}`));
      if (m.context) blocks.push(para(`  ${m.context}`));
    }
  }

  // 风险
  if (minutes.risks && minutes.risks.length > 0) {
    blocks.push(heading2("风险 & 问题"));
    for (const r of minutes.risks) {
      const severityIcon = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" }[r.severity] ?? "⚪";
      const status = r.status ? ` [${r.status}]` : "";
      const owner = r.owner ? ` @${r.owner}` : "";
      blocks.push(bullet(`${severityIcon} **${r.risk}**${status}${owner}`));
      if (r.mitigation) blocks.push(para(`  缓解：${r.mitigation}`));
    }
  }

  // 待办
  if (minutes.actionItems && minutes.actionItems.length > 0) {
    blocks.push(heading2("待办事项"));
    for (const item of minutes.actionItems) {
      const owner = item.owner ? ` @${item.owner}` : "";
      const deadline = item.deadline ? ` ⏰${item.deadline}` : "";
      const priority = item.priority ? ` [${item.priority}]` : "";
      const dep = item.dependsOn ? ` (依赖: ${item.dependsOn})` : "";
      blocks.push(bullet(`- [ ] ${item.task}${owner}${deadline}${priority}${dep}`));
    }
  }

  // 关键引用
  if (minutes.keyQuotes && minutes.keyQuotes.length > 0) {
    blocks.push(heading2("关键发言"));
    for (const q of minutes.keyQuotes) {
      const speaker = q.speaker ? `— ${q.speaker}` : "";
      blocks.push(para(`> "${q.quote}" ${speaker}`));
    }
  }

  // 情绪
  if (minutes.sentiment) {
    const s = minutes.sentiment;
    const label = { positive: "😊 积极", neutral: "😐 中性", negative: "😟 消极", mixed: "🤔 分歧" }[s.overall] ?? s.overall;
    blocks.push(heading2("整体判断"));
    blocks.push(para(label));
    if (s.highlights?.length) blocks.push(para(`亮点：${s.highlights.join("；")}`));
    if (s.concerns?.length) blocks.push(para(`担忧：${s.concerns.join("；")}`));
  }

  // 后续关注
  if (minutes.followUps && minutes.followUps.length > 0) {
    blocks.push(heading2("后续关注"));
    for (const f of minutes.followUps) {
      const trigger = f.trigger ? ` → ${f.trigger}` : "";
      const owner = f.owner ? ` @${f.owner}` : "";
      blocks.push(bullet(`**${f.topic}**${trigger}${owner}`));
    }
  }

  return blocks;
}
