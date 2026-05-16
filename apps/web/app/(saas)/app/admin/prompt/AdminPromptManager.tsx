"use client";

import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { Badge } from "@repo/ui/components/badge";
import { toast } from "sonner";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export function AdminPromptManager({
  initialPrompt,
}: {
  initialPrompt: { id: string; name: string; styleDescription: string | null } | null;
}) {
  const [current, setCurrent] = useState(initialPrompt);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [samples, setSamples] = useState(["", "", ""]);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    const validSamples = samples.filter((s) => s.trim());
    if (!newName.trim() || validSamples.length === 0) {
      toast.error("请填写名称和至少一篇示例");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "/larkAdmin/prompt/setDefault",
          body: { name: newName, sampleContents: validSamples },
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      const data = json.result ?? json;
      toast.success("默认 Prompt 已创建");
      setCurrent({ id: data.id, name: data.name, styleDescription: data.styleDescription });
      setShowCreate(false);
      setNewName("");
      setSamples(["", "", ""]);
    } catch (e) {
      toast.error("创建失败");
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
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="如：标准版、详尽版" />
            </div>
            <div>
              <Label>上传 1-3 篇示例纪要</Label>
              {samples.map((sample, i) => (
                <div key={i} className="mb-2">
                  <p className="text-xs text-gray-400 mb-1">示例 {i + 1}</p>
                  <Textarea
                    value={sample}
                    onChange={(e) => { const u = [...samples]; u[i] = e.target.value; setSamples(u); }}
                    placeholder={`粘贴第 ${i + 1} 篇...`}
                    rows={4}
                  />
                </div>
              ))}
            </div>
            <Button onClick={handleCreate} disabled={loading}>
              <Sparkles className="h-4 w-4 mr-1" />
              {loading ? "生成中..." : "生成"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
