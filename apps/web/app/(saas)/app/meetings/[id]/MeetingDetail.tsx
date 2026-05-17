"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { orpcClient } from "@shared/lib/orpc-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@repo/ui/components/card";
import { Button } from "@repo/ui/components/button";
import { Badge } from "@repo/ui/components/badge";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "sonner";
import {
  ArrowLeft,
  Clock,
  Users,
  Video,
  ExternalLink,
  CheckCircle2,
  SkipForward,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const statusConfig = {
  completed: { label: "已完成", color: "bg-green-100 text-green-700", Icon: CheckCircle2 },
  processing: { label: "处理中", color: "bg-blue-100 text-blue-700", Icon: Loader2 },
  failed: { label: "失败", color: "bg-red-100 text-red-700", Icon: AlertCircle },
  skipped: { label: "已跳过", color: "bg-gray-100 text-gray-600", Icon: SkipForward },
} as const;

export function MeetingDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery(
    orpc.meetings.feishuDetail.queryOptions({ input: { id } }),
  );
  const [generating, setGenerating] = useState(false);

  const generateMutation = useMutation({
    mutationFn: (meetingId: string) => orpcClient.meetings.generate({ feishuMeetingId: meetingId }),
    onSuccess: () => {
      toast.success("纪要生成完成");
      queryClient.invalidateQueries({ queryKey: orpc.meetings.feishuDetail.queryKey({ input: { id } }) });
      refetch();
    },
    onError: (e) => toast.error(`生成失败: ${e instanceof Error ? e.message : "未知错误"}`),
  });

  if (isLoading) return <DetailSkeleton />;
  if (error) return <DetailError message={String(error)} onRetry={() => refetch()} />;

  const m = data as Record<string, unknown>;
  if (!m) return <DetailError message="会议不存在" />;

  const isFeishu = m.source === "feishu";
  const topic = (m.topic as string) || "未命名会议";
  const startTime = m.startTime ? new Date(m.startTime as string) : null;
  const endTime = m.endTime ? new Date(m.endTime as string) : null;
  const participants = (m.participantsJson as Array<{ userName: string; isHost: boolean }>) ?? [];
  const records = (m.meetingRecords as Array<Record<string, unknown>>) ?? [];
  const noteDocToken = m.noteDocToken as string | undefined;
  const meetingNo = m.meetingNo as string | undefined;
  const meetingUrl = m.meetingUrl as string | undefined;
  const transcriptText = m.transcriptText as string | undefined;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Back + Title */}
      <Link href="/app/meetings" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" />返回列表
      </Link>

      {/* Meeting Info Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h1 className="font-bold text-2xl">{topic}</h1>
          <Badge className={isFeishu ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}>
            {isFeishu ? "飞书会议" : "手动上传"}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
          {startTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {startTime.toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              {endTime && ` - ${endTime.toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {(m.participantCount as number | undefined) ?? participants.length ?? "-"} 人参加
          </span>
        </div>

        {/* Participants full list */}
        {participants.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {participants.map((p, i) => (
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
      </div>

      {/* Links */}
      <div className="flex gap-4">
        {noteDocToken && (
          <a
            href={`https://bytedance.feishu.cn/minutes/${noteDocToken}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            <Video className="h-4 w-4" />妙记回放（逐字稿 + 录音）
          </a>
        )}
        {(meetingUrl || (isFeishu && meetingNo)) && (
          <a
            href={meetingUrl || `https://vc.feishu.cn/j/${meetingNo}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            <ExternalLink className="h-4 w-4" />会议链接
          </a>
        )}
      </div>

      {/* Divider */}
      <hr />

      {/* Meeting Minutes — Fixed height, scrollable */}
      <div>
        <h2 className="font-semibold text-lg mb-3">会议纪要</h2>
        {records.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center text-gray-400">
              还没有生成纪要
            </CardContent>
          </Card>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-3 rounded-lg border bg-gray-50 p-4">
            {records.map((r) => {
              const status = (r.status as string) ?? "processing";
              const config = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.processing;
              const Icon = config.Icon;
              return (
                <Card key={r.id as string}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={config.color}>
                        <Icon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {r.createdAt ? new Date(r.createdAt as string).toLocaleString("zh-CN") : ""}
                      </span>
                    </div>

                    {status === "processing" && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        AI 正在生成纪要...
                      </div>
                    )}

                    {(r.aiSummary as string) && (
                      <div className="mb-3">
                        <p className="font-medium text-sm mb-1">摘要</p>
                        <p className="text-sm text-gray-600">{r.aiSummary as string}</p>
                      </div>
                    )}

                    {(r.errorMessage as string) && (
                      <div className="mb-3">
                        <p className="font-medium text-sm text-red-600 mb-1">错误</p>
                        <p className="text-sm text-red-600">{r.errorMessage as string}</p>
                      </div>
                    )}

                    {(r.skippedReason as string) && (
                      <div className="mb-3">
                        <p className="font-medium text-sm mb-1">跳过原因</p>
                        <p className="text-sm text-gray-500">{r.skippedReason as string}</p>
                      </div>
                    )}

                    {r.docUrl ? (
                      <a
                        href={r.docUrl as string}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />打开纪要文档
                      </a>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Generate button */}
      <div>
        <Button
          variant="primary"
          disabled={generating}
          onClick={() => {
            setGenerating(true);
            generateMutation.mutate(id, { onSettled: () => setGenerating(false) });
          }}
        >
          <Sparkles className="h-4 w-4 mr-1" />
          {generating ? "生成中..." : records.length > 0 ? "重新生成" : "生成纪要"}
        </Button>
      </div>

      <hr />

      {/* Transcript — Fixed height, scrollable, below minutes */}
      <div>
        <h2 className="font-semibold text-lg mb-3">逐字稿</h2>
        {transcriptText ? (
          <div className="max-h-48 overflow-y-auto rounded-lg border bg-gray-50 p-4">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
              {transcriptText}
            </pre>
          </div>
        ) : (
          <Card>
            <CardContent className="p-4 text-center text-gray-400">
              暂无逐字稿
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="max-w-3xl space-y-6">
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function DetailError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="max-w-3xl text-center py-16">
      <Link href="/app/meetings" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="h-4 w-4" />返回列表
      </Link>
      <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
      <p className="text-red-600 mb-4">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>重试</Button>
      )}
    </div>
  );
}
