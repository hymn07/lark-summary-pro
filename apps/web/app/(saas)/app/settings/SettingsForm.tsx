"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { orpcClient } from "@shared/lib/orpc-client";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@repo/ui/components/dialog";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "sonner";
import { FolderOpen, Save, Settings2 } from "lucide-react";
import { useState, useEffect } from "react";
import { PromptStyleDialog } from "./PromptStyleDialog";

export function SettingsForm() {
  const { data: settings, isLoading } = useQuery(
    orpc.settings.get.queryOptions(),
  );

  const [autoEnabled, setAutoEnabled] = useState(true);
  const [extraInstructions, setExtraInstructions] = useState("");
  const [saveFolderToken, setSaveFolderToken] = useState("");
  const [showStyleDialog, setShowStyleDialog] = useState(false);

  // 加载已有设置
  useState(() => {
    if (settings) {
      setAutoEnabled((settings as Record<string, unknown>).autoEnabled as boolean ?? true);
      setExtraInstructions((settings as Record<string, unknown>).extraInstructions as string ?? "");
      setSaveFolderToken((settings as Record<string, unknown>).saveFolderToken as string ?? "");
    }
  });

  const updateMutation = useMutation(orpc.settings.update.mutationOptions());

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        autoEnabled,
        extraInstructions: extraInstructions || null,
        saveFolderToken: saveFolderToken || null,
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

      {/* 纪要风格 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>纪要风格</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowStyleDialog(true)}>
              <Settings2 className="h-4 w-4 mr-1" />管理纪要风格
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* 保存位置 */}
      <Card>
        <CardHeader>
          <CardTitle>保存位置</CardTitle>
        </CardHeader>
        <CardContent>
          <FolderPicker token={saveFolderToken} onSelect={setSaveFolderToken} />
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={updateMutation.isPending}>
        <Save className="h-4 w-4 mr-1" />
        {updateMutation.isPending ? "保存中..." : "保存设置"}
      </Button>

      <PromptStyleDialog open={showStyleDialog} onOpenChange={setShowStyleDialog} />
    </div>
  );
}

function FolderPicker({ token, onSelect }: { token: string; onSelect: (token: string) => void }) {
  const [show, setShow] = useState(false);
  const [folders, setFolders] = useState<Array<{ token: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);

  const loadFolders = async () => {
    setLoading(true);
    try {
      const data = await orpcClient.settings.listFolders({}) as Array<{ token: string; name: string; type: string }>;
      setFolders(data.filter((f) => f.type === "folder"));
    } catch {
      toast.error("获取文件夹列表失败，请确保已登录飞书");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (show) loadFolders(); }, [show]);

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 flex-1 truncate">
          {token ? `已选择文件夹: ${token}` : "未选择（默认保存到根目录）"}
        </span>
        <Button variant="outline" size="sm" onClick={() => setShow(true)}>
          <FolderOpen className="h-4 w-4 mr-1" />选择文件夹
        </Button>
        {token && (
          <Button variant="ghost" size="sm" onClick={() => onSelect("")}>
            清除
          </Button>
        )}
      </div>

      <Dialog open={show} onOpenChange={setShow}>
        <DialogContent className="max-w-md max-h-[60vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>选择保存文件夹</DialogTitle>
          </DialogHeader>
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">加载中...</p>
          ) : folders.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>没有找到文件夹</p>
              <p className="text-xs mt-1">请先在飞书中创建文件夹</p>
            </div>
          ) : (
            <div className="space-y-1">
              <button
                type="button"
                className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-gray-100 ${!token ? "bg-blue-50 text-blue-700" : ""}`}
                onClick={() => { onSelect(""); setShow(false); }}
              >
                📁 根目录（默认）
              </button>
              {folders.map((f) => (
                <button
                  key={f.token}
                  type="button"
                  className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-gray-100 truncate ${token === f.token ? "bg-blue-50 text-blue-700" : ""}`}
                  onClick={() => { onSelect(f.token); setShow(false); }}
                >
                  📁 {f.name}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
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
