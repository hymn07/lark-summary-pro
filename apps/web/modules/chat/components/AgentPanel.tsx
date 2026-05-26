"use client";

import { cn } from "@repo/ui";
import {
	ChevronDown,
	ChevronRight,
	Loader2,
	Sparkles,
	Wrench,
	X,
} from "lucide-react";
import {
	type FormEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAgent } from "./AgentProvider";

// ── Types ──

interface ToolEvent {
	name: string;
	status: "running" | "done";
	input?: string;
}

interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	text: string;
	reasoning?: string; // 模型思考过程
	tools?: ToolEvent[]; // 本次消息调用的工具
}

// ── Tool labels ──

const TOOL_LABELS: Record<string, string> = {
	searchMeetings: "搜索会议",
	getMeeting: "获取详情",
	listMeetingRecords: "查询记录",
	getFeishuMeetings: "源会议列表",
	getFeishuMeetingDetail: "源会议详情",
	generateMeetingMinutes: "生成纪要",
	retryMeetingRecord: "重试",
	getUserSettings: "查询设置",
	updateUserSettings: "更新设置",
	listPromptVersions: "Prompt 列表",
	createPromptFromSamples: "学习风格",
	getStats: "统计",
	getSystemConfig: "系统配置",
};

// ── Sub-components ──

function ToolCallBar({ tools }: { tools: ToolEvent[] }) {
	const [open, setOpen] = useState(false);
	if (tools.length === 0) {
		return null;
	}

	const runningCount = tools.filter((t) => t.status === "running").length;
	const doneCount = tools.filter((t) => t.status === "done").length;
	const label =
		runningCount > 0
			? `${tools.length} 个工具（${doneCount} 完成，${runningCount} 执行中）`
			: `已调用 ${tools.length} 个工具`;

	return (
		<div className="text-xs text-gray-500">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="flex items-center gap-1 w-full text-left py-1 hover:text-gray-700 transition-colors"
			>
				{open ? (
					<ChevronDown className="w-3 h-3" />
				) : (
					<ChevronRight className="w-3 h-3" />
				)}
				<Wrench className="w-3 h-3" />
				<span>{label}</span>
			</button>
			{open && (
				<div className="pl-6 space-y-0.5 mt-1">
					{tools.map((t, i) => (
						<div key={i} className="flex items-center gap-1.5">
							{t.status === "running" ? (
								<Loader2 className="w-2.5 h-2.5 animate-spin text-blue-500" />
							) : (
								<span className="w-2.5 h-2.5 rounded-full bg-green-400" />
							)}
							<span>{TOOL_LABELS[t.name] ?? t.name}</span>
							{t.input && (
								<span className="text-gray-400 truncate">
									— {t.input.slice(0, 60)}
								</span>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function ReasoningBlock({ text }: { text: string }) {
	const [open, setOpen] = useState(false);
	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors py-0.5"
			>
				{open ? (
					<ChevronDown className="w-3 h-3" />
				) : (
					<ChevronRight className="w-3 h-3" />
				)}
				<span>思考过程</span>
			</button>
			{open && (
				<div className="mt-1 pl-5 pr-2 py-2 rounded-[8px] bg-gray-50 text-gray-500 whitespace-pre-wrap leading-relaxed border-l-2 border-gray-200">
					{text}
				</div>
			)}
		</div>
	);
}

function MarkdownContent({ content }: { content: string }) {
	return (
		<div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-800 prose-strong:text-gray-900 prose-a:text-blue-600 prose-table:text-sm prose-td:px-2 prose-td:py-1 prose-th:px-2 prose-th:py-1">
			<ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
		</div>
	);
}

function QuickChip({ label, onClick }: { label: string; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
		>
			{label}
		</button>
	);
}

// ── Main Component ──

export function AgentPanel() {
	const { isOpen, closePanel, consumeQuery } = useAgent();
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [streaming, setStreaming] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const streamingToolsRef = useRef<ToolEvent[]>([]);

	const addTool = useCallback((name: string) => {
		streamingToolsRef.current = [
			...streamingToolsRef.current,
			{ name, status: "running" as const },
		];
	}, []);

	const finishTool = useCallback((name: string) => {
		streamingToolsRef.current = streamingToolsRef.current.map((t) =>
			t.name === name ? { ...t, status: "done" as const } : t,
		);
	}, []);

	const sendMessage = useCallback(
		async (text: string) => {
			const userMsg: ChatMessage = {
				id: crypto.randomUUID(),
				role: "user",
				text,
			};
			const assistantId = crypto.randomUUID();
			setMessages((prev) => [...prev, userMsg]);
			setStreaming(true);
			streamingToolsRef.current = [];

			const abort = new AbortController();

			try {
				const res = await fetch("/api/agent/chat", {
					method: "POST",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						messages: [
							...messages.map((m) => ({
								id: m.id,
								role: m.role,
								parts: [
									{ type: "text" as const, text: m.text },
								],
							})),
							{
								id: userMsg.id,
								role: "user" as const,
								parts: [{ type: "text" as const, text }],
							},
						],
					}),
					signal: abort.signal,
				});

				if (!res.ok) {
					const _errText = await res.text().catch(() => "");
					setMessages((prev) => [
						...prev,
						{
							id: assistantId,
							role: "assistant",
							text: `请求失败 (${res.status})`,
						},
					]);
					setStreaming(false);
					return;
				}

				const reader = res.body?.getReader();
				if (!reader) {
					setMessages((prev) => [
						...prev,
						{ id: assistantId, role: "assistant", text: "无响应" },
					]);
					setStreaming(false);
					return;
				}

				const decoder = new TextDecoder();
				let assistantText = "";
				let reasoningText = "";
				let buffer = "";

				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						break;
					}
					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					buffer = lines.pop() ?? "";

					for (const line of lines) {
						if (!line.startsWith("data: ")) {
							continue;
						}
						const data = line.slice(6).trim();
						if (!data || data === "[DONE]") {
							continue;
						}

						try {
							const p = JSON.parse(data);
							const type = p?.type;

							if (type === "text-delta" && p.delta) {
								assistantText += p.delta;
							} else if (type === "reasoning-delta" && p.delta) {
								reasoningText += p.delta;
							} else if (
								type === "tool-input-start" &&
								p.toolName
							) {
								addTool(p.toolName);
							} else if (type === "tool-result" && p.toolName) {
								finishTool(p.toolName);
							}

							// Update UI in real-time
							if (
								[
									"text-delta",
									"reasoning-delta",
									"tool-input-start",
									"tool-result",
								].includes(type)
							) {
								setMessages((prev) => {
									const updated = [...prev];
									const lastIdx = updated.length - 1;
									const tools = [
										...streamingToolsRef.current,
									];
									if (
										updated[lastIdx]?.role ===
											"assistant" &&
										updated[lastIdx]?.id === assistantId
									) {
										updated[lastIdx] = {
											...updated[lastIdx],
											text: assistantText,
											reasoning:
												reasoningText || undefined,
											tools,
										};
									} else {
										updated.push({
											id: assistantId,
											role: "assistant",
											text: assistantText,
											reasoning:
												reasoningText || undefined,
											tools,
										});
									}
									return updated;
								});
							}
						} catch {
							/* skip */
						}
					}
				}

				// Finalize
				setStreaming(false);
				setMessages((prev) => {
					const updated = [...prev];
					const lastIdx = updated.length - 1;
					const tools = [...streamingToolsRef.current].map((t) => ({
						...t,
						status: "done" as const,
					}));
					if (
						updated[lastIdx]?.role === "assistant" &&
						updated[lastIdx]?.id === assistantId
					) {
						updated[lastIdx] = {
							...updated[lastIdx],
							text: assistantText,
							reasoning: reasoningText || undefined,
							tools,
						};
					} else {
						updated.push({
							id: assistantId,
							role: "assistant",
							text: assistantText,
							reasoning: reasoningText || undefined,
							tools,
						});
					}
					return updated;
				});
			} catch (err) {
				if ((err as Error).name === "AbortError") {
					return;
				}
				setMessages((prev) => [
					...prev,
					{
						id: assistantId,
						role: "assistant",
						text: `网络错误: ${(err as Error).message}`,
					},
				]);
				setStreaming(false);
			}
		},
		[messages, addTool, finishTool],
	);

	useEffect(() => {
		const query = consumeQuery();
		if (query && !streaming) {
			sendMessage(query);
		}
	}, [consumeQuery, sendMessage, streaming]);

	useEffect(() => {
		if (listRef.current) {
			listRef.current.scrollTop = listRef.current.scrollHeight;
		}
	}, [messages]);

	useEffect(() => {
		if (isOpen && inputRef.current) {
			setTimeout(() => inputRef.current?.focus(), 350);
		}
	}, [isOpen]);

	const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const input = e.currentTarget.elements.namedItem(
			"message",
		) as HTMLInputElement;
		const text = input.value.trim();
		if (!text || streaming) {
			return;
		}
		sendMessage(text);
		input.value = "";
	};

	const quickActions = [
		{ label: "最近会议纪要", query: "帮我看看最近的会议纪要" },
		{ label: "有什么风险", query: "最近会议有什么风险需要关注" },
		{ label: "待办事项", query: "我有哪些待办事项还没完成" },
		{ label: "系统统计", query: "系统最近处理了多少会议" },
	];

	return (
		<>
			{isOpen && (
				<div
					className="fixed inset-0 bg-black/20 z-40 transition-opacity duration-300"
					onClick={closePanel}
					onKeyDown={(e) => {
						if (e.key === "Escape") {
							closePanel();
						}
					}}
					role="button"
					tabIndex={-1}
				/>
			)}
			<div
				className={cn(
					"fixed top-0 right-0 h-full z-40 w-[420px] max-w-[90vw]",
					"bg-white shadow-[0_8px_40px_rgba(0,0,0,0.12)] flex flex-col",
					"transition-transform duration-300 ease-out",
					isOpen ? "translate-x-0" : "translate-x-full",
				)}
			>
				{/* Header */}
				<div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
					<div className="flex items-center gap-2">
						<Sparkles className="w-4 h-4 text-gray-700" />
						<span className="font-medium text-sm text-gray-900">
							AI 助手
						</span>
					</div>
					<button
						type="button"
						onClick={closePanel}
						className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
					>
						<X className="w-4 h-4 text-gray-500" />
					</button>
				</div>

				{/* Messages */}
				<div
					ref={listRef}
					className="flex-1 overflow-y-auto px-5 py-4 space-y-5"
				>
					{messages.length === 0 && !streaming && (
						<div className="pt-8">
							<p className="text-sm text-gray-500 text-center mb-4">
								可以问我会议相关的问题
							</p>
							<div className="flex flex-wrap gap-2 justify-center">
								{quickActions.map((qa) => (
									<QuickChip
										key={qa.label}
										label={qa.label}
										onClick={() => sendMessage(qa.query)}
									/>
								))}
							</div>
						</div>
					)}

					{messages.map((m) => (
						<div key={m.id}>
							{m.role === "user" && (
								<div className="flex justify-end">
									<div className="max-w-[85%] px-4 py-2.5 rounded-[16px] rounded-br-[4px] bg-gray-900 text-white text-sm leading-relaxed">
										{m.text}
									</div>
								</div>
							)}

							{m.role === "assistant" && (
								<div className="space-y-2">
									{/* Tool calls */}
									{m.tools && m.tools.length > 0 && (
										<ToolCallBar tools={m.tools} />
									)}
									{/* Reasoning */}
									{m.reasoning && (
										<ReasoningBlock text={m.reasoning} />
									)}
									{/* Output */}
									{m.text ? (
										<div className="flex justify-start">
											<div className="max-w-[95%] px-4 py-2.5 rounded-[16px] rounded-bl-[4px] bg-[#F4F5F6] text-sm leading-relaxed">
												<MarkdownContent
													content={m.text}
												/>
											</div>
										</div>
									) : streaming ? (
										<div className="flex justify-start">
											<div className="flex items-center gap-1.5 px-4 py-2.5 rounded-[16px] bg-[#F4F5F6]">
												<span
													className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
													style={{
														animationDelay: "0ms",
													}}
												/>
												<span
													className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
													style={{
														animationDelay: "150ms",
													}}
												/>
												<span
													className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
													style={{
														animationDelay: "300ms",
													}}
												/>
											</div>
										</div>
									) : null}
								</div>
							)}
						</div>
					))}
				</div>

				{/* Input */}
				<form
					onSubmit={handleSubmit}
					className="shrink-0 px-4 py-3 border-t border-gray-100 flex items-center gap-2"
				>
					<input
						ref={inputRef}
						name="message"
						type="text"
						placeholder="输入消息..."
						className="flex-1 px-4 py-2.5 rounded-[12px] bg-[#F4F5F6] text-sm outline-none focus:bg-[#EEEFF1] transition-colors"
						disabled={streaming}
					/>
					<button
						type="submit"
						disabled={streaming}
						className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-900 text-white disabled:opacity-30 transition-opacity shrink-0"
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 14 14"
							fill="none"
							aria-label="发送"
						>
							<title>发送</title>
							<path
								d="M1 7L13 7M13 7L8 2M13 7L8 12"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</button>
				</form>
			</div>
		</>
	);
}
