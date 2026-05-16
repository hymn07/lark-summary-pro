"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { toast } from "sonner";
import { Users, FileText, Cpu, Play } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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
  const [testMeetingId, setTestMeetingId] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const runTest = async () => {
    if (!testMeetingId.trim()) { toast.error("请输入会议 ID"); return; }
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/larkAdmin/test/pipeline", body: { meetingId: testMeetingId } }),
      });
      const json = await res.json();
      setTestResult(JSON.stringify(json, null, 2));
      if (!json.error) toast.success("流水线执行完成，查看终端日志");
      else toast.error("执行失败");
    } catch (e) {
      setTestResult(String(e));
      toast.error("请求失败");
    } finally {
      setTestLoading(false);
    }
  };

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

      {/* 流水线测试 */}
      <Card>
        <CardHeader><CardTitle>流水线测试</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-500">输入一个飞书会议 ID，模拟触发完整流水线（结果查看终端日志）</p>
          <div className="flex gap-2">
            <Input
              value={testMeetingId}
              onChange={(e) => setTestMeetingId(e.target.value)}
              placeholder="飞书会议 ID，如 6911188411934433028"
            />
            <Button onClick={runTest} disabled={testLoading}>
              <Play className="h-4 w-4 mr-1" />
              {testLoading ? "执行中..." : "测试"}
            </Button>
          </div>
          {testResult && (
            <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-auto max-h-64">{testResult}</pre>
          )}
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
