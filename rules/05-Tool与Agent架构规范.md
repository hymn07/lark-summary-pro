# 05 — Tool 与 Agent 架构规范

> 作用：设计可被 AI Agent 安全调用的业务能力层

---

## 一、硬性规则（MUST）

> ⚠️ 规则冲突提醒：如果以下规则与你的实际需求有任何冲突，AI 必须主动指出并建议替代方案（参见 00-AI协作原则.md）。

### 1.1 Tool 接口标准

```typescript
interface Tool<TInput, TOutput> {
  name: string;           // snake_case，如 "approve_request"
  description: string;    // ⭐ 最关键：Agent 靠这个决定是否调用
  category: ToolCategory; // ai | source | data | output | system

  inputSchema: ZodType;   // 输入参数
  outputSchema: ZodType;  // 输出结果（也用于类型推导）
  requiresApproval?: boolean; // 是否需要人工确认

  execute(input: TInput, context: ToolContext): Promise<ToolResult<TOutput>>;
}
```

### 1.2 Description 编写规则（最重要）

Agent 完全靠 `description` 判断是否调用你的 Tool。必须包含：

```
✅ 一句话功能说明
✅ 何时调用（触发条件/用户意图）
✅ 副作用（调用后发生什么）
✅ 前置条件（需要哪些参数、如何获取）
✅ 边界和限制

❌ "Approve an entity"（太模糊）
❌ "处理审批"（没说明何时触发）
```

**标准模板**：
```
[动词+名词]。[一句话功能说明]。
当用户说「[触发语1]」「[触发语2]」时调用。
调用后会：[副作用1，副作用2]。
需要 [前置参数]，可先用 [前置 Tool] 获取。
```

### 1.3 Tool 分类

```typescript
type ToolCategory =
  | "ai"       // AI 分析：分类、抽取、摘要、语义匹配
  | "source"   // 数据源：同步、抓取、连接器
  | "data"     // 数据操作：CRUD、搜索、过滤
  | "output"   // 输出推送：通知、邮件、卡片
  | "transform" // 数据转换：格式转换、清洗
  | "system";  // 系统工具：测试、监控、配置
```

### 1.4 MCP Server 必须包括

- **鉴权**：验证 API Token（hash 比对）
- **权限过滤**：按用户角色控制可用 Tool 列表
- **调用日志**：记录每次 Tool 调用的成功/失败/耗时/错误

---

## 二、强烈建议（SHOULD）

### 2.1 Tool 薄层模式

Tool handler 里禁止写业务逻辑：

```typescript
// ✅ Tool handler 只做 3 件事：解析参数 → 调业务函数 → 格式化输出
server.tool("approve", "...", approvalSchema, async ({ entityId }) => {
  const result = await approveRequest(entityId); // 业务逻辑在 packages/
  return formatToolResult(result);
});
```

### 2.2 新增业务能力三步流程

```
1. packages/[feature]/actions.ts          ← 核心业务逻辑（唯一真相来源）
2. packages/api/modules/[feature]/        ← oRPC（前端 UI 调用层）
3. apps/web/app/(api)/mcp/ 或 packages/ ← MCP Tool（Agent 调用层）

必须三个都做，禁止只在某一层实现。
```

### 2.3 提供「探测」Tool

每个 MCP Server 应该有一个 `whoami` 或类似的零参数只读 Tool：

```
输入：无
输出：当前用户身份、角色、权限范围、可用 Tool 列表、可用 Tool 分类概览
用途：Agent 首次连接时用它确认身份和能力边界
```

### 2.4 Tool 权限分级

```
viewer   → list_* / get_* （只读）
analyst  → 读 + 分析 Tool
operator → 读 + 分析 + 操作 Tool
admin    → 所有 Tool + system Tool
```

---

## 三、建议（MAY）

### 3.1 Tool 计量

```typescript
// 记录每次调用
await db.toolCallLog.create({
  data: { userId, toolName, success, durationMs, error },
});
```

用途：成本分析、异常检测、用户活跃度。

### 3.2 考虑 Skill → Workflow 晋升路径

```
Skill（用户创建，轻量）→ 审批 → Workflow（固化，生产级）
```

Skill 是用户创建的 Tool 组合。当某个 Skill 被多次验证稳定后，可以晋升为固化 Workflow，配置定时触发或 Webhook 触发。

### 3.3 插件化数据源架构

如果系统需要接入多种数据源：

```typescript
interface SourceProvider<TConfig> {
  readonly type: SourceType;
  readonly configSchema: ZodSchema<TConfig>;

  validateConfig(config: TConfig): Promise<ValidationResult>;
  fetch(config: TConfig): Promise<RawData>;
  parse(raw: RawData): Promise<ParsedItem[]>;
  toSignal(item: ParsedItem): UnifiedSignal;  // 统一数据模型
}
```

核心设计：所有数据源最终输出统一的数据结构（UnifiedSignal），上层处理逻辑只认这个结构。

---

## 四、从实际项目中提炼的 Insight

### 4.1 Tool → Skill → Workflow → Agent 四层模型

```
Tool（原子能力，工程师开发）
  ↓ 组合
Skill（Tool 组合 + 指令，用户/Agent 创建）
  ↓ 审批固化
Workflow（生产级执行链，稳定可重复）
  ↓ 动态编排
Agent（无 Workflow 时 LLM 自主规划 Tool 调用路径）
```

不是所有产品都需要四层，但这个分层思路可以指导设计：
- Tool < 20 个 → 直接注册 MCP Tool 即可
- Tool 50+ 个 → 需要 ToolRegistry + 分类管理
- 需要用户自定义流程 → 加 Skill 层

### 4.2 外部服务集成的插件化方法

面对多个外部服务（如 Gmail、飞书、钉钉），采用统一接口 + 独立实现的模式：

```
interface EmailConnector {
  provider: string;
  sync(): Promise<Email[]>;
  send(email: Email): Promise<void>;
}
```

每个厂商一个独立文件，新增厂商不修改核心代码。暴露给 Agent 的能力先做核心函数，再同时挂 oRPC + MCP。

### 4.3 ToolContext 注入而非全局变量

不要用全局变量传 userId 或 token。每个 Tool 的 `context` 参数在 MCP Gateway 层注入：

```typescript
const context: ToolContext = {
  userId: resolvedUser.id,
  sessionId: `mcp_${Date.now()}`,
  apiKeyId: keyInfo.id,
  // 外部服务 token 也在 context 中注入
  emailAccessToken: feishuToken,
};
```

Tool 实现者不需要知道 token 怎么来的——只需要从 context 里拿。

### 4.4 Agent 首次接入的 Bootstrap 流程

Agent 接入不是在 IDE 里「配置好 MCP URL 就完事」。一个完整的接入流程：
1. 用户创建 API Key（Web 端或 CLI）
2. 配置到 Agent 的 .mcp.json
3. Agent 连上后调用 `whoami` 验证连通性和权限
4. Agent 调用 `tools/list` 了解自己的能力边界
5. 开始正常使用
