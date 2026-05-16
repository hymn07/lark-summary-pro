"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { toast } from "sonner";
import { Trash2, Plus, X } from "lucide-react";
import { useState } from "react";

export function ModelProviderList({
  initialProviders,
}: {
  initialProviders: Array<{
    id: string;
    name: string;
    apiBase: string;
    models: unknown;
    createdAt: Date;
  }>;
}) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", apiBase: "", apiKey: "", models: "" });

  const createMutation = useMutation(
    orpc.larkAdmin.modelProviders.create.mutationOptions({
      onSuccess: () => {
        toast.success("提供商已添加");
        setShowCreate(false);
        setForm({ name: "", apiBase: "", apiKey: "", models: "" });
        queryClient.invalidateQueries({ queryKey: ["larkAdmin", "modelProviders", "list"] });
      },
      onError: () => toast.error("添加失败"),
    }),
  );

  const deleteMutation = useMutation(
    orpc.larkAdmin.modelProviders.delete.mutationOptions({
      onSuccess: () => {
        toast.success("已删除");
        queryClient.invalidateQueries({ queryKey: ["larkAdmin", "modelProviders", "list"] });
      },
    }),
  );

  const handleCreate = () => {
    if (!form.name || !form.apiBase || !form.apiKey) {
      toast.error("请填写名称、API Base 和 API Key");
      return;
    }
    const modelList = form.models
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    createMutation.mutate({
      name: form.name,
      apiBase: form.apiBase,
      apiKey: form.apiKey,
      models: modelList,
    });
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <Button onClick={() => setShowCreate(!showCreate)}>
        <Plus className="h-4 w-4 mr-1" />
        添加提供商
      </Button>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>添加模型提供商</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>名称</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="如：OpenAI、Anthropic"
              />
            </div>
            <div>
              <Label>API Base URL</Label>
              <Input
                value={form.apiBase}
                onChange={(e) => setForm({ ...form, apiBase: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
            </div>
            <div>
              <Label>API Key</Label>
              <Input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder="sk-..."
              />
            </div>
            <div>
              <Label>模型列表（逗号分隔）</Label>
              <Input
                value={form.models}
                onChange={(e) => setForm({ ...form, models: e.target.value })}
                placeholder="gpt-4o, gpt-4o-mini"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "添加中..." : "保存"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                <X className="h-4 w-4 mr-1" />取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {initialProviders.map((p) => {
          const modelList = (p.models as string[]) ?? [];
          return (
            <Card key={p.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-gray-500">{p.apiBase}</p>
                  <div className="flex gap-1 mt-1">
                    {modelList.map((m: string) => (
                      <span key={m} className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMutation.mutate({ id: p.id })}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {initialProviders.length === 0 && (
          <p className="text-gray-500 text-center py-8">还没有模型提供商</p>
        )}
      </div>
    </div>
  );
}
