"use client";

import { Input } from "@repo/ui/components/input";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ModelProviderList({
	initialProviders,
}: {
	initialProviders: Array<{
		id: string;
		name: string;
		apiBase: string;
		models: unknown;
		createdAt: Date;
	}>;
}) {
	const queryClient = useQueryClient();
	const [showCreate, setShowCreate] = useState(false);
	const [form, setForm] = useState({
		name: "",
		apiBase: "",
		apiKey: "",
		models: "",
	});

	const createMutation = useMutation(
		orpc.larkAdmin.modelProviders.create.mutationOptions({
			onSuccess: () => {
				toast.success("提供商已添加");
				setShowCreate(false);
				setForm({ name: "", apiBase: "", apiKey: "", models: "" });
				queryClient.invalidateQueries({
					queryKey: ["larkAdmin", "modelProviders", "list"],
				});
			},
			onError: () => toast.error("添加失败"),
		}),
	);

	const deleteMutation = useMutation(
		orpc.larkAdmin.modelProviders.delete.mutationOptions({
			onSuccess: () => {
				toast.success("已删除");
				queryClient.invalidateQueries({
					queryKey: ["larkAdmin", "modelProviders", "list"],
				});
			},
		}),
	);

	const handleCreate = () => {
		if (!form.name.trim() || !form.apiBase.trim() || !form.apiKey.trim()) {
			toast.error("请填写名称、API Base 和 API Key");
			return;
		}
		const modelList = form.models
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		createMutation.mutate({
			name: form.name.trim(),
			apiBase: form.apiBase.trim(),
			apiKey: form.apiKey.trim(),
			models: modelList,
		});
	};

	const handleOverlayClick = (
		e: React.MouseEvent<HTMLDivElement>,
		cb: () => void,
	) => {
		if (e.target === e.currentTarget) {
			cb();
		}
	};

	return (
		<div className="max-w-4xl space-y-6">
			<div className="flex justify-end">
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					className="text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-[10px] transition-colors flex items-center gap-1.5"
				>
					<Plus className="h-3.5 w-3.5" /> 添加提供商
				</button>
			</div>

			{/* Provider list */}
			<div className="space-y-2">
				{initialProviders.length === 0 ? (
					<div className="text-center py-16 text-slate-400 text-sm font-medium">
						还没有模型提供商，点击上方按钮添加
					</div>
				) : (
					initialProviders.map((p) => {
						const modelList = (p.models as string[]) ?? [];
						return (
							<div
								key={p.id}
								className="premium-card bg-white p-4 rounded-[16px] shadow-[0_2px_16px_rgba(15,23,42,0.02)] flex items-center gap-4"
							>
								<div className="w-9 h-9 rounded-[10px] bg-emerald-50 flex items-center justify-center shrink-0">
									<span className="text-xs font-black text-emerald-600">
										{p.name.charAt(0)}
									</span>
								</div>
								<div className="flex-1 min-w-0">
									<p className="font-bold text-sm text-slate-900">
										{p.name}
									</p>
									<p className="text-xs text-slate-400 mt-0.5 truncate">
										{p.apiBase}
									</p>
									{modelList.length > 0 && (
										<div className="flex flex-wrap gap-1 mt-2">
											{modelList.map((m: string) => (
												<span
													key={m}
													className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md"
												>
													{m}
												</span>
											))}
										</div>
									)}
								</div>
								<button
									type="button"
									onClick={() =>
										deleteMutation.mutate({ id: p.id })
									}
									className="text-[10px] font-bold text-red-400 hover:text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-[8px] transition-colors flex items-center gap-1 shrink-0"
								>
									<Trash2 className="h-3.5 w-3.5" />
									删除
								</button>
							</div>
						);
					})
				)}
			</div>

			{/* ── 添加提供商弹窗 ── */}
			{showCreate && (
				<div
					role="dialog"
					aria-modal="true"
					className={
						"minutes-modal-overlay fixed inset-0 bg-slate-900/10 z-50 flex items-center justify-center p-4 active"
					}
					onClick={(e) =>
						handleOverlayClick(e, () => setShowCreate(false))
					}
					onKeyDown={(e) => {
						if (e.key === "Escape") {
							setShowCreate(false);
						}
					}}
				>
					<div className="minutes-modal-container bg-white border border-slate-100 w-full max-w-md rounded-[24px] shadow-[0_32px_80px_-16px_rgba(15,23,42,0.12)] overflow-hidden flex flex-col">
						<div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
							<div>
								<h3 className="text-base font-black text-slate-900 tracking-tight">
									添加模型提供商
								</h3>
								<p className="text-[10px] text-slate-400 font-medium mt-1">
									配置 LLM API 接入信息
								</p>
							</div>
							<button
								type="button"
								onClick={() => setShowCreate(false)}
								className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 flex items-center justify-center transition-colors"
							>
								<X className="h-4 w-4" />
							</button>
						</div>

						<div className="p-8 bg-[#F8F9FA] space-y-4">
							<div>
								<span className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
									名称
								</span>
								<Input
									value={form.name}
									onChange={(e) =>
										setForm({
											...form,
											name: e.target.value,
										})
									}
									placeholder="如：OpenAI、DeepSeek"
									className="rounded-[12px]"
								/>
							</div>
							<div>
								<span className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
									API Base URL
								</span>
								<Input
									value={form.apiBase}
									onChange={(e) =>
										setForm({
											...form,
											apiBase: e.target.value,
										})
									}
									placeholder="https://api.openai.com/v1"
									className="rounded-[12px]"
								/>
							</div>
							<div>
								<span className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
									API Key
								</span>
								<Input
									type="password"
									value={form.apiKey}
									onChange={(e) =>
										setForm({
											...form,
											apiKey: e.target.value,
										})
									}
									placeholder="sk-..."
									className="rounded-[12px]"
								/>
							</div>
							<div>
								<span className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
									模型列表（逗号分隔）
								</span>
								<Input
									value={form.models}
									onChange={(e) =>
										setForm({
											...form,
											models: e.target.value,
										})
									}
									placeholder="gpt-4o, gpt-4o-mini"
									className="rounded-[12px]"
								/>
							</div>
						</div>

						<div className="px-8 py-5 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-white shrink-0">
							<button
								type="button"
								onClick={() => setShowCreate(false)}
								className="px-4 py-2 text-[11px] font-bold text-slate-500 hover:bg-slate-50 rounded-[10px] transition-colors"
							>
								取消
							</button>
							<button
								type="button"
								onClick={handleCreate}
								disabled={createMutation.isPending}
								className="px-4 py-2 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-[10px] transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-60"
							>
								{createMutation.isPending ? (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								) : null}
								{createMutation.isPending
									? "添加中..."
									: "保存"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
