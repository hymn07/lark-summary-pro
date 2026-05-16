"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { Badge } from "@repo/ui/components/badge";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "sonner";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export function AdminPromptManager({
  initialPrompt,
}: {
  initialPrompt: { id: string; name: string; styleDescription: string | null; isActive: boolean } | null;
}) {
  const queryClient = useQueryClient();
  const { data: prompt } = useQuery(
    orpc.larkAdmin.prompt.getDefault.queryOptions(),
    { initialData: initialPrompt },
  );

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [samples, setSamples] = useState(["", "", ""]);

  const createMutation = useMutation(
    orpc.larkAdmin.prompt.setDefault.mutationOptions({
      onSuccess: (data: Record<string, unknown>) => {
        toast.success(`默认 Prompt "${data.name}" 已创建`);
        setShowCreate(false);
        setNewName("");
        setSamples(["", "", ""]);
        queryClient.invalidateQueries({ queryKey: ["larkAdmin", "prompt", "getDefault"] });
      },
      onError: () => toast.error("创建失败"),
    }),
  );

  const handleCreate = () => {
    const validSamples = samples.filter((s) => s.trim());
    if (!newName.trim() || validSamples.length === 0) {
      toast.error("请填写名称和至少一篇示例");
      return;
    }
    createMutation.mutate({ name: newName, sampleContents: validSamples });
  };

  const current = prompt as { id: string; name: string; styleDescription: string | null; isActive: boolean } | null;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 当前默认 Prompt */}
      {current ? (
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium">{current.name}</h3>
                <Badge className="bg-green-100 text-green-700">
                  <CheckCircle2 className="h-3 w-3 mr-1" />当前
                </Badge>
              </div>
              {current.styleDescription ? (
                <p className="text-sm text-gray-500">{current.styleDescription}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="text-gray-500">还没有设置默认 Prompt</p>
      )}

      <Button onClick={() => setShowCreate(!showCreate)}>
        <Sparkles className="h-4 w-4 mr-1" />
        {current ? "替换默认 Prompt" : "创建默认 Prompt"}
      </Button>

      {showCreate && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-medium">举一反三 — 创建公司默认风格</h3>
            <div>
              <Label>版本名称</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="如：标准版、详尽版"
              />
            </div>
            <div>
              <Label>上传 1-3 篇示例纪要</Label>
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
                    placeholder={`粘贴第 ${i + 1} 篇...`}
                    rows={4}
                  />
                </div>
              ))}
            </div>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              <Sparkles className="h-4 w-4 mr-1" />
              {createMutation.isPending ? "生成中..." : "生成"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
