"use client";

import { Input } from "@repo/ui/components/input";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Shield, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function MemberList({
	initialMembers,
}: {
	initialMembers: Array<{
		id: string;
		name: string;
		email: string;
		isAdmin: boolean;
		createdAt: Date;
	}>;
}) {
	const queryClient = useQueryClient();
	const [email, setEmail] = useState("");

	const addMutation = useMutation(
		orpc.larkAdmin.members.add.mutationOptions({
			onSuccess: () => {
				toast.success("成员已添加");
				setEmail("");
				queryClient.invalidateQueries({
					queryKey: ["larkAdmin", "members", "list"],
				});
			},
			onError: () => toast.error("添加失败，请检查邮箱是否正确"),
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

	const handleAdd = () => {
		if (!email.trim()) {
			toast.error("请输入飞书邮箱");
			return;
		}
		addMutation.mutate({ email: email.trim() });
	};

	return (
		<div className="max-w-4xl space-y-6">
			{/* Add member */}
			<div className="premium-card bg-white p-5 rounded-[20px] shadow-[0_2px_16px_rgba(15,23,42,0.02)]">
				<div className="space-y-1 mb-4">
					<h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
						<Plus className="h-4 w-4 text-indigo-500" />
						添加成员
					</h3>
					<p className="text-xs text-slate-400 font-medium">
						输入飞书邮箱地址，将用户加入白名单
					</p>
				</div>
				<div className="flex gap-2">
					<Input
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								handleAdd();
							}
						}}
						placeholder="user@feishu.local"
						className="rounded-[12px] flex-1"
					/>
					<button
						type="button"
						onClick={handleAdd}
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
			</div>

			{/* Member list */}
			<div className="space-y-2">
				{initialMembers.length === 0 ? (
					<div className="text-center py-16 text-slate-400 text-sm font-medium">
						还没有添加成员
					</div>
				) : (
					initialMembers.map((member) => (
						<div
							key={member.id}
							className="premium-card bg-white p-4 rounded-[16px] shadow-[0_2px_16px_rgba(15,23,42,0.02)] flex items-center gap-4"
						>
							<div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
								{(member.name ?? member.email)
									.charAt(0)
									.toUpperCase()}
							</div>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2">
									<span className="font-bold text-sm text-slate-900 truncate">
										{member.name}
									</span>
									{member.isAdmin && (
										<span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md flex items-center shrink-0">
											<Shield className="h-3 w-3 mr-1" />
											管理员
										</span>
									)}
								</div>
								<p className="text-xs text-slate-400 mt-0.5">
									{member.email}
								</p>
							</div>
							<button
								type="button"
								onClick={() =>
									removeMutation.mutate({ id: member.id })
								}
								className="text-[10px] font-bold text-red-400 hover:text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-[8px] transition-colors flex items-center gap-1 shrink-0"
							>
								<Trash2 className="h-3.5 w-3.5" />
								移除
							</button>
						</div>
					))
				)}
			</div>
		</div>
	);
}
