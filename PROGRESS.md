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

#### 前端弹窗视觉重构 + 抽屉动画修复 + 品牌图标替换 — 2026-05-28

#### 会议纪要详情弹窗（MinutesDetailDialog）视觉重构
- 纯白底色统一布局（去掉 Body 灰色分区），整体更简洁大气
- 增强阴影：双层 box-shadow（0 20px 40px + 0 8px 16px），弹窗浮起感明显
- 去嵌套：摘要文本卡片改为极淡灰 bg-slate-50/60，透明边框，减少"卡片套卡片"疲劳
- "● 会议纪要详情"标签：蓝色 dot 引导线 + text-indigo-500
- 全局字号提升：标题 base→lg，正文 13px→14px，按钮 10/11px→11/12px
- 紧凑布局：Header/Body/Footer padding 统一收缩

#### 源会议抽屉（MeetingDetailDialog）动画修复
- 双层关闭：抽屉 overlay z-index 从 z-40 提升至 z-[55]，点击先关抽屉 → 再关弹窗
- 滑入动画：showPanel 状态 + requestAnimationFrame，先挂载无 active → 下一帧加 active → 过渡播放
- 关闭动画：displayM ref 保留数据，滑出 400ms 后才 unmount
- 侧栏 Logo 闪现修复：whitespace-nowrap 防止展开时换行

#### 品牌图标替换
- Logo 组件：PNG 图片 → Sparkles 图标（深色渐变圆角方块 bg-gradient-to-br from-gray-800 to-gray-900）
- Favicon：icon.png → icon.svg（统一风格）
- 清理所有旧 brand asset（favicon.ico / logo-dark.png / logo-light.png / icon-*.png）

#### 会议纪要列表分页
- MinutesList 后端游标分页（PAGE_SIZE=5，cursor stack 支持前后翻页）
- 切 tab 自动重置分页
- 弹窗定位修复：page-enter 动画 both→backwards，消除 CSS containing block 对 fixed 定位的影响

#### 弹窗毛玻璃遮罩
- 白色半透明背景 rgba(255,255,255,0.4) + blur 16px，替代暗色遮罩
- 有视觉分离但不暗沉

## 📋 待做

### 🔴 Bug 修复
- [ ] **飞书文档二次生成内容写入失败**：第一次生成纪要写入飞书文档正常，后续再次生成时文档创建成功、标题可见，但正文内容未写入。需排查 doc-creator 的文档更新逻辑（create vs update 路径）

### 🟡 新功能

- [ ] **AI 对话记忆系统**
  - 收集用户在 Agent 聊天中的提问偏好和模式
  - 分析高频查询类型，发现用户关心的信息维度
  - 反馈到结构化提取 Schema：如发现用户常问"花了多少钱"，可新增预算/费用字段
  - 记忆存储：用户维度（每位用户独立画像）+ 增量更新

- [ ] **会议待办（To-Do）提取与维护系统**
  - 结构化提取：从会议纪要中严格提取待办事项（action items）
  - 格式：负责人 + 内容 + 截止时间（如有提及）+ 优先级
  - 维护到指定飞书文档：首次创建文档并记录 docUrl 到 DB
  - 容错处理：文档被删 → 创建新文档并更新 DB 链接
  - 并发安全：多场会议同时提取时，文档写入不冲突
  - DB 设计：新增 UserTodoDoc 表（userId, docUrl, docToken, createdAt, updatedAt）

### ⚪ 测试
- [ ] 测试多 LLM provider 选择和切换
- [ ] 测试 ASR 语音转文字功能（三种 adapter）
- [ ] 真实飞书会议端到端测试
- [ ] Agent 端到端验证（启动 dev → 点击浮动按钮 → 提问 → 验证工具调用和流式渲染）

## ⚠️ 已知问题

- 逐字稿拉取依赖飞书妙记额度
- 用户重新登录需 prompt=consent 才能拿到新 scope
- 飞书文档二次生成内容写入失败（见待做 Bug）
