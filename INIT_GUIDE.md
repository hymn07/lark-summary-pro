# 模板初始化指南

> 从 saas-starter 创建一个新项目只需 5 分钟。

---

## 快速开始

```bash
# 1. 复制模板
cp -r saas-starter my-new-project
cd my-new-project

# 2. 运行初始化脚本
bash scripts/init.sh

# 3. 安装依赖
pnpm install

# 4. 启动基础设施
docker compose up -d

# 5. 初始化数据库
pnpm --filter database generate
pnpm --filter database push

# 6. 启动开发服务器
pnpm dev
```

---

## 初始化脚本做的事

运行 `scripts/init.sh` 后，你会被问到 3 个问题，然后自动完成：

| 问什么 | 改什么 |
|--------|--------|
| 项目名称（如 `my-saas`） | `package.json` 的 name，所有 `@repo/` 引用不变 |
| 数据库名（如 `my_saas_dev`） | `.env` 的 DATABASE_URL，docker-compose 的 POSTGRES_DB |
| 容器名前缀（如 `mysaas`） | `docker-compose.yml` 的 container_name |

其余的——技术栈、monorepo 结构、Prisma schema 基础表、auth 配置、API 层、UI 组件——全是开箱即用的。

---

## 不需要改的

这些在初始化后直接用，不要动：

```
rules/           ← 所有规范文档，直接投喂给 AI
packages/ui/     ← shadcn 组件库
packages/auth/   ← 认证系统
packages/api/    ← oRPC 框架
packages/mail/   ← 邮件模板
packages/payments/ ← Stripe 支付
tooling/         ← 构建配置
docker-compose.yml ← 本地开发环境
```

---

## 需要手动改的

初始化后你需要按自己产品填的：

| 文件 | 内容 | 什么时候改 |
|------|------|-----------|
| `.env` | OAuth Key, AI Key, Stripe Key 等 | 需要对应功能时 |
| `prisma/schema.prisma` | 加业务 model | 开始做第一个功能时 |
| `packages/api/orpc/router.ts` | 加业务路由 | 新增 API 时 |
| `apps/web/app/.../` | 加业务页面 | 新增页面时 |
| `README.md` | 项目介绍 | 上线前 |

---

## 给你的 AI 的初始化消息

新项目开始时，把这段发给 AI：

```markdown
## 我要开始一个新项目

项目名称：[xxx]
一句话描述：[xxx]

技术栈、项目结构、开发规范按 rules/ 下的文档执行。

首先帮我完成初始化：
1. 确认所有配置正确
2. 把 README 改成项目描述
3. 等我说第一个功能需求
```
