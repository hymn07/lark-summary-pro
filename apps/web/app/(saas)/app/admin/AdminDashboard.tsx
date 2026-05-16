"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Button } from "@repo/ui/components/button";
import { toast } from "sonner";
import { Users, FileText, Cpu, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export function AdminDashboard({
  totalRecords,
  totalUsers,
  completedRecords,
  modelProviders,
}: {
  totalRecords: number;
  totalUsers: number;
  completedRecords: number;
  modelProviders: number;
}) {
  const { data: systemConfig } = useQuery(
    orpc.larkAdmin.settings.get.queryOptions(),
  );
  const updateConfigMutation = useMutation(
    orpc.larkAdmin.settings.update.mutationOptions({
      onSuccess: () => toast.success("模式已切换"),
    }),
  );

  const memberMode = (systemConfig as Record<string, unknown>)?.memberAccessMode ?? "open";

  const cards = [
    { label: "成员", value: totalUsers, icon: Users },
    { label: "会议纪要", value: totalRecords, icon: FileText },
    { label: "已完成", value: completedRecords, icon: CheckCircle2 },
    { label: "模型提供商", value: modelProviders, icon: Cpu },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className="h-8 w-8 text-gray-400" />
                <div>
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-sm text-gray-500">{card.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 成员接入模式 */}
      <Card>
        <CardHeader>
          <CardTitle>成员接入模式</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() =>
                updateConfigMutation.mutate({ memberAccessMode: "open" })
              }
              className={`flex-1 p-4 rounded-lg border-2 text-left transition-colors ${
                memberMode === "open"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <p className="font-medium">开放模式</p>
              <p className="text-sm text-gray-500 mt-1">
                公司全员自动可用，飞书登录即创建用户
              </p>
            </button>
            <button
              type="button"
              onClick={() =>
                updateConfigMutation.mutate({ memberAccessMode: "whitelist" })
              }
              className={`flex-1 p-4 rounded-lg border-2 text-left transition-colors ${
                memberMode === "whitelist"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <p className="font-medium">审批模式</p>
              <p className="text-sm text-gray-500 mt-1">
                仅白名单成员可用，需管理员手动添加
              </p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* 快捷入口 */}
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
