"use client";

import { Input } from "@repo/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { orpcClient } from "@shared/lib/orpc-client";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2,
	Cpu,
	FileText,
	Globe,
	Loader2,
	Plus,
	Shield,
	Sparkles,
	Trash2,
	Upload,
	Users,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const ADMIN_CARDS = [
	{
		key: "mode",
		icon: Globe,
		iconBg: "bg-sky-50",
		iconColor: "text-sky-600",
		title: "系统配置",
		desc: "接入模式 / 默认模型",
	},
	{
		key: "members",
		icon: Users,
		iconBg: "bg-indigo-50",
		iconColor: "text-indigo-600",
		title: "管理成员",
		desc: "添加 / 移除、权限控制",
	},
	{
		key: "models",
		icon: Cpu,
		iconBg: "bg-emerald-50",
		iconColor: "text-emerald-600",
		title: "模型提供商",
		desc: "配置 LLM API",
	},
	{
		key: "prompt",
		icon: FileText,
		iconBg: "bg-purple-50",
		iconColor: "text-purple-600",
		title: "默认 Prompt",
		desc: "公司级纪要风格",
	},
] as const;

const handleOverlayClick = (
	e: React.MouseEvent<HTMLDivElement>,
	cb: () => void,
) => {
	if (e.target === e.currentTarget) {
		cb();
	}
};

export function AdminDashboard() {
	const _queryClient = useQueryClient();
	const [activeDialog, setActiveDialog] = useState<string | null>(null);

	return (
		<div className="max-w-4xl space-y-6">
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
				{ADMIN_CARDS.map(
					({ key, icon: Icon, iconBg, iconColor, title, desc }) => (
						<button
							key={key}
							type="button"
							onClick={() => setActiveDialog(key)}
							className="premium-card bg-white p-5 rounded-[20px] shadow-[0_2px_16px_rgba(15,23,42,0.02)] cursor-pointer text-left hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.04)] transition-all group"
						>
							<div
								className={`w-10 h-10 rounded-[12px] ${iconBg} flex items-center justify-center mb-3`}
							>
								<Icon className={`h-5 w-5 ${iconColor}`} />
							</div>
							<p className="font-bold text-sm text-slate-900 mb-1">
								{title}
							</p>
							<p className="text-[11px] text-slate-400 leading-relaxed">
								{desc}
							</p>
						</button>
					),
				)}
			</div>

			<MemberAccessDialog
				open={activeDialog === "mode"}
				onClose={() => setActiveDialog(null)}
			/>
			<MemberListDialog
				open={activeDialog === "members"}
				onClose={() => setActiveDialog(null)}
			/>
			<ModelProviderDialog
				open={activeDialog === "models"}
				onClose={() => setActiveDialog(null)}
			/>
			<AdminPromptDialog
				open={activeDialog === "prompt"}
				onClose={() => setActiveDialog(null)}
			/>
		</div>
	);
}

/* ──────────────────────────────────────────
   Member Access Mode Dialog
   ────────────────────────────────────────── */
function MemberAccessDialog({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const { data: systemConfig } = useQuery(
		orpc.larkAdmin.settings.get.queryOptions(),
	);
	const { data: providers } = useQuery(
		orpc.larkAdmin.modelProviders.list.queryOptions(),
	);

	const updateConfigMutation = useMutation(
		orpc.larkAdmin.settings.update.mutationOptions({
			onSuccess: (_data: unknown, variables: unknown) => {
				const v = variables as Record<string, unknown>;
				toast.success(v.memberAccessMode ? "成员接入模式已切换" : "模型配置已更新");
				queryClient.invalidateQueries({
					queryKey: orpc.larkAdmin.settings.get.queryKey(),
				});
			},
		}),
	);

	const config = (systemConfig as Record<string, unknown>) ?? {};
	const memberMode = (config.memberAccessMode as string) ?? "open";
	const dfm = (config.defaultFastModel as string) ?? "";
	const dtm = (config.defaultTextModel as string) ?? "";
	const provList = (providers as { id: string; name: string; models: string[] }[] ?? []);
	const modelOpts = provList.flatMap((p: { id: string; name: string; models: string[] }) =>
		(p.models ?? []).map((m: string) => ({ value: `${p.id}:${m}`, label: `${p.name} / ${m}` })),
	);

	if (!open) {
		return null;
	}

	return (
		<div
			role="dialog"
			aria-modal="true"
			className="minutes-modal-overlay fixed inset-0 bg-slate-900/10 z-50 flex items-center justify-center p-4 active"
			onClick={(e) => handleOverlayClick(e, onClose)}
			onKeyDown={(e) => {
				if (e.key === "Escape") {
					onClose();
				}
			}}
		>
			<div className="minutes-modal-container bg-white border border-slate-100 w-full max-w-md rounded-[24px] shadow-[0_32px_80px_-16px_rgba(15,23,42,0.12)] overflow-hidden flex flex-col">
				<div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
					<div className="flex items-center space-x-2.5">
						<Globe className="text-sky-500 h-5 w-5" />
						<h3 className="text-base font-black text-slate-900 tracking-tight">
							系统配置
						</h3>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 flex items-center justify-center transition-colors"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="p-6 bg-[#F8F9FA] space-y-4">
					<p className="text-xs text-slate-400">
						控制新用户注册时是否需要管理员审批
					</p>
					<div className="grid grid-cols-2 gap-3">
						<button
							type="button"
							onClick={() =>
								updateConfigMutation.mutate({
									memberAccessMode: "open",
								})
							}
							className={`p-4 rounded-[16px] border-2 text-left transition-all ${
								memberMode === "open"
									? "border-indigo-200 bg-indigo-50/50 shadow-sm"
									: "border-slate-100 hover:border-slate-200"
							}`}
						>
							<div className="flex items-center gap-2 mb-1.5">
								<span
									className={`w-2 h-2 rounded-full ${memberMode === "open" ? "bg-indigo-500" : "bg-slate-300"}`}
								/>
								<p className="font-bold text-sm text-slate-900">
									开放模式
								</p>
							</div>
							<p className="text-xs text-slate-400 leading-relaxed">
								公司全员飞书登录即用
							</p>
						</button>
						<button
							type="button"
							onClick={() =>
								updateConfigMutation.mutate({
									memberAccessMode: "whitelist",
								})
							}
							className={`p-4 rounded-[16px] border-2 text-left transition-all ${
								memberMode === "whitelist"
									? "border-indigo-200 bg-indigo-50/50 shadow-sm"
									: "border-slate-100 hover:border-slate-200"
							}`}
						>
							<div className="flex items-center gap-2 mb-1.5">
								<span
									className={`w-2 h-2 rounded-full ${memberMode === "whitelist" ? "bg-indigo-500" : "bg-slate-300"}`}
								/>
								<p className="font-bold text-sm text-slate-900">
									审批模式
								</p>
							</div>
							<p className="text-xs text-slate-400 leading-relaxed">
								仅白名单成员可用
							</p>
						</button>
					</div>
				</div>
			<div className="space-y-3">
				<p className="text-xs font-bold text-slate-500 uppercase tracking-wide">默认模型</p>
				<div className="space-y-1.5">
					<label className="text-xs text-slate-500">快速模型（前置路由、分类等轻量任务）</label>
					<Select value={dfm} onValueChange={(v: string) => updateConfigMutation.mutate({ defaultFastModel: v })}>
						<SelectTrigger className="w-full rounded-xl"><SelectValue placeholder="选择快速模型..." /></SelectTrigger>
						<SelectContent>{modelOpts.map((opt: { value: string; label: string }) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
					</Select>
				</div>
				<div className="space-y-1.5">
					<label className="text-xs text-slate-500">主力模型（生成纪要等核心任务）</label>
					<Select value={dtm} onValueChange={(v: string) => updateConfigMutation.mutate({ defaultTextModel: v })}>
						<SelectTrigger className="w-full rounded-xl"><SelectValue placeholder="选择主力模型..." /></SelectTrigger>
						<SelectContent>{modelOpts.map((opt: { value: string; label: string }) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
					</Select>
				</div>
				{modelOpts.length === 0 && <p className="text-xs text-amber-600">请先在「模型提供商」中添加 LLM 提供商</p>}
			</div>
			</div>
		</div>
	);
}

/* ──────────────────────────────────────────
   Member List Dialog
   ────────────────────────────────────────── */
function MemberListDialog({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const [email, setEmail] = useState("");
	const { data: membersData } = useQuery(
		orpc.larkAdmin.members.list.queryOptions(),
	);

	const members =
		(membersData as Array<Record<string, unknown>>) ??
		[];

	const addMutation = useMutation(
		orpc.larkAdmin.members.add.mutationOptions({
			onSuccess: () => {
				toast.success("成员已添加");
				setEmail("");
				queryClient.invalidateQueries({
					queryKey: ["larkAdmin", "members", "list"],
				});
			},
			onError: () => toast.error("添加失败，请检查邮箱"),
		}),
	);

	const removeMutation = useMutation(
		orpc.larkAdmin.members.remove.mutationOptions({
			onSuccess: () => {
				toast.success("成员已移除");
				queryClient.invalidateQueries({
					queryKey: ["larkAdmin", "members", "list"],
				});
			},
		}),
	);

	if (!open) {
		return null;
	}

	return (
		<div
			role="dialog"
			aria-modal="true"
			className="minutes-modal-overlay fixed inset-0 bg-slate-900/10 z-50 flex items-center justify-center p-4 active"
			onClick={(e) => handleOverlayClick(e, onClose)}
			onKeyDown={(e) => {
				if (e.key === "Escape") {
					onClose();
				}
			}}
		>
			<div className="minutes-modal-container bg-white border border-slate-100 w-full max-w-md rounded-[24px] shadow-[0_32px_80px_-16px_rgba(15,23,42,0.12)] overflow-hidden flex flex-col max-h-[80vh]">
				<div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
					<div className="flex items-center space-x-2.5">
						<Users className="text-indigo-500 h-5 w-5" />
						<h3 className="text-base font-black text-slate-900 tracking-tight">
							管理成员
						</h3>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 flex items-center justify-center transition-colors"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div
					className="p-6 bg-[#F8F9FA] space-y-4 overflow-y-auto no-scrollbar"
					style={{ maxHeight: 360 }}
				>
					{/* Add form */}
					<div className="flex gap-2">
						<Input
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && email.trim()) {
									addMutation.mutate({ email: email.trim() });
								}
							}}
							placeholder="输入飞书邮箱地址"
							className="rounded-[12px] flex-1"
						/>
						<button
							type="button"
							onClick={() => {
								if (email.trim()) {
									addMutation.mutate({ email: email.trim() });
								}
							}}
							disabled={addMutation.isPending}
							className="px-4 py-2 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-[10px] transition-colors shadow-sm flex items-center gap-1.5 shrink-0 disabled:opacity-60"
						>
							{addMutation.isPending ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Plus className="h-3.5 w-3.5" />
							)}
							添加
						</button>
					</div>

					{/* List */}
					<div className="space-y-1.5">
						{members.length === 0 ? (
							<div className="text-center py-12 text-slate-400 text-xs">
								暂无成员
							</div>
						) : (
							members.map((m: Record<string, unknown>) => (
								<div
									key={m.id as string}
									className="bg-white border border-slate-200/60 p-3 rounded-[14px] flex items-center gap-3"
								>
									<div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[11px] shadow-sm shrink-0">
										{String(
											(m.name as string) ??
												(m.email as string) ??
												"?",
										)
											.charAt(0)
											.toUpperCase()}
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-1.5">
											<span className="font-bold text-xs text-slate-900 truncate">
												{m.name as string}
											</span>
											{m.isAdmin && (
												<span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded flex items-center shrink-0">
													<Shield className="h-2.5 w-2.5 mr-0.5" />
													管理员
												</span>
											)}
										</div>
										<p className="text-[11px] text-slate-400">
											{m.email as string}
										</p>
									</div>
									<button
										type="button"
										onClick={() =>
											removeMutation.mutate({
												id: m.id as string,
											})
										}
										className="text-[10px] font-bold text-red-400 hover:text-red-500 hover:bg-red-50 px-2 py-1 rounded-[6px] transition-colors flex items-center gap-0.5 shrink-0"
									>
										<Trash2 className="h-3 w-3" />
										移除
									</button>
								</div>
							))
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

/* ──────────────────────────────────────────
   Model Provider Dialog
   ────────────────────────────────────────── */
function ModelProviderDialog({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const { data: providersData } = useQuery(
		orpc.larkAdmin.modelProviders.list.queryOptions(),
	);
	const providers = (providersData as Array<Record<string, unknown>>) ?? [];
	const [showForm, setShowForm] = useState(false);
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
				setShowForm(false);
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
			toast.error("请填写完整信息");
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

	if (!open) {
		return null;
	}

	return (
		<div
			role="dialog"
			aria-modal="true"
			className="minutes-modal-overlay fixed inset-0 bg-slate-900/10 z-50 flex items-center justify-center p-4 active"
			onClick={(e) => handleOverlayClick(e, onClose)}
			onKeyDown={(e) => {
				if (e.key === "Escape") {
					onClose();
				}
			}}
		>
			<div className="minutes-modal-container bg-white border border-slate-100 w-full max-w-md rounded-[24px] shadow-[0_32px_80px_-16px_rgba(15,23,42,0.12)] overflow-hidden flex flex-col max-h-[80vh]">
				<div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
					<div className="flex items-center space-x-2.5">
						<Cpu className="text-emerald-500 h-5 w-5" />
						<h3 className="text-base font-black text-slate-900 tracking-tight">
							模型提供商
						</h3>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 flex items-center justify-center transition-colors"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div
					className="p-6 bg-[#F8F9FA] space-y-4 overflow-y-auto no-scrollbar"
					style={{ maxHeight: 360 }}
				>
					<div className="flex justify-end">
						<button
							type="button"
							onClick={() => setShowForm(!showForm)}
							className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-[8px] transition-colors flex items-center gap-1"
						>
							<Plus className="h-3 w-3" />
							添加提供商
						</button>
					</div>

					{showForm && (
						<div className="bg-white border border-slate-200/60 rounded-[16px] p-4 space-y-3">
							<div>
								<span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
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
									placeholder="OpenAI"
									className="rounded-[10px]"
								/>
							</div>
							<div>
								<span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
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
									className="rounded-[10px]"
								/>
							</div>
							<div>
								<span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
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
									className="rounded-[10px]"
								/>
							</div>
							<div>
								<span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
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
									className="rounded-[10px]"
								/>
							</div>
							<div className="flex gap-2 pt-1">
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
								<button
									type="button"
									onClick={() => setShowForm(false)}
									className="px-4 py-2 text-[11px] font-bold text-slate-500 hover:bg-slate-50 rounded-[10px] transition-colors"
								>
									取消
								</button>
							</div>
						</div>
					)}

					<div className="space-y-1.5">
						{providers.length === 0 ? (
							<div className="text-center py-12 text-slate-400 text-xs">
								暂无模型提供商
							</div>
						) : (
							providers.map((p: Record<string, unknown>) => {
								const modelList = (p.models as string[]) ?? [];
								return (
									<div
										key={p.id as string}
										className="bg-white border border-slate-200/60 p-3 rounded-[14px] flex items-center gap-3"
									>
										<div className="w-8 h-8 rounded-[8px] bg-emerald-50 flex items-center justify-center shrink-0">
											<span className="text-[11px] font-black text-emerald-600">
												{(p.name as string).charAt(0)}
											</span>
										</div>
										<div className="flex-1 min-w-0">
											<p className="font-bold text-xs text-slate-900">
												{p.name as string}
											</p>
											<p className="text-[11px] text-slate-400 truncate">
												{p.apiBase as string}
											</p>
											{modelList.length > 0 && (
												<div className="flex flex-wrap gap-1 mt-1.5">
													{modelList.map(
														(m: string) => (
															<span
																key={m}
																className="text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded"
															>
																{m}
															</span>
														),
													)}
												</div>
											)}
										</div>
										<button
											type="button"
											onClick={() =>
												deleteMutation.mutate({
													id: p.id as string,
												})
											}
											className="text-[10px] font-bold text-red-400 hover:text-red-500 hover:bg-red-50 px-2 py-1 rounded-[6px] transition-colors flex items-center gap-0.5 shrink-0"
										>
											<Trash2 className="h-3 w-3" />
											删除
										</button>
									</div>
								);
							})
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

/* ──────────────────────────────────────────
   Admin Prompt Dialog
   ────────────────────────────────────────── */
function AdminPromptDialog({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
	const { data: promptData } = useQuery(
		orpc.larkAdmin.prompt.get.queryOptions(),
	);
	const current = promptData as {
		id: string;
		name: string;
		styleDescription: string | null;
	} | null;

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

	useEffect(() => {
		if (!open) {
			setShowCreate(false);
		}
	}, [open]);

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

	const handleCreate = async () => {
		if (!newName.trim()) {
			toast.error("请填写版本名称");
			return;
		}
		setLoading(true);
		try {
			let _data: {
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
				_data = await orpcClient.larkAdmin.prompt.setDefault({
					name: newName,
					sampleContents: validSamples,
				});
			} else {
				if (!manualPrompt.trim()) {
					toast.error("请填写 Prompt 内容");
					setLoading(false);
					return;
				}
				_data = await orpcClient.larkAdmin.prompt.setDefault({
					name: newName,
					corePrompt: manualPrompt,
					styleDescription: styleDesc || null,
				});
			}
			toast.success("默认 Prompt 已更新");
			setShowCreate(false);
			setNewName("");
			setSamples(["", "", ""]);
			setManualPrompt("");
			setStyleDesc("");
		} catch (e: unknown) {
			toast.error(
				`创建失败: ${e instanceof Error ? e.message : "未知错误"}`,
			);
		} finally {
			setLoading(false);
		}
	};

	if (!open) {
		return null;
	}

	return (
		<>
			<div
				role="dialog"
				aria-modal="true"
				className="minutes-modal-overlay fixed inset-0 bg-slate-900/10 z-50 flex items-center justify-center p-4 active"
				onClick={(e) => handleOverlayClick(e, onClose)}
				onKeyDown={(e) => {
					if (e.key === "Escape") {
						onClose();
					}
				}}
			>
				<div className="minutes-modal-container bg-white border border-slate-100 w-full max-w-md rounded-[24px] shadow-[0_32px_80px_-16px_rgba(15,23,42,0.12)] overflow-hidden flex flex-col">
					<div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
						<div className="flex items-center space-x-2.5">
							<FileText className="text-purple-500 h-5 w-5" />
							<h3 className="text-base font-black text-slate-900 tracking-tight">
								默认 Prompt
							</h3>
						</div>
						<button
							type="button"
							onClick={onClose}
							className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 flex items-center justify-center transition-colors"
						>
							<X className="h-4 w-4" />
						</button>
					</div>

					<div className="p-6 bg-[#F8F9FA] space-y-4">
						{current ? (
							<div className="bg-white border border-slate-200/60 p-4 rounded-[16px] flex items-center gap-3">
								<div className="w-9 h-9 rounded-[10px] bg-purple-50 flex items-center justify-center shrink-0">
									<FileText className="h-4 w-4 text-purple-600" />
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 mb-0.5">
										<h4 className="font-bold text-sm text-slate-900">
											{current.name}
										</h4>
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
						) : (
							<div className="text-center py-8 text-slate-400 text-xs">
								还没有设置公司默认 Prompt
							</div>
						)}

						<button
							type="button"
							onClick={() => setShowCreate(true)}
							className="w-full text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-[12px] transition-colors shadow-sm flex items-center justify-center gap-1.5"
						>
							<Sparkles className="h-3.5 w-3.5" />
							{current ? "替换默认 Prompt" : "创建默认 Prompt"}
						</button>
					</div>
				</div>
			</div>

			{/* Create prompt sub-dialog */}
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

						<div className="p-6 bg-[#F8F9FA] space-y-4 overflow-y-auto no-scrollbar">
							<div className="bg-slate-100 p-1 rounded-xl flex">
								<button
									type="button"
									onClick={() => setCreateMode("ai")}
									className={`flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${createMode === "ai" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600"}`}
								>
									<Sparkles className="h-3.5 w-3.5" />
									AI 学习生成
								</button>
								<button
									type="button"
									onClick={() => setCreateMode("manual")}
									className={`flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${createMode === "manual" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600"}`}
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
												</button>
												<input
													ref={fileRefs[i]}
													type="file"
													accept=".txt,.md,.docx,.pdf"
													className="hidden"
													onChange={(ev) => {
														handleFileUpload(ev, i);
														ev.target.value = "";
													}}
												/>
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
		</>
	);
}
