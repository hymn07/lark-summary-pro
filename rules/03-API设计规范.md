# 03 — API 设计规范

> 作用：设计类型安全、Agent 友好、可维护的 API 层

---

## 一、硬性规则（MUST）

> ⚠️ 规则冲突提醒：如果以下规则与你的实际需求有任何冲突，AI 必须主动指出并建议替代方案（参见 00-AI协作原则.md）。

### 1.1 双轨 API 架构

**所有可被 AI Agent 调用的业务能力必须同时暴露两个接口：**

```
packages/[业务包]/     ← 核心业务逻辑（唯一真相来源）
      ↓
┌──────┴──────┐
↓             ↓
oRPC          MCP Tools
(前端 UI)     (AI Agent)
```

- 核心业务逻辑写在 `packages/` 中，只写一次
- oRPC procedure 和 MCP Tool 都只是薄薄的适配层
- **禁止**在 procedure 或 MCP handler 里写业务逻辑

### 1.2 REST 命名惯例

```
GET    /api/items              → 列表（支持 ?status=&type=&limit= 查询参数）
GET    /api/items/:id          → 详情
POST   /api/items              → 创建
PATCH  /api/items/:id          → 部分更新
DELETE /api/items/:id          → 删除
POST   /api/items/:id/approve  → 子资源操作（动词）

❌ GET /api/getItems           → 不要在 URL 里用动词
❌ POST /api/item              → 用复数
```

### 1.3 HTTP 状态码

```typescript
200  OK            // GET/PATCH 成功
201  Created       // POST 创建成功
204  No Content    // DELETE 成功
400  Bad Request   // 参数校验失败
401  Unauthorized  // 未登录或 token 过期
403  Forbidden     // 已登录但无权限
404  Not Found     // 资源不存在
409  Conflict      // 重复创建
429  Too Many      // 限频
500  Internal      // 服务器错误
```

### 1.4 所有输入必须 Zod validation

```typescript
const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(["A", "B"]),
  amount: z.number().optional(),
});
```

不要依赖「前端做了校验」——前端校验是 UX，后端校验是安全。

### 1.5 每个 API 端点对应一个 oRPC Module

```
packages/api/modules/[feature]/
├── router.ts        # router 定义
├── procedures.ts    # procedure 实现
├── schema.ts        # Zod schemas
└── index.ts         # 导出
```

---

## 二、强烈建议（SHOULD）

### 2.1 统一错误响应格式

```typescript
interface ApiError {
  error: {
    code: string;      // "VALIDATION_ERROR" | "NOT_FOUND" | "FORBIDDEN"
    message: string;   // 人类可读
    details?: unknown; // 字段级错误详情（validation 时）
  };
}
```

### 2.2 分页约定

使用游标分页（cursor-based），避免偏移分页在大数据量下的性能问题：

```typescript
const listQuery = z.object({
  limit: z.number().min(1).max(100).default(20),
  cursor: z.string().optional(),  // 上一页最后一条的 ID
});

interface ListResponse<T> {
  data: T[];
  hasMore: boolean;
  nextCursor?: string;
}
```

### 2.3 中间件层设计

```
请求 → Logger → CORS → Rate Limit → Auth → 业务路由
```

- Logger：记录请求路径、耗时
- CORS：白名单控制
- Rate Limit：登录接口 5 次/分钟，通用接口 100 次/分钟
- Auth：better-auth 处理认证

### 2.4 API Key 管理

如果系统需要支持 Agent 通过 API Key 调用（不是通过用户登录态），API Key 必须：
- 数据库只存 hash，不存明文
- 创建时返回一次明文，之后无法查看
- 支持多 Key（不同设备/用途）
- 支持按 scope 限制权限
- 记录最后使用时间

---

## 三、建议（MAY）

### 3.1 API 版本化

```
/api/v1/items    → 当前版本
/api/v2/items    → 大改时启用
```

小改动（加字段、加可选参数）不升版本号。

### 3.2 为每个写操作记录审计日志

至少记录：
- 谁（userId）
- 做了什么（action + targetType + targetId）
- 什么时候（createdAt）
- 从哪里来（ipAddress, userAgent）

---

## 四、从实际项目中提炼的 Insight

### 4.1 双轨 API 不是「做了两遍」

很多人以为 oRPC + MCP 意味着同一套逻辑写两次。实际上，业务逻辑在 `packages/` 里写一次，oRPC procedure 和 MCP Tool 各只有 10-15 行的适配代码。

### 4.2 类型安全链路的价值

oRPC 的最大好处不是少写代码，是改了数据库字段 → Prisma 生成新类型 → oRPC 自动推导 → 前端 TanStack Query 报类型错误 → 你知道所有要改的地方。

如果不用类型安全的 API 层，前后端类型是手动维护的，改了字段前端运行时才发现。

### 4.3 Agent 接入的设计：Bootstrap API 模式

Agent 首次接入的认证引导不走 MCP（因为 Agent 还没有 MCP 连接）。

设计一个独立的 Bootstrap REST API：
```
POST /v1/auth/register → 注册 + 返回 API Key
POST /v1/auth/create-key → 已有账号生成新 Key  
GET  /v1/auth/status → Agent 确认连接状态和可用工具数
```

然后 Agent 带着 API Key 通过 MCP 协议访问所有业务 Tool。

### 4.4 MCP 权限过滤

不是所有用户都能调用所有 MCP Tool。按角色过滤：

```
viewer   → 只读 Tool（list_*, get_*）
analyst  → 只读 + 分析 Tool
admin    → 所有 Tool
```

权限表在 MCP Server 创建时过滤，不是在 Tool handler 内部判断。
