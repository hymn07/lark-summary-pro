# lark-summary-pro

以飞书为入口的 AI 会议纪要自动生成工具 —— 开完会，纪要自动出现在指定文件夹里。

## 解决的问题

飞书自带会议纪要功能，但每篇 5 元，且无法定制风格。lark-summary-pro 让你用自己配置的 LLM，一次部署全公司免费使用，纪要风格完全可控。

## 核心功能

- **自动生成**：会议结束后，自动拉取妙记逐字稿，AI 生成结构化纪要并创建飞书文档
- **风格定制**：上传 1-3 篇示例纪要，AI 学习你的风格；支持自然语言排除规则和特殊要求
- **管理后台**：管理员可管理成员、配置多个 LLM 提供商、按成员分配模型、设置公司默认 Prompt
- **飞书登录**：通过飞书 OAuth 登录，纪要直接创建到用户指定的飞书文件夹

## 技术栈

Next.js 16 + TypeScript + Prisma + PostgreSQL + better-auth + Hono + oRPC + shadcn/ui + Tailwind CSS + Vercel AI SDK

## 快速开始

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

## 部署

单租户自部署。详细步骤见 `rules/07-部署运维规范.md`。

## 项目结构

```
├── apps/web/          # Next.js 主应用
├── packages/
│   ├── database/      # Prisma Schema
│   ├── api/           # Hono + oRPC API
│   ├── ai/            # AI SDK 封装
│   ├── ui/            # shadcn/ui 组件
│   └── lark-meeting/  # 会议纪要业务逻辑
├── rules/             # 设计规范文档
└── docker-compose.yml
```
