"use client";

import { cn } from "@repo/ui";
import { Bell, Check, ChevronRight, Loader2, MailOpen, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface TodoItemData {
	id: string;
	task: string;
	owner?: string;
	deadline?: string;
	priority: string;
	selected?: boolean;
}

interface NotificationData {
	id: string;
	type: string;
	title: string;
	content?: string;
	status: string;
	metadata?: {
		todoItems?: TodoItemData[];
		meetingTopic?: string;
	};
	createdAt: string;
}

export function NotificationBell() {
	const [open, setOpen] = useState(false);
	const [notifications, setNotifications] = useState<NotificationData[]>([]);
	const [loading, setLoading] = useState(false);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [confirming, setConfirming] = useState(false);
	const [selectedItems, setSelectedItems] = useState<Map<string, string[]>>(new Map());
	const panelRef = useRef<HTMLDivElement>(null);

	const unreadCount = notifications.filter((n) => n.status === "unread").length;

	useEffect(() => {
		fetchNotifications();
	}, []);

	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		if (open) document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [open]);

	const fetchNotifications = async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/notifications?limit=20");
			const data = await res.json();
			setNotifications(data.notifications ?? []);
		} catch { /* silent */ }
		setLoading(false);
	};

	const markRead = async (id: string) => {
		await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
		setNotifications((prev) =>
			prev.map((n) => (n.id === id ? { ...n, status: "read" } : n))
		);
	};

	const toggleItem = (notifId: string, itemId: string) => {
		setSelectedItems((prev) => {
			const next = new Map(prev);
			const current = next.get(notifId) ?? [];
			const items = notifications
				.find((n) => n.id === notifId)
				?.metadata?.todoItems?.map((i) => i.id) ?? [];
			if (current.includes(itemId)) {
				next.set(notifId, current.filter((id) => id !== itemId));
			} else {
				next.set(notifId, [...current, itemId]);
			}
			return next;
		});
	};

	const selectAll = (notifId: string) => {
		const items = notifications
			.find((n) => n.id === notifId)
			?.metadata?.todoItems?.map((i) => i.id) ?? [];
		setSelectedItems((prev) => {
			const next = new Map(prev);
			next.set(notifId, items);
			return next;
		});
	};

	const confirmTodos = async (notifId: string) => {
		const selected = selectedItems.get(notifId) ?? [];
		if (selected.length === 0) return;
		setConfirming(true);
		try {
			await fetch(`/api/notifications/${notifId}/confirm`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ todoItemIds: selected }),
			});
			await markRead(notifId);
			setNotifications((prev) =>
				prev.map((n) =>
					n.id === notifId
						? { ...n, status: "actioned", metadata: { ...n.metadata, todoItems: n.metadata?.todoItems?.filter((i) => !selected.includes(i.id)) } }
						: n
				)
			);
			setSelectedItems((prev) => { prev.delete(notifId); return prev; });
		} catch { /* silent */ }
		setConfirming(false);
	};

	const priorityColor = (p: string) =>
		p === "high" ? "text-red-500" : p === "medium" ? "text-amber-500" : "text-slate-400";

	const timeAgo = (dateStr: string) => {
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}分钟前`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}小时前`;
		return `${Math.floor(hours / 24)}天前`;
	};

	return (
		<div className="relative" ref={panelRef}>
			<button
				type="button"
				onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
				className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
			>
				<Bell className="h-4 w-4 text-slate-500" />
				{unreadCount > 0 && (
					<span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
						{unreadCount > 99 ? "99+" : unreadCount}
					</span>
				)}
			</button>

			{open && (
				<div className="absolute right-0 top-full mt-2 w-[400px] max-h-[560px] overflow-y-auto bg-white rounded-[20px] border border-slate-100 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.12)] z-50">
					<div className="sticky top-0 bg-white px-5 py-3 border-b border-slate-100 flex justify-between items-center rounded-t-[20px]">
						<h3 className="text-sm font-bold text-slate-800">通知</h3>
						<button
							type="button"
							onClick={() => setOpen(false)}
							className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center"
						>
							<X className="h-3.5 w-3.5 text-slate-400" />
						</button>
					</div>

					{loading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-5 w-5 animate-spin text-slate-300" />
						</div>
					) : notifications.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12 text-slate-400">
							<MailOpen className="h-8 w-8 mb-2 opacity-50" />
							<p className="text-xs">暂无通知</p>
						</div>
					) : (
						<div className="divide-y divide-slate-50">
							{notifications.map((n) => {
								const isExpanded = expandedId === n.id;
								const items = n.metadata?.todoItems ?? [];
								const selected = selectedItems.get(n.id) ?? [];
								const isTodoReview = n.type === "todo_review";

								return (
									<div key={n.id} className={cn("px-5 py-3 transition-colors", n.status === "unread" && "bg-indigo-50/30")}>
										<div
											className="flex items-start justify-between gap-3 cursor-pointer"
											onClick={() => {
												if (isTodoReview && n.status !== "actioned") {
													setExpandedId(isExpanded ? null : n.id);
												}
												if (n.status === "unread") markRead(n.id);
											}}
											onKeyDown={(e) => { if (e.key === "Enter") { /* no-op */ } }}
											role="button"
											tabIndex={0}
										>
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2">
													{n.status === "unread" && (
														<span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
													)}
													<h4 className="text-xs font-bold text-slate-800 truncate">{n.title}</h4>
												</div>
												<p className="text-[10px] text-slate-400 mt-0.5">
													{isTodoReview ? `${items.length} 条待办` : ""}
													{n.status === "unread" ? " · " : ""}
													{timeAgo(n.createdAt)}
												</p>
											</div>
											{n.status === "actioned" && (
												<Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
											)}
											{isTodoReview && n.status !== "actioned" && (
												<ChevronRight className={cn("h-4 w-4 text-slate-300 shrink-0 mt-0.5 transition-transform", isExpanded && "rotate-90")} />
											)}
										</div>

										{/* Expanded todo items */}
										{isExpanded && isTodoReview && (
											<div className="mt-3 pt-3 border-t border-slate-100">
												<div className="flex items-center justify-between mb-2">
													<span className="text-[10px] font-bold text-slate-400 uppercase">
														待确认 · {items.length} 条
													</span>
													<button
														type="button"
														onClick={(e) => { e.stopPropagation(); selectAll(n.id); }}
														className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600"
													>
														全选
													</button>
												</div>
												<div className="space-y-1.5 max-h-[240px] overflow-y-auto">
													{items.map((item) => (
														<label
															key={item.id}
															className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
														>
															<input
																type="checkbox"
																checked={selected.includes(item.id)}
																onChange={() => toggleItem(n.id, item.id)}
																className="mt-0.5 shrink-0 rounded accent-indigo-500"
															/>
															<div className="flex-1 min-w-0">
																<span className="text-slate-700">{item.task}</span>
																<div className="flex items-center gap-2 mt-0.5 text-[10px]">
																	{item.owner && <span className="text-slate-400">@{item.owner}</span>}
																	{item.deadline && (
																		<span className="text-slate-400">
																			截止 {new Date(item.deadline).toLocaleDateString("zh-CN")}
																		</span>
																	)}
																	<span className={cn("font-bold", priorityColor(item.priority))}>
																		{item.priority === "high" ? "高" : item.priority === "medium" ? "中" : "低"}
																	</span>
																</div>
															</div>
														</label>
													))}
												</div>
												<button
													type="button"
													disabled={selected.length === 0 || confirming}
													onClick={(e) => { e.stopPropagation(); confirmTodos(n.id); }}
													className={cn(
														"mt-3 w-full py-2 rounded-[10px] text-[11px] font-bold transition-all",
														selected.length > 0
															? "bg-indigo-600 text-white hover:bg-indigo-700"
															: "bg-slate-100 text-slate-400 cursor-not-allowed"
													)}
												>
													{confirming ? (
														<Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" />
													) : (
														`确认${selected.length > 0 ? ` (${selected.length}/${items.length})` : ""}`
													)}
												</button>
											</div>
										)}
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
