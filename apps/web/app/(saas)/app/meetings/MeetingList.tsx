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
import { RefreshCw, FileText, Sparkles, Eye } from "lucide-react";
import { useState } from "react";

export function MeetingList() {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery(orpc.meetings.feishuList.queryOptions());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const meetings = (data as unknown[] | undefined) ?? [];

  const generateMutation = useMutation({
    mutationFn: (feishuMeetingId: string) =>
      orpcClient.meetings.generate({ feishuMeetingId }),
    onSuccess: () => {
      toast.success("纪要生成完成");
      queryClient.invalidateQueries({ queryKey: orpc.meetings.feishuList.queryKey() });
    },
    onError: (e) => toast.error(`生成失败: ${e instanceof Error ? e.message : "未知错误"}`),
  });

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" />刷新列表
        </Button>
      </div>

      {meetings.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          暂无会议记录。需要先开通飞书搜索权限 (vc:meeting.search:read) 并重新登录。
        </p>
      ) : (
        meetings.map((m: Record<string, unknown>) => (
          <Card key={m.id as string}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{(m.topic as string) || "未命名会议"}</h3>
                <p className="text-sm text-gray-500">
                  {m.startTime ? new Date(m.startTime as string).toLocaleString("zh-CN") : "未知时间"}
                  {(m._count as Record<string, number>)?.meetingRecords > 0 && (
                    <Badge className="ml-2 bg-blue-100 text-blue-700">
                      {(m._count as Record<string, number>).meetingRecords} 份纪要
                    </Badge>
                  )}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setDetailId(m.id as string)}>
                  <Eye className="h-4 w-4 mr-1" />详情
                </Button>
                <Button
                  size="sm"
                  disabled={generatingId === m.id}
                  onClick={() => {
                    setGeneratingId(m.id as string);
                    generateMutation.mutate(m.id as string, { onSettled: () => setGeneratingId(null) });
                  }}
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  {generatingId === m.id ? "生成中..." : "生成纪要"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* 详情弹窗 */}
      <MeetingDetailDialog id={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function MeetingDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isLoading } = useQuery(
    id ? orpc.meetings.feishuDetail.queryOptions({ input: { id } }) : { queryKey: ["skip"], queryFn: () => null, enabled: false },
  );

  const detail = data as Record<string, unknown> | null;

  return (
    <Dialog open={!!id} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {detail?.topic as string ?? "会议详情"}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-32" />
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-gray-500">
              {detail?.startTime ? new Date(detail.startTime as string).toLocaleString("zh-CN") : "未知时间"}
            </div>

            {/* 已生成的纪要 */}
            {(detail?.meetingRecords as unknown[])?.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">已生成的纪要</h4>
                <div className="space-y-2">
                  {(detail?.meetingRecords as Array<Record<string, unknown>>).map((r) => (
                    <Card key={r.id as string}>
                      <CardContent className="p-3 text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={
                            r.status === "completed" ? "bg-green-100 text-green-700" :
                            r.status === "failed" ? "bg-red-100 text-red-700" :
                            "bg-gray-100 text-gray-600"
                          }>
                            {r.status as string}
                          </Badge>
                          <span className="text-gray-400">
                            {r.createdAt ? new Date(r.createdAt as string).toLocaleString("zh-CN") : ""}
                          </span>
                        </div>
                        {r.docUrl && (
                          <a href={r.docUrl as string} target="_blank" rel="noreferrer" className="text-blue-600 text-xs hover:underline">
                            打开文档 →
                          </a>
                        )}
                        {r.aiSummary && <p className="text-gray-500 mt-1">{(r as { aiSummary: string }).aiSummary}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* 逐字稿 */}
            {detail?.transcriptText ? (
              <div>
                <h4 className="font-medium mb-2">逐字稿</h4>
                <pre className="bg-gray-50 p-3 rounded text-xs whitespace-pre-wrap max-h-64 overflow-auto">
                  {(detail.transcriptText as string).slice(0, 3000)}
                  {(detail.transcriptText as string).length > 3000 && "\n\n... (内容过长，已截断)"}
                </pre>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">暂无逐字稿</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
