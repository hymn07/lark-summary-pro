"use client";

import { Badge } from "@repo/ui/components/badge";
import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import { Brain, Globe, Lightbulb, User, Zap } from "lucide-react";

const scopeBadge = (scope: string) =>
	scope === "public"
		? { label: "公共", color: "bg-indigo-100 text-indigo-700" }
		: { label: "个人", color: "bg-slate-100 text-slate-600" };

const statusBadge = (status: string) => {
	const map: Record<string, { label: string; color: string }> = {
		proposed: { label: "待审核", color: "bg-amber-100 text-amber-700" },
		pending_review: { label: "待审核", color: "bg-amber-100 text-amber-700" },
		reviewed: { label: "已审核", color: "bg-blue-100 text-blue-700" },
		accepted: { label: "已采纳", color: "bg-green-100 text-green-700" },
		approved: { label: "已批准", color: "bg-green-100 text-green-700" },
		rejected: { label: "已拒绝", color: "bg-red-100 text-red-700" },
		implemented: { label: "已实现", color: "bg-emerald-100 text-emerald-700" },
	};
	return map[status] ?? { label: status, color: "bg-gray-100 text-gray-600" };
};

export default function MemoryAdminPage() {
	const { data: insights, isLoading: insightsLoading } = useQuery({
		queryKey: ["admin", "memory-insights"],
		queryFn: async () => {
			const res = await fetch("/api/admin/memory/insights");
			return res.json();
		},
	});

	const { data: proposals, isLoading: proposalsLoading } = useQuery({
		queryKey: ["admin", "dimension-proposals"],
		queryFn: async () => {
			const res = await fetch("/api/admin/memory/proposals");
			return res.json();
		},
	});

	const allInsights = (insights as { data?: unknown[] })?.data ?? [];
	const allProposals = (proposals as { data?: unknown[] })?.data ?? [];

	const publicProposals = (allProposals as Array<Record<string, unknown>>).filter(
		(p) => p.scope === "public"
	);
	const personalProposals = (allProposals as Array<Record<string, unknown>>).filter(
		(p) => p.scope === "personal"
	);

	return (
		<div className="max-w-5xl space-y-8">
			<div>
				<h2 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
					<Brain className="h-6 w-6 text-indigo-500" /> 记忆洞察
				</h2>
				<p className="text-xs text-slate-400 font-medium mt-1">
					AI 对话分析 — 发现用户关注的新维度
				</p>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-4 gap-4">
				<Card>
					<CardContent className="p-4 flex items-center gap-3">
						<Zap className="h-5 w-5 text-amber-500" />
						<div>
							<p className="text-2xl font-black">{allInsights.length}</p>
							<p className="text-[10px] text-slate-400">洞察</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 flex items-center gap-3">
						<Globe className="h-5 w-5 text-indigo-500" />
						<div>
							<p className="text-2xl font-black">{publicProposals.length}</p>
							<p className="text-[10px] text-slate-400">公共提案</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 flex items-center gap-3">
						<User className="h-5 w-5 text-slate-500" />
						<div>
							<p className="text-2xl font-black">{personalProposals.length}</p>
							<p className="text-[10px] text-slate-400">个人提案</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 flex items-center gap-3">
						<Lightbulb className="h-5 w-5 text-emerald-500" />
						<div>
							<p className="text-2xl font-black">
								{(allProposals as Array<Record<string, unknown>>).filter(
									(p) => p.status === "approved" || p.status === "implemented"
								).length}
							</p>
							<p className="text-[10px] text-slate-400">已采纳</p>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Public Proposals */}
			<div>
				<h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
					<Globe className="h-4 w-4" /> 公共维度提案
				</h3>
				{proposalsLoading ? (
					<Skeleton className="h-32" />
				) : publicProposals.length === 0 ? (
					<p className="text-sm text-slate-400 py-8 text-center">
						暂无公共提案 — 等用户问多几次就有了
					</p>
				) : (
					<div className="space-y-3">
						{publicProposals.map((p) => {
							const sb = statusBadge(p.status as string);
							return (
								<Card key={p.id as string}>
									<CardContent className="p-4">
										<div className="flex items-start justify-between">
											<div>
												<h4 className="font-bold text-slate-800">
													{p.displayName as string}
													<span className="ml-2 text-[10px] font-mono text-slate-400">
														{p.fieldName as string}
													</span>
												</h4>
												<p className="text-xs text-slate-500 mt-1">
													{p.description as string}
												</p>
												<div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
													<span>证据: {p.evidenceCount as number} 条</span>
													<span>用户: {p.uniqueUsers as number} 人</span>
													<span>置信度: {Math.round(((p.confidence as number) ?? 0) * 100)}%</span>
												</div>
											</div>
											<Badge className={sb.color}>{sb.label}</Badge>
										</div>
									</CardContent>
								</Card>
							);
						})}
					</div>
				)}
			</div>

			{/* Personal Proposals */}
			<div>
				<h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
					<User className="h-4 w-4" /> 个人维度提案
				</h3>
				{proposalsLoading ? (
					<Skeleton className="h-32" />
				) : personalProposals.length === 0 ? (
					<p className="text-sm text-slate-400 py-8 text-center">
						暂无个人提案
					</p>
				) : (
					<div className="space-y-3">
						{personalProposals.slice(0, 20).map((p) => {
							const sb = statusBadge(p.status as string);
							return (
								<Card key={p.id as string}>
									<CardContent className="p-4">
										<div className="flex items-start justify-between">
											<div>
												<h4 className="font-bold text-slate-800 text-sm">
													{p.displayName as string}
												</h4>
												<p className="text-xs text-slate-500 mt-1">
													{p.description as string}
												</p>
												<div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
													<span>证据: {p.evidenceCount as number} 条</span>
													<span>用户ID: {(p.userId as string)?.slice(0, 8)}...</span>
												</div>
											</div>
											<Badge className={sb.color}>{sb.label}</Badge>
										</div>
									</CardContent>
								</Card>
							);
						})}
					</div>
				)}
			</div>

			{/* Insights */}
			<div>
				<h3 className="text-base font-bold text-slate-800 mb-3">最近洞察</h3>
				{insightsLoading ? (
					<Skeleton className="h-32" />
				) : (allInsights as Array<Record<string, unknown>>).length === 0 ? (
					<p className="text-sm text-slate-400 py-8 text-center">暂无洞察</p>
				) : (
					<div className="space-y-3">
						{(allInsights as Array<Record<string, unknown>>).slice(0, 20).map((i) => {
							const sb = scopeBadge(i.scope as string);
							return (
								<Card key={i.id as string}>
									<CardContent className="p-4">
										<div className="flex items-start justify-between">
											<div>
												<h4 className="font-bold text-slate-800 text-sm">
													{i.title as string}
												</h4>
												{i.description && (
													<p className="text-xs text-slate-500 mt-1">{i.description as string}</p>
												)}
											</div>
											<Badge className={sb.color}>{sb.label}</Badge>
										</div>
									</CardContent>
								</Card>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
