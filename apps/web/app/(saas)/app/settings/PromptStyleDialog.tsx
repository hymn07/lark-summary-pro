"use client";

import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { orpcClient } from "@shared/lib/orpc-client";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2,
	FileText,
	Loader2,
	PenLine,
	Plus,
	Settings2,
	Sparkles,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export function PromptStyleDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const { data: versions, isLoading } = useQuery(
		orpc.prompts.list.queryOptions(),
	);
	const [showCreate, setShowCreate] = useState(false);
	const [createMode, setCreateMode] = useState<"ai" | "manual">("ai");
	const [newName, setNewName] = useState("");
	const [samples, setSamples] = useState(["", "", ""]);
	const [manualPrompt, setManualPrompt] = useState("");
	const [styleDesc, setStyleDesc] = useState("");

	// ── Detail / Edit state ──
	const [detailVersion, setDetailVersion] = useState<Record<
		string,
		unknown
	> | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [editName, setEditName] = useState("");
	const [editStyleDesc, setEditStyleDesc] = useState("");

	// Separate ref per sample upload slot
	const fileRef0 = useRef<HTMLInputElement>(null);
	const fileRef1 = useRef<HTMLInputElement>(null);
	const fileRef2 = useRef<HTMLInputElement>(null);
	const fileRefs = [fileRef0, fileRef1, fileRef2];

	useEffect(() => {
		if (!open) {
			setShowCreate(false);
			setDetailVersion(null);
			setIsEditing(false);
		}
	}, [open]);

	const createMutation = useMutation(
		orpc.prompts.create.mutationOptions({
			onSuccess: (data: Record<string, unknown>) => {
				toast.success(`"${data.name}" 已创建`);
				setShowCreate(false);
				setNewName("");
				setSamples(["", "", ""]);
				setManualPrompt("");
				setStyleDesc("");
				queryClient.invalidateQueries({
					queryKey: orpc.prompts.list.queryKey(),
				});
			},
			onError: () => toast.error("创建失败"),
		}),
	);

	const updateMutation = useMutation({
		mutationFn: (input: {
			id: string;
			name?: string;
			styleDescription?: string | null;
		}) => orpcClient.prompts.update(input),
		onSuccess: () => {
			toast.success("已更新");
			setIsEditing(false);
			setDetailVersion(null);
			queryClient.invalidateQueries({
				queryKey: orpc.prompts.list.queryKey(),
			});
		},
		onError: () => toast.error("更新失败"),
	});

	const deleteMutation = useMutation(
		orpc.prompts.delete.mutationOptions({
			onSuccess: () => {
				toast.success("已删除");
				setDetailVersion(null);
				queryClient.invalidateQueries({
					queryKey: orpc.prompts.list.queryKey(),
				});
			},
		}),
	);

	const activateMutation = useMutation(
		orpc.prompts.activate.mutationOptions({
			onSuccess: () => {
				toast.success("已切换活跃版本");
				queryClient.invalidateQueries({
					queryKey: orpc.prompts.list.queryKey(),
				});
			},
		}),
	);

	const handleFileUpload = async (
		e: React.ChangeEvent<HTMLInputElement>,
		index: number,
	) => {
		const file = e.target.files?.[0];
		if (!file) {
			return;
		}
		try {
			const text = await file.text();
			const u = [...samples];
			u[index] = text;
			setSamples(u);
		} catch {
			toast.error("文件读取失败");
		}
	};

	const handleCreate = () => {
		if (!newName.trim()) {
			toast.error("请填写风格名称");
			return;
		}
		if (createMode === "ai") {
			const valid = samples.filter((s) => s.trim());
			if (valid.length === 0) {
				toast.error("请粘贴或上传至少一篇示例");
				return;
			}
			createMutation.mutate({ name: newName, sampleContents: valid });
		} else {
			if (!manualPrompt.trim()) {
				toast.error("请填写 Prompt 内容");
				return;
			}
			createMutation.mutate({
				name: newName,
				corePrompt: manualPrompt,
				styleDescription: styleDesc || null,
			});
		}
	};

	const openDetail = (v: Record<string, unknown>) => {
		setDetailVersion(v);
		setEditName((v.name as string) ?? "");
		setEditStyleDesc((v.styleDescription as string) ?? "");
		setIsEditing(false);
	};

	const handleSaveEdit = () => {
		if (!detailVersion) {
			return;
		}
		if (!editName.trim()) {
			toast.error("名称不能为空");
			return;
		}
		updateMutation.mutate({
			id: detailVersion.id as string,
			name: editName.trim(),
			styleDescription: editStyleDesc.trim() || null,
		});
	};

	const versionList = (versions as unknown[]) ?? [];

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
			{/* ── 纪要风格管理弹窗 ── */}
			<div
				role="dialog"
				aria-modal="true"
				className={`minutes-modal-overlay fixed inset-0 bg-slate-900/10 z-50 flex items-center justify-center p-4 ${open ? "active" : ""}`}
				onClick={(e) =>
					handleOverlayClick(e, () => onOpenChange(false))
				}
				onKeyDown={(e) => {
					if (e.key === "Escape") {
						onOpenChange(false);
					}
				}}
			>
				<div className="minutes-modal-container bg-white border border-slate-100 w-full max-w-lg rounded-[24px] shadow-[0_32px_80px_-16px_rgba(15,23,42,0.12)] overflow-hidden flex flex-col max-h-[80vh]">
					{/* Header */}
					<div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
						<div className="flex items-center gap-3">
							<Settings2 className="text-indigo-500 h-5 w-5" />
							<div>
								<h3 className="text-base font-black text-slate-900 tracking-tight">
									管理纪要风格
								</h3>
								<p className="text-[10px] text-slate-400 font-medium">
									{versionList.length} 个风格版本
								</p>
							</div>
							<button
								type="button"
								onClick={() => setShowCreate(true)}
								className="ml-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-[8px] transition-colors flex items-center gap-1"
							>
								<Plus className="h-3 w-3" /> 创建新风格
							</button>
						</div>
						<button
							type="button"
							onClick={() => onOpenChange(false)}
							className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 flex items-center justify-center transition-colors shrink-0"
						>
							<X className="h-4 w-4" />
						</button>
					</div>

					{/* Body — fixed max-height, scrollable */}
					<div
						className="p-6 bg-[#F8F9FA] overflow-y-auto no-scrollbar"
						style={{ maxHeight: 360 }}
					>
						{isLoading ? (
							<div className="space-y-2">
								{[1, 2, 3].map((i) => (
									<div
										key={i}
										className="bg-white rounded-[16px] border border-slate-200/60 p-4"
									>
										<div
											className="skeleton-block"
											style={{
												width: "40%",
												height: 16,
												marginBottom: 8,
											}}
										/>
										<div
											className="skeleton-block"
											style={{ width: "70%", height: 12 }}
										/>
									</div>
								))}
							</div>
						) : versionList.length === 0 ? (
							<div className="text-center py-16 text-slate-400 text-xs font-medium">
								还没有创建纪要风格
								<br />
								点击标题旁的「创建新风格」按钮开始
							</div>
						) : (
							<div className="space-y-2">
								{versionList.map(
									(v: Record<string, unknown>) => (
										<button
											key={v.id as string}
											type="button"
											onClick={() => openDetail(v)}
											className="bg-white border border-slate-200/60 p-4 rounded-[16px] w-full text-left flex items-center gap-3 cursor-pointer hover:border-indigo-200 hover:shadow-sm transition-all group"
										>
											<div className="w-9 h-9 rounded-[10px] bg-indigo-50 flex items-center justify-center shrink-0">
												<Sparkles className="h-4 w-4 text-indigo-500" />
											</div>
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2 mb-0.5">
													<h4 className="font-bold text-sm text-slate-900 truncate">
														{v.name as string}
													</h4>
													{v.isActive && (
														<span className="text-[10px] font-bold text-[#10B981] bg-[#E6F4EA] px-2 py-0.5 rounded-md flex items-center shrink-0">
															<CheckCircle2 className="h-3 w-3 mr-1" />
															当前使用
														</span>
													)}
												</div>
												{v.styleDescription && (
													<p className="text-xs text-slate-400 truncate">
														{(
															v.styleDescription as string
														).slice(0, 60)}
													</p>
												)}
											</div>
											<PenLine className="h-3.5 w-3.5 text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0" />
										</button>
									),
								)}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* ── 创建新风格弹窗 ── */}
			{showCreate && (
				<div
					role="dialog"
					aria-modal="true"
					className="minutes-modal-overlay fixed inset-0 bg-slate-900/10 z-[60] flex items-center justify-center p-4 active"
					onClick={(e) =>
						handleOverlayClick(e, () => setShowCreate(false))
					}
					onKeyDown={(e) => {
						if (e.key === "Escape") {
							setShowCreate(false);
						}
					}}
				>
					<div className="minutes-modal-container bg-white border border-slate-100 w-full max-w-lg rounded-[24px] shadow-[0_32px_80px_-16px_rgba(15,23,42,0.12)] overflow-hidden flex flex-col max-h-[85vh]">
						<div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
							<div className="flex items-center space-x-2.5">
								<Sparkles className="text-indigo-500 h-5 w-5" />
								<h3 className="text-base font-black text-slate-900 tracking-tight">
									创建新风格
								</h3>
							</div>
							<button
								type="button"
								onClick={() => setShowCreate(false)}
								className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 flex items-center justify-center transition-colors"
							>
								<X className="h-4 w-4" />
							</button>
						</div>

						<div className="p-6 bg-[#F8F9FA] space-y-4 overflow-y-auto no-scrollbar">
							{/* Mode switch */}
							<div className="bg-slate-100 p-1 rounded-xl flex">
								<button
									type="button"
									onClick={() => setCreateMode("ai")}
									className={`flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
										createMode === "ai"
											? "bg-white text-indigo-600 shadow-sm"
											: "text-slate-600"
									}`}
								>
									<Sparkles className="h-3.5 w-3.5" />
									AI 学习生成
								</button>
								<button
									type="button"
									onClick={() => setCreateMode("manual")}
									className={`flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
										createMode === "manual"
											? "bg-white text-indigo-600 shadow-sm"
											: "text-slate-600"
									}`}
								>
									<FileText className="h-3.5 w-3.5" />
									手动编写
								</button>
							</div>

							<div>
								<span className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
									版本名称
								</span>
								<Input
									value={newName}
									onChange={(e) => setNewName(e.target.value)}
									placeholder="如：简洁版、技术评审版"
									className="rounded-[12px]"
								/>
							</div>

							{createMode === "ai" ? (
								<div>
									<span className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
										上传 1-3 篇示例纪要
									</span>
									<p className="text-[11px] text-slate-400 mb-3">
										AI 将学习你的写作风格
									</p>
									{samples.map((s, i) => (
										<div key={i} className="mb-3">
											<div className="flex items-center gap-2 mb-1.5">
												<span className="text-[10px] font-bold text-slate-400">
													示例 {i + 1}
												</span>
												<button
													type="button"
													className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
													onClick={() =>
														fileRefs[
															i
														].current?.click()
													}
												>
													<Upload className="h-3 w-3" />
													上传文件
												</button>
												<input
													ref={fileRefs[i]}
													type="file"
													accept=".txt,.md"
													className="hidden"
													onChange={(ev) => {
														handleFileUpload(ev, i);
														ev.target.value = "";
													}}
												/>
											</div>
											<Textarea
												value={s}
												onChange={(ev) => {
													const u = [...samples];
													u[i] = ev.target.value;
													setSamples(u);
												}}
												placeholder={`粘贴第 ${i + 1} 篇纪要文本...`}
												rows={4}
												className="resize-none bg-[#F8F9FA] border-slate-200/60 rounded-[14px] text-[13px] placeholder:text-slate-300"
											/>
										</div>
									))}
								</div>
							) : (
								<>
									<div>
										<span className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
											Prompt 内容
										</span>
										<Textarea
											value={manualPrompt}
											onChange={(e) =>
												setManualPrompt(e.target.value)
											}
											placeholder="直接编写 System Prompt..."
											rows={6}
											className="resize-none bg-[#F8F9FA] border-slate-200/60 rounded-[14px] text-[13px] placeholder:text-slate-300"
										/>
									</div>
									<div>
										<span className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
											风格描述（可选）
										</span>
										<Input
											value={styleDesc}
											onChange={(e) =>
												setStyleDesc(e.target.value)
											}
											placeholder="如：简洁分点式，偏重技术细节"
											className="rounded-[12px]"
										/>
									</div>
								</>
							)}
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
								) : (
									<Sparkles className="h-3.5 w-3.5" />
								)}
								{createMutation.isPending
									? "生成中..."
									: createMode === "ai"
										? "AI 学习生成"
										: "保存"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* ── 风格详情/编辑弹窗 ── */}
			{detailVersion && (
				<div
					role="dialog"
					aria-modal="true"
					className="minutes-modal-overlay fixed inset-0 bg-slate-900/10 z-[60] flex items-center justify-center p-4 active"
					onClick={(e) =>
						handleOverlayClick(e, () => {
							setDetailVersion(null);
							setIsEditing(false);
						})
					}
					onKeyDown={(e) => {
						if (e.key === "Escape") {
							setDetailVersion(null);
							setIsEditing(false);
						}
					}}
				>
					<div className="minutes-modal-container bg-white border border-slate-100 w-full max-w-md rounded-[24px] shadow-[0_32px_80px_-16px_rgba(15,23,42,0.12)] overflow-hidden flex flex-col">
						<div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
							<div className="flex items-center space-x-2.5">
								<div className="w-8 h-8 rounded-[10px] bg-indigo-50 flex items-center justify-center">
									<Sparkles className="h-4 w-4 text-indigo-500" />
								</div>
								<h3 className="text-base font-black text-slate-900 tracking-tight truncate max-w-[200px]">
									{detailVersion.name as string}
								</h3>
							</div>
							<button
								type="button"
								onClick={() => {
									setDetailVersion(null);
									setIsEditing(false);
								}}
								className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 flex items-center justify-center transition-colors"
							>
								<X className="h-4 w-4" />
							</button>
						</div>

						<div className="p-6 bg-[#F8F9FA] space-y-4">
							{/* Status badges */}
							<div className="flex items-center gap-2">
								{detailVersion.isActive && (
									<span className="text-[10px] font-bold text-[#10B981] bg-[#E6F4EA] px-2.5 py-1 rounded-md flex items-center">
										<CheckCircle2 className="h-3 w-3 mr-1" />
										当前使用中
									</span>
								)}
								{detailVersion.isDefault && (
									<span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
										默认版本
									</span>
								)}
							</div>

							{isEditing ? (
								<>
									<div>
										<span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
											风格名称
										</span>
										<Input
											value={editName}
											onChange={(e) =>
												setEditName(e.target.value)
											}
											className="rounded-[12px]"
										/>
									</div>
									<div>
										<span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
											风格描述
										</span>
										<Textarea
											value={editStyleDesc}
											onChange={(e) =>
												setEditStyleDesc(e.target.value)
											}
											rows={3}
											className="resize-none bg-[#F8F9FA] border-slate-200/60 rounded-[14px] text-[13px] placeholder:text-slate-300"
										/>
									</div>
								</>
							) : detailVersion.styleDescription ? (
								<div>
									<span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
										风格描述
									</span>
									<p className="text-[13px] text-slate-600 leading-relaxed bg-white border border-slate-200/60 rounded-[14px] p-4">
										{
											detailVersion.styleDescription as string
										}
									</p>
								</div>
							) : (
								<div className="text-center py-8 text-slate-400 text-xs">
									暂无风格描述，点击编辑按钮添加
								</div>
							)}
						</div>

						<div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between bg-white shrink-0">
							<button
								type="button"
								onClick={() => {
									deleteMutation.mutate({
										id: detailVersion.id as string,
									});
								}}
								className="text-[10px] font-bold text-red-400 hover:text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-[8px] transition-colors flex items-center gap-1"
							>
								<Trash2 className="h-3 w-3" />
								删除
							</button>
							<div className="flex gap-2">
								{!detailVersion.isActive && (
									<button
										type="button"
										onClick={() => {
											activateMutation.mutate({
												id: detailVersion.id as string,
											});
											setDetailVersion(null);
										}}
										className="px-4 py-2 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-[10px] transition-colors shadow-sm flex items-center gap-1.5"
									>
										<CheckCircle2 className="h-3.5 w-3.5" />
										设为当前
									</button>
								)}
								{isEditing ? (
									<button
										type="button"
										onClick={handleSaveEdit}
										disabled={updateMutation.isPending}
										className="px-4 py-2 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-[10px] transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-60"
									>
										{updateMutation.isPending ? (
											<Loader2 className="h-3.5 w-3.5 animate-spin" />
										) : null}
										保存修改
									</button>
								) : (
									<button
										type="button"
										onClick={() => setIsEditing(true)}
										className="px-4 py-2 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-[10px] transition-colors flex items-center gap-1.5"
									>
										<PenLine className="h-3.5 w-3.5" />
										编辑
									</button>
								)}
								<button
									type="button"
									onClick={() => {
										setDetailVersion(null);
										setIsEditing(false);
									}}
									className="px-4 py-2 text-[11px] font-bold text-slate-500 hover:bg-slate-50 rounded-[10px] transition-colors"
								>
									关闭
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
