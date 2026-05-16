# 项目进度

## ✅ 已完成

### 产品方案设计 - 2026-05-16
- 完整产品设计方案，MVP 3 场景 + 8 个数据 Model + 7 步流水线 + API 双轨 + 页面规划
- 完整方案见 `docs/DESIGN.md`

### 项目文档初始化 - 2026-05-16
- CLAUDE.md（项目背景+导入约定+自查清单）、README.md、PROGRESS.md

### 数据库建表 - 2026-05-16
- Prisma schema 加 8 个业务 Model + isAdmin，清理 Flowmail 残留，已 push 到 PostgreSQL

### 核心业务逻辑 - 2026-05-16
- `packages/lark-meeting/`：pipeline.ts + 7 个步骤模块 + 举一反三 + 配置读取

### API 层（oRPC + MCP）- 2026-05-16
- 4 个 oRPC 模块（16 个 procedure），MCP Server（8 个 Tool）

### 前端页面 - 2026-05-16
- 14 个页面文件：Dashboard、设置、Prompt 管理、管理后台（首页+成员+模型+Prompt）
- 遵循三态处理、颜色+图标双通道、Server/Client 组件分层
- auth config：关闭 organizations 和 onboarding（单租户）

---

## 📋 待做

- [ ] 飞书 OAuth 登录集成
- [ ] 飞书事件长连接监听
- [ ] LLM 模型实例初始化（从 SystemConfig 读取配置 → 创建 AI SDK model）
- [ ] 侧边栏导航更新（增加管理后台入口、设置等）
- [ ] TypeScript 编译验证 + 修复

---

## ⚠️ 已知问题

- **@ai-eyes 残留引用**：`AppWrapper.tsx` 引用了 `@ai-eyes/core`
- **飞书 API 凭证未配置**：getTenantAccessToken() 留空
- **LLM 模型实例未初始化**：getFastModel()、getTextModel() 留空
- **前端页面依赖 shadcn/ui 组件**：Card、Badge、Skeleton、Switch、Select 等需确认已安装
