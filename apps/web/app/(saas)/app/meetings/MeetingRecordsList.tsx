"use client";

import { Button } from "@repo/ui/components/button";
import { orpcClient } from "@shared/lib/orpc-client";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	CalendarDays,
	CheckCircle2,
	Clock,
	ExternalLink,
	LayoutGrid,
	Loader2,
	Plus,
	RefreshCw,
	Sparkles,
	Upload,
	Users,
	Video,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarView } from "./CalendarView";
import { MeetingDetailDialog } from "./MeetingDetailDialog";


export function MeetingRecordsList() {
	const queryClient = useQueryClient();
	const { data, isLoading, isFetching } = useQuery(
		orpc.meetings.feishuList.queryOptions(),
	);
	const [showSkeleton, setShowSkeleton] = useState(true);
	const [showAdd, setShowAdd] = useState(false);
	const [generatingId, setGeneratingId] = useState<string | null>(null);
	const [detailId, setDetailId] = useState<string | null>(null);
	const [viewMode, setViewMode] = useState<"card" | "calendar">("card");

	const meetings = (data as unknown[] | undefined) ?? [];

	// 180ms skeleton
	useEffect(() => {
		if (!isLoading && !isFetching) {
			const timer = setTimeout(() => setShowSkeleton(false), 180);
			return () => clearTimeout(timer);
		}
		setShowSkeleton(true);
	}, [isLoading, isFetching]);

	const generateMutation = useMutation({
		mutationFn: (feishuMeetingId: string) =>
			orpcClient.meetings.generate({ feishuMeetingId }),
		onMutate: async (feishuMeetingId) => {
			const queryKey = orpc.meetings.feishuList.queryKey();
			await queryClient.cancelQueries({ queryKey });
			const previous = queryClient.getQueryData(queryKey);
			queryClient.setQueryData(queryKey, (old: unknown) => {
				if (!Array.isArray(old)) {
					return old;
				}
				return old.map((m: Record<string, unknown>) => {
					if (m.id === feishuMeetingId) {
						const existingRecords =
							(m.meetingRecords as Array<
								Record<string, unknown>
							>) ?? [];
						return {
							...m,
							meetingRecords: [
								{
									id: "optimistic",
									status: "processing",
									createdAt: new Date().toISOString(),
								},
								...existingRecords,
							],
						};
					}
					return m;
				});
			});
			return { previous };
		},
		onSuccess: (data) => {
			const results = data as Array<{ status: string }> | undefined;
			if (!results || results.length === 0) {
				toast.warning("已跳过：无匹配用户");
			} else if (results.some((r) => r.status === "completed")) {
				toast.success("纪要生成完成");
			} else {
				toast.warning("处理完成");
			}
		},
		onError: (e) => {
			toast.error(
				`生成失败: ${e instanceof Error ? e.message : "未知错误"}`,
			);
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.meetings.feishuList.queryKey(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.meetings.list.queryKey(),
			});
		},
	});

	const syncMutation = useMutation({
		mutationFn: () => orpcClient.meetings.sync({}),
		onSuccess: (data) => {
			toast.success(
				`同步完成，共 ${(data as unknown[]).length} 条会议记录`,
			);
			queryClient.invalidateQueries({
				queryKey: orpc.meetings.feishuList.queryKey(),
			});
		},
		onError: (e) => {
			toast.error(
				`同步失败: ${e instanceof Error ? e.message : "未知错误"}`,
			);
		},
	});

	return (
		<div className="max-w-4xl space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-black tracking-tight text-slate-900">
						会议记录
					</h2>
					<p className="text-xs text-slate-400 font-medium mt-1">
						飞书会议 & 手动上传
					</p>
				</div>
				<div className="flex gap-2 items-center">
					{/* View toggle */}
					<div className="tab-container mr-2" role="tablist">
						<button
							type="button"
							onClick={() => setViewMode("card")}
							className={`tab-item px-4 py-2 text-[12px] font-semibold rounded-[9px] flex items-center ${viewMode === "card" ? "active" : ""}`}
						>
							<LayoutGrid className="h-3.5 w-3.5" />
						</button>
						<button
							type="button"
							onClick={() => setViewMode("calendar")}
							className={`tab-item px-4 py-2 text-[12px] font-semibold rounded-[9px] flex items-center ${viewMode === "calendar" ? "active" : ""}`}
						>
							<CalendarDays className="h-3.5 w-3.5" />
						</button>
					</div>
					<button
						type="button"
						onClick={() => syncMutation.mutate()}
						disabled={syncMutation.isPending}
						className="text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-[10px] transition-colors flex items-center gap-1.5"
					>
						{syncMutation.isPending ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<RefreshCw className="h-3.5 w-3.5" />
						)}
						刷新
					</button>
					<button
						type="button"
						onClick={() => setShowAdd(true)}
						className="text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-[10px] transition-colors shadow-sm flex items-center gap-1.5"
					>
						<Plus className="h-3.5 w-3.5" />
						添加会议
					</button>
				</div>
			</div>

			{/* Content */}
			{isLoading || showSkeleton ? (
				<div>
					{[1, 2, 3].map((_, i) => (
						<div
							key={i}
							className="skeleton-card"
							style={{ opacity: i === 2 ? 0.5 : 1 }}
						>
							<div
								className="skeleton-block"
								style={{
									width: "30%",
									height: 18,
									marginBottom: 12,
								}}
							/>
							<div
								className="skeleton-block"
								style={{
									width: "50%",
									height: 14,
									marginBottom: 8,
								}}
							/>
							<div
								className="skeleton-block"
								style={{ width: "40%", height: 14 }}
							/>
						</div>
					))}
				</div>
			) : viewMode === "calendar" ? (
				<CalendarView
					meetings={meetings as Array<Record<string, unknown>>}
					generatingId={generatingId}
					onMeetingClick={(id) => setDetailId(id)}
					onGenerate={(id) => {
						setGeneratingId(id);
						generateMutation.mutate(id, {
							onSettled: () => setGeneratingId(null),
						});
					}}
				/>
			) : meetings.length === 0 ? (
				<div className="text-center py-20">
					<div className="w-14 h-14 rounded-[16px] bg-slate-100 flex items-center justify-center mx-auto mb-5">
						<Video className="h-6 w-6 text-slate-300" />
					</div>
					<p className="text-slate-500 font-bold text-sm">
						暂无会议记录
					</p>
					<p className="text-slate-400 text-xs mt-1.5 max-w-xs mx-auto leading-relaxed">
						会议数据来自飞书事件推送，也可以手动上传逐字稿
					</p>
				</div>
			) : (
				<div className="space-y-3">
					{meetings.map((m, index) => (
						<MeetingCard
							key={(m as Record<string, unknown>).id as string}
							meeting={m as Record<string, unknown>}
							index={index}
							generatingId={generatingId}
							onDetailClick={(id) => setDetailId(id)}
							onGenerate={(id) => {
								setGeneratingId(id);
								generateMutation.mutate(id, {
									onSettled: () => setGeneratingId(null),
								});
							}}
						/>
					))}
				</div>
			)}

			<AddMeetingDialog open={showAdd} onOpenChange={setShowAdd} />
			<MeetingDetailDialog
				id={detailId}
				open={!!detailId}
				onOpenChange={(open) => {
					if (!open) {
						setDetailId(null);
					}
				}}
			/>
		</div>
	);
}

function MeetingCard({
	meeting,
	index,
	generatingId,
	onDetailClick,
	onGenerate,
}: {
	meeting: Record<string, unknown>;
	index: number;
	generatingId: string | null;
	onDetailClick?: (id: string) => void;
	onGenerate: (id: string) => void;
}) {
	const id = meeting.id as string;
	const isFeishu = meeting.source === "feishu";
	const topic = (meeting.topic as string) || "未命名会议";
	const startTime = meeting.startTime
		? new Date(meeting.startTime as string)
		: null;
	const endTime = meeting.endTime
		? new Date(meeting.endTime as string)
		: null;
	const records =
		(meeting.meetingRecords as Array<Record<string, unknown>>) ?? [];
	const noteDocToken = meeting.noteDocToken as string | undefined;
	const meetingUrl = meeting.meetingUrl as string | undefined;
	const hasRecords = records.length > 0;
	const processing = records.some((r) => r.status === "processing");
	const allFailed =
		hasRecords &&
		records.every((r) => r.status === "failed" || r.status === "skipped");
	const completedCount = records.filter(
		(r) => r.status === "completed",
	).length;

	return (
		// biome-ignore lint/a11y/useSemanticElements: card with nested interactive elements
		<div
			role="button"
			tabIndex={0}
			onClick={() => onDetailClick?.(id)}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onDetailClick?.(id);
				}
			}}
			className={
				"card-enter p-5 rounded-[20px] flex flex-col cursor-pointer group bg-white border border-slate-100 hover:border-indigo-100 hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.04)] transition-all"
			}
			style={{ animationDelay: `${String(index * 0.05)}s` }}
		>
			{/* Top: title + source badge + action */}
			<div className="flex justify-between items-start mb-3">
				<div className="flex items-center gap-2.5 min-w-0">
					<h2 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate max-w-[320px]">
						{topic}
					</h2>
					<span
						className={`px-2 py-0.5 text-[10px] font-bold rounded-md shrink-0 ${isFeishu ? "text-sky-600 bg-sky-50" : "text-purple-600 bg-purple-50"}`}
					>
						{isFeishu ? "飞书" : "手动"}
					</span>
				</div>
				<button
					type="button"
					className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-[8px] transition-all flex items-center gap-1 shrink-0 ml-2"
					onClick={(e) => {
						e.stopPropagation();
						onGenerate(id);
					}}
					disabled={generatingId === id}
				>
					<Sparkles className="h-3 w-3" />
					{generatingId === id
						? "生成中..."
						: hasRecords
							? "重新生成"
							: "生成纪要"}
				</button>
			</div>

			{/* Middle: time + host */}
			<div className="flex items-center gap-4 text-[11px] text-slate-400 font-medium mb-4">
				{startTime && (
					<span className="flex items-center gap-1.5">
						<Clock className="h-3 w-3 text-slate-300" />
						{startTime.toLocaleString("zh-CN", {
							month: "long",
							day: "numeric",
							hour: "2-digit",
							minute: "2-digit",
						})}
						{endTime &&
							` - ${endTime.toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`}
					</span>
				)}
				{(meeting.participantCount as number) > 0 && (
					<span className="flex items-center gap-1.5">
						<Users className="h-3 w-3 text-slate-300" />
						{meeting.participantCount as number}人
					</span>
				)}
			</div>

			{/* Bottom: status badges + links */}
			<div className="flex items-center gap-2 flex-wrap">
				{processing ? (
					<span className="text-[#F59E0B] bg-[#FFF7ED] px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center">
						<span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] mr-1.5 pulse-dot" />{" "}
						处理中...
					</span>
				) : hasRecords && !allFailed ? (
					<span className="text-[#10B981] bg-[#E6F4EA] px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center">
						<CheckCircle2 className="h-3 w-3 mr-1.5" /> 已生成{" "}
						{completedCount} 份纪要
					</span>
				) : allFailed ? (
					<span className="text-red-500 bg-red-50 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center">
						<AlertCircle className="h-3 w-3 mr-1.5" /> 生成失败
					</span>
				) : (
					<span className="text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg text-[10px] font-medium flex items-center">
						<Video className="h-3 w-3 mr-1.5" /> 暂无纪要
					</span>
				)}
				{noteDocToken && (
					<a
						href={`https://bytedance.feishu.cn/minutes/${noteDocToken}`}
						target="_blank"
						rel="noreferrer"
						className="text-[#10B981] bg-[#E6F4EA]/50 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center hover:bg-[#E6F4EA] transition-colors"
						onClick={(e) => e.stopPropagation()}
					>
						<Video className="h-3 w-3 mr-1.5" /> 妙记回放
					</a>
				)}
				{meetingUrl && (
					<a
						href={meetingUrl as string}
						target="_blank"
						rel="noreferrer"
						className="text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center hover:bg-indigo-100 transition-colors"
						onClick={(e) => e.stopPropagation()}
					>
						<ExternalLink className="h-3 w-3 mr-1.5" /> 会议链接
					</a>
				)}
			</div>
		</div>
	);
}

function AddMeetingDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const [topic, setTopic] = useState("");
	const [transcriptText, setTranscriptText] = useState("");
	const [startTime, setStartTime] = useState("");
	const [endTime, setEndTime] = useState("");
	const [meetingUrl, setMeetingUrl] = useState("");
	const [participantsStr, setParticipantsStr] = useState("");
	const [loading, setLoading] = useState(false);
	const [inputMode, setInputMode] = useState<"file" | "text">("text");

	const handleAdd = async () => {
		if (!topic.trim()) {
			toast.error("请填写会议名称");
			return;
		}
		if (!transcriptText.trim()) {
			toast.error("请粘贴或上传逐字稿");
			return;
		}
		setLoading(true);
		try {
			const participants = participantsStr.trim()
				? participantsStr
						.split(/[,，、\s]+/)
						.map((n) => ({
							userId: n,
							userName: n.trim(),
							isHost: false,
							isExternal: false,
						}))
				: [];
			await orpcClient.meetings.createManual({
				topic: topic.trim(),
				transcriptText: transcriptText.trim(),
				startTime: startTime || undefined,
				endTime: endTime || undefined,
				meetingUrl: meetingUrl || undefined,
				participants:
					participants.length > 0 ? participants : undefined,
			});
			toast.success("会议已添加");
			queryClient.invalidateQueries({
				queryKey: orpc.meetings.feishuList.queryKey(),
			});
			onOpenChange(false);
			setTopic("");
			setTranscriptText("");
			setStartTime("");
			setEndTime("");
			setMeetingUrl("");
			setParticipantsStr("");
		} catch (e) {
			toast.error(
				`添加失败: ${e instanceof Error ? e.message : "未知错误"}`,
			);
		} finally {
			setLoading(false);
		}
	};

	if (!open) {
		return null;
	}

	return (
		<div
			className="modal-overlay-2 fixed inset-0 bg-slate-900/30 z-50 flex items-center justify-center p-4 active"
			onClick={(e) => {
				if (e.target === e.currentTarget) {
					onOpenChange(false);
				}
			}}
		>
			<div className="modal-container-2 bg-white border border-slate-100 w-full max-w-lg rounded-[32px] shadow-[0_32px_80px_-16px_rgba(15,23,42,0.14)] overflow-hidden flex flex-col">
				<div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
					<div>
						<h3 className="text-base font-black text-slate-900 tracking-tight">
							添加新会议记录
						</h3>
						<p className="text-[10px] text-slate-400 font-medium">
							支持文件多格式选取与长文本粘贴双载体
						</p>
					</div>
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 flex items-center justify-center transition"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="p-6 space-y-4">
					<div className="space-y-1.5">
						<span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
							会议名称 *
						</span>
						<input
							type="text"
							value={topic}
							onChange={(e) => setTopic(e.target.value)}
							placeholder="如：产品评审会"
							className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-semibold focus:outline-none shadow-sm transition-all"
						/>
					</div>

					<div className="space-y-1.5">
						<span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
							逐字稿 / 转文字内容 *
						</span>
						<div className="bg-slate-100 p-1 rounded-xl flex space-x-1 mb-2">
							<button
								type="button"
								onClick={() => setInputMode("file")}
								className={`flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all ${inputMode === "file" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600"}`}
							>
								<Upload className="h-3 w-3 mr-1 inline" />
								上传文件 (.md/.txt/.docx)
							</button>
							<button
								type="button"
								onClick={() => setInputMode("text")}
								className={`flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all ${inputMode === "text" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600"}`}
							>
								手动输入
							</button>
						</div>
						<div className="rigid-shell-container w-full relative">
							{inputMode === "file" ? (
								<label className="absolute inset-0 border-2 border-dashed border-slate-200 hover:border-indigo-500/50 bg-slate-50/20 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors group">
									<Upload className="h-5 w-5 text-slate-300 group-hover:text-indigo-500 mb-1.5" />
									<p className="text-xs font-bold text-slate-700">
										拖拽文件到此处，或{" "}
										<span className="text-indigo-600 underline">
											点击浏览文件
										</span>
									</p>
									<p className="text-[9px] text-slate-400 mt-0.5 font-medium">
										支持格式: .md, .txt, .docx
									</p>
									<input
										type="file"
										accept=".txt,.md"
										className="hidden"
										onChange={async (e) => {
											const file = e.target.files?.[0];
											if (!file) {
												return;
											}
											setTranscriptText(
												await file.text(),
											);
											if (!topic && file.name) {
												setTopic(
													file.name.replace(
														/\.(txt|md)$/,
														"",
													),
												);
											}
											setInputMode("text");
										}}
									/>
								</label>
							) : (
								<textarea
									value={transcriptText}
									onChange={(e) =>
										setTranscriptText(e.target.value)
									}
									placeholder="请在此处直接粘贴您的会议转文字文本"
									className="absolute inset-0 w-full h-full px-3.5 py-3.5 bg-slate-50/30 border border-slate-200 focus:border-indigo-500 rounded-2xl text-xs font-semibold focus:outline-none transition-all resize-none shadow-sm"
								/>
							)}
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
								开始时间
							</span>
							<input
								type="datetime-local"
								value={startTime}
								onChange={(e) => setStartTime(e.target.value)}
								className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-semibold focus:outline-none shadow-sm transition-all"
							/>
						</div>
						<div className="space-y-1.5">
							<span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
								结束时间
							</span>
							<input
								type="datetime-local"
								value={endTime}
								onChange={(e) => setEndTime(e.target.value)}
								className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-semibold focus:outline-none shadow-sm transition-all"
							/>
						</div>
					</div>

					<div className="space-y-1.5">
						<span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
							参会人员 (可选)
						</span>
						<input
							value={participantsStr}
							onChange={(e) => setParticipantsStr(e.target.value)}
							placeholder="用逗号或空格分隔，如：张三, 李四"
							className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-semibold focus:outline-none shadow-sm transition-all"
						/>
					</div>

					<div className="space-y-1.5">
						<span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
							会议链接
						</span>
						<input
							value={meetingUrl}
							onChange={(e) => setMeetingUrl(e.target.value)}
							placeholder="https://..."
							className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-semibold focus:outline-none shadow-sm transition-all"
						/>
					</div>
				</div>

				<div className="px-6 py-4 border-t border-slate-100 flex justify-end space-x-2 bg-white">
					<Button
						variant="outline"
						size="sm"
						onClick={() => onOpenChange(false)}
					>
						取消
					</Button>
					<Button size="sm" onClick={handleAdd} disabled={loading}>
						{loading ? "添加中..." : "确定创建"}
					</Button>
				</div>
			</div>
		</div>
	);
}
