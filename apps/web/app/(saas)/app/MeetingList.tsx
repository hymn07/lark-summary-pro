"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@repo/ui/components/card";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui";
import { CheckCircle2, Clock, AlertCircle, SkipForward, ExternalLink, RotateCw } from "lucide-react";
import { useState } from "react";

const statusConfig = {
  completed: { label: "已完成", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  processing: { label: "处理中", color: "bg-blue-100 text-blue-700", icon: Clock },
  failed: { label: "失败", color: "bg-red-100 text-red-700", icon: AlertCircle },
  skipped: { label: "已跳过", color: "bg-gray-100 text-gray-600", icon: SkipForward },
} as const;

export function MeetingList() {
  const [status, setStatus] = useState<string | undefined>();
  const { data, isLoading, error, refetch } = useQuery(
    orpc.meetings.list.queryOptions({ input: { status: status as never, limit: 20 } }),
  );

  if (isLoading) return <MeetingListSkeleton />;
  if (error) return <ErrorCard message={String(error)} onRetry={() => refetch()} />;

  const meetings = data?.data ?? [];

  if (meetings.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 text-lg">还没有会议纪要</p>
        <p className="text-gray-400 mt-2">开完会后，纪要将自动出现在这里</p>
      </div>
    );
  }

  return (
    <div>
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
        {meetings.map((m) => (
          <MeetingCard key={m.id} meeting={m} />
        ))}
      </div>
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

function MeetingCard({ meeting }: { meeting: Record<string, unknown> }) {
  const config = statusConfig[meeting.status as keyof typeof statusConfig] ?? statusConfig.processing;
  const Icon = config.icon;
  const topic = (meeting.topic as string) ?? "未命名会议";
  const createdAt = meeting.createdAt ? new Date(meeting.createdAt as string).toLocaleString("zh-CN") : "";

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex items-start gap-4">
        <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", {
          "text-green-600": meeting.status === "completed",
          "text-blue-600": meeting.status === "processing",
          "text-red-600": meeting.status === "failed",
          "text-gray-400": meeting.status === "skipped",
        })} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium truncate">{topic}</h3>
            <Badge className={config.color}>{config.label}</Badge>
          </div>
          {meeting.aiSummary ? (
            <p className="text-sm text-gray-500 line-clamp-2 mb-1">
              {meeting.aiSummary as string}
            </p>
          ) : null}
          <p className="text-xs text-gray-400">{createdAt}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {meeting.docUrl ? (
            <a href={meeting.docUrl as string} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-1" />
                打开文档
              </Button>
            </a>
          ) : null}
          {(meeting.status === "failed" || meeting.status === "skipped") ? (
            <Button variant="ghost" size="sm">
              <RotateCw className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function MeetingListSkeleton() {
  return (
    <div className="space-y-3">
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
