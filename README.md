# SaaS Starter

从 supastarter 提取的 Next.js SaaS 模板。包含认证、多租户、支付、邮件等基础设施，不含业务逻辑。

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript (strict) |
| 包管理 | pnpm + Turborepo |
| 数据库 | Prisma + PostgreSQL |
| 认证 | better-auth (email OTP + OAuth) |
| API | Hono + oRPC (前端) |
| UI | shadcn/ui + Radix + Tailwind CSS |
| 邮件 | React Email + Resend |
| 支付 | Stripe |
| 存储 | S3 (MinIO) |
| 代码质量 | Biome |

## 项目结构

```
├── apps/
│   ├── web/              # Next.js 主应用
│   ├── docs/             # 文档站
│   └── mail-preview/     # 邮件模板预览
├── packages/
│   ├── database/         # Prisma schema + 查询
│   ├── auth/             # better-auth 认证
│   ├── api/              # Hono + oRPC API
│   ├── ai/               # Vercel AI SDK
│   ├── ui/               # shadcn/ui 组件
│   ├── mail/             # 邮件发送
│   ├── payments/         # Stripe 支付
│   ├── storage/          # S3 存储
│   ├── i18n/             # 国际化
│   ├── utils/            # 工具函数
│   └── ──────────────    # 👇 业务包加这里
├── tooling/              # 构建配置
├── docker-compose.yml    # 本地开发环境
└── scripts/
```

## 快速开始

```bash
# 1. 启动基础设施 (PostgreSQL + MinIO)
docker compose up -d

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example .env

# 4. 初始化数据库
pnpm --filter database generate
pnpm --filter database push

# 5. 启动
pnpm dev
```

访问 `http://localhost:3000`

## 数据库表

| 表 | 用途 |
|----|------|
| user | 用户 |
| session | 登录会话 |
| account | OAuth 账户 |
| verification | 验证码 |
| organization | 组织/工作区 |
| member | 组织成员 |
| invitation | 邀请 |
| purchase | 支付记录 |

## 认证方式

- 注册/登录：邮箱验证码 (email OTP) + Google OAuth
- 组织：多租户，用户可创建/加入多个组织
- 角色：owner / admin / member

## 如何加业务功能

以加「待办事项」为例：

1. **数据库** — `packages/database/prisma/schema.prisma` 加 model → `pnpm --filter database push`
2. **API** — `packages/api/modules/todos/` 创建 router
3. **页面** — `apps/web/app/(saas)/app/[organizationSlug]/todos/` 创建页面
4. **注册** — `packages/api/orpc/router.ts` 注册新路由

## 来源

此模板从 [Flowmail](https://github.com/littlesheepxy/flowmail) 项目提取。
Flowmail 基于 supastarter (supastarter.dev) 构建。
提取时删除了所有业务代码，只保留通用 SaaS 基础设施。
