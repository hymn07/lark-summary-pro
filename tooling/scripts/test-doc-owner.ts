/**
 * 测试：创建文档 → 添加协作者 → 转移所有权
 * 不依赖 @repo/lark-meeting，直接调飞书 API
 */
import "dotenv/config";
import { db } from "@repo/database";

const TENANT_TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";

async function getConfigFromDB(key: string): Promise<string | null> {
  const row = await db.systemConfig.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function getTenantToken() {
  const [appId, appSecret] = await Promise.all([
    getConfigFromDB("feishu_app_id"),
    getConfigFromDB("feishu_app_secret"),
  ]);
  if (!appId || !appSecret) throw new Error("飞书应用凭证未配置");
  const res = await fetch(TENANT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const json = await res.json();
  return json.tenant_access_token as string | null;
}

async function main() {
  console.log("═══ 文档创建 + 协作者 + 所有权转移测试 ═══\n");

  // 1. tenant_access_token
  console.log("1. 获取 tenant_access_token...");
  const tenantToken = await getTenantToken();
  if (!tenantToken) { console.log("❌ 失败"); process.exit(1); }
  console.log(`   ✅ ${tenantToken.slice(0, 20)}...\n`);

  // 2. 找当前用户的飞书 open_id
  console.log("2. 查找用户...");
  const account = await db.account.findFirst({
    where: { providerId: "lark" },
    orderBy: { updatedAt: "desc" },
  });
  if (!account) { console.log("❌ 没有飞书账号，请先登录"); process.exit(1); }
  const userOpenId = account.accountId;
  console.log(`   userId: ${account.userId}`);
  console.log(`   open_id: ${userOpenId}\n`);

  // 3. 创建文档（tenant_access_token）
  console.log("3. 创建文档...");
  const createRes = await fetch("https://open.feishu.cn/open-apis/docx/v1/documents", {
    method: "POST",
    headers: { Authorization: `Bearer ${tenantToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ title: `测试文档 - ${new Date().toLocaleString("zh-CN")}` }),
  });
  const createJson = await createRes.json();
  console.log(`   code=${createJson.code} msg=${createJson.msg}`);
  const docId: string = createJson.data?.document?.document_id;
  if (!docId) { console.log("❌ 创建失败:", JSON.stringify(createJson)); process.exit(1); }
  console.log(`   ✅ docId: ${docId}`);
  console.log(`   链接: https://feishu.cn/docx/${docId}\n`);

  // 4. 写入内容
  console.log("4. 写入内容...");
  const blockRes = await fetch(
    `https://open.feishu.cn/open-apis/docx/v1/documents/${docId}/blocks/${docId}/children`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${tenantToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        children: [
          { block_type: 2, text: { elements: [{ text_run: { content: "测试摘要：应用创建的测试文档" } }] } },
        ],
        index: -1,
      }),
    },
  );
  const blockJson = await blockRes.json();
  console.log(`   code=${blockJson.code} msg=${blockJson.msg}\n`);

  // 5. 添加用户为协作者
  console.log(`5. 添加协作者 open_id=${userOpenId}...`);
  const collabRes = await fetch(
    `https://open.feishu.cn/open-apis/drive/v1/permissions/${docId}/members?type=docx`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${tenantToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ member_type: "openid", member_id: userOpenId, perm: "full_access" }),
    },
  );
  const collabJson = await collabRes.json();
  console.log(`   code=${collabJson.code} msg=${collabJson.msg}`);
  if (collabJson.code === 0) {
    console.log("   ✅ 协作者添加成功\n");
  } else {
    console.log(`   ⚠️ 失败 — 完整响应: ${JSON.stringify(collabJson)}\n`);
  }

  // 6. 转移所有权
  console.log(`6. 转移所有权给 open_id=${userOpenId}...`);
  console.log(`   (stay_put=false move to user dir, remove_old_owner=false keep app perm)`);
  const transferRes = await fetch(
    `https://open.feishu.cn/open-apis/drive/v1/permissions/${docId}/members/transfer_owner` +
    `?type=docx&need_notification=false&remove_old_owner=false&old_owner_perm=full_access&stay_put=false`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${tenantToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ member_type: "openid", member_id: userOpenId }),
    },
  );
  const transferJson = await transferRes.json();
  console.log(`   code=${transferJson.code} msg=${transferJson.msg}`);
  if (transferJson.code === 0) {
    console.log("   ✅ 所有权转移成功\n");
  } else {
    console.log(`   ⚠️ 失败 — 完整: ${JSON.stringify(transferJson)}`);
    if (transferJson.code === 1063002) {
      console.log("   💡 错误 1063002: 应用不是文档协作者");
      console.log("   💡 去飞书打开 https://feishu.cn/docx/" + docId);
      console.log("   💡 右上角「...」→「...更多」→「添加文档应用」→ 搜索你的应用");
    }
    console.log("");
  }

  // 7. 查看权限
  console.log("7. 查看当前文档权限...");
  const listRes = await fetch(
    `https://open.feishu.cn/open-apis/drive/v1/permissions/${docId}/members?type=docx`,
    { headers: { Authorization: `Bearer ${tenantToken}` } },
  );
  const listJson = await listRes.json();
  console.log(`   code=${listJson.code} msg=${listJson.msg}`);
  if (listJson.code === 0) {
    for (const m of listJson.data?.members ?? []) {
      console.log(`   - ${m.member_type}:${m.member_id} perm=${m.perm}`);
    }
  }

  console.log(`\n═══ 完成 ═══`);
  console.log(`文档: https://feishu.cn/docx/${docId}`);
  process.exit(0);
}

main().catch(console.error);
