# 项目进度

## ✅ 已完成

### 数据库 — 2026-05-16/17
- 8 个业务 Model（PromptVersion, MeetingRecord, ModelProvider, UserModelAccess, UserSettings, SystemConfig, ProcessingLog, SampleLearning）
- FeishuMeeting 缓存表
- PostgreSQL Docker 运行中

### 业务逻辑包 packages/lark-meeting/ — 2026-05-16/17
- pipeline.ts: 7 步处理流水线（含详细日志）
- meeting-fetcher.ts: 飞书 API 调用
- feishu-client.ts: tenant_access_token 获取（带缓存）
- participant-router.ts: 参会人路由
- pre-router.ts: 前置路由（排除规则+特殊要求）
- prompt-assembler.ts: Prompt 组装
- llm-generator.ts: generateText+JSON.parse（DeepSeek 兼容）
- model-factory.ts: DeepSeek flash/pro 模型实例创建
- sample-learner.ts: 举一反三学习
- meeting-search.ts: 妙记搜索+缓存
- mock-pipeline.ts: Mock 测试流水线
- event-listener.ts: 飞书事件 WebSocket 长连接

### API 层 — 2026-05-16/17
- oRPC: 4 个模块（settings, prompts, meetings, larkAdmin），20+ 个 procedure
- MCP Server: 8 个 Agent Tool

### 前端页面 — 2026-05-16/17
- Dashboard: 会议纪要列表 + 三态处理
- 设置页: 自动开关/排除规则/特殊要求/Prompt 版本选择
- Prompt 管理: 举一反三（粘贴+上传+AI学习） + 手动编写模式
- 管理后台: 成员模式切换/成员管理/模型提供商/默认 Prompt/流水线测试
- 会议记录: 飞书妙记列表/详情弹窗/逐字稿/生成纪要
- Landing Page: lark-summary-pro 产品介绍

### 数据库 — 2026-05-18
- FeishuMeeting 新增字段：source（feishu/manual）、noteDocToken、meetingUrl、participantsJson、uploadedFileName、createdById
- 手动会议支持：用户上传逐字稿，source=manual，行为与飞书会议一致

### 业务逻辑包 — 2026-05-18
- meeting-fetcher.ts：支持手动会议从缓存读取详情
- llm-generator.ts：手动会议从 FeishuMeeting 缓存读逐字稿
- meeting-search.ts：缓存参会人和 noteDocToken，getCachedMeetings 返回关联 meetingRecords

### API 层 — 2026-05-18
- 新增 createManualMeeting procedure：手动添加会议（上传逐字稿）
- feishuDetail 自动补充拉取参会人和妙记数据

### 前端重做 — 2026-05-18
- 会议记录列表页：源会议卡片 + 内嵌关联纪要 + 参会人 + 妙记/会议链接
- 会议详情页：[id]：纪要卡片固定高度 h-64 可滚动 + 逐字稿卡片固定高度 h-48 可滚动
- 会议纪要列表页：MeetingRecord 带来源会议上下文 + 状态筛选
- 手动添加会议 Dialog（上传文件 + 粘贴逐字稿）
- 设置页：额外指令（Textarea）替代排除规则+特殊要求，字段重排

### 集成 — 2026-05-16/17
- 飞书应用凭证已配置
- DeepSeek API 接入（flash+pro，generateText 方式兼容）
- 飞书 OAuth 登录（better-auth genericOAuth）
- 飞书文档创建+写入 API 已调通
- Mock 流水线测试可用（LLM 全链路）
- 妙记搜索 API 已通（0 条结果，等有会议后自动拉取）

---

## 📋 待做

- [ ] 真实飞书会议端到端测试（创建会议 → 事件监听 → 生成纪要 → 文档）
- [ ] 事件监听器启动（`scripts/event-listener.ts`）
- [ ] 妙记搜索集成到会议记录页（token 权限已 OK，等数据）
- [ ] 前端细节打磨（Prompt 列表刷新、错误提示等）
- [ ] 其他模型提供商支持（千问/豆包/Gemini/OpenRouter）

---

## ⚠️ 已知问题

- 旧 SaaS 模板组件用桩（stub）替代，功能完整但部分 UI 不可交互
- Prompt 创建 500 待排查（可能是 FIELD_ENCRYPTION_KEY 运行时未加载，需看终端日志）
- 会议记录页依赖飞书事件捕获数据，或 mock 测试
