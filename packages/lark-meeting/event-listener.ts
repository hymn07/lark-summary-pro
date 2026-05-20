import * as Lark from "@larksuiteoapi/node-sdk";
import { getConfig } from "./config-reader";
import { handleMeetingEnded } from "./pipeline";

let wsClient: Lark.WSClient | null = null;

// 启动飞书事件长连接监听（基于官方 SDK）
export async function startEventListener(): Promise<void> {
  if (wsClient) {
    console.log("飞书事件监听已在运行，跳过");
    return;
  }

  const appId = await getConfig("feishu_app_id");
  const appSecret = await getConfig("feishu_app_secret");
  if (!appId || !appSecret) {
    console.error("飞书应用凭证未配置，无法启动事件监听");
    return;
  }

  console.log("飞书事件监听启动中...");

  wsClient = new Lark.WSClient({
    appId,
    appSecret,
    loggerLevel: Lark.LoggerLevel.info,
  });

  wsClient.start({
    eventDispatcher: new Lark.EventDispatcher({}).register({
      "vc.meeting.all_meeting_ended_v1": async (event) => {
        try {
          console.log(
            `收到会议结束事件: ${(event as { meeting?: { id?: string; topic?: string } }).meeting?.id} - ${(event as { meeting?: { topic?: string } }).meeting?.topic}`,
          );
          await handleMeetingEnded(event as Parameters<typeof handleMeetingEnded>[0]);
        } catch (err) {
          console.error("处理会议结束事件失败:", err);
        }
      },
    }),
  });

  console.log("飞书事件监听已连接");
}

// 停止事件监听
export function stopEventListener(): void {
  // SDK 的 WSClient 目前没有提供显式的 stop 方法；连接在进程退出时自动断开
  wsClient = null;
}
