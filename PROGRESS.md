# 项目进度

## ✅ 已完成

### 产品方案设计 - 2026-05-16
- 做了什么：完成完整的产品设计方案，包括 MVP 3 个场景、8 个数据 Model、处理流水线（7 步）、API 设计（双轨）、页面路由规划
- 实现要点：
  - 单租户自部署（无 organizationId）
  - 飞书长连接接收「企业会议结束」事件
  - 一场会议 N 个内部参与者 → N 份独立纪要（各自用各自的 Prompt 和设置）
  - Prompt 版本管理 + 举一反三（用户看不到核心 Prompt 原文，只能通过样本和自然语言间接影响）
  - 成员管理双模式：开放模式（全员自动可用）vs 审批模式（管理员手动白名单）
  - 前置路由：小模型先判断排除规则和提取特殊要求，再组装 Prompt 发给主力模型
- 完整方案见 `docs/DESIGN.md`

### 项目文档初始化 - 2026-05-16
- 做了什么：更新 CLAUDE.md（项目名+背景+Git 规则）、README.md（产品描述）、PROGRESS.md、删除 agents.md 并入 CLAUDE.md
- 实现要点：CLAUDE.md 包含项目背景段、完整导入约定、提交前自查清单

### 数据库建表 - 2026-05-16
- 做了什么：在 Prisma schema 中添加 8 个业务 Model（PromptVersion、MeetingRecord、ModelProvider、UserModelAccess、UserSettings、SystemConfig、ProcessingLog、SampleLearning），扩展 User 表增加 isAdmin 字段
- 实现要点：
  - 清理了 User 和 Organization 中引用 Flowmail 残留模型的无效关联
  - 新增 MeetingRecordStatus 枚举（processing/completed/skipped/failed）
  - 核心 Prompt 用 @db.Text 存储（后续加密）
  - 用户偏好字段用 Json（exclusionRules、specialRequirements、models、sampleDocTokens）
  - 修复了 @repo/logs 缺失导致的 pnpm install 失败
  - 移除了 apps/web 中 @ai-eyes/* 残留依赖

---

## 🔄 进行中

### 核心业务逻辑 — 处理流水线
- 创建 `packages/lark-meeting/` 业务包
- 实现飞书事件处理 → 参会人路由 → 前置路由 → Prompt 组装 → LLM 生成 → 文档创建的完整链路

---

## 📋 待做

- [ ] 飞书集成（事件监听 + 获取逐字稿 + 创建文档）
- [ ] API 层（oRPC + MCP Tool）
- [ ] 前端页面（Dashboard / 设置 / Prompt 管理 / 管理后台）
- [ ] 飞书 OAuth 登录

---

## ⚠️ 已知问题

- **@ai-eyes 残留引用**：`apps/web/modules/saas/shared/components/AppWrapper.tsx` 仍引用了 `@ai-eyes/core`，需要后续重构或删除该组件
- **数据库未实际创建**：Prisma schema 已验证通过，但未执行 push/migrate（需 Docker PostgreSQL 运行后执行）
