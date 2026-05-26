# 项目进度

## ✅ 已完成

### 数据库
- 8 个业务 Model（PromptVersion, MeetingRecord, ModelProvider, UserModelAccess, UserSettings, SystemConfig, ProcessingLog, SampleLearning）
- FeishuMeeting 缓存表 + source/noteDocToken/meetingUrl/participantsJson/uploadedFileName/createdById 字段
- MeetingSource 枚举（feishu / manual）
- 软删除：FeishuMeeting + MeetingRecord 均有 isDeleted 字段，查询自动过滤

### 业务逻辑包 packages/lark-meeting/
- pipeline.ts：7 步流水线 + generateForUser（手动生成）+ handleMeetingEnded（自动触发，含批量省成本路径）
- meeting-fetcher.ts：飞书 API 调用 + 参会人姓名批量查询（contact/v3/users/basic_batch），API 失败回退缓存
- meeting-search.ts：妙记搜索 + 缓存 + syncUserMeetings + 参会人姓名批量查询
- feishu-client.ts：tenant_access_token 获取 + batchGetUserNames + addDocCollaborator
- participant-router.ts：参会人路由 + 无匹配时回退 autoEnabled 用户
- pre-router.ts：前置路由（LLM 判断跳过/提取要求）
- prompt-assembler.ts：Prompt 组装（decryptField 解密）
- llm-generator.ts：generateText+JSON.parse（DeepSeek 兼容）
- doc-creator.ts：纯 tenant token 创建 + 用户协作者（不再用 user token 创建/transfer_owner）
- model-factory.ts：DeepSeek flash/pro
- sample-learner.ts：举一反三学习
- event-listener.ts：飞书事件 WebSocket 长连接，通过 instrumentation.ts 在 Next.js 启动时自动拉起

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

### 文档创建策略（2026-05-19 更新）
```
所有文档统一 tenant_access_token 创建（应用下）+ 当前用户 addDocCollaborator（full_access）
批量路径：N 人默认模板+无额外指令 → 1 次 LLM → N 份文档各加协作者
个性路径：不同模板或有额外指令 → 每人独立 LLM + 独立文档
```

### 事件监听器启动 + 会议同步策略 — 2026-05-20
- instrumentation.ts：Next.js 16 register() 钩子，服务器启动时自动启动飞书 WebSocket 事件监听
- UserSettings 新增 meetingsSyncedAt 字段，记录最后同步时间
- listFeishuMeetings 改为首次登录触发 syncUserMeetings（meetingsSyncedAt 为 null 时）
- syncMeetings 过程（POST /meetings/sync）：用户可手动"刷新"触发全量同步
- 前端"刷新"按钮改为调用 syncMeetings mutation
- 三层覆盖结构预留：事件监听器（实时）+ 每日 cron（兜底）+ 手动刷新（应急）

### 设置页 + 管理后台重构 — 2026-05-21
- 统一设计哲学：大圆角（rounded-[16px]/[24px]）、淡投影、退火态色、缓动动画
- SettingsForm 完全重写：premium-card 布局、自定义 Switch toggle、删除"保存位置"
- PromptStyleDialog：三段式（列表→创建→详情编辑），固定高度滚动，编辑保存名称/描述，修复文件上传 ref bug
- AdminDashboard：全部 Dialog 化、4 张等层级卡片（grid-cols-4），删除"流水线测试"
- ModelProviderList：Dialog 表单，修复 API createdById 过滤过严
- 成员/模型/默认 Prompt 统一 Dialog 设计语言
- 日历：个会→个会议

### 会议记录列表重设计 + 页面切换动画 — 2026-05-21
- MeetingRecordsList：card-enter 交错入场、skeleton-card shimmer（180ms）、tab-container 视图切换
- AppWrapper：usePathname + key={pathname} + pageIn 动画，侧栏切页 0.35s fade-in+slide-up
- 主内容区背景 bg-[#F8F9FA]，白色卡片无需边框也能显轮廓
- MeetingDetailDialog 折叠纪要 badge 修复：隐藏项也用 STATUS_ICONS + 退火色
- 基于 3.html 极简视觉规范重构 MinutesDetailDialog 和 MinutesList
- 详情弹窗：自定义居中弹窗替换 shadcn Dialog，锁定原生双向绝对居中（flex items-center justify-center）
- 摘要区：默认 130px（约 5 行），展开 360px 内滚动（overflow-y: auto），随时可收起
- 源会议抽屉：真正复用 MeetingDetailDialog 组件，非空占位
- 已移除处理日志展示
- 列表页：分段胶囊页签（tab-container + tab-slider + 计数 badges）、卡片入场动画（slideUpIn）、180ms 骨架屏
- 卡片 hover 显示"打开文档"按钮，处理中呼吸灯脉冲
- CSS 变量 --transition-smooth（0.35s cubic-bezier(0.25, 1, 0.5, 1)）

### 文档创建 + 参会人 + 批量省成本 — 2026-05-19
- doc-creator：砍掉三层降级，纯 tenant_access_token + addDocCollaborator
- feishu-client：新增 batchGetUserNames（contact/v3/users/basic_batch）+ addDocCollaborator（drive/v1/permissions）
- meeting-fetcher + meeting-search：参会人姓名批量查询，解决"未知"显示
- pipeline：handleMeetingEnded 增加批量路径，默认模板+无额外指令的用户共享 1 次 LLM

### ASR 语音转文字 — 2026-05-25
- 新增 asr-client.ts：三合一 adapter（OpenAI Whisper / 阿里云 DashScope / 火山引擎），根据 apiBase 自动路由
- 千问3-ASR-Flash 走 base64 data URI 直传，Fun-ASR/火山走 MinIO 临时上传 + 异步轮询
- 新增 POST /api/asr/transcribe 接口（FormData 接收 providerId + audioFile）
- 手动添加会议 Dialog 新增「上传录音」模式，支持 mp3/wav/m4a/flac/ogg 等

### 多 LLM 提供商支持 + 步骤级模型选择 — 2026-05-22
- model-factory.ts 重写：从 system_config 读 default_fast_model / default_text_model（格式 providerId:modelName），不再硬编码 providers[0]
- 系统配置 API 扩展 defaultFastModel / defaultTextModel 字段
- 管理后台「系统配置」弹窗新增快速模型和主力模型下拉框
- 飞书凭证读取逻辑改为 env 优先、DB 降级
- 数据库 system_config 已写入 DeepSeek 默认模型配置，兼容升级无需手动干预

### 会议同步策略
```
用户打开会议记录页 → 后台 async 执行：
  1. user_token 搜索 90 天会议（vc/meetings/search）
  2. tenant_token 逐个获取详情 + recording API → 提取妙记 token
  3. Upsert 到 FeishuMeeting（meetingId unique，增量不重复）
新会议 → 飞书事件监听自动加入
```

### Agent 信息管理平台 — 2026-05-26

#### 增强 LLM 输出 Schema（10 维度结构化提取）
- MeetingMinutesSchema 重写：从 5 个简单字段升级到 10 维度
  - 新增 discussionPoints（议题×结论）、entities（实体×类型×评价）、decisions（决策×理由×状态×影响）
  - 新增 metrics（指标×数值×趋势）、risks（风险×严重度×缓解×责任人）、keyQuotes（关键发言引用）
  - 新增 sentiment（情绪判断）、followUps（后续关注×触发条件）、keywords（检索关键词）、categories（分类标签）
  - keyPoints / summary 保留向后兼容，normalizeMinutes() 自动补全缺失字段
- prompt-assembler.ts：更新 DEFAULT_CORE_PROMPT 和 OUTPUT_FORMAT_REQUIREMENT
  - LLM 提示词新增实体识别、指标提取、风险标记、情绪判断、后续关注等指令
  - 输出格式从 5 字段扩展到完整 10 维度 JSON Schema 示例

#### 数据库：MeetingRecord 新增检索字段
- MeetingRecord 新增 3 个字段：
  - `minutesContent` @db.Text — 完整 Markdown 纪要（Agent 展示用）
  - `minutesJson` Json — 完整结构化纪要（结构化查询用）
  - `searchText` @db.Text — 去重拼接所有文本（Prisma contains 关键词搜索）
- pipeline.ts：createMeetingRecord() 写入新字段，buildMinutesMarkdown() + buildSearchText() 生成

#### doc-creator 飞书文档增强
- formatMinutesAsBlocks() 用新结构化数据生成更丰富飞书文档：
  讨论要点（含发言人和结论）、实体（含类型和评价）、决策（含理由和状态）、指标（含趋势）、
  风险（含严重度和缓解措施）、待办（含负责人和优先级）、关键引用、情绪判断、后续关注

#### Agent 后端 packages/agent/
- 新建包：package.json / tsconfig.json / core / tools
- core/types.ts：PageContext、AgentConfig、ToolContext 类型
- core/tool-registry.ts：ToolRegistry class（builtin 工具注册 + 合并）
- core/planner.ts：buildSystemPrompt()（~70 行中文系统提示词，含上下文构建）+ buildAgentConfig()
- 12 个 Agent 工具（Vercel AI SDK tool() 格式）：
  search_meetings（核心：关键词搜索 searchText）、get_meeting（完整结构化详情）、list_meeting_records
  get_feishu_meetings、get_feishu_meeting_detail（含逐字稿）
  generate_meeting_minutes、retry_meeting_record
  get_user_settings、update_user_settings
  list_prompt_versions、create_prompt_from_samples
  get_stats、get_system_config

#### Agent 聊天 API
- POST /api/agent/chat：rate limit（30/分钟/IP）+ better-auth session + ToolLoopAgent + streaming
- ToolLoopAgent 来自 Vercel AI SDK v6，maxSteps=10，stopWhen=stepCountIs()

#### 前端 Agent UI
- AgentProvider：React Context（面板开关、pendingQuery 跨组件传递）
- AgentFloatingButton：右下角浮动按钮，premium-card 投影，hover 放大
- AgentPanel：380px Drawer 从右侧滑入，useChat(@ai-sdk/react) + DefaultChatTransport
  - 消息流式渲染、工具调用脉冲动画、快捷提问 chips
  - 移动端全屏 Sheet 模式
- MeetingResultCard：会议查询结果迷你卡片（状态 badge、实体、链接）
- useChatHistory：localStorage 会话持久化（最多 20 个）
- AppWrapper 集成：AgentProvider + AgentFloatingButton + AgentPanel
- @chat/* 路径别名

## 📋 待做

- [ ] 测试多 LLM provider 选择和切换
- [ ] 测试 ASR 语音转文字功能（三种 adapter）
- [ ] 真实飞书会议端到端测试
- [ ] Agent 端到端验证（启动 dev → 点击浮动按钮 → 提问 → 验证工具调用和流式渲染）

## ⚠️ 已知问题

- 逐字稿拉取依赖飞书妙记额度
- 用户重新登录需 prompt=consent 才能拿到新 scope
