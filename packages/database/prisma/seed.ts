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

  // 飞书应用凭证
  await db.systemConfig.upsert({
    where: { key: "feishu_app_id" },
    update: { value: "REDACTED" },
    create: { key: "feishu_app_id", value: "REDACTED" },
  });
  await db.systemConfig.upsert({
    where: { key: "feishu_app_secret" },
    update: { value: "REDACTED" },
    create: { key: "feishu_app_secret", value: "REDACTED" },
  });
  await db.systemConfig.upsert({
    where: { key: "member_access_mode" },
    update: { value: "open" },
    create: { key: "member_access_mode", value: "open" },
  });

  // DeepSeek 模型提供商
  const count = await db.modelProvider.count();
  if (count === 0) {
    await db.modelProvider.create({
      data: {
        name: "DeepSeek",
        apiBase: "https://api.deepseek.com/chat/completions",
        apiKey: "REDACTED",
        models: ["deepseek-v4-flash", "deepseek-v4-pro"],
        createdById: sysUser.id,
      },
    });
    console.log("✅ 已创建 DeepSeek 模型提供商");
  }
  console.log("✅ Seed 完成");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
