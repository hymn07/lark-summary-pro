import { db } from "@repo/database";
import { syncUserMeetings, getCachedMeetings } from "@repo/lark-meeting/meeting-search";

async function main() {
  const account = await db.account.findFirst({
    where: { providerId: "lark" },
    orderBy: { updatedAt: "desc" },
  });
  if (!account?.accessToken) { console.log("no token"); process.exit(0); }

  console.log("开始同步...\n");
  const cached = await syncUserMeetings(account.accessToken, 90);
  console.log(`\n同步完成，${cached.length} 个会议已缓存\n`);

  // 列出缓存
  const list = await getCachedMeetings(20);
  console.log("当前缓存的会议:");
  for (const m of list) {
    console.log(`  📋 ${m.topic ?? "无标题"}`);
    console.log(`     source=${m.source} 妙记=${m.noteDocToken?.slice(0, 10) ?? "无"}`);
    console.log(`     逐字稿=${m.transcriptText ? m.transcriptText.length + "字" : "无"}`);
    console.log(`     参会人=${(m.participantsJson as Array<unknown>)?.length ?? 0}人`);
    console.log("");
  }

  process.exit(0);
}

main().catch(console.error);
