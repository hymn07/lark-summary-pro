"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { orpcClient } from "@shared/lib/orpc-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@repo/ui/components/card";
import { Button } from "@repo/ui/components/button";
import { Badge } from "@repo/ui/components/badge";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@repo/ui/components/dialog";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "sonner";
import {
  RefreshCw,
  Sparkles,
  Video,
  Upload,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  SkipForward,
  Users,
  Plus,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { MeetingDetailDialog } from "./MeetingDetailDialog";

const statusConfig = {
  completed: { label: "已完成", color: "bg-green-100 text-green-700", Icon: CheckCircle2 },
  processing: { label: "处理中", color: "bg-blue-100 text-blue-700", Icon: Loader2 },
  failed: { label: "失败", color: "bg-red-100 text-red-700", Icon: AlertCircle },
  skipped: { label: "已跳过", color: "bg-gray-100 text-gray-600", Icon: SkipForward },
} as const;

export function MeetingRecordsList() {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery(orpc.meetings.feishuList.queryOptions());
  const [showAdd, setShowAdd] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const meetings = (data as unknown[] | undefined) ?? [];

  const generateMutation = useMutation({
    mutationFn: (feishuMeetingId: string) => orpcClient.meetings.generate({ feishuMeetingId }),
    onMutate: async (feishuMeetingId) => {
      // 乐观更新：在会议记录中立刻显示"处理中"
      const queryKey = orpc.meetings.feishuList.queryKey();
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.map((m: Record<string, unknown>) => {
          if (m.id === feishuMeetingId) {
            const existingRecords = (m.meetingRecords as Array<Record<string, unknown>>) ?? [];
            return {
              ...m,
              meetingRecords: [{ id: "optimistic", status: "processing", createdAt: new Date().toISOString() }, ...existingRecords],
            };
          }
          return m;
        });
      });
      return { previous };
    },
    onSuccess: (data, feishuMeetingId) => {
      const results = data as Array<{ status: string }> | undefined;
      if (!results || results.length === 0) {
        toast.warning("已跳过：无匹配用户");
      } else if (results.some((r) => r.status === "completed")) {
        toast.success("纪要生成完成");
      } else {
        toast.warning("处理完成");
      }
    },
    onError: (e) => {
      toast.error(`生成失败: ${e instanceof Error ? e.message : "未知错误"}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: orpc.meetings.feishuList.queryKey() });
      queryClient.invalidateQueries({ queryKey: orpc.meetings.list.queryKey() });
    },
  });

  if (isLoading) return <MeetingRecordsSkeleton />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-2xl">会议记录</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />刷新
          </Button>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" />添加会议
          </Button>
        </div>
      </div>

      {meetings.length === 0 ? (
        <div className="text-center py-16">
          <Video className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">暂无会议记录</p>
          <p className="text-gray-400 mt-2">
            会议数据来自飞书"会议结束"事件推送，也可以手动上传
          </p>
        </div>
      ) : (
        meetings.map((m) => (
          <MeetingCard
            key={(m as Record<string, unknown>).id as string}
            meeting={m as Record<string, unknown>}
            generatingId={generatingId}
            onDetailClick={(id) => setDetailId(id)}
            onGenerate={(id) => {
              setGeneratingId(id);
              generateMutation.mutate(id, { onSettled: () => setGeneratingId(null) });
            }}
          />
        ))
      )}

      <AddMeetingDialog open={showAdd} onOpenChange={setShowAdd} />
      <MeetingDetailDialog id={detailId} open={!!detailId} onOpenChange={(open) => { if (!open) setDetailId(null); }} />
    </div>
  );
}

function MeetingCard({
  meeting,
  generatingId,
  onDetailClick,
  onGenerate,
}: {
  meeting: Record<string, unknown>;
  generatingId: string | null;
  onDetailClick?: (id: string) => void;
  onGenerate: (id: string) => void;
}) {
  const id = meeting.id as string;
  const isFeishu = meeting.source === "feishu";
  const topic = (meeting.topic as string) || "未命名会议";
  const startTime = meeting.startTime
    ? new Date(meeting.startTime as string)
    : null;
  const endTime = meeting.endTime
    ? new Date(meeting.endTime as string)
    : null;
  const participants = (meeting.participantsJson as Array<{ userName: string; isHost: boolean }>) ?? [];
  const records = (meeting.meetingRecords as Array<Record<string, unknown>>) ?? [];
  const noteDocToken = meeting.noteDocToken as string | undefined;
  const meetingNo = meeting.meetingNo as string | undefined;
  const meetingUrl = meeting.meetingUrl as string | undefined;

  const displayParticipants = participants.slice(0, 4);
  const remainingCount = participants.length - 4;

  return (
    <div onClick={() => onDetailClick?.(id)} className="cursor-pointer">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg truncate">{topic}</h3>
                <Badge className={isFeishu ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}>
                  {isFeishu ? "飞书会议" : "手动上传"}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                {startTime && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {startTime.toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {endTime && ` - ${endTime.toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Participants */}
          <div className="flex items-center gap-1 text-sm text-gray-500 mb-2 h-5">
            {displayParticipants.length > 0 ? (
              <>
                <Users className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">
                  {displayParticipants.map((p) => p.userName ?? "未知").join("、")}
                  {remainingCount > 0 && ` 等 ${participants.length} 人`}
                </span>
              </>
            ) : (
              <span className="text-gray-300 text-xs">暂无参会人信息</span>
            )}
          </div>

          {/* Links */}
          <div className="flex gap-3 mb-2 h-5">
            {noteDocToken ? (
              <a href={`https://bytedance.feishu.cn/minutes/${noteDocToken}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                onClick={(e) => e.stopPropagation()}>
                <Video className="h-3 w-3" />妙记回放
              </a>
            ) : null}
            {(meetingUrl || (isFeishu && meetingNo)) ? (
              <a href={meetingUrl || `https://vc.feishu.cn/j/${meetingNo}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                onClick={(e) => e.stopPropagation()}>
                <ExternalLink className="h-3 w-3" />会议链接
              </a>
            ) : null}
            {!noteDocToken && !meetingUrl && !(isFeishu && meetingNo) && (
              <span className="text-gray-300 text-xs">暂无链接</span>
            )}
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            {records.some((r) => r.status === "processing") ? (
              <Badge className="bg-blue-100 text-blue-700">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                处理中...
              </Badge>
            ) : records.length > 0 ? (
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                已生成 {records.length} 份纪要
              </Badge>
            ) : (
              <span className="text-xs text-gray-400">未生成纪要</span>
            )}
            <div onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="ghost"
                disabled={generatingId === id}
                onClick={() => onGenerate(id)}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                {generatingId === id ? "生成中..." : records.length > 0 ? "重新生成" : "生成纪要"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AddMeetingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [participantsStr, setParticipantsStr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!topic.trim()) { toast.error("请填写会议名称"); return; }
    if (!transcriptText.trim()) { toast.error("请粘贴或上传逐字稿"); return; }
    setLoading(true);
    try {
      const participants = participantsStr.trim()
        ? participantsStr.split(/[,，、\s]+/).map((n) => ({ userId: n, userName: n.trim(), isHost: false, isExternal: false }))
        : [];
      await orpcClient.meetings.createManual({
        topic: topic.trim(),
        transcriptText: transcriptText.trim(),
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        meetingUrl: meetingUrl || undefined,
        participants: participants.length > 0 ? participants : undefined,
      });
      toast.success("会议已添加");
      queryClient.invalidateQueries({ queryKey: orpc.meetings.feishuList.queryKey() });
      onOpenChange(false);
      setTopic(""); setTranscriptText(""); setStartTime(""); setEndTime(""); setMeetingUrl(""); setParticipantsStr("");
    } catch (e) {
      toast.error(`添加失败: ${e instanceof Error ? e.message : "未知错误"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setTranscriptText(text);
      if (!topic && file.name) setTopic(file.name.replace(/\.(txt|md)$/, ""));
    } catch {
      toast.error("文件读取失败");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />添加会议记录
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>会议名称 *</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="如：产品评审会" />
          </div>
          <div>
            <Label>逐字稿/转文字内容 *</Label>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-xs text-blue-600 hover:underline cursor-pointer flex items-center gap-1">
                <Upload className="h-3 w-3" />上传 .txt/.md 文件
                <input type="file" accept=".txt,.md" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
            <Textarea
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="粘贴会议转文字内容..."
              rows={6}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>开始时间</Label>
              <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="text-sm" />
            </div>
            <div>
              <Label>结束时间</Label>
              <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="text-sm" />
            </div>
          </div>
          <div>
            <Label>参会人</Label>
            <Input
              value={participantsStr}
              onChange={(e) => setParticipantsStr(e.target.value)}
              placeholder="用逗号或空格分隔，如：张三, 李四"
            />
          </div>
          <div>
            <Label>会议链接</Label>
            <Input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleAdd} disabled={loading}>
            {loading ? "添加中..." : "添加会议"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MeetingRecordsSkeleton() {
  return (
    <div className="space-y-4 max-w-3xl">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
