"use client";

import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { Badge } from "@repo/ui/components/badge";
import { toast } from "sonner";
import { Sparkles, CheckCircle2, Upload, FileText } from "lucide-react";
import { useState, useRef } from "react";

export function AdminPromptManager({
  initialPrompt,
}: {
  initialPrompt: { id: string; name: string; styleDescription: string | null } | null;
}) {
  const [current, setCurrent] = useState(initialPrompt);
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<"ai" | "manual">("ai");
  const [newName, setNewName] = useState("");
  const [samples, setSamples] = useState(["", "", ""]);
  const [manualPrompt, setManualPrompt] = useState("");
  const [styleDesc, setStyleDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const updated = [...samples];
      updated[index] = text;
      setSamples(updated);
    } catch {
      toast.error("文件读取失败");
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("请填写版本名称");
      return;
    }
    setLoading(true);
    try {
      let body: Record<string, unknown>;

      if (createMode === "ai") {
        const validSamples = samples.filter((s) => s.trim());
        if (validSamples.length === 0) { toast.error("请粘贴或上传至少一篇示例"); setLoading(false); return; }
        body = { name: newName, sampleContents: validSamples };
      } else {
        if (!manualPrompt.trim()) { toast.error("请填写 Prompt 内容"); setLoading(false); return; }
        body = { name: newName, corePrompt: manualPrompt, styleDescription: styleDesc || null };
      }

      const res = await fetch("/api/rpc/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/larkAdmin/prompt/setDefault", body }),
      });
      const json = await res.json();
      console.log("Prompt 创建响应:", json);

      if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = json.result ?? json;
      toast.success("默认 Prompt 已创建");
      setCurrent({ id: data.id, name: data.name, styleDescription: data.styleDescription });
      setShowCreate(false);
      setNewName("");
      setSamples(["", "", ""]);
      setManualPrompt("");
      setStyleDesc("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "未知错误";
      console.error("创建 Prompt 失败:", msg);
      toast.error(`创建失败: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {current ? (
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium">{current.name}</h3>
                <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="h-3 w-3 mr-1" />当前</Badge>
              </div>
              {current.styleDescription && <p className="text-sm text-gray-500">{current.styleDescription}</p>}
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
            <h3 className="font-medium">{current ? "替换" : "创建"}公司默认风格</h3>

            {/* 模式切换 */}
            <div className="flex gap-2">
              <Button variant={createMode === "ai" ? "default" : "outline"} size="sm" onClick={() => setCreateMode("ai")}>
                <Sparkles className="h-3 w-3 mr-1" />AI 学习生成
              </Button>
              <Button variant={createMode === "manual" ? "default" : "outline"} size="sm" onClick={() => setCreateMode("manual")}>
                <FileText className="h-3 w-3 mr-1" />手动编写
              </Button>
            </div>

            <div>
              <Label>版本名称</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="如：标准版、详尽版" />
            </div>

            {createMode === "ai" ? (
              <div>
                <Label>上传 1-3 篇示例纪要</Label>
                <p className="text-sm text-gray-500 mb-2">粘贴文本或上传文件，AI 将学习写作风格</p>
                {samples.map((sample, i) => (
                  <div key={i} className="mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400">示例 {i + 1}</span>
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        onClick={() => fileRef.current?.click()}
                      >
                        <Upload className="h-3 w-3" />上传文件
                        <input
                          ref={fileRef}
                          type="file"
                          accept=".txt,.md,.docx,.pdf"
                          className="hidden"
                          onChange={(ev) => { handleFileUpload(ev, i); ev.target.value = ""; }}
                        />
                      </button>
                    </div>
                    <Textarea
                      value={sample}
                      onChange={(ev) => { const u = [...samples]; u[i] = ev.target.value; setSamples(u); }}
                      placeholder={`粘贴第 ${i + 1} 篇会议纪要...`}
                      rows={4}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div>
                  <Label>Prompt 内容（System Prompt）</Label>
                  <Textarea
                    value={manualPrompt}
                    onChange={(e) => setManualPrompt(e.target.value)}
                    placeholder="直接编写 Prompt，告诉 AI 如何生成会议纪要..."
                    rows={6}
                  />
                </div>
                <div>
                  <Label>风格描述（可选，展示给用户）</Label>
                  <Input
                    value={styleDesc}
                    onChange={(e) => setStyleDesc(e.target.value)}
                    placeholder="如：简洁分点式，偏重技术细节"
                  />
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={loading}>
                <Sparkles className="h-4 w-4 mr-1" />
                {loading ? "生成中..." : createMode === "ai" ? "AI 学习生成" : "保存"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
