import { db } from "@repo/database";

async function main() {
  // 查找飞书登录用户（非 system 用户）
  const users = await db.user.findMany({ take: 10 });
  const feishuUser = users.find((u) => u.email.includes("feishu")) || users[0];
  if (!feishuUser) {
    console.log("❌ 数据库中没有用户，请先登录飞书创建用户");
    process.exit(1);
  }

  const userId = feishuUser.id;
  console.log(`✅ 使用用户: ${feishuUser.name} (${feishuUser.email})`);

  // 检查是否已有示例数据
  const existing = await db.feishuMeeting.findFirst({ where: { meetingId: "sample-feishu-001" } });
  if (existing) {
    console.log("⚠️  示例数据已存在，先清理...");
    await db.meetingRecord.deleteMany({ where: { meetingId: "sample-feishu-001" } });
    await db.feishuMeeting.deleteMany({ where: { meetingId: "sample-feishu-001" } });
  }

  // 创建示例飞书会议
  const meeting = await db.feishuMeeting.create({
    data: {
      meetingId: "sample-feishu-001",
      meetingNo: "705-123-456",
      topic: "Q2 产品规划评审会",
      startTime: new Date("2026-05-15T14:00:00+08:00"),
      endTime: new Date("2026-05-15T15:30:00+08:00"),
      participantCount: 8,
      source: "feishu",
      noteDocToken: "sample_note_doc_token_abc123",
      meetingUrl: "https://vc.feishu.cn/j/705123456",
      participantsJson: [
        { userId: "ou_001", userName: "张三", isHost: true, isExternal: false },
        { userId: "ou_002", userName: "李四", isHost: false, isExternal: false },
        { userId: "ou_003", userName: "王五", isHost: false, isExternal: false },
        { userId: "ou_004", userName: "赵六", isHost: false, isExternal: false },
        { userId: "ou_005", userName: "陈七", isHost: false, isExternal: false },
        { userId: "ou_006", userName: "孙八", isHost: false, isExternal: false },
        { userId: "ou_007", userName: "周九", isHost: false, isExternal: false },
        { userId: "ou_008", userName: "吴十", isHost: false, isExternal: false },
      ],
      transcriptText: `张三：好，今天我们讨论一下 Q2 的产品路线图。先由李四介绍一下目前的进度。

李四：好的。目前我们 MVP 三个核心场景的代码基本完成了。会议事件监听、逐字稿拉取、LLM 生成、文档创建这条链路已经跑通了。但是还有一些细节需要打磨。

张三：哪些细节？

李四：主要是几个方面。一是前置路由的小模型判断准确率还不够高，需要调一下 Prompt。二是文档创建后端有时候会超时，需要加重试逻辑。三是用户自定义 Prompt 的功能还需要测试。

王五：我补充一下。从用户反馈来看，他们最关心两个事情：一是纪要的准确度，特别是对专业术语的处理；二是生成速度，现在平均需要 30 秒左右，用户觉得有点慢。

赵六：这个我可以优化。现在用的是 DeepSeek flash，API 响应时间在 10-15 秒，加上前置路由的 5 秒，再加上文档创建的 5-10 秒，总时间 30 秒是合理的。如果要提速，可以考虑把前置路由和 LLM 生成并行化，或者用更快的模型。

张三：并行化可以试试。但准确度更重要，不要为了速度牺牲质量。孙八，你怎么看？

孙八：我同意张三的意见。准确度第一。另外我建议我们 Q2 优先做这几个事情：一是把端到端测试做完，确保真实场景下跑通；二是加一个"手动上传会议"的功能，不是所有用户都用飞书；三是优化移动端展示。

周九：移动端这块我可以负责。另外我注意到一个细节——现在生成的纪要没有把"待办事项"的负责人标清楚，有时候会遗漏。

张三：好，那我们定一下 Q2 的优先级。第一优先级：端到端测试和稳定性。第二优先级：手动上传功能。第三优先级：移动端优化和准确度提升。大家觉得怎么样？

众人：同意。

张三：行动项：李四负责端到端测试，本周五之前完成第一版。赵六负责并行化优化，下周三之前出方案。孙八和周九负责手动上传功能的设计和开发，两周内完成。王五负责收集用户反馈，整理需求优先级。

李四：好的，收到。

张三：没问题的话今天就到这里，谢谢大家。`,
      transcriptFetched: true,
    },
  });

  console.log(`✅ 创建飞书会议: ${meeting.topic}`);

  // 创建已完成纪要
  const completedRecord = await db.meetingRecord.create({
    data: {
      meetingId: "sample-feishu-001",
      topic: "Q2 产品规划评审会",
      startTime: new Date("2026-05-15T14:00:00+08:00"),
      endTime: new Date("2026-05-15T15:30:00+08:00"),
      hostUserId: "ou_001",
      participantCount: 8,
      status: "completed",
      userId,
      docUrl: "https://bytedance.feishu.cn/docx/sample_doc_abc",
      docToken: "sample_doc_token_abc",
      aiSummary: "会议确定了 Q2 三个优先级：端到端测试与稳定性（第一优先）、手动上传会议功能（第二优先）、移动端优化与准确度提升（第三优先）。李四负责测试，赵六负责性能优化，孙八周九负责手动上传功能。",
      createdAt: new Date("2026-05-15T16:00:00+08:00"),
      updatedAt: new Date("2026-05-15T16:00:00+08:00"),
    },
  });
  console.log(`✅ 创建已完成纪要: ${completedRecord.id}`);

  // 创建处理日志
  await db.processingLog.createMany({
    data: [
      { meetingRecordId: completedRecord.id, step: "fetch_detail", status: "success", detail: "获取会议详情成功，8人参会" },
      { meetingRecordId: completedRecord.id, step: "participant_route", status: "success", detail: "匹配到 1 个内部用户" },
      { meetingRecordId: completedRecord.id, step: "pre_route", status: "success", detail: "排除规则未命中，继续处理" },
      { meetingRecordId: completedRecord.id, step: "prompt_assemble", status: "success", detail: "使用默认 Prompt 版本" },
      { meetingRecordId: completedRecord.id, step: "llm_generate", status: "success", detail: "LLM 生成成功，用时 18s" },
      { meetingRecordId: completedRecord.id, step: "doc_create", status: "success", detail: "飞书文档创建成功" },
    ],
  });
  console.log("✅ 创建处理日志");

  // 创建失败纪要
  const failedRecord = await db.meetingRecord.create({
    data: {
      meetingId: "sample-feishu-001",
      topic: "Q2 产品规划评审会",
      startTime: new Date("2026-05-15T14:00:00+08:00"),
      endTime: new Date("2026-05-15T15:30:00+08:00"),
      participantCount: 8,
      status: "failed",
      userId,
      errorMessage: "LLM API 调用超时：请求在 60 秒内未返回结果，请检查 DeepSeek API 状态",
      createdAt: new Date("2026-05-15T17:00:00+08:00"),
      updatedAt: new Date("2026-05-15T17:00:00+08:00"),
    },
  });
  console.log(`✅ 创建失败纪要（用于展示错误状态）: ${failedRecord.id}`);

  // 创建跳过纪要
  const skippedRecord = await db.meetingRecord.create({
    data: {
      meetingId: "sample-feishu-001",
      topic: "Q2 产品规划评审会",
      startTime: new Date("2026-05-15T14:00:00+08:00"),
      endTime: new Date("2026-05-15T15:30:00+08:00"),
      participantCount: 8,
      status: "skipped",
      userId,
      skippedReason: "用户排除规则命中：本次会议涉及团建内容，已配置跳过",
      createdAt: new Date("2026-05-15T14:30:00+08:00"),
      updatedAt: new Date("2026-05-15T14:30:00+08:00"),
    },
  });
  console.log(`✅ 创建跳过纪要（用于展示跳过状态）: ${skippedRecord.id}`);

  console.log("\n🎉 示例数据创建完成！");
  console.log("   会议 ID: sample-feishu-001");
  console.log("   纪要数量: 3 条 (completed + failed + skipped)");
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
