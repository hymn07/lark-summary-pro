"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { orpcClient } from "@shared/lib/orpc-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@repo/ui/components/card";
import { Button } from "@repo/ui/components/button";
import { Badge } from "@repo/ui/components/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@repo/ui/components/dialog";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "sonner";
import {
  Clock,
  Users,
  Video,
  ExternalLink,
  CheckCircle2,
  SkipForward,
  AlertCircle,
  Loader2,
  Sparkles,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";

const statusConfig = {
  completed: { label: "已完成", color: "bg-green-100 text-green-700", Icon: CheckCircle2 },
  processing: { label: "处理中", color: "bg-blue-100 text-blue-700", Icon: Loader2 },
  failed: { label: "失败", color: "bg-red-100 text-red-700", Icon: AlertCircle },
  skipped: { label: "已跳过", color: "bg-gray-100 text-gray-600", Icon: SkipForward },
} as const;

export function MeetingDetailDialog({
  id,
  open,
  onOpenChange,
}: {
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(
    id && open
      ? orpc.meetings.feishuDetail.queryOptions({ input: { id } })
      : { queryKey: ["skip"], queryFn: () => null, enabled: false },
  );
  const [generating, setGenerating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteMeetingMutation = useMutation({
    mutationFn: (opts: { id: string; deleteRecords: boolean }) =>
      orpcClient.meetings.deleteFeishu(opts),
    onSuccess: () => {
      toast.success("已删除");
      queryClient.invalidateQueries({ queryKey: orpc.meetings.feishuList.queryKey() });
      onOpenChange(false);
    },
    onError: () => toast.error("删除失败"),
  });

  const generateMutation = useMutation({
    mutationFn: (meetingId: string) => orpcClient.meetings.generate({ feishuMeetingId: meetingId }),
    onSuccess: () => {
      toast.success("纪要生成完成");
      queryClient.invalidateQueries({ queryKey: orpc.meetings.feishuDetail.queryKey({ input: { id: id! } }) });
    },
    onError: (e) => toast.error(`生成失败: ${e instanceof Error ? e.message : "未知错误"}`),
  });

  const m = data as Record<string, unknown> | null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4 p-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !m ? (
          <div className="text-center py-8 text-gray-500">会议不存在</div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                {m.topic as string ?? "未命名会议"}
                <Badge className={(m.source as string) === "feishu" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}>
                  {(m.source as string) === "feishu" ? "飞书会议" : "手动上传"}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 mt-2">
              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                {m.startTime && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(m.startTime as string).toLocaleString("zh-CN", {
                      month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                    {m.endTime && ` - ${new Date(m.endTime as string).toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {(m.participantCount as number) ?? 0} 人
                </span>
              </div>

              {/* Participants */}
              {((m.participantsJson as unknown[])?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(m.participantsJson as Array<{ userName: string; isHost: boolean }>).map((p, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                        p.isHost ? "bg-blue-100 text-blue-700 font-medium" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {p.userName ?? "未知"}
                      {p.isHost && "（主持）"}
                    </span>
                  ))}
                </div>
              )}

              {/* Links */}
              <div className="flex gap-4">
                {m.noteDocToken && (
                  <a href={`https://bytedance.feishu.cn/minutes/${m.noteDocToken}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                    <Video className="h-4 w-4" />妙记回放
                  </a>
                )}
                {(m.meetingUrl || (m.source === "feishu" && m.meetingNo)) && (
                  <a
                    href={(m.meetingUrl as string) || `https://vc.feishu.cn/j/${m.meetingNo}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />会议链接
                  </a>
                )}
              </div>

              <hr />

              {/* Minutes section */}
              <div>
                <h3 className="font-semibold mb-3">会议纪要</h3>
                {((m.meetingRecords as unknown[])?.length ?? 0) === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">还没有生成纪要</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-3 rounded-lg border bg-gray-50 p-4">
                    {(m.meetingRecords as Array<Record<string, unknown>>).map((r) => {
                      const st = (r.status as string) ?? "processing";
                      const cfg = statusConfig[st as keyof typeof statusConfig] ?? statusConfig.processing;
                      const Icon = cfg.Icon;
                      return (
                        <Card key={r.id as string}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={cfg.color}>
                                <Icon className="h-3 w-3 mr-1" />
                                {cfg.label}
                              </Badge>
                              <span className="text-xs text-gray-400">
                                {r.createdAt ? new Date(r.createdAt as string).toLocaleString("zh-CN") : ""}
                              </span>
                            </div>

                            {st === "processing" && (
                              <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                AI 正在生成纪要...
                              </div>
                            )}

                            {(r.aiSummary as string) && (
                              <div className="mb-2">
                                <p className="text-sm font-medium mb-1">摘要</p>
                                <p className="text-sm text-gray-600">{r.aiSummary as string}</p>
                              </div>
                            )}

                            {(r.errorMessage as string) && (
                              <div className="mb-2">
                                <p className="text-sm font-medium text-red-600 mb-1">错误</p>
                                <p className="text-sm text-red-600">{r.errorMessage as string}</p>
                              </div>
                            )}

                            {(r.skippedReason as string) && (
                              <div className="mb-2">
                                <p className="text-sm font-medium mb-1">跳过原因</p>
                                <p className="text-sm text-gray-500">{r.skippedReason as string}</p>
                              </div>
                            )}

                            {r.docUrl && (
                              <a href={r.docUrl as string} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                                <ExternalLink className="h-3 w-3" />打开纪要文档
                              </a>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Generate + Delete buttons */}
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  disabled={generating}
                  onClick={() => {
                    setGenerating(true);
                    generateMutation.mutate(id!, { onSettled: () => setGenerating(false) });
                  }}
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  {generating ? "生成中..." : "生成纪要"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="h-4 w-4 mr-1" />删除
                </Button>
              </div>

              <hr />

              {/* Transcript section — below minutes, fixed height scrollable */}
              <div>
                <h3 className="font-semibold mb-3">逐字稿</h3>
                {m.transcriptText ? (
                  <div className="max-h-48 overflow-y-auto rounded-lg border bg-gray-50 p-4">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                      {m.transcriptText as string}
                    </pre>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm text-center py-8">暂无逐字稿</p>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>

      {/* Delete confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />确认删除
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            该会议有 {((m?.meetingRecords as unknown[])?.length ?? 0)} 条关联纪要。是否同时删除？
          </p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => { setShowDeleteConfirm(false); deleteMeetingMutation.mutate({ id: id!, deleteRecords: false }); }}>
              保留纪要
            </Button>
            <Button variant="primary" size="sm" onClick={() => { setShowDeleteConfirm(false); deleteMeetingMutation.mutate({ id: id!, deleteRecords: true }); }}>
              全部删除
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>取消</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
