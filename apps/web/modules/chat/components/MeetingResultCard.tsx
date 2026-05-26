"use client";

import { cn } from "@repo/ui";
import { ExternalLink } from "lucide-react";

interface MeetingResult {
	id: string;
	topic: string | null;
	startTime: string | undefined;
	status: string;
	aiSummary: string | null;
	docUrl: string | null;
	topEntities?: string[];
	topDecisions?: string[];
	categories?: string[];
}

export function MeetingResultCard({ result }: { result: MeetingResult }) {
	return (
		<div className="rounded-[12px] bg-white border border-gray-100 p-3 space-y-2 shadow-sm">
			<div className="flex items-start justify-between gap-2">
				<div className="font-medium text-sm text-gray-900 line-clamp-1">
					{result.topic || "无标题会议"}
				</div>
				<StatusBadge status={result.status} />
			</div>

			{result.aiSummary && (
				<p className="text-xs text-gray-500 line-clamp-2">
					{result.aiSummary}
				</p>
			)}

			<div className="flex flex-wrap gap-1">
				{result.categories?.map((c) => (
					<span
						key={c}
						className="px-1.5 py-0.5 rounded-full bg-gray-100 text-[10px] text-gray-600"
					>
						{c}
					</span>
				))}
			</div>

			<div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
				{result.startTime && (
					<span>
						{new Date(result.startTime).toLocaleDateString("zh-CN")}
					</span>
				)}
				{result.topEntities && result.topEntities.length > 0 && (
					<span>涉及: {result.topEntities.join("、")}</span>
				)}
				{result.docUrl && (
					<a
						href={result.docUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-0.5 text-gray-500 hover:text-gray-700 transition-colors"
					>
						文档 <ExternalLink className="w-2.5 h-2.5" />
					</a>
				)}
			</div>
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	const config: Record<string, { label: string; className: string }> = {
		completed: { label: "已完成", className: "bg-green-50 text-green-700" },
		processing: { label: "处理中", className: "bg-blue-50 text-blue-700" },
		failed: { label: "失败", className: "bg-red-50 text-red-700" },
		skipped: { label: "已跳过", className: "bg-yellow-50 text-yellow-700" },
	};

	const c = config[status] ?? {
		label: status,
		className: "bg-gray-50 text-gray-600",
	};

	return (
		<span
			className={cn(
				"px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0",
				c.className,
			)}
		>
			{c.label}
		</span>
	);
}
