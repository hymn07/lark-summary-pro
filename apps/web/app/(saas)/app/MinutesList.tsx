"use client";

import { Button } from "@repo/ui/components/button";
import { orpcClient } from "@shared/lib/orpc-client";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	CheckCircle2,
	ExternalLink,
	Loader2,
	RotateCw,
	SkipForward,
} from "lucide-react";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { MinutesDetailDialog } from "./MinutesDetailDialog";

const statusConfig = {
	completed: {
		label: "已完成",
		color: "text-[#10B981]",
		bg: "bg-[#E6F4EA]",
		Icon: CheckCircle2,
	},
	processing: {
		label: "处理中",
		color: "text-[#F59E0B]",
		bg: "bg-[#FFF7ED]",
		Icon: Loader2,
	},
	failed: {
		label: "失败",
		color: "text-red-600",
		bg: "bg-red-50",
		Icon: AlertCircle,
	},
	skipped: {
		label: "已跳过",
		color: "text-gray-500",
		bg: "bg-gray-100",
		Icon: SkipForward,
	},
} as const;

const FILTER_OPTIONS = [
	{ key: "all", label: "全部" },
	{ key: "completed", label: "已完成" },
	{ key: "processing", label: "处理中" },
	{ key: "failed", label: "失败" },
] as const;

export function MinutesList() {
	const queryClient = useQueryClient();
	const [status, setStatus] = useState<string | undefined>();
	const [detailId, setDetailId] = useState<string | null>(null);
	const [showSkeleton, setShowSkeleton] = useState(true);
	const sliderRef = useRef<HTMLDivElement>(null);
	const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

	const { data, isLoading, isFetching, error, refetch } = useQuery(
		orpc.meetings.list.queryOptions({
			input: { status: status as never, limit: 50 },
		}),
	);

	// Unfiltered query for tab counts
	const { data: allData } = useQuery(
		orpc.meetings.list.queryOptions({
			input: { limit: 100 },
		}),
	);

	const records = (data as { data?: unknown[] })?.data ?? [];
	const allRecords = (allData as { data?: unknown[] })?.data ?? [];

	const counts = {
		all: allRecords.length,
		completed: allRecords.filter(
			(r) => (r as Record<string, unknown>).status === "completed",
		).length,
		processing: allRecords.filter(
			(r) => (r as Record<string, unknown>).status === "processing",
		).length,
		failed: allRecords.filter(
			(r) => (r as Record<string, unknown>).status === "failed",
		).length,
	};

	// 180ms skeleton delay — matching 3.html tab switch benchmark
	useEffect(() => {
		if (!isFetching && showSkeleton) {
			const timer = setTimeout(() => setShowSkeleton(false), 180);
			return () => clearTimeout(timer);
		}
	}, [isFetching, showSkeleton]);

	const retryMutation = useMutation({
		mutationFn: (recordId: string) =>
			orpcClient.meetings.retry({ id: recordId }),
		onSuccess: () => {
			toast.success("已重新提交生成");
			queryClient.invalidateQueries({
				queryKey: orpc.meetings.list.queryKey(),
			});
		},
		onError: (e) =>
			toast.error(
				`重试失败: ${e instanceof Error ? e.message : "未知错误"}`,
			),
	});

	const handleTabChange = (key: string) => {
		if (status !== (key === "all" ? undefined : key)) {
			setShowSkeleton(true);
			setStatus(key === "all" ? undefined : key);
		}
	};

	const updateSlider = useCallback((key: string) => {
		const tab = tabRefs.current.get(key);
		const slider = sliderRef.current;
		if (!tab || !slider) {
			return;
		}
		slider.style.width = `${String(tab.offsetWidth)}px`;
		slider.style.transform = `translateX(${String(tab.offsetLeft)}px)`;
	}, []);

	useLayoutEffect(() => {
		const activeKey = status ?? "all";
		updateSlider(activeKey);
	}, [status, counts, updateSlider]);

	const activeFilter = status ?? "all";

	return (
		<div className="max-w-4xl">
			{/* ── 分段胶囊页签 ── */}
			<div className="tab-container mb-6" role="tablist">
				<div className="tab-slider" ref={sliderRef} />
				{FILTER_OPTIONS.map(({ key, label }) => {
					const cnt = counts[key as keyof typeof counts] ?? 0;
					return (
						<button
							key={key}
							ref={(el) => {
								if (el) {
									tabRefs.current.set(key, el);
								}
							}}
							role="tab"
							type="button"
							aria-selected={activeFilter === key}
							onClick={() => handleTabChange(key)}
							className={`tab-item px-5 py-2 text-[13px] font-semibold rounded-[9px] flex items-center ${activeFilter === key ? "active" : ""}`}
						>
							{label}
							{cnt > 0 && (
								<span className="tab-badge ml-1.5 px-1.5 py-0.5 text-[10px] rounded-[20px] font-medium">
									{cnt}
								</span>
							)}
						</button>
					);
				})}
			</div>

			{/* ── 内容区域 ── */}
			{isLoading || showSkeleton ? (
				<div>
					<div className="skeleton-card">
						<div
							className="skeleton-block"
							style={{
								width: "25%",
								height: 18,
								marginBottom: 12,
							}}
						/>
						<div
							className="skeleton-block"
							style={{ width: "80%", height: 14 }}
						/>
					</div>
					<div className="skeleton-card" style={{ opacity: 0.5 }}>
						<div
							className="skeleton-block"
							style={{
								width: "35%",
								height: 18,
								marginBottom: 12,
							}}
						/>
						<div
							className="skeleton-block"
							style={{ width: "60%", height: 14 }}
						/>
					</div>
				</div>
			) : error ? (
				<div className="text-center py-16">
					<AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
					<p className="text-red-600 mb-4">{String(error)}</p>
					<Button variant="outline" onClick={() => refetch()}>
						<RotateCw className="h-4 w-4 mr-1" />
						重试
					</Button>
				</div>
			) : records.length === 0 ? (
				<div className="text-center text-slate-400 py-16 text-sm font-medium">
					{status
						? `没有${statusConfig[status as keyof typeof statusConfig]?.label ?? status}的纪要`
						: "还没有会议纪要"}
				</div>
			) : (
				<div className="space-y-4">
					{records.map((r, index) => (
						<MinutesCard
							key={(r as Record<string, unknown>).id as string}
							record={r as Record<string, unknown>}
							index={index}
							onDetailClick={(id) => setDetailId(id)}
							onRetry={(id) => retryMutation.mutate(id)}
						/>
					))}
				</div>
			)}

			<MinutesDetailDialog
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

function MinutesCard({
	record,
	index,
	onDetailClick,
	onRetry,
}: {
	record: Record<string, unknown>;
	index: number;
	onDetailClick?: (id: string) => void;
	onRetry?: (id: string) => void;
}) {
	const st = (record.status as string) ?? "processing";
	const cfg =
		statusConfig[st as keyof typeof statusConfig] ??
		statusConfig.processing;
	const Icon = cfg.Icon;
	const topic = (record.topic as string) ?? "未命名会议";
	const desc = (record.aiSummary as string) ?? "";
	const isProcessing = st === "processing";
	const isCompleted = st === "completed";
	const isFailed = st === "failed";
	const isSkipped = st === "skipped";
	const isClickable = isCompleted || isFailed || isSkipped;

	const handleRetry = (e: React.MouseEvent) => {
		e.stopPropagation();
		onRetry?.(record.id as string);
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: card contains interactive child anchor
		<div
			role="button"
			tabIndex={isClickable ? 0 : -1}
			onClick={() => {
				if (isClickable) {
					onDetailClick?.(record.id as string);
				}
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					if (isClickable) {
						e.preventDefault();
						onDetailClick?.(record.id as string);
					}
				}
			}}
			className={`card-enter p-6 rounded-[16px] flex items-start justify-between gap-6 ${
				isClickable
					? "cursor-pointer group"
					: "cursor-default opacity-80"
			}`}
			style={{ animationDelay: `${String(index * 0.05)}s` }}
		>
			<div className="space-y-1.5 flex-1 min-w-0">
				<div className="flex items-center space-x-3">
					<h2
						className={`text-base font-semibold text-[#1A1A1A] truncate ${isClickable ? "group-hover:text-indigo-600" : ""} transition-colors`}
					>
						{topic}
					</h2>
					<span className="text-[11px] text-[#999999] font-mono mt-0.5 shrink-0">
						{record.createdAt
							? new Date(
									record.createdAt as string,
								).toLocaleString("zh-CN")
							: ""}
					</span>
				</div>
				{desc ? (
					<p className="text-[13px] text-[#666666] line-clamp-1-custom pr-4">
						{desc}
					</p>
				) : (record.errorMessage as string) ? (
					<p className="text-[13px] text-red-500 line-clamp-1-custom pr-4">
						{record.errorMessage as string}
					</p>
				) : (record.skippedReason as string) ? (
					<p className="text-[13px] text-[#666666] line-clamp-1-custom pr-4">
						跳过原因：{record.skippedReason as string}
					</p>
				) : null}
			</div>

			<div className="flex items-center shrink-0 space-x-3 mt-0.5">
				{isCompleted && record.docUrl ? (
					<a
						href={record.docUrl as string}
						target="_blank"
						rel="noreferrer"
						onClick={(e) => e.stopPropagation()}
						className="opacity-0 group-hover:opacity-100 text-[11px] text-indigo-600 hover:bg-indigo-50 transition-all font-bold flex items-center px-3 py-1.5 rounded-[10px]"
					>
						<ExternalLink className="h-3 w-3 mr-1.5" /> 打开文档
					</a>
				) : null}
				{(isFailed || isSkipped) && (
					<button
						type="button"
						onClick={handleRetry}
						className="opacity-0 group-hover:opacity-100 text-[11px] text-amber-600 hover:bg-amber-50 transition-all font-bold flex items-center px-3 py-1.5 rounded-[10px]"
					>
						<RotateCw className="h-3 w-3 mr-1.5" /> 重新生成
					</button>
				)}

				<span
					className={`px-2.5 py-1.5 text-[10px] font-bold rounded-[10px] flex items-center shrink-0 ${cfg.bg} ${cfg.color}`}
				>
					{isProcessing ? (
						<span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] mr-2 pulse-dot" />
					) : (
						<Icon className="h-3 w-3 mr-1.5" />
					)}
					{cfg.label}
				</span>
			</div>
		</div>
	);
}
