import { db } from "./client";

async function main() {
  // 创建系统用户（用于关联 ModelProvider）
  const sysUser = await db.user.upsert({
    where: { email: "system@lark-summary-pro.local" },
    update: {},
    create: {
      name: "System",
      email: "system@lark-summary-pro.local",
      emailVerified: true,
      isAdmin: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // 飞书应用凭证（从环境变量读取）
  const feishuAppId = process.env.FEISHU_APP_ID;
  const feishuAppSecret = process.env.FEISHU_APP_SECRET;
  if (feishuAppId && feishuAppSecret) {
    await db.systemConfig.upsert({
      where: { key: "feishu_app_id" },
      update: { value: feishuAppId },
      create: { key: "feishu_app_id", value: feishuAppId },
    });
    await db.systemConfig.upsert({
      where: { key: "feishu_app_secret" },
      update: { value: feishuAppSecret },
      create: { key: "feishu_app_secret", value: feishuAppSecret },
    });
  } else {
    console.log("⚠️ FEISHU_APP_ID / FEISHU_APP_SECRET 未设置，跳过飞书配置");
  }
  await db.systemConfig.upsert({
    where: { key: "member_access_mode" },
    update: { value: "open" },
    create: { key: "member_access_mode", value: "open" },
  });

  // 模型提供商（从环境变量读取）
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
  const count = await db.modelProvider.count();
  if (count === 0 && deepseekApiKey) {
    await db.modelProvider.create({
      data: {
        name: "DeepSeek",
        apiBase: "https://api.deepseek.com/v1",
        apiKey: deepseekApiKey,
        models: ["deepseek-v4-flash", "deepseek-v4-pro"],
        createdById: sysUser.id,
      },
    });
    console.log("✅ 已创建 DeepSeek 模型提供商");
  } else if (!deepseekApiKey) {
    console.log("⚠️ DEEPSEEK_API_KEY 未设置，跳过模型提供商创建");
  }
  console.log("✅ Seed 完成");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
