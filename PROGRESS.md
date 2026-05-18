# 项目进度

## ✅ 已完成

### 数据库
- 8 个业务 Model（PromptVersion, MeetingRecord, ModelProvider, UserModelAccess, UserSettings, SystemConfig, ProcessingLog, SampleLearning）
- FeishuMeeting 缓存表 + source/noteDocToken/meetingUrl/participantsJson/uploadedFileName/createdById 字段
- MeetingSource 枚举（feishu / manual）
- 软删除：FeishuMeeting + MeetingRecord 均有 isDeleted 字段，查询自动过滤

### 业务逻辑包 packages/lark-meeting/
- pipeline.ts：7 步流水线 + generateForUser（手动生成，不调参会人路由）+ handleMeetingEnded（自动触发）
- meeting-fetcher.ts：飞书 API 调用，API 失败回退缓存
- meeting-search.ts：妙记搜索 + 缓存 + syncUserMeetings（登录时同步90天会议+recording API关联妙记）
- feishu-client.ts：tenant_access_token 获取（带缓存）
- participant-router.ts：参会人路由 + 无匹配时回退 autoEnabled 用户
- pre-router.ts：前置路由（LLM 判断跳过/提取要求）
- prompt-assembler.ts：Prompt 组装（decryptField 解密）
- llm-generator.ts：generateText+JSON.parse（DeepSeek 兼容）
- doc-creator.ts：三层降级创建（user token → tenant+transfer_owner → tenant only）
- model-factory.ts：DeepSeek flash/pro
- sample-learner.ts：举一反三学习
- event-listener.ts：飞书事件 WebSocket 长连接

### API 层
- oRPC: settings/prompts/meetings/larkAdmin 4 模块，20+ procedure
- 新增：createManualMeeting / deleteFeishu / deleteRecord / listFolders / syncUserMeetings
- MCP Server: 8 Agent Tool

### 前端页面
- 会议记录列表（/app/meetings）：源会议卡片 + 妙记/会议链接 + 参会人 + 状态标识 + 乐观更新 processing
- 会议详情弹窗（MeetingDetailDialog）：纪要 h-64 + 逐字稿 h-48 固定高度可滚动
- 会议纪要列表（/app Dashboard）：MeetingRecord 平铺 + 状态筛选 + 来源会议上下文
- 纪要详情弹窗（MinutesDetailDialog）：处理日志 + 跳转源会议 + 删除
- 设置页：自动开关 + 额外指令（自由文本）+ 纪要风格 Dialog + 文件夹选择器
- Prompt 管理：侧边栏移除，改为设置页 Dialog
- 手动添加会议 Dialog：上传逐字稿 + 时间 + 参会人 + 链接
- 管理后台：返回导航 + 成员/模型/Prompt 管理

### 文档创建策略
```
类型                Token              文档归属      触发
──────────────────────────────────────────────────────
手动生成 ● 纪要     user_access_token   用户所有      用户点击
自动触发（事件）    user → tenant+transfer 用户所有  飞书事件
降级失败            tenant_access_token  应用所有      兜底
```

### 会议同步策略
```
用户打开会议记录页 → 后台 async 执行：
  1. user_token 搜索 90 天会议（vc/meetings/search）
  2. tenant_token 逐个获取详情 + recording API → 提取妙记 token
  3. Upsert 到 FeishuMeeting（meetingId unique，增量不重复）
新会议 → 飞书事件监听自动加入
```

## 📋 待做

- [ ] 事件监听器启动（`scripts/event-listener.ts`）
- [ ] 真实飞书会议端到端测试
- [ ] transfer_owner 测试（需重新登录后 open_id 生效）
- [ ] 文档 Block 写入 API 修复（目前 block_type 已修正，写入仍报 invalid param）
- [ ] refresh_token 续期测试（code=20014）
- [ ] 其他模型提供商支持

## ⚠️ 已知问题

- 飞书文档 Block 写入报 invalid param（文档创建成功，内容写入失败，不影响 URL 生成）
- refresh token 续期报 code=20014（OAuth v2 endpoint 可能需要不同参数）
- 逐字稿拉取依赖飞书妙记额度
- 用户重新登录需 prompt=consent 才能拿到新 scope
