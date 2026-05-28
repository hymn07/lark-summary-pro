# lark-summary-pro

以飞书为入口的 AI 会议纪要自动生成工具 —— 开完会，纪要自动出现在指定文件夹里。

## 为什么用这个？

飞书自带的会议纪要无法定制风格，且会议内容分散在各个文档里，无法统一管理和有关联地利用信息。lark-summary-pro 让你用自己的 LLM，不仅成本可降低 90%+，还能把会议信息真正用起来。

- **成本低**：可自定义模型，成本可低至几分钱
- **可定制**：自定义 Prompt + 上传 1-3 篇示例纪要让 AI 学习你的风格，适配各行业、公司
- **AI Agent 对话**：通过自然语言查询会议内容、针对性提问、执行操作，内置 16 个工具
- **待办统一维护**：自动从会议中提取代办，维护到统一的代办文档
- **数据自有**：纪要数据沉淀在本地数据库，后续可做二次处理和消费
- **开源自部署**：可在此基础上针对性二次开发，适配团队个性化需求

## 功能

- **自动生成**：会议结束后，通过 WebSocket 长连接接收事件，自动拉取妙记逐字稿，AI 生成 10 维度结构化纪要并创建飞书文档
- **风格定制**：上传示例纪要让 AI 学习写作风格；支持自然语言描述排除规则和特殊要求
- **参会人路由**：根据参会人匹配系统用户，每人可配置独立的生成规则
- **前置过滤**：用小模型快速判断会议是否值得生成纪要，避免浪费
- **AI Agent 对话**：自然语言查询会议内容、管理待办、执行操作，内置 16 个工具
- **记忆系统**：自动分析用户对话偏好，发现新的提取维度，个人/公共记忆分级
- **会议待办**：自动提取行动项，通知确认后写入飞书文档，按紧急程度排序，统一维护
- **语音转文字**：支持上传录音文件（mp3/wav/m4a 等），自动转写为逐字稿
- **管理后台**：成员管理、多 LLM 提供商配置、模型路由、Prompt 管理、记忆洞察
- **飞书登录**：通过飞书 OAuth 登录，纪要直接创建到用户指定的飞书文件夹

## 技术栈

Next.js 16 + TypeScript + Prisma + PostgreSQL + better-auth + Hono + oRPC + shadcn/ui + Tailwind CSS + Vercel AI SDK

## 飞书应用配置

### 1. 创建应用

1. 打开 [飞书开发者后台](https://open.feishu.cn/app)，点击「创建企业自建应用」
2. 填写应用名称和描述，创建后进入应用详情页
3. 在「基础信息」页获取 **App ID** 和 **App Secret**，填入 `.env` 的 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET`

### 2. 添加应用能力

在「添加应用能力」中，添加 **网页应用**。

### 3. 开通权限

在「权限管理」中，导入项目根目录的 `feishu-permissions.json`，或手动开通以下权限：

**应用身份权限**（调用 API 时使用 tenant_access_token）：
- `vc:meeting:read` — 读取会议详情及参会人
- `vc:meeting.recording:read` — 读取录制信息（提取妙记 token）
- `contact:user.id:read` — 批量查询用户姓名
- `drive:drive:read` — 添加文档协作者、转移所有权
- `docx:document:read` — 读取文档内容（逐字稿降级方案）
- `docx:document:write` — 创建文档并写入内容

**用户身份权限**（用户 OAuth 登录时授权）：
- `auth:user.id:read` — 获取用户身份信息
- `offline_access` — 获取 refresh_token 用于长期会话
- `minutes:minutes.search:read` — 搜索妙记
- `minutes:minutes:readonly` — 读取妙记
- `minutes:minutes.transcript:export` — 导出妙记逐字稿
- `drive:drive` — 访问云空间
- `docx:document` — 创建/编辑文档
- `vc:meeting.search:read` — 搜索会议（同步历史会议用）

开通后，**需要发布应用并让管理员审核通过**，权限才会生效。

### 4. 事件订阅

在「事件与回调」中，添加事件 `vc.meeting.all_meeting_ended_v1`（会议结束事件）。

> 本项目使用 WebSocket 长连接接收事件，无需配置回调 URL。确保事件已添加并订阅即可。

### 5. 安全设置

在「安全设置」中，添加重定向 URL（根据实际域名修改）：

```
http://localhost:3000/api/auth/oauth2/callback/lark
```

## 部署

### 本地开发

```bash
# 1. 启动基础设施 (PostgreSQL + MinIO)
docker compose up -d

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env：填写数据库地址、飞书 App ID/Secret、LLM API Key

# 4. 初始化数据库
pnpm --filter database generate
pnpm --filter database push

# 5. 启动
pnpm dev
```

### 生产部署

项目已内置完整的 Docker 化部署方案：

```bash
# 1. 构建并推送镜像（或直接拉取已构建的镜像）
pnpm build

# 2. 在服务器上，配置 .env 文件

# 3. 启动所有服务
docker compose -f docker-compose.prod.yml up -d
```

生产环境包含：PostgreSQL + MinIO + Web 应用 + Nginx 反向代理 + 数据库迁移。

首次部署需要在服务器上安装 Docker 和 Docker Compose，运行 `scripts/server-init.sh` 可一键初始化服务器环境。

## 项目结构

```
├── apps/web/          # Next.js 主应用
├── packages/
│   ├── database/      # Prisma Schema
│   ├── api/           # Hono + oRPC API
│   ├── ai/            # AI SDK 封装
│   ├── ui/            # shadcn/ui 组件
│   ├── lark-meeting/  # 会议纪要核心业务逻辑
│   ├── agent/          # AI Agent（工具注册/记忆系统）
│   ├── mcp-server/    # MCP Tool 暴露
│   ├── auth/          # better-auth 认证
│   └── storage/       # MinIO 对象存储
├── rules/             # 设计规范文档
└── docker-compose.yml
```

## 后续版本规划

### 文档格式优化

飞书文档支持丰富的 Block 类型（卡片、表格、高亮块），后续利用这些能力美化纪要排版。

### 会议创建与管理

在应用内创建、编辑和管理会议，统一以本应用为入口完成会议相关的所有操作。

最终愿景：不是一个「会议纪要工具」，而是团队的**会议信息管理入口**。