"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { toast } from "sonner";
import { Users, FileText, Cpu } from "lucide-react";
import Link from "next/link";

export function AdminDashboard() {
  const queryClient = useQueryClient();
  const { data: systemConfig } = useQuery(
    orpc.larkAdmin.settings.get.queryOptions(),
  );

  const updateConfigMutation = useMutation(
    orpc.larkAdmin.settings.update.mutationOptions({
      onSuccess: () => {
        toast.success("模式已切换");
        queryClient.invalidateQueries({ queryKey: orpc.larkAdmin.settings.get.queryKey() });
      },
    }),
  );

  const memberMode = (systemConfig as Record<string, unknown>)?.memberAccessMode ?? "open";

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>成员接入模式</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => updateConfigMutation.mutate({ memberAccessMode: "open" })}
              className={`flex-1 p-4 rounded-lg border-2 text-left transition-colors ${
                memberMode === "open" ? "border-blue-500 bg-blue-50" : "border-gray-200"
              }`}
            >
              <p className="font-medium">开放模式</p>
              <p className="text-sm text-gray-500 mt-1">公司全员飞书登录即用</p>
            </button>
            <button
              type="button"
              onClick={() => updateConfigMutation.mutate({ memberAccessMode: "whitelist" })}
              className={`flex-1 p-4 rounded-lg border-2 text-left transition-colors ${
                memberMode === "whitelist" ? "border-blue-500 bg-blue-50" : "border-gray-200"
              }`}
            >
              <p className="font-medium">审批模式</p>
              <p className="text-sm text-gray-500 mt-1">仅白名单成员可用</p>
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/app/admin/members">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-500" />
              <span className="font-medium">管理成员</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/app/admin/models">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <Cpu className="h-5 w-5 text-green-500" />
              <span className="font-medium">模型提供商</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/app/admin/prompt">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <FileText className="h-5 w-5 text-purple-500" />
              <span className="font-medium">默认 Prompt</span>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
