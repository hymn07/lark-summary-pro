"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/select";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export function SettingsForm() {
  const { data: settings, isLoading } = useQuery(
    orpc.settings.get.queryOptions(),
  );
  const { data: prompts } = useQuery(orpc.prompts.list.queryOptions());

  const [autoEnabled, setAutoEnabled] = useState(true);
  const [extraInstructions, setExtraInstructions] = useState("");
  const [saveFolderToken, setSaveFolderToken] = useState("");
  const [activeVersionId, setActiveVersionId] = useState<string>("");

  // 加载已有设置
  useState(() => {
    if (settings) {
      setAutoEnabled((settings as Record<string, unknown>).autoEnabled as boolean ?? true);
      setExtraInstructions((settings as Record<string, unknown>).extraInstructions as string ?? "");
      setSaveFolderToken((settings as Record<string, unknown>).saveFolderToken as string ?? "");
      setActiveVersionId((settings as Record<string, unknown>).activePromptVersionId as string ?? "");
    }
  });

  const updateMutation = useMutation(orpc.settings.update.mutationOptions());

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        autoEnabled,
        extraInstructions: extraInstructions || null,
        saveFolderToken: saveFolderToken || null,
        activePromptVersionId: activeVersionId || null,
      });
      toast.success("设置已保存");
    } catch {
      toast.error("保存失败，请重试");
    }
  };

  if (isLoading) return <SettingsSkeleton />;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 自动纪要开关 */}
      <Card>
        <CardHeader>
          <CardTitle>自动会议纪要</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-gray-500">会议结束后自动生成纪要</p>
          <Switch checked={autoEnabled} onCheckedChange={setAutoEnabled} />
        </CardContent>
      </Card>

      {/* 额外指令 */}
      <Card>
        <CardHeader>
          <CardTitle>额外指令</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={extraInstructions}
            onChange={(e) => setExtraInstructions(e.target.value)}
            placeholder='可以告诉 AI 哪些会议要跳过、哪些话题要重点关注。比如："排除关于年会的会议"、"涉及融资话题时重点关注估值和条款"'
            rows={5}
          />
        </CardContent>
      </Card>

      {/* 保存位置 */}
      <Card>
        <CardHeader>
          <CardTitle>保存位置</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>飞书文件夹 Token</Label>
          <Input
            value={saveFolderToken}
            onChange={(e) => setSaveFolderToken(e.target.value)}
            placeholder="留空则保存到根目录"
            className="mt-1"
          />
        </CardContent>
      </Card>

      {/* Prompt 版本选择 */}
      <Card>
        <CardHeader>
          <CardTitle>纪要风格</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={activeVersionId} onValueChange={setActiveVersionId}>
            <SelectTrigger>
              <SelectValue placeholder="选择 Prompt 版本" />
            </SelectTrigger>
            <SelectContent>
              {(prompts as unknown[] ?? []).map((p: Record<string, unknown>) => (
                <SelectItem key={p.id as string} value={p.id as string}>
                  {p.name as string}
                  {p.styleDescription ? ` — ${p.styleDescription}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link href="/app/settings/prompts" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
            管理 Prompt 版本 →
          </Link>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={updateMutation.isPending}>
        <Save className="h-4 w-4 mr-1" />
        {updateMutation.isPending ? "保存中..." : "保存设置"}
      </Button>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6 max-w-2xl">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
