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
  X,
} from "lucide-react";
import { useState } from "react";
import { MeetingDetailDialog } from "./MeetingDetailDialog";
import { CalendarView } from "./CalendarView";
import { LayoutGrid, CalendarDays } from "lucide-react";

const statusConfig = {
  completed: { label: "已完成", color: "bg-green-100 text-green-700", Icon: CheckCircle2 },
  processing: { label: "处理中", color: "bg-blue-100 text-blue-700", Icon: Loader2 },
  failed: { label: "失败", color: "bg-red-100 text-red-700", Icon: AlertCircle },
  skipped: { label: "已跳过", color: "bg-gray-100 text-gray-600", Icon: SkipForward },
} as const;

export function MeetingRecordsList() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(orpc.meetings.feishuList.queryOptions());
  const [showAdd, setShowAdd] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"card" | "calendar">("card");

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

  const syncMutation = useMutation({
    mutationFn: () => orpcClient.meetings.sync({}),
    onSuccess: (data) => {
      toast.success(`同步完成，共 ${(data as unknown[]).length} 条会议记录`);
      queryClient.invalidateQueries({ queryKey: orpc.meetings.feishuList.queryKey() });
    },
    onError: (e) => {
      toast.error(`同步失败: ${e instanceof Error ? e.message : "未知错误"}`);
    },
  });

  if (isLoading) return <MeetingRecordsSkeleton />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-2xl">会议记录</h2>
        <div className="flex gap-2 items-center">
          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-md p-0.5 mr-2">
            <button
              type="button"
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === "card" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setViewMode("card")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === "calendar" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setViewMode("calendar")}
            >
              <CalendarDays className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            刷新
          </Button>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" />添加会议
          </Button>
        </div>
      </div>

      {viewMode === "calendar" ? (
        <CalendarView
          meetings={meetings as Array<Record<string, unknown>>}
          generatingId={generatingId}
          onMeetingClick={(id) => setDetailId(id)}
          onGenerate={(id) => {
            setGeneratingId(id);
            generateMutation.mutate(id, { onSettled: () => setGeneratingId(null) });
          }}
          onFetchTranscript={(id) => { /* handled via MeetingDetailDialog */ }}
          onUploadTranscript={(id) => { /* handled via MeetingDetailDialog */ }}
        />
      ) : meetings.length === 0 ? (
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
  const startTime = meeting.startTime ? new Date(meeting.startTime as string) : null;
  const endTime = meeting.endTime ? new Date(meeting.endTime as string) : null;
  const records = (meeting.meetingRecords as Array<Record<string, unknown>>) ?? [];
  const noteDocToken = meeting.noteDocToken as string | undefined;
  const meetingNo = meeting.meetingNo as string | undefined;
  const meetingUrl = meeting.meetingUrl as string | undefined;
  const hasRecords = records.length > 0;
  const processing = records.some((r) => r.status === "processing");
  const allFailed = hasRecords && records.every((r) => r.status === "failed" || r.status === "skipped");

  return (
    <div
      onClick={() => onDetailClick?.(id)}
      className="premium-card bg-white p-6 rounded-[24px] shadow-[0_2px_16px_rgba(15,23,42,0.02)] cursor-pointer group flex flex-col"
    >
      {/* Top row: title + source badge + hover action */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center space-x-2.5">
          <h2 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate max-w-[320px]">
            {topic}
          </h2>
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${isFeishu ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>
            {isFeishu ? "飞书会议" : "手动上传"}
          </span>
        </div>
        <button
          type="button"
          className="opacity-0 group-hover:opacity-100 text-[11px] text-slate-500 hover:text-indigo-600 transition-all font-bold flex items-center bg-slate-50 px-2.5 py-1 rounded-lg shrink-0"
          onClick={(e) => { e.stopPropagation(); onGenerate(id); }}
          disabled={generatingId === id}
        >
          <Sparkles className="h-3 w-3 mr-1" />
          {generatingId === id ? "生成中..." : hasRecords ? "重新生成" : "生成纪要"}
        </button>
      </div>

      {/* Middle row: time + host */}
      <div className="flex items-center space-x-5 text-[11px] text-slate-400 font-medium mb-4">
        {startTime && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-slate-300" />
            {startTime.toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            {endTime && ` - ${endTime.toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`}
          </span>
        )}
        {meeting.hostUserId && <span className="flex items-center gap-1"><Users className="h-3 w-3 text-slate-300" />发起人: hym</span>}
      </div>

      {/* Bottom row: status + links */}
      <div className="flex items-center gap-2.5">
        {processing ? (
          <span className="text-blue-600 bg-blue-50 border border-blue-100/50 px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center">
            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> 处理中...
          </span>
        ) : hasRecords && !allFailed ? (
          <span className="text-emerald-600 bg-emerald-50 border border-emerald-100/50 px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center">
            <CheckCircle2 className="h-3 w-3 mr-1.5" /> 已生成 {records.length} 份纪要
          </span>
        ) : allFailed ? (
          <span className="text-red-500 bg-red-50 border border-red-100/50 px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center">
            <AlertCircle className="h-3 w-3 mr-1.5" /> 生成失败
          </span>
        ) : (
          <span className="text-slate-400 bg-slate-50 border border-slate-200/40 px-2.5 py-1 rounded-xl text-[11px] font-medium flex items-center">
            <Video className="h-3 w-3 mr-1.5" /> 暂无会议纪要
          </span>
        )}
        {noteDocToken && (
          <a
            href={`https://bytedance.feishu.cn/minutes/${noteDocToken}`}
            target="_blank" rel="noreferrer"
            className="text-indigo-600 bg-indigo-50 border border-indigo-100/50 px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center hover:bg-indigo-100 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Video className="h-3 w-3 mr-1.5" /> 妙记回放
          </a>
        )}
      </div>
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
  const [inputMode, setInputMode] = useState<"file" | "text">("text");

  const handleAdd = async () => {
    if (!topic.trim()) { toast.error("请填写会议名称"); return; }
    if (!transcriptText.trim()) { toast.error("请粘贴或上传逐字稿"); return; }
    setLoading(true);
    try {
      const participants = participantsStr.trim()
        ? participantsStr.split(/[,，、\s]+/).map((n) => ({ userId: n, userName: n.trim(), isHost: false, isExternal: false }))
        : [];
      await orpcClient.meetings.createManual({
        topic: topic.trim(), transcriptText: transcriptText.trim(),
        startTime: startTime || undefined, endTime: endTime || undefined,
        meetingUrl: meetingUrl || undefined,
        participants: participants.length > 0 ? participants : undefined,
      });
      toast.success("会议已添加");
      queryClient.invalidateQueries({ queryKey: orpc.meetings.feishuList.queryKey() });
      onOpenChange(false);
      setTopic(""); setTranscriptText(""); setStartTime(""); setEndTime(""); setMeetingUrl(""); setParticipantsStr("");
    } catch (e) { toast.error(`添加失败: ${e instanceof Error ? e.message : "未知错误"}`); }
    finally { setLoading(false); }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay-2 fixed inset-0 bg-slate-900/30 z-50 flex items-center justify-center p-4 active" onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false); }}>
      <div className="modal-container-2 bg-white border border-slate-100 w-full max-w-lg rounded-[32px] shadow-[0_32px_80px_-16px_rgba(15,23,42,0.14)] overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight">添加新会议记录</h3>
            <p className="text-[10px] text-slate-400 font-medium">支持文件多格式选取与长文本粘贴双载体</p>
          </div>
          <button onClick={() => onOpenChange(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 flex items-center justify-center transition"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">会议名称 *</label>
            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="如：产品评审会"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-semibold focus:outline-none shadow-sm transition-all" />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">逐字稿 / 转文字内容 *</label>
            <div className="bg-slate-100 p-1 rounded-xl flex space-x-1 mb-2">
              <button type="button" onClick={() => setInputMode("file")}
                className={`tab-btn flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all ${inputMode === "file" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600"}`}>
                <Upload className="h-3 w-3 mr-1 inline" />上传文件 (.md/.txt/.docx)
              </button>
              <button type="button" onClick={() => setInputMode("text")}
                className={`tab-btn flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all ${inputMode === "text" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600"}`}>
                手动输入
              </button>
            </div>
            <div className="rigid-shell-container w-full relative">
              {inputMode === "file" ? (
                <label className="absolute inset-0 border-2 border-dashed border-slate-200 hover:border-indigo-500/50 bg-slate-50/20 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors group">
                  <Upload className="h-5 w-5 text-slate-300 group-hover:text-indigo-500 mb-1.5" />
                  <p className="text-xs font-bold text-slate-700">拖拽文件到此处，或 <span className="text-indigo-600 underline">点击浏览文件</span></p>
                  <p className="text-[9px] text-slate-400 mt-0.5 font-medium">支持格式: .md, .txt, .docx</p>
                  <input type="file" accept=".txt,.md" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    setTranscriptText(await file.text());
                    if (!topic && file.name) setTopic(file.name.replace(/\.(txt|md)$/, ""));
                    setInputMode("text");
                  }} />
                </label>
              ) : (
                <textarea value={transcriptText} onChange={(e) => setTranscriptText(e.target.value)}
                  placeholder="请在此处直接粘贴您的会议转文字文本"
                  className="absolute inset-0 w-full h-full px-3.5 py-3.5 bg-slate-50/30 border border-slate-200 focus:border-indigo-500 rounded-2xl text-xs font-semibold focus:outline-none transition-all resize-none shadow-sm" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">开始时间</label>
              <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-semibold focus:outline-none shadow-sm transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">结束时间</label>
              <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-semibold focus:outline-none shadow-sm transition-all" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">参会人员 (可选)</label>
            <input value={participantsStr} onChange={(e) => setParticipantsStr(e.target.value)}
              placeholder="用逗号或空格分隔，如：张三, 李四"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-semibold focus:outline-none shadow-sm transition-all" />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">会议链接</label>
            <input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-semibold focus:outline-none shadow-sm transition-all" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end space-x-2 bg-white">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>取消</Button>
          <Button size="sm" onClick={handleAdd} disabled={loading}>{loading ? "添加中..." : "确定创建"}</Button>
        </div>
      </div>
    </div>
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
