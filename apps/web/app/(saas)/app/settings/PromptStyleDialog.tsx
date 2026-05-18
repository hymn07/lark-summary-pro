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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@repo/ui/components/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Sparkles, CheckCircle2, Upload, FileText, Settings2 } from "lucide-react";
import { useState, useRef } from "react";

export function PromptStyleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: versions, isLoading } = useQuery(orpc.prompts.list.queryOptions());
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<"ai" | "manual">("ai");
  const [newName, setNewName] = useState("");
  const [samples, setSamples] = useState(["", "", ""]);
  const [manualPrompt, setManualPrompt] = useState("");
  const [styleDesc, setStyleDesc] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const createMutation = useMutation(
    orpc.prompts.create.mutationOptions({
      onSuccess: (data: Record<string, unknown>) => {
        toast.success(`"${data.name}" 已创建`);
        setShowCreate(false); setNewName(""); setSamples(["", "", ""]); setManualPrompt(""); setStyleDesc("");
        queryClient.invalidateQueries({ queryKey: orpc.prompts.list.queryKey() });
      },
      onError: () => toast.error("创建失败"),
    }),
  );

  const deleteMutation = useMutation(
    orpc.prompts.delete.mutationOptions({
      onSuccess: () => { toast.success("已删除"); queryClient.invalidateQueries({ queryKey: orpc.prompts.list.queryKey() }); },
    }),
  );

  const activateMutation = useMutation(
    orpc.prompts.activate.mutationOptions({
      onSuccess: () => { toast.success("已切换"); queryClient.invalidateQueries({ queryKey: orpc.prompts.list.queryKey() }); },
    }),
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { const text = await file.text(); const u = [...samples]; u[index] = text; setSamples(u); }
    catch { toast.error("文件读取失败"); }
  };

  const handleCreate = () => {
    if (!newName.trim()) { toast.error("请填写风格名称"); return; }
    if (createMode === "ai") {
      const valid = samples.filter((s) => s.trim());
      if (valid.length === 0) { toast.error("请粘贴或上传至少一篇示例"); return; }
      createMutation.mutate({ name: newName, sampleContents: valid });
    } else {
      if (!manualPrompt.trim()) { toast.error("请填写 Prompt 内容"); return; }
      createMutation.mutate({ name: newName, corePrompt: manualPrompt, styleDescription: styleDesc || null });
    }
  };

  const versionList = (versions as unknown[]) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />管理纪要风格
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <Button variant="outline" onClick={() => setShowCreate(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />创建新风格
          </Button>

          {/* Create dialog (nested) */}
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />创建新风格</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button variant={createMode === "ai" ? "primary" : "outline"} size="sm" onClick={() => setCreateMode("ai")}><Sparkles className="h-3 w-3 mr-1" />AI 学习生成</Button>
                  <Button variant={createMode === "manual" ? "primary" : "outline"} size="sm" onClick={() => setCreateMode("manual")}><FileText className="h-3 w-3 mr-1" />手动编写</Button>
                </div>
                <div>
                  <Label>风格名称</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="如：简洁版、技术评审版" />
                </div>
                {createMode === "ai" ? (
                  <div>
                    <Label>上传 1-3 篇示例纪要</Label>
                    <p className="text-sm text-gray-500 mb-2">粘贴文本或上传文件，AI 将学习写作风格</p>
                    {samples.map((s, i) => (
                      <div key={i} className="mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-400">示例 {i + 1}</span>
                          <button type="button" className="text-xs text-blue-600 hover:underline flex items-center gap-1" onClick={() => fileRef.current?.click()}>
                            <Upload className="h-3 w-3" />上传
                            <input ref={fileRef} type="file" accept=".txt,.md" className="hidden" onChange={(ev) => { handleFileUpload(ev, i); ev.target.value = ""; }} />
                          </button>
                        </div>
                        <Textarea value={s} onChange={(ev) => { const u = [...samples]; u[i] = ev.target.value; setSamples(u); }} placeholder={`粘贴第 ${i + 1} 篇...`} rows={4} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div>
                      <Label>Prompt 内容</Label>
                      <Textarea value={manualPrompt} onChange={(e) => setManualPrompt(e.target.value)} placeholder="直接编写 System Prompt..." rows={6} />
                    </div>
                    <div>
                      <Label>风格描述（可选，展示给用户确认）</Label>
                      <Input value={styleDesc} onChange={(e) => setStyleDesc(e.target.value)} placeholder="如：简洁分点式，偏重技术细节" />
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}><Sparkles className="h-4 w-4 mr-1" />{createMutation.isPending ? "生成中..." : createMode === "ai" ? "AI 学习生成" : "保存"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Version list */}
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-5 w-32 mb-2" /><Skeleton className="h-4 w-48" /></CardContent></Card>)}
            </div>
          ) : versionList.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">还没有创建纪要风格</p>
          ) : (
            <div className="space-y-2">
              {versionList.map((v: Record<string, unknown>) => (
                <Card key={v.id as string}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="font-medium text-sm truncate">{v.name as string}</h4>
                        {v.isActive && <Badge className="bg-green-100 text-green-700 text-xs"><CheckCircle2 className="h-3 w-3 mr-0.5" />当前使用</Badge>}
                        {v.isDefault && <Badge status="info" className="text-xs">默认</Badge>}
                      </div>
                      {v.styleDescription && <p className="text-xs text-gray-500 truncate">{(v.styleDescription as string).slice(0, 80)}</p>}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {!v.isActive && <Button variant="outline" size="sm" onClick={() => activateMutation.mutate({ id: v.id as string })}>使用</Button>}
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate({ id: v.id as string })}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
