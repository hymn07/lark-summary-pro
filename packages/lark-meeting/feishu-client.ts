import { getConfig } from "./config-reader";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

// 获取飞书 tenant_access_token（带缓存）
export async function getTenantAccessToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const [appId, appSecret] = await Promise.all([
    getConfig("feishu_app_id"),
    getConfig("feishu_app_secret"),
  ]);

  if (!appId || !appSecret) return null;

  try {
    const res = await fetch(
      "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      },
    );

    if (!res.ok) return null;

    const json = await res.json();
    cachedToken = json.tenant_access_token ?? null;
    tokenExpiresAt = Date.now() + ((json.expire ?? 7200) - 300) * 1000;
    return cachedToken;
  } catch {
    return null;
  }
}

// 批量获取用户姓名（不校验通讯录授权范围）
export async function batchGetUserNames(userIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (userIds.length === 0) return result;

  const token = await getTenantAccessToken();
  if (!token) return result;

  // 每次最多 10 个
  for (let i = 0; i < userIds.length; i += 10) {
    const batch = userIds.slice(i, i + 10);
    try {
      const res = await fetch(
        "https://open.feishu.cn/open-apis/contact/v3/users/basic_batch?user_id_type=open_id",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify({ user_ids: batch }),
        },
      );
      if (!res.ok) continue;
      const json = await res.json();
      if (json.code !== 0) continue;
      for (const user of json.data?.users ?? []) {
        result.set(user.user_id, user.name);
      }
    } catch {
      continue;
    }
  }

  return result;
}

// 添加文档协作者
export async function addDocCollaborator(
  docToken: string,
  openId: string,
  perm = "full_access",
): Promise<boolean> {
  const token = await getTenantAccessToken();
  if (!token) return false;

  try {
    const res = await fetch(
      `https://open.feishu.cn/open-apis/drive/v1/permissions/${docToken}/members?type=docx`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          member_type: "openid",
          member_id: openId,
          perm,
        }),
      },
    );
    const json = await res.json();
    if (json.code !== 0) {
      console.error("添加协作者失败:", json.msg);
      return false;
    }
    return true;
  } catch (e) {
    console.error("添加协作者异常:", e);
    return false;
  }
}
