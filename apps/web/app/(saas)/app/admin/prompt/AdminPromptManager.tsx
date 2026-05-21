"use client";

import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { orpcClient } from "@shared/lib/orpc-client";
import {
	CheckCircle2,
	FileText,
	Loader2,
	Sparkles,
	Upload,
	X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

export function AdminPromptManager({
	initialPrompt,
}: {
	initialPrompt: {
		id: string;
		name: string;
		styleDescription: string | null;
	} | null;
}) {
	const [current, setCurrent] = useState(initialPrompt);
	const [showCreate, setShowCreate] = useState(false);
	const [createMode, setCreateMode] = useState<"ai" | "manual">("ai");
	const [newName, setNewName] = useState("");
	const [samples, setSamples] = useState(["", "", ""]);
	const [manualPrompt, setManualPrompt] = useState("");
	const [styleDesc, setStyleDesc] = useState("");
	const [loading, setLoading] = useState(false);
	const fileRef0 = useRef<HTMLInputElement>(null);
	const fileRef1 = useRef<HTMLInputElement>(null);
	const fileRef2 = useRef<HTMLInputElement>(null);
	const fileRefs = [fileRef0, fileRef1, fileRef2];

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
			const updated = [...samples];
			updated[index] = text;
			setSamples(updated);
		} catch {
			toast.error("文件读取失败");
		}
	};

	const handleCreate = async () => {
		if (!newName.trim()) {
			toast.error("请填写版本名称");
			return;
		}
		setLoading(true);
		try {
			let data: {
				id: string;
				name: string;
				styleDescription: string | null;
			};

			if (createMode === "ai") {
				const validSamples = samples.filter((s) => s.trim());
				if (validSamples.length === 0) {
					toast.error("请粘贴或上传至少一篇示例");
					setLoading(false);
					return;
				}
				data = await orpcClient.larkAdmin.prompt.setDefault({
					name: newName,
					sampleContents: validSamples,
				});
			} else {
				if (!manualPrompt.trim()) {
					toast.error("请填写 Prompt 内容");
					setLoading(false);
					return;
				}
				data = await orpcClient.larkAdmin.prompt.setDefault({
					name: newName,
					corePrompt: manualPrompt,
					styleDescription: styleDesc || null,
				});
			}

			toast.success("默认 Prompt 已更新");
			setCurrent({
				id: data.id,
				name: data.name,
				styleDescription: data.styleDescription,
			});
			setShowCreate(false);
			setNewName("");
			setSamples(["", "", ""]);
			setManualPrompt("");
			setStyleDesc("");
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : "未知错误";
			toast.error(`创建失败: ${msg}`);
		} finally {
			setLoading(false);
		}
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
			{/* Current prompt */}
			{current ? (
				<div className="premium-card bg-white p-5 rounded-[20px] shadow-[0_2px_16px_rgba(15,23,42,0.02)]">
					<div className="flex items-center gap-4">
						<div className="w-10 h-10 rounded-[12px] bg-purple-50 flex items-center justify-center shrink-0">
							<FileText className="h-5 w-5 text-purple-600" />
						</div>
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2 mb-0.5">
								<h3 className="font-bold text-sm text-slate-900">
									{current.name}
								</h3>
								<span className="text-[10px] font-bold text-[#10B981] bg-[#E6F4EA] px-2 py-0.5 rounded-md flex items-center shrink-0">
									<CheckCircle2 className="h-3 w-3 mr-1" />
									当前
								</span>
							</div>
							{current.styleDescription && (
								<p className="text-xs text-slate-400">
									{current.styleDescription}
								</p>
							)}
						</div>
					</div>
				</div>
			) : (
				<div className="text-center py-16 text-slate-400 text-sm font-medium">
					还没有设置公司默认 Prompt
				</div>
			)}

			<div className="flex justify-start">
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					className="text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-[10px] transition-colors shadow-sm flex items-center gap-1.5"
				>
					<Sparkles className="h-3.5 w-3.5" />
					{current ? "替换默认 Prompt" : "创建默认 Prompt"}
				</button>
			</div>

			{/* ── 创建/替换弹窗 ── */}
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
					<div className="minutes-modal-container bg-white border border-slate-100 w-full max-w-lg rounded-[24px] shadow-[0_32px_80px_-16px_rgba(15,23,42,0.12)] overflow-hidden flex flex-col">
						<div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
							<div className="flex items-center space-x-2.5">
								<Sparkles className="text-indigo-500 h-5 w-5" />
								<h3 className="text-base font-black text-slate-900 tracking-tight">
									{current ? "替换" : "创建"}公司默认风格
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

						<div
							className="p-6 bg-[#F8F9FA] space-y-4 overflow-y-auto no-scrollbar"
							style={{ maxHeight: 400 }}
						>
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
									placeholder="如：标准版、详尽版"
									className="rounded-[12px]"
								/>
							</div>

							{createMode === "ai" ? (
								<div>
									<span className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
										上传 1-3 篇示例纪要
									</span>
									<p className="text-[11px] text-slate-400 mb-3">
										AI 将学习写作风格并生成公司默认 Prompt
									</p>
									{samples.map((sample, i) => (
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
													<input
														ref={fileRefs[i]}
														type="file"
														accept=".txt,.md,.docx,.pdf"
														className="hidden"
														onChange={(ev) => {
															handleFileUpload(
																ev,
																i,
															);
															ev.target.value =
																"";
														}}
													/>
												</button>
											</div>
											<Textarea
												value={sample}
												onChange={(ev) => {
													const u = [...samples];
													u[i] = ev.target.value;
													setSamples(u);
												}}
												placeholder={`粘贴第 ${i + 1} 篇会议纪要...`}
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
											placeholder="直接编写 System Prompt，告诉 AI 如何生成会议纪要..."
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
								disabled={loading}
								className="px-4 py-2 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-[10px] transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-60"
							>
								{loading ? (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								) : (
									<Sparkles className="h-3.5 w-3.5" />
								)}
								{loading
									? "生成中..."
									: createMode === "ai"
										? "AI 学习生成"
										: "保存"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
