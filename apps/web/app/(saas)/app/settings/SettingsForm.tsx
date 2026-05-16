"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Switch } from "@repo/ui/components/switch";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/select";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export function SettingsForm() {
  const { data: settings, isLoading } = useQuery(
    orpc.settings.get.queryOptions(),
  );
  const { data: prompts } = useQuery(orpc.prompts.list.queryOptions());

  const [autoEnabled, setAutoEnabled] = useState(true);
  const [saveFolderToken, setSaveFolderToken] = useState("");
  const [exclusionRules, setExclusionRules] = useState<string[]>([]);
  const [newExclusionRule, setNewExclusionRule] = useState("");
  const [specialReqs, setSpecialReqs] = useState<{ topic: string; focus: string }[]>([]);
  const [newReqTopic, setNewReqTopic] = useState("");
  const [newReqFocus, setNewReqFocus] = useState("");
  const [activeVersionId, setActiveVersionId] = useState<string>("");

  // 加载已有设置
  useState(() => {
    if (settings) {
      setAutoEnabled((settings as Record<string, unknown>).autoEnabled as boolean ?? true);
      setSaveFolderToken((settings as Record<string, unknown>).saveFolderToken as string ?? "");
      setExclusionRules((settings as Record<string, unknown>).exclusionRules as string[] ?? []);
      setSpecialReqs((settings as Record<string, unknown>).specialRequirements as { topic: string; focus: string }[] ?? []);
      setActiveVersionId((settings as Record<string, unknown>).activePromptVersionId as string ?? "");
    }
  });

  const updateMutation = useMutation(orpc.settings.update.mutationOptions());

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        autoEnabled,
        saveFolderToken: saveFolderToken || null,
        exclusionRules,
        specialRequirements: specialReqs,
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

      {/* 排除规则 */}
      <Card>
        <CardHeader>
          <CardTitle>排除规则</CardTitle>
          <p className="text-sm text-gray-500">命中以下规则的会议将自动跳过，不生成纪要</p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3">
            <Input
              value={newExclusionRule}
              onChange={(e) => setNewExclusionRule(e.target.value)}
              placeholder='如"关于年会的会议"'
            />
            <Button
              variant="outline"
              onClick={() => {
                if (newExclusionRule.trim()) {
                  setExclusionRules([...exclusionRules, newExclusionRule.trim()]);
                  setNewExclusionRule("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {exclusionRules.map((rule, i) => (
            <div key={i} className="flex items-center gap-2 py-1 text-sm">
              <span className="flex-1">{rule}</span>
              <button
                type="button"
                onClick={() => setExclusionRules(exclusionRules.filter((_, j) => j !== i))}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 特殊要求 */}
      <Card>
        <CardHeader>
          <CardTitle>特殊要求</CardTitle>
          <p className="text-sm text-gray-500">针对特定话题的会议，需要重点关注的内容</p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3">
            <Input
              value={newReqTopic}
              onChange={(e) => setNewReqTopic(e.target.value)}
              placeholder="话题（如：融资、合作）"
              className="flex-1"
            />
            <Input
              value={newReqFocus}
              onChange={(e) => setNewReqFocus(e.target.value)}
              placeholder="重点关注（如：技术细节）"
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={() => {
                if (newReqTopic.trim() && newReqFocus.trim()) {
                  setSpecialReqs([...specialReqs, { topic: newReqTopic.trim(), focus: newReqFocus.trim() }]);
                  setNewReqTopic("");
                  setNewReqFocus("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {specialReqs.map((req, i) => (
            <div key={i} className="flex items-center gap-2 py-1 text-sm">
              <span className="flex-1">
                话题 <strong>{req.topic}</strong> → 重点关注 <strong>{req.focus}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSpecialReqs(specialReqs.filter((_, j) => j !== i))}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
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
      {Array.from({ length: 5 }).map((_, i) => (
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
