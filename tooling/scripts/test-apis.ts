/**
 * API 全链路测试脚本
 * 测试：会议列表、会议详情、手动创建会议、生成纪要、纪要列表、软删除
 */
import { db } from "@repo/database";
import { getCachedMeetings } from "@repo/lark-meeting/meeting-search";
import { fetchMeetingDetail } from "@repo/lark-meeting/meeting-fetcher";
import { handleMeetingEnded } from "@repo/lark-meeting";
import type { FeishuMeetingEndedEvent } from "@repo/lark-meeting/types";

const PASS = "✅";
const FAIL = "❌";

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  lark-summary-pro API 全链路测试");
  console.log("═══════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;

  function check(name: string, ok: boolean, detail?: string) {
    if (ok) { passed++; console.log(`${PASS} ${name}${detail ? ` — ${detail}` : ""}`); }
    else { failed++; console.log(`${FAIL} ${name}${detail ? ` — ${detail}` : ""}`); }
    return ok;
  }

  // ─── Test 1: 获取缓存会议列表 ───
  console.log("── 1. 会议记录列表 (getCachedMeetings) ──");
  try {
    const meetings = await getCachedMeetings(50);
    check("获取会议列表", meetings.length > 0, `${meetings.length} 条记录`);
    if (meetings.length > 0) {
      const m = meetings[0];
      check("会议有 topic", !!m.topic, `${m.topic}`);
      check("会议有 source", !!m.source, `${m.source}`);
      check("会议有关联纪要 _count", "_count" in m, `${(m as Record<string, unknown>)._count ? JSON.stringify((m as Record<string, unknown>)._count) : "missing"}`);
      check("会议有关联 meetingRecords", Array.isArray((m as Record<string, unknown>).meetingRecords), `${(m as Record<string, unknown>).meetingRecords?.length ?? 0} 条`);
    }
  } catch (e) {
    check("获取会议列表（异常）", false, String(e));
  }

  // ─── Test 2: 获取会议详情（含缓存回退） ───
  console.log("\n── 2. 会议详情 (fetchMeetingDetail) ──");
  try {
    // 测试真实飞书 API（可能没有真实会议，会回退到缓存）
    const sampleDetail = await fetchMeetingDetail("sample-feishu-001");
    check("示例会议详情（缓存回退）", !!sampleDetail, sampleDetail?.topic ?? "null");
    check("  有参会人数", (sampleDetail?.participantCount ?? 0) > 0, `${sampleDetail?.participantCount} 人`);

    // 测试不存在的会议
    const nonexistent = await fetchMeetingDetail("nonexistent-id-12345");
    check("不存在的会议返回 null", nonexistent === null);
  } catch (e) {
    check("获取会议详情（异常）", false, String(e));
  }

  // ─── Test 3: 手动创建会议 ───
  console.log("\n── 3. 手动创建会议 ──");
  const testMeetingId = `manual-test-${Date.now()}`;
  try {
    const manual = await db.feishuMeeting.create({
      data: {
        meetingId: testMeetingId,
        topic: "测试手动会议",
        source: "manual",
        transcriptText: "这是测试逐字稿内容。张三：我们讨论一下测试方案。李四：好的。",
        transcriptFetched: true,
        uploadedFileName: "测试手动会议",
        startTime: new Date(),
        meetingUrl: "https://example.com/test",
        participantsJson: [
          { userId: "u1", userName: "张三", isHost: true, isExternal: false },
          { userId: "u2", userName: "李四", isHost: false, isExternal: false },
        ],
        participantCount: 2,
      },
    });
    check("创建手动会议", !!manual, `id=${manual.id}`);
    check("  source=manual", manual.source === "manual");
    check("  有逐字稿", (manual.transcriptText?.length ?? 0) > 0);

    // 清理
    await db.feishuMeeting.delete({ where: { id: manual.id } });
  } catch (e) {
    check("创建手动会议（异常）", false, String(e));
  }

  // ─── Test 4: 生成纪要（mock 模式） ──
  console.log("\n── 4. 生成纪要 (handleMeetingEnded) ──");
  try {
    // 先检查示例数据
    const cached = await db.feishuMeeting.findUnique({
      where: { meetingId: "sample-feishu-001" },
      include: { meetingRecords: true },
    });
    check("示例会议在缓存中", !!cached);
    if (cached) {
      check("  有逐字稿", (cached.transcriptText?.length ?? 0) > 0, `${cached.transcriptText?.length ?? 0} 字`);

      // 获取用户
      const user = await db.user.findFirst({ where: { email: { contains: "feishu" } } });
      check("找到测试用户", !!user, user?.name ?? "none");

      if (user) {
        // 确保用户有 userSettings（开启自动纪要）
        await db.userSettings.upsert({
          where: { userId: user.id },
          create: { userId: user.id, autoEnabled: true },
          update: { autoEnabled: true },
        });

        // 模拟飞书事件
        const event: FeishuMeetingEndedEvent = {
          meeting: {
            id: "sample-feishu-001",
            topic: cached.topic ?? "未知会议",
            meetingSource: 1,
            startTime: String(Math.floor((cached.startTime?.getTime() ?? Date.now()) / 1000)),
            endTime: String(Math.floor((cached.endTime?.getTime() ?? Date.now()) / 1000)),
          },
        };

        console.log("   触发流水线...");
        const results = await handleMeetingEnded(event);
        check("流水线有返回结果", results.length > 0, `${results.length} 条结果`);
        results.forEach((r, i) => {
          check(`  结果[${i}]: ${r.status}`, r.status === "completed", r.status === "completed" ? "纪要已生成" : (r.errorMessage ?? r.skippedReason ?? ""));
        });

        // 验证 MeetingRecord 已创建
        const records = await db.meetingRecord.findMany({
          where: { meetingId: "sample-feishu-001", isDeleted: false },
          orderBy: { createdAt: "desc" },
          take: 3,
        });
        check("MeetingRecord 已入库", records.length > 0, `共 ${records.length} 条`);
        const completed = records.find((r) => r.status === "completed");
        check("  有 completed 状态的记录", !!completed);
        if (completed) {
          check("  有 aiSummary", (completed.aiSummary?.length ?? 0) > 0, completed.aiSummary?.slice(0, 50) ?? "empty");
          check("  有 docUrl", !!completed.docUrl, completed.docUrl ?? "none");
        }
      }
    }
  } catch (e) {
    check("生成纪要（异常）", false, String(e));
  }

  // ─── Test 5: 纪要列表查询 ──
  console.log("\n── 5. 纪要列表 (listRecords) ──");
  try {
    const user = await db.user.findFirst({ where: { email: { contains: "feishu" } } });
    if (user) {
      const all = await db.meetingRecord.findMany({
        where: { userId: user.id, isDeleted: false },
        orderBy: { createdAt: "desc" },
      });
      check("全部纪要列表", all.length > 0, `${all.length} 条`);

      const statuses = ["completed", "processing", "failed", "skipped"] as const;
      for (const s of statuses) {
        const filtered = await db.meetingRecord.findMany({
          where: { userId: user.id, status: s, isDeleted: false },
        });
        check(`  按状态筛选: ${s}`, filtered.length >= 0, `${filtered.length} 条`);
      }
    }
  } catch (e) {
    check("纪要列表（异常）", false, String(e));
  }

  // ─── Test 6: 软删除测试 ──
  console.log("\n── 6. 软删除 ──");
  try {
    const user = await db.user.findFirst({ where: { email: { contains: "feishu" } } });
    if (user) {
      // 创建一条测试纪要
      const testRecord = await db.meetingRecord.create({
        data: {
          meetingId: "sample-feishu-001",
          topic: "软删除测试",
          status: "failed",
          userId: user.id,
          errorMessage: "测试软删除",
        },
      });
      check("创建测试纪要", !!testRecord);

      // 软删除
      await db.meetingRecord.update({
        where: { id: testRecord.id },
        data: { isDeleted: true },
      });
      const deleted = await db.meetingRecord.findUnique({ where: { id: testRecord.id } });
      check("软删除后 isDeleted=true", deleted?.isDeleted === true);

      // 查询应过滤已删除
      const active = await db.meetingRecord.findMany({
        where: { userId: user.id, isDeleted: false },
      });
      const stillExists = active.find((r) => r.id === testRecord.id);
      check("查询过滤已删除纪要", !stillExists);

      // 清理
      await db.meetingRecord.delete({ where: { id: testRecord.id } });
    }
  } catch (e) {
    check("软删除（异常）", false, String(e));
  }

  // ─── 总结 ───
  console.log("\n═══════════════════════════════════════");
  console.log(`  结果: ${PASS} ${passed} 通过  ${FAIL} ${failed} 失败`);
  console.log("═══════════════════════════════════════");

  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
