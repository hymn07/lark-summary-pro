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
