"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Badge } from "@repo/ui/components/badge";
import { toast } from "sonner";
import { Trash2, Plus, Shield } from "lucide-react";
import { useState } from "react";

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
        queryClient.invalidateQueries({ queryKey: ["larkAdmin", "members", "list"] });
      },
      onError: () => toast.error("添加失败"),
    }),
  );

  const removeMutation = useMutation(
    orpc.larkAdmin.members.remove.mutationOptions({
      onSuccess: () => {
        toast.success("成员已移除");
        queryClient.invalidateQueries({ queryKey: ["larkAdmin", "members", "list"] });
      },
    }),
  );

  return (
    <div className="space-y-4 max-w-3xl">
      {/* 添加成员 */}
      <div className="flex gap-2">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="输入飞书邮箱地址"
          className="flex-1"
        />
        <Button
          onClick={() => {
            if (email.trim()) addMutation.mutate({ email: email.trim() });
          }}
          disabled={addMutation.isPending}
        >
          <Plus className="h-4 w-4 mr-1" />
          添加
        </Button>
      </div>

      {/* 成员列表 */}
      <div className="border rounded-lg divide-y">
        {initialMembers.map((member) => (
          <div key={member.id} className="p-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{member.name}</span>
                {member.isAdmin ? (
                  <Badge className="bg-yellow-100 text-yellow-700">
                    <Shield className="h-3 w-3 mr-1" />管理员
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm text-gray-500">{member.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeMutation.mutate({ id: member.id })}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
