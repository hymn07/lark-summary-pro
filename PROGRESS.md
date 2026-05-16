# 项目进度

## ✅ 已完成

### 产品方案设计 - 2026-05-16
- 完整产品设计方案，MVP 3 场景 + 8 数据 Model + 7 步流水线 + API 双轨 + 页面规划
- 方案见 `docs/DESIGN.md`

### 数据库 + 业务逻辑 + API + 前端 + 接入 - 2026-05-16
- 数据库：Prisma schema 推送到 PostgreSQL，8 个业务表已创建
- 业务逻辑：`packages/lark-meeting/` — 7 步处理流水线 + 举一反三 + 配置读取
- oRPC API：16 个 procedure，4 个模块
- MCP Server：8 个 Agent Tool
- 前端：14 个页面（Dashboard / 设置 / Prompt 管理 / 管理后台）
- 飞书凭证已入库，tenant_access_token 已验证可调通
- DeepSeek 模型提供商已配置（flash + pro）

---

## 📋 待做

- [ ] 飞书 OAuth 登录（参考 `飞书登录认证实现指南_优化版.md`）
- [ ] 飞书事件长连接监听（处理会议结束事件）
- [ ] 侧边栏导航更新（管理后台入口、设置等菜单项）
- [ ] 前端页面与 API 联调

---

## ⚠️ 已知问题

- **@ai-eyes 残留**：`apps/web/modules/saas/shared/components/AppWrapper.tsx`
- **shadcn/ui 组件**：Card、Badge、Switch、Select 等需确认已安装到项目
