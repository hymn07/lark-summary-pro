// Next.js 16 服务器启动时自动调用
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startEventListener, startTranscriptRetrier } = await import("@repo/lark-meeting");
    startEventListener().catch((err: unknown) =>
      console.error("飞书事件监听器启动失败:", err),
    );
    startTranscriptRetrier();
  }
}
