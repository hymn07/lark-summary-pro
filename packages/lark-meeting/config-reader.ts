import { db } from "@repo/database";

// 从 SystemConfig 表读取配置
export async function getConfig(key: string): Promise<string | null> {
  const config = await db.systemConfig.findUnique({ where: { key } });
  return config?.value ?? null;
}

export async function setConfig(key: string, value: string): Promise<void> {
  await db.systemConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

// 获取成员接入模式
export async function getMemberAccessMode(): Promise<"open" | "whitelist"> {
  const value = await getConfig("member_access_mode");
  return value === "whitelist" ? "whitelist" : "open";
}

// 获取飞书应用凭证（env 优先，DB 降级）
export async function getFeishuCredentials(): Promise<{
  appId: string | null;
  appSecret: string | null;
}> {
  const appId = process.env.FEISHU_APP_ID || (await getConfig("feishu_app_id"));
  const appSecret = process.env.FEISHU_APP_SECRET || (await getConfig("feishu_app_secret"));
  return { appId, appSecret };
}

// 获取模型提供商列表
export async function getModelProviders(): Promise<
  { id: string; name: string; apiBase: string; apiKey: string; models: unknown }[]
> {
  return db.modelProvider.findMany();
}

// 获取用户可用的模型
export async function getUserModels(userId: string): Promise<string[]> {
  const accesses = await db.userModelAccess.findMany({
    where: { userId },
    include: { modelProvider: true },
  });
  return accesses.map((a) => a.modelProviderId);
}
