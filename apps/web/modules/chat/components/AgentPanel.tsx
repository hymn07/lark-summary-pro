"use client";

import { cn } from "@repo/ui";
import {
	ArrowUp,
	BarChart3,
	Brain,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	ExternalLink,
	FileText,
	Loader2,
	Search,
	Sparkles,
	Wrench,
	X,
} from "lucide-react";
import {
	type FormEvent,
	type ReactNode,
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
	resultPreview?: string;
}

interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	text: string;
	reasoning?: string;
	tools?: ToolEvent[];
	toolResults?: Record<string, unknown>;
}

// ── Helpers ──

function safeStr(v: unknown): string {
	return String(v ?? "");
}

function safeBool(v: unknown): v is string {
	return typeof v === "string" && v.length > 0;
}

// ── Constants ──

const TOOL_META: Record<string, { label: string; icon: typeof Search }> = {
	searchMeetings: { label: "搜索会议", icon: Search },
	getMeeting: { label: "查看详情", icon: FileText },
	listMeetingRecords: { label: "查询记录", icon: FileText },
	getFeishuMeetings: { label: "源会议", icon: FileText },
	getFeishuMeetingDetail: { label: "会议详情", icon: FileText },
	generateMeetingMinutes: { label: "生成纪要", icon: Sparkles },
	retryMeetingRecord: { label: "重试", icon: Sparkles },
	getUserSettings: { label: "查询设置", icon: Wrench },
	updateUserSettings: { label: "更新设置", icon: Wrench },
	listPromptVersions: { label: "Prompt", icon: FileText },
	createPromptFromSamples: { label: "学习风格", icon: Brain },
	getStats: { label: "统计", icon: BarChart3 },
	getSystemConfig: { label: "系统配置", icon: Wrench },
};

// ── Tool Result Preview ──

function ToolResultPreview({
	toolName,
	result,
}: {
	toolName: string;
	result: unknown;
}) {
	const d = result as Record<string, unknown> | undefined;
	if (!d || d.error) {
		return null;
	}

	const renderLink = (url: unknown) =>
		safeBool(url) ? (
			<a
				href={String(url)}
				target="_blank"
				rel="noopener noreferrer"
				className="text-gray-400 hover:text-gray-600 shrink-0"
			>
				<ExternalLink className="w-3 h-3" />
			</a>
		) : null;

	const renderCond = (v: unknown, fn: () => ReactNode): ReactNode => {
		return v != null ? fn() : null;
	};

	if (
		(toolName === "searchMeetings" || toolName === "listMeetingRecords") &&
		Array.isArray(d.results)
	) {
		const results = d.results as Array<Record<string, unknown>>;
		if (results.length === 0) {
			return (
				<p className="text-xs text-gray-500">未找到匹配的会议记录</p>
			);
		}
		return (
			<div className="space-y-1.5 mt-1">
				<p className="text-xs text-gray-500">
					找到 {safeStr(d.total ?? results.length)} 条记录
				</p>
				{results.slice(0, 5).map((r, i) => (
					<div
						key={i}
						className="flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] bg-white border border-gray-100 text-xs"
					>
						<FileText className="w-3 h-3 text-gray-400 shrink-0" />
						<span className="text-gray-700 truncate flex-1">
							{safeStr(r.topic ?? "无标题")}
						</span>
						{renderLink(r.docUrl)}
					</div>
				))}
				{results.length > 5 && (
					<p className="text-xs text-gray-400 pl-2">
						...还有 {results.length - 5} 条
					</p>
				)}
			</div>
		);
	}

	if (toolName === "getStats" && d) {
		const stats = [
			{ label: "总数", value: d.total, color: "text-gray-700" },
			{ label: "已完成", value: d.completed, color: "text-green-600" },
			{ label: "成功率", value: d.successRate, color: "text-blue-600" },
		];
		return (
			<div className="grid grid-cols-3 gap-2 mt-1">
				{stats.map((s) => (
					<div
						key={s.label}
						className="px-2.5 py-2 rounded-[6px] bg-white border border-gray-100 text-center"
					>
						<div className={cn("text-base font-semibold", s.color)}>
							{safeStr(s.value ?? "-")}
						</div>
						<div className="text-[10px] text-gray-400">
							{s.label}
						</div>
					</div>
				))}
			</div>
		);
	}

	if (toolName === "getMeeting" && d) {
		return (
			<div className="px-2.5 py-2 mt-1 rounded-[6px] bg-white border border-gray-100 text-xs">
				<p className="font-medium text-gray-700">
					{safeStr(d.topic ?? "无标题")}
				</p>
				{renderCond(d.aiSummary, () => (
					<p className="text-gray-500 mt-0.5 line-clamp-2">
						{safeStr(d.aiSummary)}
					</p>
				))}
				{renderCond(d.docUrl, () => (
					<a
						href={String(d.docUrl)}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-600 mt-1"
					>
						打开文档 <ExternalLink className="w-2.5 h-2.5" />
					</a>
				))}
			</div>
		);
	}

	return null;
}

// ── Tool Call Bar ──

function ToolCallBar({
	tools,
	toolResults,
}: {
	tools: ToolEvent[];
	toolResults?: Record<string, unknown>;
}) {
	const [open, setOpen] = useState(false);
	if (tools.length === 0) {
		return null;
	}

	const runningCount = tools.filter((t) => t.status === "running").length;
	const allDone = runningCount === 0;

	return (
		<div className="rounded-[8px] border border-gray-100 overflow-hidden">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
			>
				{allDone ? (
					<CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
				) : (
					<Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
				)}
				<span className="text-gray-600">已调用 {tools.length} 个工具</span>
				{!allDone && <span className="text-gray-400">· 执行中</span>}
				<span className="flex-1" />
				{open ? (
					<ChevronDown className="w-3 h-3 text-gray-400" />
				) : (
					<ChevronRight className="w-3 h-3 text-gray-400" />
				)}
			</button>
			{open && (
				<div className="border-t border-gray-50 px-3 py-2 space-y-2">
					{tools.map((t, i) => {
						const meta = TOOL_META[t.name] ?? {
							label: t.name,
							icon: Wrench,
						};
						const Icon = meta.icon;
						return (
							<div key={i}>
								<div className="flex items-center gap-2 text-xs">
									{t.status === "running" ? (
										<Loader2 className="w-3 h-3 animate-spin text-blue-500" />
									) : (
										<CheckCircle2 className="w-3 h-3 text-green-500" />
									)}
									<Icon className="w-3 h-3 text-gray-400" />
									<span className="text-gray-600">
										{meta.label}
									</span>
								</div>
								{t.status === "done" && (
									<ToolResultPreview
										toolName={t.name}
										result={toolResults}
									/>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

// ── Reasoning Block ──

function ReasoningBlock({ text }: { text: string }) {
	const [open, setOpen] = useState(false);
	if (!text) {
		return null;
	}
	return (
		<div className="rounded-[8px] border border-gray-200 bg-gray-50/50 overflow-hidden">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-gray-400 hover:text-gray-600 hover:bg-gray-100/50 transition-colors"
			>
				<Brain className="w-3 h-3" />
				<span>思考过程</span>
				<ChevronDown
					className={cn(
						"w-3 h-3 ml-auto transition-transform",
						open && "rotate-180",
					)}
				/>
			</button>
			{open && (
				<div className="px-3 pb-2">
					<p className="text-[11px] leading-relaxed text-gray-500 whitespace-pre-wrap">
						{text.length > 600 ? `${text.slice(0, 600)}…` : text}
					</p>
				</div>
			)}
		</div>
	);
}

// ── Markdown Content ──

function MarkdownContent({ content }: { content: string }) {
	return (
		<ReactMarkdown
			remarkPlugins={[remarkGfm]}
			components={{
				p: ({ children }) => (
					<p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
				),
				ul: ({ children }) => (
					<ul className="mb-2 ml-4 list-disc space-y-1">
						{children}
					</ul>
				),
				ol: ({ children }) => (
					<ol className="mb-2 ml-4 list-decimal space-y-1">
						{children}
					</ol>
				),
				li: ({ children }) => (
					<li className="leading-relaxed">{children}</li>
				),
				strong: ({ children }) => (
					<strong className="font-semibold text-gray-900">
						{children}
					</strong>
				),
				code: ({ children, className }) => {
					const isBlock = className?.includes("language-");
					return isBlock ? (
						<code className="block rounded-lg bg-gray-100 px-3 py-2 text-xs font-mono my-2 overflow-x-auto">
							{children}
						</code>
					) : (
						<code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-800">
							{children}
						</code>
					);
				},
				h1: ({ children }) => (
					<h1 className="text-base font-bold mb-2 text-gray-900">
						{children}
					</h1>
				),
				h2: ({ children }) => (
					<h2 className="text-sm font-bold mb-1.5 text-gray-900">
						{children}
					</h2>
				),
				h3: ({ children }) => (
					<h3 className="text-sm font-semibold mb-1 text-gray-900">
						{children}
					</h3>
				),
				table: ({ children }) => (
					<div className="my-2 overflow-x-auto rounded-[8px] border border-gray-200">
						<table className="w-full text-xs">{children}</table>
					</div>
				),
				thead: ({ children }) => (
					<thead className="bg-gray-50 border-b">{children}</thead>
				),
				tr: ({ children }) => (
					<tr className="border-b last:border-b-0">{children}</tr>
				),
				th: ({ children }) => (
					<th className="px-2.5 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap">
						{children}
					</th>
				),
				td: ({ children }) => (
					<td className="px-2.5 py-1.5 align-top text-gray-700">
						{children}
					</td>
				),
				blockquote: ({ children }) => (
					<blockquote className="border-l-2 border-gray-300 pl-3 italic text-gray-500 my-2">
						{children}
					</blockquote>
				),
				a: ({ href, children }) => (
					<a
						href={href}
						target="_blank"
						rel="noopener noreferrer"
						className="text-blue-600 underline underline-offset-2 hover:opacity-80"
					>
						{children}
					</a>
				),
			}}
		>
			{content}
		</ReactMarkdown>
	);
}

// ── Quick Chip ──

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

// ── Main ──

export function AgentPanel() {
	const { isOpen, closePanel, consumeQuery } = useAgent();
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [streaming, setStreaming] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const streamingToolsRef = useRef<ToolEvent[]>([]);
	const streamingResultsRef = useRef<Record<string, unknown>>({});

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
			streamingResultsRef.current = {};

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
				});

				if (!res.ok) {
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

				const updateMessage = () => {
					const tools = [...streamingToolsRef.current];
					const toolResults = { ...streamingResultsRef.current };
					setMessages((prev) => {
						const updated = [...prev];
						const lastIdx = updated.length - 1;
						if (
							updated[lastIdx]?.role === "assistant" &&
							updated[lastIdx]?.id === assistantId
						) {
							updated[lastIdx] = {
								...updated[lastIdx],
								text: assistantText,
								reasoning: reasoningText || undefined,
								tools,
								toolResults,
							};
						} else {
							updated.push({
								id: assistantId,
								role: "assistant",
								text: assistantText,
								reasoning: reasoningText || undefined,
								tools,
								toolResults,
							});
						}
						return updated;
					});
				};

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
								if (p.result) {
									streamingResultsRef.current[p.toolName] =
										p.result;
								}
							}

							if (
								[
									"text-delta",
									"reasoning-delta",
									"tool-input-start",
									"tool-result",
								].includes(type)
							) {
								updateMessage();
							}
						} catch {
							/* skip */
						}
					}
				}

				// Finalize
				setStreaming(false);
				const tools = [...streamingToolsRef.current].map((t) => ({
					...t,
					status: "done" as const,
				}));
				const toolResults = { ...streamingResultsRef.current };
				setMessages((prev) => {
					const updated = [...prev];
					const lastIdx = updated.length - 1;
					if (
						updated[lastIdx]?.role === "assistant" &&
						updated[lastIdx]?.id === assistantId
					) {
						updated[lastIdx] = {
							...updated[lastIdx],
							text: assistantText,
							reasoning: reasoningText || undefined,
							tools,
							toolResults,
						};
					} else {
						updated.push({
							id: assistantId,
							role: "assistant",
							text: assistantText,
							reasoning: reasoningText || undefined,
							tools,
							toolResults,
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
					"fixed top-0 right-0 h-full z-40 w-[440px] max-w-[92vw]",
					"bg-white shadow-[0_8px_40px_rgba(0,0,0,0.12)] flex flex-col",
					"transition-transform duration-300 ease-out",
					isOpen ? "translate-x-0" : "translate-x-full",
				)}
			>
				{/* Header */}
				<div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
					<div className="flex items-center gap-2">
						<div className="w-7 h-7 rounded-[10px] bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
							<Sparkles className="w-3.5 h-3.5 text-white" />
						</div>
						<div>
							<span className="font-medium text-sm text-gray-900">
								AI 助手
							</span>
							<p className="text-[10px] text-gray-400 leading-none mt-0.5">
								会议纪要智能查询
							</p>
						</div>
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
						<div className="pt-12">
							<div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center mx-auto mb-4">
								<Sparkles className="w-6 h-6 text-white" />
							</div>
							<p className="text-sm text-gray-500 text-center mb-1">
								会议纪要 AI 助手
							</p>
							<p className="text-xs text-gray-400 text-center mb-5">
								可以搜索、查询、统计你的会议信息
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
									{m.tools && m.tools.length > 0 && (
										<ToolCallBar
											tools={m.tools}
											toolResults={m.toolResults}
										/>
									)}
									{m.reasoning && (
										<ReasoningBlock text={m.reasoning} />
									)}
									{m.text ? (
										<div className="flex justify-start">
											<div className="max-w-[95%] px-4 py-3 rounded-[16px] rounded-bl-[4px] bg-[#F4F5F6] text-sm leading-relaxed">
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
					className="shrink-0 px-4 py-3 border-t border-gray-100 flex items-center gap-2 bg-white"
				>
					<input
						ref={inputRef}
						name="message"
						type="text"
						placeholder="输入消息..."
						className="flex-1 px-4 py-2.5 rounded-[12px] bg-[#F4F5F6] text-sm outline-none focus:bg-[#EEEFF1] focus:ring-1 focus:ring-gray-300 transition-all"
						disabled={streaming}
					/>
					<button
						type="submit"
						disabled={streaming}
						className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-900 text-white disabled:opacity-30 transition-opacity shrink-0 hover:bg-gray-800"
					>
						<ArrowUp className="w-4 h-4" />
					</button>
				</form>
			</div>
		</>
	);
}
