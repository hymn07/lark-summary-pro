"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@repo/ui/components/card";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui";
import {
  CheckCircle2,
  AlertCircle,
  SkipForward,
  ExternalLink,
  RotateCw,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { MinutesDetailDialog } from "./MinutesDetailDialog";

const statusConfig = {
  completed: { label: "已完成", color: "bg-green-100 text-green-700", Icon: CheckCircle2 },
  processing: { label: "处理中", color: "bg-blue-100 text-blue-700", Icon: Loader2 },
  failed: { label: "失败", color: "bg-red-100 text-red-700", Icon: AlertCircle },
  skipped: { label: "已跳过", color: "bg-gray-100 text-gray-600", Icon: SkipForward },
} as const;

export function MinutesList() {
  const [status, setStatus] = useState<string | undefined>();
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = useQuery(
    orpc.meetings.list.queryOptions({ input: { status: status as never, limit: 20 } }),
  );

  if (isLoading) return <MinutesListSkeleton />;
  if (error) return <ErrorCard message={String(error)} onRetry={() => refetch()} />;

  const records = (data as { data?: unknown[] })?.data ?? [];

  if (records.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 text-lg">还没有会议纪要</p>
        <p className="text-gray-400 mt-2">开完会后，纪要将自动出现在这里</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex gap-2 mb-6">
        <FilterButton active={!status} onClick={() => setStatus(undefined)}>
          全部
        </FilterButton>
        {Object.entries(statusConfig).map(([key, config]) => (
          <FilterButton key={key} active={status === key} onClick={() => setStatus(key)}>
            {config.label}
          </FilterButton>
        ))}
      </div>

      <div className="space-y-3">
        {records.map((r) => (
          <MinutesCard key={(r as Record<string, unknown>).id as string} record={r as Record<string, unknown>} onDetailClick={(id) => setDetailId(id)} />
        ))}
      </div>
      <MinutesDetailDialog id={detailId} open={!!detailId} onOpenChange={(open) => { if (!open) setDetailId(null); }} />
    </div>
  );
}

function MinutesCard({ record, onDetailClick }: { record: Record<string, unknown>; onDetailClick?: (id: string) => void }) {
  const status = (record.status as string) ?? "processing";
  const config = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.processing;
  const Icon = config.Icon;
  const topic = (record.topic as string) ?? "未命名会议";

  return (
    <div onClick={() => onDetailClick?.(record.id as string)} className="cursor-pointer">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4 flex items-start gap-4">
          <Icon
            className={cn("h-5 w-5 mt-0.5 flex-shrink-0", {
              "text-green-600": status === "completed",
              "text-blue-600": status === "processing",
              "text-red-600": status === "failed",
              "text-gray-400": status === "skipped",
            })}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium truncate">{topic}</h3>
              <Badge className={config.color}>
                <Icon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
            </div>

            {status === "processing" && (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                AI 正在生成中...
              </div>
            )}

            {(record.aiSummary as string) && (
              <p className="text-sm text-gray-500 line-clamp-2 mb-1">
                {record.aiSummary as string}
              </p>
            )}
            {(record.errorMessage as string) && (
              <p className="text-sm text-red-600 line-clamp-2 mb-1">
                {record.errorMessage as string}
              </p>
            )}
            {(record.skippedReason as string) && (
              <p className="text-sm text-gray-500 line-clamp-2 mb-1">
                跳过原因：{record.skippedReason as string}
              </p>
            )}

            <p className="text-xs text-gray-400">
              {record.createdAt ? new Date(record.createdAt as string).toLocaleString("zh-CN") : ""}
            </p>
          </div>

          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {record.docUrl ? (
              <a href={record.docUrl as string} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  打开文档
                </Button>
              </a>
            ) : null}
            {(status === "failed" || status === "skipped") ? (
              <Button variant="ghost" size="sm">
                <RotateCw className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-sm transition-colors",
        active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200",
      )}
    >
      {children}
    </button>
  );
}

function MinutesListSkeleton() {
  return (
    <div className="space-y-3 max-w-3xl">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 flex gap-4">
            <Skeleton className="h-5 w-5 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-center py-16">
      <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
      <p className="text-red-600 mb-4">{message}</p>
      <Button variant="outline" onClick={onRetry}>
        <RotateCw className="h-4 w-4 mr-1" />
        重试
      </Button>
    </div>
  );
}
