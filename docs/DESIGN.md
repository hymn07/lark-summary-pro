# lark-summary-pro — 产品设计方案

## 一、一句话定位

**以飞书为入口的 AI 会议纪要自动生成工具 —— 开完会，纪要自动出现在指定文件夹里。**

## 二、产品分层架构

```
入口层：飞书应用（长连接接收「企业会议结束」事件 → 获取妙记逐字稿）
   ↓
能力层：前置路由（话题过滤 + 特殊要求提取）→ Prompt 组装 → LLM 生成 → 格式整理
   ↓
输出层：飞书文档创建 + 写入（调用 docx v1 API 创建含内容的文档）
   ↓
展示层：Web 管理后台 + 用户设置页
```

## 三、用户角色

| 角色 | 核心需求 | 关键操作 |
|------|---------|---------|
| 管理员 | 初始化系统、管理成员和模型、设置默认 Prompt | 成员管理、模型提供商配置、模型分配、默认 Prompt 管理、「举一反三」生成 Prompt |
| 普通用户 | 开完会自动出纪要，纪要风格可控 | 开关自动纪要、选择保存位置、写排除规则/特殊要求、管理自己的 Prompt 版本 |

管理员同时拥有普通用户的功能。

## 四、MVP 三个核心场景

### 场景 1：自动生成会议纪要（核心链路）

- **触发**：飞书推送「企业会议结束」事件到系统
- **过程**：
  1. 接收事件，获取 meeting_id
  2. 调用飞书 API 获取会议详情（含逐字稿 doc_token）
  3. 获取逐字稿文本内容
  4. **前置路由**：用小模型判断 — 是否命中用户的排除规则（"年会的不做"），同时提取用户特殊要求（"A 公司重点关注资金"）
  5. 如果命中排除规则 → 跳过，记录日志
  6. 如果继续 → **Prompt 组装**：核心 Prompt + 用户特殊要求 + 输出格式要求
  7. 发给 LLM 生成结构化纪要
  8. 调用飞书文档 API，在用户指定文件夹创建文档并写入内容
  9. 记录处理日志（成功/失败）
- **结果**：会议纪要文档出现在用户指定的飞书文件夹中

### 场景 2：管理员初始化与成员管理

- **触发**：管理员首次登录后进入管理后台
- **过程**：
  1. **系统初始化**：配置飞书应用凭证（App ID、App Secret），配置 LLM 提供商和 API Key
  2. 「举一反三」生成默认 Prompt：上传 1-3 篇示例纪要 → AI 学习风格 → 生成核心 Prompt（用户不可见）→ 管理员命名此版本
  3. **成员管理模式选择**：管理员二选一
     - **开放模式**：公司全员自动可用。任何人飞书登录后自动创建用户，默认拥有使用权
     - **审批模式**：管理员主动在后台添加/移除成员。只有被添加的飞书用户才能使用，不在白名单里的人登录后看到"无权限"提示
  4. 为每个成员分配可用的模型（用管理员的模型池，管理员控制成本）
- **结果**：系统就绪，成员可以开始使用

### 场景 3：用户自定义纪要风格

- **触发**：用户想调整纪要风格
- **过程**：
  1. 在 Prompt 版本管理页，用户上传 1-3 篇自己满意的会议纪要 + 为本次版本命名（如"简洁版"）
  2. 点击"生成" → 提交到后端 → AI 学习这些样本 → 生成核心 Prompt（用户不可见）+ 生成风格描述文案（如"简洁分点式，偏重技术细节"，展示给用户确认）
  3. 用户查看风格描述，确认后保存为一个 Prompt 版本
  4. 用户可以管理自己的版本库：切换活跃版本、删除旧版本、再新建新版本
  5. 用户也可以在设置页直接写自然语言排除规则和特殊要求（如"和 B 公司相关的会议，重点总结合同条款"），这些规则作为 Prompt 组装的一层追加到核心 Prompt 前面
  6. 用户始终看不到核心 Prompt 原文，只能通过样本学习和自然语言间接影响
- **结果**：下次会议纪要按用户选择的 Prompt 版本 + 排除规则 + 特殊要求组合生成

## 五、MVP 不做的事

- 不做多公司 SaaS 托管（单租户自部署）
- 不做会议 To-do 自动提取和跟踪（V2）
- 不做会议历史汇总文档（V2）
- 不做手动触发单次会议纪要（MVP 只做自动）
- 不做 Webhook 方式接收事件（只做长连接）
- 不做非飞书的会议来源
- 不做团队协作/评论功能

## 六、数据库设计

### 6 类对象建模

#### 主对象

**User（已有）**：飞书登录的用户
- 扩展字段：isAdmin（是否管理员）

**PromptVersion**：用户管理的 Prompt 版本
```
PromptVersion
  id, name, corePrompt（核心 Prompt，JSON 加密存储）, styleDescription（AI 生成的风格描述，展示给用户）
  createdById, isDefault（管理员设的默认版本）, isActive
  organizationId 不用（单租户）
```

#### 过程对象

**MeetingRecord**：每次会议的处理记录
```
MeetingRecord
  id, meetingId（飞书会议ID）, topic, startTime, endTime
  hostUserId, participantCount
  status（processing/completed/skipped/failed）
  promptVersionId（用的哪个 Prompt 版本）
  docUrl, docToken（生成的飞书文档）
  skippedReason（跳过原因）
  aiSummary（AI 生成的简短摘要，用于列表展示）
  errorMessage
```

#### 关系对象

**UserModelAccess**：用户可用的模型
```
UserModelAccess
  id, userId, modelProviderId
```

#### 配置对象

**ModelProvider**：LLM 提供商配置
```
ModelProvider
  id, name, apiBase, apiKey（加密存储）, models（JSON，可用模型列表）
```

**UserSettings**：用户设置
```
UserSettings
  id, userId
  autoEnabled（布尔，是否开启自动纪要）
  saveFolderToken（飞书文件夹 token）
  exclusionRules（JSON，自然语言排除规则列表）
  specialRequirements（JSON，自然语言特殊要求列表，如 {"topic": "融资", "focus": "技术"}）
  activePromptVersionId
```

**SystemConfig**：系统级配置
```
SystemConfig
  id, key, value
  // 如 feishu_app_id, feishu_app_secret, default_prompt_version_id, member_access_mode
```
- `member_access_mode`：`"open"`（开放模式）或 `"whitelist"`（审批模式）

#### 审计对象

**ProcessingLog**：处理日志
```
ProcessingLog
  id, meetingRecordId, step, status, detail, createdAt
```

#### AI 对象

**SampleLearning**：举一反三学习记录
```
SampleLearning
  id, userId, name（用户起的名字）
  sampleDocTokens（样本飞书文档 token 列表，1-3 个）
  generatedPrompt（生成的 Prompt）
  styleDescription（生成的风格描述）
```

### 索引设计

```prisma
MeetingRecord: @@index([hostUserId]), @@index([status]), @@index([startTime])
PromptVersion: @@index([createdById])
UserSettings: @@index([userId]), unique
ProcessingLog: @@index([meetingRecordId])
```

### JSON vs 关联表决策

- exclusionRules、specialRequirements → **JSON**（结构随需求变化，不需要独立查询）
- corePrompt → **JSON 加密存储**（敏感数据）
- ModelProvider.models → **JSON**（模型列表结构简单，跟着 Provider 走）

## 七、状态机设计

### MeetingRecord 状态机

```
processing  → completed   // 纪要生成成功
processing  → failed      // 生成失败（可重试）
processing  → skipped     // 命中排除规则，跳过
failed      → processing  // 管理员手动重试
skipped     → processing  // 管理员手动重试
```

状态变更记录到 ProcessingLog。

## 八、处理流水线

```
新数据到达（飞书事件）
  ↓
Step 1: 获取会议详情 + 逐字稿文本（用 tenant_access_token）
  ↓ 失败 → 标记 failed，记录日志
Step 1.5: 参会人路由
  - 拉取参会人列表，筛掉 is_external: true
  - 匹配系统用户数据库，找出开了自动纪要的内部用户
  - 如果 meeting_source ≠ 1（非本企业会议）→ 跳过
  - 如果匹配结果为空 → 跳过
  ↓
Step 2: 对每个匹配到的用户，执行前置路由（小模型判断）
  - 检查是否命中该用户的排除规则 → 命中则跳过该用户
  - 提取该用户的特殊要求 → 作为后续 prompt 输入
  ↓
Step 3: Prompt 组装（每个用户独立组装）
  - 核心 Prompt（用户选择的版本） + 用户特殊要求 + 输出格式要求
  ↓
Step 4: LLM 生成结构化纪要（每个用户独立调用）
  ↓ 失败 → 该用户的记录标记 failed（可重试）
Step 5: 在用户指定的飞书文件夹创建文档 + 写入内容
  ↓ 失败 → 该用户的记录标记 failed（可重试）
  ↓ 成功
Step 6: 为该用户创建 MeetingRecord（status=completed, docUrl, aiSummary）
  ↓
Step 7: 后处理（写 ProcessingLog）
```

**核心决策**：一场会议 N 个内部参与者 → N 份独立的纪要，各自用各自的 Prompt 版本和设置，各自放到各自的文件夹。

降级策略：
- LLM 不可用 → 标记 failed，不阻塞
- 文档创建失败 → 重试 3 次后标记 failed
- 前置路由失败 → 降级为全量处理（不做过滤，统一生成）
- 获取参会人失败 → 至少为主持人生成（兜底）

## 九、API 设计（双轨）

### oRPC 路由（给前端）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/settings | 获取当前用户设置 |
| PATCH | /api/settings | 更新用户设置 |
| GET | /api/prompt-versions | 获取当前用户的 Prompt 版本列表 |
| POST | /api/prompt-versions | 创建新的 Prompt 版本（含举一反三） |
| DELETE | /api/prompt-versions/:id | 删除 Prompt 版本 |
| PATCH | /api/prompt-versions/:id/activate | 激活某个版本 |
| GET | /api/meeting-records | 会议纪要列表（最近生成的） |
| GET | /api/meeting-records/:id | 会议纪要详情 |
| POST | /api/meeting-records/:id/retry | 手动重试失败的处理 |
| GET | /api/admin/members | 管理员：成员列表 |
| POST | /api/admin/members | 管理员：添加成员 |
| DELETE | /api/admin/members/:id | 管理员：移除成员 |
| GET | /api/admin/model-providers | 管理员：模型提供商列表 |
| POST | /api/admin/model-providers | 管理员：添加模型提供商 |
| DELETE | /api/admin/model-providers/:id | 管理员：删除提供商 |
| GET | /api/admin/members/:id/models | 管理员：某成员的模型分配 |
| PATCH | /api/admin/members/:id/models | 管理员：更新某成员的模型分配 |
| GET | /api/admin/settings | 管理员：获取系统配置 |
| PATCH | /api/admin/settings | 管理员：更新系统配置（含成员模式） |
| POST | /api/admin/default-prompt | 管理员：设置默认 Prompt（含举一反三） |

### MCP Tool（给 Agent）

| Tool 名 | 说明 |
|---------|------|
| get_meeting_record | 获取某次会议纪要详情 |
| list_meeting_records | 列出会议纪要，支持按状态/时间筛选 |
| retry_meeting_record | 重试失败的纪要生成 |
| get_user_settings | 获取用户设置 |
| update_user_settings | 更新用户设置 |
| get_prompt_versions | 获取用户的 Prompt 版本列表 |
| create_prompt_from_samples | 举一反三：从样本创建 Prompt 版本 |

## 十、页面设计

遵循 `rules/06-前端开发规范.md` 的路由组织：

```
app/(saas)/app/
├── page.tsx                    # Dashboard（会议纪要列表）
├── [recordId]/page.tsx         # 会议纪要详情
├── settings/
│   ├── page.tsx                # 用户设置（主设置页）
│   └── prompts/
│       └── page.tsx            # Prompt 版本管理 + 举一反三（同页）
├── admin/
│   ├── page.tsx                # 管理后台首页（概览 + 成员模式选择）
│   ├── members/
│   │   ├── page.tsx            # 成员列表 + 添加成员
│   │   └── [memberId]/page.tsx # 成员详情（模型分配等）
│   ├── models/
│   │   └── page.tsx            # 模型提供商管理
│   └── prompt/
│       └── page.tsx            # 公司默认 Prompt 管理 + 举一反三（复用同一组件）
```

### 各页面布局

#### Dashboard（会议纪要列表）
```
顶部：标题 + "最近生成的会议纪要" + 状态筛选
主体：卡片列表，每张卡片：
  - 会议主题 | 状态标签 | 时间
  - AI 摘要（2-3 行）
  - 链接按钮（打开飞书文档）
三态：loading（skeleton）/ empty（"还没有会议纪要"）/ error（重试按钮）
```

#### 用户设置页
```
顶部：标题
表单区：
  - 自动会议纪要开关（Toggle）
  - 保存位置选择（飞书文件夹选择器）
  - 排除规则（输入框 + 列表，可增删）
  - 特殊要求（输入框 + 列表，如 "话题：x → 重点：y"）
  - 当前 Prompt 版本（下拉选择）
  - 跳转链接 → Prompt 管理页
```

#### Prompt 版本管理（含举一反三）
```
顶部：标题 + "创建新版本"按钮
点击"创建新版本" → 弹出或展开表单：
  - 上传 1-3 篇会议纪要（飞书文档链接或文件上传）
  - 给这个版本起名（如"简洁版"、"技术评审版"）
  - 点击"生成" → 后台 AI 学习 → 返回风格描述预览 → 用户确认保存
主体：版本卡片列表，每张：
  - 版本名称 | 风格描述 | 创建时间
  - 活跃标记（当前使用） | 切换按钮 | 删除按钮
```
管理员后台的 Prompt 管理页复用同一组件，只是面向全公司的默认 Prompt。

#### 管理后台 — 首页（概览）
```
顶部：标题 "管理后台"
区域 1：系统状态（会议处理数、成功率、LLM 调用量）
区域 2：成员接入模式选择
  - 两个 Radio 卡片：
    - 开放模式：公司全员自动可用，首次飞书登录即创建用户
    - 审批模式：仅白名单成员可用，需管理员手动添加
  - 当前模式高亮显示
```

#### 管理后台 — 成员管理
```
顶部：标题 + "添加成员"按钮（审批模式下按钮可见，开放模式下隐藏）
模式为"开放模式"时：显示提示文案"当前为开放模式，公司全员均可使用"
主体：表格
  - 姓名 | 飞书ID | 状态 | 可用模型 | 操作（编辑模型/移除）
```

#### 管理后台 — 模型提供商
```
顶部：标题 + "添加提供商"按钮
主体：提供商列表
  - 名称 | API Base | 模型数 | 操作
点击展开模型列表
```

## 十一、认证设计

**飞书 OAuth 2.0 登录**：
- 用户通过飞书 OAuth 登录，获取飞书用户身份
- 首次登录时：
  - **开放模式**（member_access_mode=open）：自动创建用户（isAdmin 默认 false）
  - **审批模式**（member_access_mode=whitelist）：检查是否在成员白名单中
    - 在 → 正常登录
    - 不在 → 提示"您没有使用权限，请联系管理员"
- 已存在用户 → 正常登录
- 管理员通过数据库 `isAdmin` 字段标记（首次部署时在数据库或 SystemConfig 中指定管理员飞书 ID）
- 管理员看到「管理后台」导航入口，普通用户看不到

## 十二、关键技术决策

1. **单租户自部署**：不需要 organizationId，数据库模型简化
2. **长连接接收事件**：使用飞书 SDK 的长连接模式，无需公网 IP
3. **Prompt 加密存储**：用户看不到核心 Prompt，用 `FIELD_ENCRYPTION_KEY` 加密
4. **前置路由用小模型**：成本低，分层处理（路由 + 生成两步走）
5. **举一反三复用同一个能力**：管理员初始化 + 用户自定义 共用同一个"样本 → Prompt"生成逻辑
6. **文档创建用飞书 docx v1 API**：先创建空文档，再通过 Block API 写入内容

## 十三、验证清单

完成后用 `rules/08-项目执行规范.md` 的 6 个问题自查：
- □ 有没有主对象？（MeetingRecord, PromptVersion）
- □ 有没有真实数据流？（飞书事件 → 逐字稿 → LLM → 文档）
- □ 有没有落库闭环？（MeetingRecord + ProcessingLog）
- □ 有没有流程约束？（状态机在后端强制）
- □ 有没有可追溯性？（ProcessingLog + createdAt/updatedAt）
- □ 有没有扩展空间？（JSON 字段存 AI 产出，Prompt 版本可迭代）
