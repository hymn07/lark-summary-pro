# 项目进度

## ✅ 已完成

### 产品方案设计 - 2026-05-16
- 做了什么：完整的产品设计方案，MVP 3 个场景、8 个数据 Model、处理流水线（7 步）、API 设计（双轨）、页面路由规划
- 完整方案见 `docs/DESIGN.md`

### 项目文档初始化 - 2026-05-16
- 做了什么：CLAUDE.md（项目背景+导入约定+自查清单）、README.md、PROGRESS.md

### 数据库建表 - 2026-05-16
- 做了什么：Prisma schema 加 8 个业务 Model + isAdmin 字段，清理 Flowmail 残留关联
- 实现要点：schema 验证通过，待 Docker PostgreSQL 运行后 push

### 核心业务逻辑 - 2026-05-16
- 做了什么：创建 `packages/lark-meeting/` 业务包，实现完整处理流水线
- 文件：pipeline.ts（主编排）、meeting-fetcher.ts、participant-router.ts、pre-router.ts、prompt-assembler.ts、llm-generator.ts、doc-creator.ts、sample-learner.ts、config-reader.ts
- 实现要点：
  - 每个步骤独立模块，遵循单一职责
  - 一场会议 N 个参与者 → N 份独立纪要
  - 前置路由用 Zod Schema 约束 AI 输出
  - 举一反三复用同一个 `learnFromSamples` 函数
  - 飞书 API 和 LLM 调用留为 stub（TODO），需用户配置凭证后接入

### API 层（oRPC + MCP）- 2026-05-16
- 做了什么：
  - 4 个 oRPC 模块（settings、prompts、meetings、larkAdmin），16 个 procedure
  - MCP Server（packages/mcp-server/），8 个 Tool
- 实现要点：双轨架构完成，前端通过 oRPC、Agent 通过 MCP 均可调用

---

## 📋 待做

- [ ] 前端页面（Dashboard / 设置 / Prompt 管理 / 管理后台）
- [ ] 飞书 OAuth 登录集成
- [ ] 飞书事件长连接监听
- [ ] LLM 模型初始化（从 SystemConfig 读取提供商配置，创建 AI SDK model 实例）
- [ ] 数据库 push/migrate（Docker PostgreSQL 启动后）

---

## ⚠️ 已知问题

- **@ai-eyes 残留引用**：`apps/web/modules/saas/shared/components/AppWrapper.tsx` 引用了 `@ai-eyes/core`
- **数据库未实际创建**：Prisma schema 已验证通过，需 Docker PostgreSQL 运行后执行 push
- **飞书 API 凭证未配置**：meeting-fetcher.ts、doc-creator.ts 中的 `getTenantAccessToken()` 为 stub
- **LLM 模型实例未初始化**：pre-router.ts、llm-generator.ts、sample-learner.ts 中的模型获取为 stub
