"use client";

import { Button } from "@repo/ui/components/button";
import { orpcClient } from "@shared/lib/orpc-client";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	AlertTriangle,
	CheckCircle2,
	ExternalLink,
	FileText,
	Loader2,
	SkipForward,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MeetingDetailDialog } from "./meetings/MeetingDetailDialog";

const statusConfig = {
	completed: { label: "已完成", color: "text-[#10B981]", Icon: CheckCircle2 },
	processing: { label: "处理中", color: "text-[#F59E0B]", Icon: Loader2 },
	failed: { label: "失败", color: "text-red-600", Icon: AlertCircle },
	skipped: { label: "已跳过", color: "text-gray-500", Icon: SkipForward },
} as const;

export function MinutesDetailDialog({
	id,
	open,
	onOpenChange,
}: {
	id: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { data, isLoading } = useQuery(
		id && open
			? orpc.meetings.get.queryOptions({ input: { id } })
			: { queryKey: ["skip"], queryFn: () => null, enabled: false },
	);
	const queryClient = useQueryClient();
	const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
	const [sourceMeetingId, setSourceMeetingId] = useState<string | null>(null);
	const [sourceVisible, setSourceVisible] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	useEffect(() => {
		if (!open) {
			setIsSummaryExpanded(false);
			setSourceMeetingId(null);
			setSourceVisible(false);
		}
	}, [open]);

	const deleteRecordMutation = useMutation({
		mutationFn: (recordId: string) =>
			orpcClient.meetings.deleteRecord({ id: recordId }),
		onSuccess: () => {
			toast.success("纪要已删除");
			queryClient.invalidateQueries({
				queryKey: orpc.meetings.list.queryKey(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.meetings.feishuList.queryKey(),
			});
			if (feishuMeeting?.id) {
				queryClient.invalidateQueries({
					queryKey: orpc.meetings.feishuDetail.queryKey({
						input: { id: feishuMeeting.id as string },
					}),
				});
			}
			onOpenChange(false);
		},
		onError: () => toast.error("删除失败"),
	});

	const r = data as Record<string, unknown> | null;
	const feishuMeeting = r?.feishuMeeting as
		| Record<string, unknown>
		| null
		| undefined;
	const hasSourceMeeting = !!feishuMeeting?.id;
	const st = (r?.status as string) ?? "processing";
	const cfg =
		statusConfig[st as keyof typeof statusConfig] ??
		statusConfig.processing;

	const handleDelete = () => {
		if (!id) {
			return;
		}
		setShowDeleteConfirm(false);
		deleteRecordMutation.mutate(id);
	};

	const handleOverlayClick = (
		e: React.MouseEvent<HTMLDivElement>,
		cb: () => void,
	) => {
		if (e.target === e.currentTarget) {
			cb();
		}
	};

	if (!open) {
		return null;
	}

	return (
		<>
			{/* ── 会议纪要详情弹窗 (z-50) ── */}
			<div
				role="dialog"
				aria-modal="true"
				className={`minutes-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 ${open ? "active" : ""}`}
				onClick={(e) =>
					handleOverlayClick(e, () => onOpenChange(false))
				}
				onKeyDown={(e) => {
					if (e.key === "Escape") {
						onOpenChange(false);
					}
				}}
			>
				<div className="minutes-modal-container bg-white border border-slate-100 w-full max-w-lg rounded-[24px] shadow-[0_32px_80px_-16px_rgba(15,23,42,0.12)] overflow-hidden flex flex-col">
					{/* ── Header ── */}
					<div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
						{isLoading ? (
							<div className="space-y-2">
								<div className="h-5 w-48 bg-slate-100 rounded animate-pulse" />
								<div className="h-3 w-32 bg-slate-50 rounded animate-pulse" />
							</div>
						) : !r ? (
							<div className="space-y-1">
								<div className="flex items-center space-x-2.5">
									<FileText className="text-indigo-500 text-sm" />
									<h3 className="text-base font-black text-slate-900 tracking-tight">
										纪要不存在
									</h3>
								</div>
							</div>
						) : (
							<div className="space-y-1">
								<div className="flex items-center space-x-2.5">
									<FileText className="text-indigo-500 text-sm" />
									<h3 className="text-base font-black text-slate-900 tracking-tight">
										{(r.topic as string) ?? "未命名会议"}
									</h3>
								</div>
								<div className="flex items-center space-x-2 text-[10px] text-slate-400 font-medium ml-6">
									<span>
										{r.createdAt
											? new Date(
													r.createdAt as string,
												).toLocaleString("zh-CN")
											: "--:--"}
									</span>
									<span>·</span>
									<span className={`font-bold ${cfg.color}`}>
										{cfg.label}
									</span>
								</div>
							</div>
						)}
						<button
							type="button"
							onClick={() => onOpenChange(false)}
							className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 flex items-center justify-center transition-colors"
						>
							<X className="h-4 w-4" />
						</button>
					</div>

					{/* ── Body ── */}
					<div className="p-8 bg-[#F8F9FA]">
						{isLoading ? (
							<div className="space-y-3">
								<div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
								<div className="bg-white border border-slate-200/60 p-5 rounded-[16px] shadow-sm space-y-2">
									<div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
									<div className="h-3 w-3/4 bg-slate-100 rounded animate-pulse" />
									<div className="h-3 w-1/2 bg-slate-100 rounded animate-pulse" />
								</div>
							</div>
						) : !r ? (
							<div className="flex items-center justify-center py-16 text-slate-400 text-sm">
								纪要数据不可用
							</div>
						) : (
							<div className="space-y-3">
								{/* 会议纪要详情 label */}
								<span className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
									<span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2" />
									会议纪要详情
								</span>

								{/* Summary card */}
								<div className="bg-white border border-slate-200/60 p-5 rounded-[16px] shadow-sm relative">
									{/* Processing state */}
									{st === "processing" && (
										<div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
											<Loader2 className="h-4 w-4 animate-spin" />
											AI 正在生成纪要...
										</div>
									)}

									{/* Error message */}
									{!!(r.errorMessage as string) && (
										<div className="text-[13px] text-red-600 font-medium leading-relaxed">
											<p className="font-bold text-[11px] uppercase tracking-widest mb-1">
												错误信息
											</p>
											{r.errorMessage as string}
										</div>
									)}

									{/* Skip reason */}
									{!!(r.skippedReason as string) && (
										<div className="text-[13px] text-slate-500 font-medium leading-relaxed">
											<p className="font-bold text-[11px] uppercase tracking-widest mb-1">
												跳过原因
											</p>
											{r.skippedReason as string}
										</div>
									)}

									{/* Summary content */}
									{!!(r.aiSummary as string) && (
										<>
											<div
												className="summary-collapse-zone text-[13px] text-slate-700 font-medium leading-relaxed overflow-hidden"
												style={{
													maxHeight: isSummaryExpanded
														? "360px"
														: "130px",
													overflowY: isSummaryExpanded
														? "auto"
														: "hidden",
												}}
											>
												<p>{r.aiSummary as string}</p>
											</div>
											<div className="pt-3 flex justify-center border-t border-slate-50 mt-2">
												<button
													type="button"
													onClick={() =>
														setIsSummaryExpanded(
															!isSummaryExpanded,
														)
													}
													className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-colors flex items-center px-3 py-1 bg-[#F8F9FA] hover:bg-slate-200 rounded-full"
												>
													{isSummaryExpanded
														? "收起内容"
														: "展开全文"}
													<svg
														className={`ml-1.5 h-2 w-2 transition-transform ${isSummaryExpanded ? "rotate-180" : ""}`}
														viewBox="0 0 8 5"
														fill="currentColor"
														aria-hidden="true"
													>
														<title>
															{isSummaryExpanded
																? "收起"
																: "展开"}
														</title>
														<path d="M4 5L0 0h8z" />
													</svg>
												</button>
											</div>
										</>
									)}

									{/* No content */}
									{!r.aiSummary &&
										!r.errorMessage &&
										!r.skippedReason &&
										st !== "processing" && (
											<p className="text-[13px] text-slate-400 py-8 text-center">
												暂无内容
											</p>
										)}
								</div>
							</div>
						)}
					</div>

					{/* ── Footer ── */}
					{!isLoading && r && (
						<div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between bg-white shrink-0">
							<button
								type="button"
								onClick={() => setShowDeleteConfirm(true)}
								className="text-[10px] font-bold text-red-400 hover:text-red-500 px-3 py-1.5 rounded-xl hover:bg-red-50/50 transition-colors flex items-center"
							>
								<Trash2 className="h-3 w-3 mr-1.5" /> 删除纪要
							</button>
							<div className="flex items-center space-x-2.5">
								{hasSourceMeeting && (
									<button
										type="button"
										onClick={() => {
											setSourceMeetingId(feishuMeeting?.id as string);
											setSourceVisible(true);
										}}
										className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-[10px] text-[11px] font-bold transition shadow-sm flex items-center"
									>
										查看源会议
										<svg
											className="ml-2 h-3 w-3 opacity-50"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											aria-hidden="true"
										>
											<title>查看源会议</title>
											<path d="M5 12h14M12 5l7 7-7 7" />
										</svg>
									</button>
								)}
								{!!r.docUrl && (
									<a
										href={r.docUrl as string}
										target="_blank"
										rel="noreferrer"
										className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[10px] text-[11px] font-bold transition shadow-md shadow-indigo-600/10 flex items-center"
									>
										<ExternalLink className="h-3 w-3 mr-1.5" />{" "}
										打开文档
									</a>
								)}
							</div>
						</div>
					)}
				</div>
			</div>

			{/* ── 源会议抽屉（复用 MeetingDetailDialog） ── */}
			{sourceVisible && (
				<MeetingDetailDialog
					id={sourceMeetingId}
					open={!!sourceMeetingId}
					onOpenChange={(open) => {
						if (!open) {
							setSourceMeetingId(null);
							setTimeout(() => setSourceVisible(false), 400);
						}
					}}
				/>
			)}

			{/* ── 删除确认 ── */}
			{showDeleteConfirm && (
				// biome-ignore lint/a11y: overlay click-to-close for delete confirmation
				<div
					className="fixed inset-0 bg-slate-900/20 z-[70] flex items-center justify-center p-4"
					onClick={(e) =>
						handleOverlayClick(e, () => setShowDeleteConfirm(false))
					}
					onKeyDown={(e) => {
						if (e.key === "Escape") {
							setShowDeleteConfirm(false);
						}
					}}
				>
					<div className="bg-white border border-slate-100 w-full max-w-sm rounded-[24px] shadow-[0_32px_80px_-16px_rgba(15,23,42,0.14)] overflow-hidden p-6">
						<h3 className="text-base font-black text-slate-900 mb-2 flex items-center gap-2">
							<AlertTriangle className="h-5 w-5 text-red-500" />
							确认删除
						</h3>
						<p className="text-xs text-slate-500 mb-4">
							确定要删除这条会议纪要吗？
						</p>
						<div className="flex gap-2 justify-end">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setShowDeleteConfirm(false)}
							>
								取消
							</Button>
							<Button
								variant="primary"
								size="sm"
								onClick={handleDelete}
							>
								确认删除
							</Button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
