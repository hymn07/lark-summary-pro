// 飞书事件长连接监听器 — 独立进程
// 启动方式：DATABASE_URL="..." npx tsx scripts/event-listener.ts
import { startEventListener } from "@repo/lark-meeting";

startEventListener().catch(console.error);
