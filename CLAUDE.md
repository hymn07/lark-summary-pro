# lark-summary-pro

> 每次新对话开始时，Claude 会自动读取本文件。项目设计决策记录在方案文件中。

## 项目
以飞书为入口的 AI 会议纪要自动生成工具 —— 开完会，纪要自动出现在指定文件夹里。

## 技术栈
Next.js 16 + TypeScript + Prisma + PostgreSQL + better-auth + shadcn/ui + Tailwind CSS
Hono + oRPC + TanStack Query + react-hook-form + zod + Stripe + Resend + MinIO
完整规范见 rules/01-技术栈规范.md

## 你必须先读
- **rules/00-AI协作原则.md** — 你的角色、提问的时机和方式
- **PROGRESS.md** — 项目当前状态，上次做到哪了

## 红线（每次对话都生效，违反前读 rules）
1. 业务逻辑放在 packages/，页面放在 apps/web/app/，API 路由在 packages/api/modules/
2. AI 输出必须用 Zod Schema 约束，禁止纯文本描述格式然后手动 parse
3. 数据库改动走 migration（pnpm --filter database migrate），禁止直接改生产
4. 所有业务能力同时暴露 oRPC Procedure（前端）和 MCP Tool（Agent）
5. 状态机在后端强制校验，前端只做触发展示
6. 发现我的设计有问题、需求模糊、有更好的实现方式时，必须主动问我

## 设计规范索引

> ⚠️ 做以下任何工作时，**必须先读对应的 rules 文件再动手**，不要凭自己的判断。
> 红线只覆盖了最关键的那几条。详细规范都在 rules/ 里。

| 你在做什么 | 必须读 |
|-----------|------|
| 设计产品功能、定义 MVP 范围 | rules/00-产品设计规范.md |
| 设计数据库表、索引、关系 | rules/02-数据库设计规范.md |
| 设计处理流程、状态机、聚合匹配 | rules/02.5-业务逻辑设计规范.md |
| 设计页面布局、交互、视觉 | rules/02.8-产品设计参考.md |
| 设计 API 端点、错误处理 | rules/03-API设计规范.md |
| 写 AI 功能、Prompt、降级 | rules/04-AI集成规范.md |
| 设计 MCP Tool、Agent 架构 | rules/05-Tool与Agent架构规范.md |
| 写前端页面、组件、状态管理 | rules/06-前端开发规范.md |
| 部署上线、排查问题 | rules/07-部署运维规范.md |
| 不知道怎么分工、给 AI 发消息 | rules/08-项目执行规范.md |

## 常用命令
```bash
pnpm dev                    # 启动开发服务器
pnpm build                  # 构建
pnpm --filter database generate  # 生成 Prisma Client
pnpm --filter database push      # 推送 Schema 到数据库
pnpm --filter database migrate   # 生成 migration
pnpm --filter database studio    # 打开 Prisma Studio
docker compose up -d        # 启动本地基础设施
docker compose logs -f      # 查看日志
```

## 组件导入
```typescript
// UI 组件从 @repo/ui 导入
import { Button, Card, Badge, Dialog } from "@repo/ui";
// 图标用 lucide-react
import { CheckCircleIcon, ClockIcon } from "lucide-react";
```

## 每次完成任务后
更新 **PROGRESS.md**：
- 完成了什么 → 移到「已完成」，写明关键决策和实现细节
- 开始做什么 → 加到「进行中」
- 发现了什么 bug/技术债 → 加到「已知问题」，修完了就移除

## 项目背景

- **产品定位**：AI 自动生成飞书会议纪要，单租户自部署
- **完整设计方案**：见 `.claude/plans/enumerated-zooming-moore.md`
- **核心链路**：飞书事件 → 拉取逐字稿 → 参会人路由 → 前置过滤 → LLM 生成 → 创建文档
- **用户角色**：管理员（成员管理 + 模型配置 + 默认 Prompt）+ 普通用户（开关/保存位置/排除规则/Prompt 版本）
- **关键决策**：单租户（无 organizationId）、长连接接收事件、Prompt 加密存储用户不可见、一场会议 N 个内部参与者 → N 份独立纪要

## 项目特定规则

### Git 提交规则

- **自主判断**：完成一个独立功能单元后，自动提交。不需要问我要不要 commit
- **提交格式**：Conventional Commits
  ```
  feat: 添加xxx功能
  fix: 修复xxx问题
  refactor: 重构xxx
  chore: 初始化/配置/依赖更新
  docs: 更新文档
  test: 添加测试
  ```
- **标题**：类型用英文（feat/fix/chore...），描述用中文
- **Body**：用中文写简要说明（做了什么、为什么这样做）
- **示例**：
  ```
  feat: 添加会议纪要自动生成流水线

  实现从飞书事件接收到文档创建的五步处理链路：
  前置路由 → Prompt组装 → LLM生成 → 文档创建 → 日志记录。
  支持排除规则和特殊要求的前置过滤。
  ```
