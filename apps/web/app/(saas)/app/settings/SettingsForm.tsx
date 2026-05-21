"use client";

import { Textarea } from "@repo/ui/components/textarea";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Settings2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PromptStyleDialog } from "./PromptStyleDialog";

export function SettingsForm() {
	const _queryClient = useQueryClient();
	const { data: settings, isLoading } = useQuery(
		orpc.settings.get.queryOptions(),
	);

	const [autoEnabled, setAutoEnabled] = useState(true);
	const [extraInstructions, setExtraInstructions] = useState("");
	const [showStyleDialog, setShowStyleDialog] = useState(false);

	const updateMutation = useMutation(
		orpc.settings.update.mutationOptions({
			onSuccess: () => toast.success("设置已保存"),
			onError: () => toast.error("保存失败"),
		}),
	);

	// Sync local state from server
	const [initDone, setInitDone] = useState(false);
	if (!initDone && settings) {
		const s = settings as Record<string, unknown>;
		setAutoEnabled((s.autoEnabled as boolean) ?? true);
		setExtraInstructions((s.extraInstructions as string) ?? "");
		setInitDone(true);
	}

	const handleSave = () => {
		updateMutation.mutate({
			autoEnabled,
			extraInstructions: extraInstructions || null,
		});
	};

	if (isLoading) {
		return <SettingsSkeleton />;
	}

	return (
		<div className="max-w-4xl space-y-6">
			{/* ── 自动会议纪要 ── */}
			<div className="premium-card bg-white p-6 rounded-[24px] shadow-[0_2px_16px_rgba(15,23,42,0.02)]">
				<div className="flex items-center justify-between">
					<div className="space-y-1">
						<h3 className="text-sm font-bold text-slate-900">
							自动会议纪要
						</h3>
						<p className="text-xs text-slate-400 font-medium">
							会议结束后自动生成纪要，开完即出
						</p>
					</div>
					<button
						type="button"
						onClick={() => setAutoEnabled(!autoEnabled)}
						className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
							autoEnabled ? "bg-indigo-600" : "bg-slate-200"
						}`}
					>
						<span
							className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${autoEnabled ? "translate-x-[22px]" : "translate-x-[3px]"}`}
						/>
					</button>
				</div>
			</div>

			{/* ── 额外指令 ── */}
			<div className="premium-card bg-white p-6 rounded-[24px] shadow-[0_2px_16px_rgba(15,23,42,0.02)]">
				<div className="space-y-4">
					<div className="space-y-1">
						<h3 className="text-sm font-bold text-slate-900">
							额外指令
						</h3>
						<p className="text-xs text-slate-400 font-medium">
							告诉 AI 哪些会议要跳过、哪些话题要重点关注
						</p>
					</div>
					<Textarea
						value={extraInstructions}
						onChange={(e) => setExtraInstructions(e.target.value)}
						placeholder='例如："排除关于年会的会议"、"涉及融资话题时重点关注估值和条款"'
						rows={4}
						className="resize-none bg-[#F8F9FA] border-slate-200/60 rounded-[14px] text-[13px] placeholder:text-slate-300"
					/>
				</div>
			</div>

			{/* ── 纪要风格 ── */}
			<div className="premium-card bg-white p-6 rounded-[24px] shadow-[0_2px_16px_rgba(15,23,42,0.02)]">
				<div className="flex items-center justify-between">
					<div className="space-y-1">
						<h3 className="text-sm font-bold text-slate-900">
							纪要风格
						</h3>
						<p className="text-xs text-slate-400 font-medium">
							管理你的 AI 写作风格版本
						</p>
					</div>
					<button
						type="button"
						onClick={() => setShowStyleDialog(true)}
						className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 rounded-[10px] transition-colors"
					>
						<Settings2 className="h-3.5 w-3.5" />
						管理纪要风格
					</button>
				</div>
			</div>

			{/* ── 保存 ── */}
			<div className="flex justify-end">
				<button
					type="button"
					onClick={handleSave}
					disabled={updateMutation.isPending}
					className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-[12px] text-[13px] font-bold transition-colors shadow-sm flex items-center gap-2 disabled:opacity-60"
				>
					{updateMutation.isPending ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : null}
					{updateMutation.isPending ? "保存中..." : "保存设置"}
				</button>
			</div>

			<PromptStyleDialog
				open={showStyleDialog}
				onOpenChange={setShowStyleDialog}
			/>
		</div>
	);
}

function SettingsSkeleton() {
	return (
		<div className="max-w-4xl space-y-6">
			{Array.from({ length: 3 }).map((_, i) => (
				<div
					key={i}
					className="skeleton-card"
					style={{ height: 88, borderRadius: 24 }}
				>
					<div
						className="skeleton-block"
						style={{ width: "30%", height: 18, marginBottom: 12 }}
					/>
					<div
						className="skeleton-block"
						style={{ width: "60%", height: 14 }}
					/>
				</div>
			))}
		</div>
	);
}
