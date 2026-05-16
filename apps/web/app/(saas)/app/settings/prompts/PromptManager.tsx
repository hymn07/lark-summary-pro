"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { Badge } from "@repo/ui/components/badge";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "sonner";
import { Plus, Trash2, Sparkles, CheckCircle2, X } from "lucide-react";
import { useState } from "react";

export function PromptManager() {
  const queryClient = useQueryClient();
  const { data: versions, isLoading } = useQuery(orpc.prompts.list.queryOptions());

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [samples, setSamples] = useState(["", "", ""]);

  const createMutation = useMutation(
    orpc.prompts.create.mutationOptions({
      onSuccess: (data: Record<string, unknown>) => {
        toast.success(`风格版本 "${data.name}" 已创建`);
        setShowCreate(false);
        setNewName("");
        setSamples(["", "", ""]);
        queryClient.invalidateQueries({ queryKey: ["prompts", "list"] });
      },
      onError: () => toast.error("创建失败，请重试"),
    }),
  );

  const deleteMutation = useMutation(
    orpc.prompts.delete.mutationOptions({
      onSuccess: () => {
        toast.success("版本已删除");
        queryClient.invalidateQueries({ queryKey: ["prompts", "list"] });
      },
    }),
  );

  const activateMutation = useMutation(
    orpc.prompts.activate.mutationOptions({
      onSuccess: () => {
        toast.success("已切换风格版本");
        queryClient.invalidateQueries({ queryKey: ["prompts", "list"] });
      },
    }),
  );

  const handleCreate = () => {
    const validSamples = samples.filter((s) => s.trim());
    if (!newName.trim() || validSamples.length === 0) {
      toast.error("请填写版本名称和至少一篇示例");
      return;
    }
    createMutation.mutate({ name: newName, sampleContents: validSamples });
  };

  if (isLoading) return <PromptSkeleton />;

  const versionList = (versions as unknown[]) ?? [];

  return (
    <div className="space-y-6 max-w-2xl">
      <Button onClick={() => setShowCreate(!showCreate)}>
        <Plus className="h-4 w-4 mr-1" />
        创建新版本
      </Button>

      {/* 创建表单（举一反三） */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              举一反三 — 创建新风格
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>版本名称</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="如：简洁版、技术评审版"
                className="mt-1"
              />
            </div>
            <div>
              <Label>上传 1-3 篇示例会议纪要</Label>
              <p className="text-sm text-gray-500 mb-2">
                粘贴会议纪要的完整文本，AI 将学习写作风格
              </p>
              {samples.map((sample, i) => (
                <div key={i} className="mb-2">
                  <p className="text-xs text-gray-400 mb-1">示例 {i + 1}</p>
                  <Textarea
                    value={sample}
                    onChange={(e) => {
                      const updated = [...samples];
                      updated[i] = e.target.value;
                      setSamples(updated);
                    }}
                    placeholder={`粘贴第 ${i + 1} 篇会议纪要...`}
                    rows={4}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                <Sparkles className="h-4 w-4 mr-1" />
                {createMutation.isPending ? "生成中..." : "生成"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                <X className="h-4 w-4 mr-1" />
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 版本列表 */}
      <div className="space-y-3">
        {versionList.length === 0 ? (
          <p className="text-gray-500 text-center py-8">还没有 Prompt 版本，点击上方按钮创建</p>
        ) : (
          versionList.map((v: Record<string, unknown>) => (
            <Card key={v.id as string}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">{v.name as string}</h3>
                    {v.isActive ? (
                      <Badge className="bg-green-100 text-green-700">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        当前使用
                      </Badge>
                    ) : null}
                    {v.isDefault ? (
                      <Badge variant="outline">默认</Badge>
                    ) : null}
                  </div>
                  {v.styleDescription ? (
                    <p className="text-sm text-gray-500">
                      {(v.styleDescription as string).slice(0, 100)}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {!v.isActive ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => activateMutation.mutate({ id: v.id as string })}
                    >
                      使用
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate({ id: v.id as string })}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function PromptSkeleton() {
  return (
    <div className="space-y-3 max-w-2xl">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
