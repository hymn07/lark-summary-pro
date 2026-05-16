import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getAllTools } from "./tools";

// MCP Server 主入口
// 启动方式：node packages/mcp-server/index.ts 或通过 Cursor/Claude 配置
async function main() {
  const server = new McpServer({
    name: "lark-summary-pro",
    version: "1.0.0",
    description: "飞书 AI 会议纪要生成工具 — 管理会议纪要、Prompt 版本、用户设置",
  });

  // 注册所有 Tool
  for (const tool of getAllTools()) {
    server.tool(tool.name, tool.description, tool.inputSchema.shape, tool.handler);
  }

  // 使用 stdio 传输（适配 Cursor/Claude Code 等）
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
