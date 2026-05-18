"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { orpcClient } from "@shared/lib/orpc-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@repo/ui/components/button";
import { Badge } from "@repo/ui/components/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@repo/ui/components/dialog";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "sonner";
import {
  CheckCircle2,
  SkipForward,
  AlertCircle,
  Loader2,
  ExternalLink,
  Clock,
  ArrowRight,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { MeetingDetailDialog } from "./meetings/MeetingDetailDialog";

const statusConfig = {
  completed: { label: "已完成", color: "bg-green-100 text-green-700", Icon: CheckCircle2 },
  processing: { label: "处理中", color: "bg-blue-100 text-blue-700", Icon: Loader2 },
  failed: { label: "失败", color: "bg-red-100 text-red-700", Icon: AlertCircle },
  skipped: { label: "已跳过", color: "bg-gray-100 text-gray-600", Icon: SkipForward },
} as const;

export function MinutesDetailDialog({
  id,
  open,
  onOpenChange,
}: {
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery(
    id && open
      ? orpc.meetings.get.queryOptions({ input: { id } })
      : { queryKey: ["skip"], queryFn: () => null, enabled: false },
  );
  const queryClient = useQueryClient();
  const [sourceMeetingId, setSourceMeetingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteRecordMutation = useMutation({
    mutationFn: (recordId: string) => orpcClient.meetings.deleteRecord({ id: recordId }),
    onSuccess: () => {
      toast.success("纪要已删除");
      queryClient.invalidateQueries({ queryKey: orpc.meetings.list.queryKey() });
      onOpenChange(false);
    },
    onError: () => toast.error("删除失败"),
  });

  const r = data as Record<string, unknown> | null;
  const feishuMeeting = r?.feishuMeeting as Record<string, unknown> | null | undefined;
  const fmDbId = feishuMeeting?.id as string | undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4 p-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : !r ? (
            <div className="text-center py-8 text-gray-500">纪要不存在</div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg flex items-center gap-2">
                  {(() => {
                    const st = (r.status as string) ?? "processing";
                    const cfg = statusConfig[st as keyof typeof statusConfig] ?? statusConfig.processing;
                    const Icon = cfg.Icon;
                    return <Icon className="h-5 w-5" />;
                  })()}
                  {r.topic as string ?? "未命名会议"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {/* Status badge */}
                <div className="flex items-center gap-3">
                  {(() => {
                    const st = (r.status as string) ?? "processing";
                    const cfg = statusConfig[st as keyof typeof statusConfig] ?? statusConfig.processing;
                    const Icon = cfg.Icon;
                    return (
                      <Badge className={cfg.color}>
                        <Icon className="h-3 w-3 mr-1" />
                        {cfg.label}
                      </Badge>
                    );
                  })()}
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {r.createdAt ? new Date(r.createdAt as string).toLocaleString("zh-CN") : ""}
                  </span>
                </div>

                {/* Processing state */}
                {r.status === "processing" && (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-4 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI 正在生成纪要...
                  </div>
                )}

                {/* Summary */}
                {(r.aiSummary as string) && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">摘要</h4>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                      {r.aiSummary as string}
                    </p>
                  </div>
                )}

                {/* Error */}
                {(r.errorMessage as string) && (
                  <div>
                    <h4 className="font-medium text-sm text-red-600 mb-1">错误信息</h4>
                    <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
                      {r.errorMessage as string}
                    </p>
                  </div>
                )}

                {/* Skip reason */}
                {(r.skippedReason as string) && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">跳过原因</h4>
                    <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                      {r.skippedReason as string}
                    </p>
                  </div>
                )}

                {/* Processing logs */}
                {((r.processingLogs as unknown[])?.length ?? 0) > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">处理日志</h4>
                    <div className="space-y-1">
                      {(r.processingLogs as Array<Record<string, unknown>>).map((log, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            log.status === "error" ? "bg-red-400" : "bg-green-400"
                          }`} />
                          <span className="font-mono">{log.step as string}</span>
                          <span>—</span>
                          <span className="flex-1 truncate">{log.detail as string}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Doc link */}
                {r.docUrl && (
                  <a
                    href={r.docUrl as string}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />打开纪要文档
                  </a>
                )}

                {/* View source meeting */}
                {fmDbId && (
                  <button
                    type="button"
                    className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    onClick={() => setSourceMeetingId(fmDbId)}
                  >
                    查看源会议详情
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}

                {/* Delete button */}
                <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="h-4 w-4 mr-1" />删除纪要
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />确认删除
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">确定要删除这条会议纪要吗？</p>
          <div className="flex gap-2 mt-4">
            <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>取消</Button>
            <Button variant="primary" size="sm" onClick={() => { setShowDeleteConfirm(false); deleteRecordMutation.mutate(id!); }}>
              确认删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 嵌套弹窗：源会议详情 */}
      <MeetingDetailDialog
        id={sourceMeetingId}
        open={!!sourceMeetingId}
        onOpenChange={(open) => { if (!open) setSourceMeetingId(null); }}
      />
    </>
  );
}
