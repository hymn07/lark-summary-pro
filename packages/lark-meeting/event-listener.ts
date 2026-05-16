import { getTenantAccessToken } from "./feishu-client";
import { handleMeetingEnded } from "./pipeline";
import type { FeishuMeetingEndedEvent } from "./types";

// 飞书事件长连接监听
// 连接 WebSocket 接收事件，自动重连
export async function startEventListener(): Promise<void> {
  const token = await getTenantAccessToken();
  if (!token) {
    console.error("无法获取飞书 tenant_access_token，事件监听未启动");
    return;
  }

  const wsUrl = `wss://open.feishu.cn/open-apis/event/v1/ws?token=${token}`;
  console.log("飞书事件监听启动中...");

  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("飞书事件 WebSocket 已连接");
    };

    ws.onmessage = async (event) => {
      try {
        const raw = JSON.parse(event.data as string);
        // 飞书事件格式: { schema, header: { event_type, ... }, event: { ... } }
        const eventType = raw.header?.event_type;

        if (eventType === "vc.meeting.all_meeting_ended_v1") {
          const meetingEvent = raw as FeishuMeetingEndedEvent;
          console.log(`收到会议结束事件: ${meetingEvent.meeting.id} - ${meetingEvent.meeting.topic}`);
          handleMeetingEnded(meetingEvent).catch((err) =>
            console.error("处理会议结束事件失败:", err),
          );
        }
      } catch (err) {
        console.error("解析事件失败:", err);
      }
    };

    ws.onclose = (event) => {
      console.log(`飞书事件 WebSocket 断开 (code: ${event.code})，5 秒后重连`);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 5000);
    };

    ws.onerror = (err) => {
      console.error("飞书事件 WebSocket 错误:", err);
    };
  }

  connect();
}

// 停止事件监听
export function stopEventListener(): void {
  // WebSocket 会自动清理；如需强制断开，可在此实现
}
