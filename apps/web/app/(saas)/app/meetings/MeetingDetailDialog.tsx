"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { orpcClient } from "@shared/lib/orpc-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "sonner";
import {
  Clock, Users, Video, ExternalLink, CheckCircle2, SkipForward, AlertCircle, Loader2, Sparkles, Trash2, FileText, Upload, X,
} from "lucide-react";
import { useState } from "react";

const STATUS_ICONS = { completed: CheckCircle2, processing: Loader2, failed: AlertCircle, skipped: SkipForward } as const;

export function MeetingDetailDialog({
  id,
  open,
  onOpenChange,
}: { id: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(
    id && open ? orpc.meetings.feishuDetail.queryOptions({ input: { id } }) : { queryKey: ["skip"], queryFn: () => null, enabled: false } as never,
  );

  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadText, setUploadText] = useState("");
  const [generating, setGenerating] = useState(false);

  const m = data as Record<string, unknown> | null;

  const generateMutation = useMutation({
    mutationFn: (meetingId: string) => orpcClient.meetings.generate({ feishuMeetingId: meetingId }),
    onSuccess: () => {
      toast.success("纪要生成完成");
      queryClient.invalidateQueries({ queryKey: orpc.meetings.feishuDetail.queryKey({ input: { id: id! } }) });
    },
    onError: (e) => toast.error(`生成失败: ${e instanceof Error ? e.message : "未知错误"}`),
  });

  const [fetchingTranscript, setFetchingTranscript] = useState(false);
  const handleFetchTranscript = async () => {
    if (!id) return;
    setFetchingTranscript(true);
    try {
      const result = await orpcClient.meetings.fetchTranscript({ id }) as { transcriptFetched: boolean };
      toast[result.transcriptFetched ? "success" : "warning"](result.transcriptFetched ? "逐字稿已获取，正在生成纪要" : "逐字稿尚未就绪，稍后重试");
      queryClient.invalidateQueries({ queryKey: orpc.meetings.feishuDetail.queryKey({ input: { id } }) });
    } catch { toast.error("获取失败"); }
    finally { setFetchingTranscript(false); }
  };

  const uploadMutation = useMutation({
    mutationFn: (text: string) => orpcClient.meetings.uploadTranscript({ id: id!, text }),
    onSuccess: () => { toast.success("逐字稿已保存"); setShowUpload(false); setUploadText(""); queryClient.invalidateQueries({ queryKey: orpc.meetings.feishuDetail.queryKey({ input: { id: id! } }) }); },
    onError: () => toast.error("上传失败"),
  });

  const deleteMutation = useMutation({
    mutationFn: (opts: { deleteRecords: boolean }) => orpcClient.meetings.deleteFeishu({ id: id!, ...opts }),
    onSuccess: () => { toast.success("已删除"); onOpenChange(false); queryClient.invalidateQueries({ queryKey: orpc.meetings.feishuList.queryKey() }); },
    onError: () => toast.error("删除失败"),
  });

  const records = (m?.meetingRecords as Array<Record<string, unknown>>) ?? [];
  const visibleRecords = records.slice(0, 3);
  const hiddenRecords = records.slice(3);
  const hasMoreRecords = records.length > 3;

  const transcriptText = m?.transcriptText as string | undefined;
  const userTranscriptText = m?.userTranscriptText as string | undefined;

  return (
    <>
      {/* Overlay */}
      <div
        className={`drawer-overlay fixed inset-0 bg-slate-900/20 z-40 ${open ? "active" : ""}`}
        onClick={() => onOpenChange(false)}
      />

      {/* Drawer panel */}
      <div className={`drawer-panel fixed top-4 right-4 bottom-4 w-full sm:w-[560px] bg-white shadow-[0_32px_96px_-12px_rgba(15,23,42,0.14)] z-50 flex flex-col border border-slate-100 rounded-[32px] overflow-hidden ${open ? "active" : ""}`}>
        {isLoading ? (
          <div className="p-8 space-y-4"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-full" /><Skeleton className="h-64 w-full" /></div>
        ) : !m ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">会议不存在</div>
        ) : (
          <>
            {/* Header */}
            <div className="px-8 py-5 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">{m.topic as string ?? "未命名会议"}</h2>
                <div className="flex items-center space-x-3 mt-1.5 text-[11px] text-slate-400 font-medium">
                  {m.startTime && <span>{new Date(m.startTime as string).toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}{m.endTime && ` - ${new Date(m.endTime as string).toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`}</span>}
                  {m.noteDocToken && (
                    <>
                      <span>·</span>
                      <a href={`https://bytedance.feishu.cn/minutes/${m.noteDocToken}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-700 flex items-center font-bold bg-indigo-50 px-2 py-0.5 rounded-md transition-colors">
                        <Video className="h-3 w-3 mr-1" />妙记回放
                      </a>
                    </>
                  )}
                </div>
              </div>
              <button onClick={() => onOpenChange(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 flex items-center justify-center transition"><X className="h-4 w-4" /></button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 no-scrollbar bg-slate-50/40 space-y-6">
              {/* ── Summaries Section ── */}
              <div className="space-y-3.5">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-[11px] font-bold text-slate-400 tracking-widest uppercase flex items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2" /> 会议纪要 ({records.length}份)
                  </h3>
                  <Button
                    size="sm"
                    disabled={generating}
                    onClick={() => { setGenerating(true); generateMutation.mutate(m.id as string, { onSettled: () => setGenerating(false) }); }}
                    className="text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded-md h-auto"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />生成新纪要
                  </Button>
                </div>

                {records.length === 0 ? (
                  <div className="py-16 text-center bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
                    <Sparkles className="h-6 w-6 text-slate-200 mb-2.5 mx-auto block" />
                    <h4 className="text-xs font-bold text-slate-700">暂无会议纪要</h4>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3" id="main-summary-list">
                      {visibleRecords.map((r) => {
                        const st = r.status as string;
                        const Icon = STATUS_ICONS[st as keyof typeof STATUS_ICONS] ?? Loader2;
                        const isProcessing = st === "processing";
                        const isBad = st === "failed" || st === "skipped";
                        return (
                          <div key={r.id as string} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                            <div className="flex justify-between items-center mb-2.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isProcessing ? "text-blue-600 bg-blue-50" : isBad ? "text-red-500 bg-red-50" : "text-emerald-600 bg-emerald-50"}`}>
                                <Icon className={`h-3 w-3 mr-1 inline ${isProcessing ? "animate-spin" : ""}`} />
                                {isProcessing ? "处理中" : isBad ? (r.skippedReason ? "已跳过" : "失败") : "已完成"}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {r.createdAt ? new Date(r.createdAt as string).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}
                              </span>
                            </div>
                            {(r.aiSummary as string) && (
                              <p className="text-xs text-slate-600 font-medium line-clamp-1">{r.aiSummary as string}</p>
                            )}
                            {(r.errorMessage as string) && <p className="text-xs text-red-500">{r.errorMessage as string}</p>}
                            {(r.skippedReason as string) && <p className="text-xs text-slate-400">{r.skippedReason as string}</p>}
                            {r.docUrl && (
                              <div className="flex justify-end mt-2 text-[11px] font-bold">
                                <a href={r.docUrl as string} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700 flex items-center space-x-1 font-semibold">
                                  <ExternalLink className="h-3 w-3" /> <span>打开云文档</span>
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {hasMoreRecords && (
                      <>
                        <div className={`accordion-load-more space-y-3 ${isSummaryExpanded ? "expanded" : ""}`}>
                          {hiddenRecords.map((r) => (
                            <div key={r.id as string} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                              <div className="flex justify-between items-center mb-2.5">
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                  {(r.status as string) === "processing" ? "处理中" : "已完成"}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {r.createdAt ? new Date(r.createdAt as string).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}
                                </span>
                              </div>
                              {(r.aiSummary as string) && <p className="text-xs text-slate-600 font-medium line-clamp-1">{r.aiSummary as string}</p>}
                              {r.docUrl && (
                                <div className="flex justify-end mt-2 text-[11px] font-bold">
                                  <a href={r.docUrl as string} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700 flex items-center space-x-1 font-semibold">
                                    <ExternalLink className="h-3 w-3" /> <span>打开云文档</span>
                                  </a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="text-center pt-1">
                          <button
                            type="button"
                            onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                            className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-colors py-1 px-3 bg-white border border-slate-100 rounded-full shadow-sm"
                          >
                            {isSummaryExpanded ? "收起内容 ↑" : `加载更多 (还有 ${hiddenRecords.length} 份) ↓`}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* ── Transcript Section ── */}
              <div className="space-y-3.5">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-[11px] font-bold text-slate-400 tracking-widest uppercase flex items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-700 mr-2" /> 会议逐字稿
                  </h3>
                  <div className="flex items-center space-x-1.5">
                    <Button variant="ghost" size="sm" onClick={handleFetchTranscript} disabled={fetchingTranscript}
                      className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md h-auto">
                      {fetchingTranscript ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <FileText className="h-3 w-3 mr-1" />}获取妙记逐字稿
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowUpload(true)}
                      className="text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md h-auto">
                      <Upload className="h-3 w-3 mr-1" />上传逐字稿
                    </Button>
                  </div>
                </div>

                {(transcriptText || userTranscriptText) ? (
                  <div
                    className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-4 cursor-pointer hover:border-slate-200 transition-colors group"
                    onClick={() => setIsTranscriptExpanded(!isTranscriptExpanded)}
                  >
                    <div className={`transcript-clamp-zone text-xs leading-relaxed text-slate-600 font-serif pr-1 no-scrollbar ${isTranscriptExpanded ? "expanded" : ""}`}>
                      {(transcriptText ?? userTranscriptText ?? "").split("\n").map((line: string, i: number) => (
                        <div key={i} className="mb-2">
                          <span className="block text-[9px] text-indigo-500 font-bold font-sans tracking-wider mb-0.5">
                            {line.startsWith("说话人") ? line.split(". ")[0] : `段落 ${i + 1}`}
                          </span>
                          <p className="font-medium">{line.includes(". ") ? line.split(". ").slice(1).join(". ") : line}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-center pt-2 border-t border-slate-50 text-[10px] font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">
                      <span>{isTranscriptExpanded ? "↑ 点击卡片任意位置一键收缩归位 ↑" : "加载更多逐字稿 ↓"}</span>
                    </div>
                  </div>
                ) : (
                  <div className="py-16 text-center bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
                    <p className="text-xs text-slate-400">暂无逐字稿，可通过上方按钮获取或上传</p>
                  </div>
                )}
              </div>

              {/* Delete */}
              <div className="pt-4 flex justify-center shrink-0">
                <Button variant="ghost" size="sm" onClick={() => setShowDelete(true)}
                  className="text-[10px] font-bold text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors h-auto">
                  <Trash2 className="h-3 w-3 mr-1" />删除此会议记录
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {showDelete && (
        <div className="modal-overlay-2 fixed inset-0 bg-slate-900/30 z-50 flex items-center justify-center p-4 active">
          <div className="modal-container-2 bg-white border border-slate-100 w-full max-w-sm rounded-[24px] shadow-[0_32px_80px_-16px_rgba(15,23,42,0.14)] overflow-hidden p-6">
            <h3 className="text-base font-black text-slate-900 mb-2">确认删除</h3>
            <p className="text-xs text-slate-500 mb-4">该会议有 {records.length} 条关联纪要。是否同时删除？</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowDelete(false); deleteMutation.mutate({ deleteRecords: false }); }}>保留纪要</Button>
              <Button size="sm" onClick={() => { setShowDelete(false); deleteMutation.mutate({ deleteRecords: true }); }}>全部删除</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowDelete(false)}>取消</Button>
            </div>
          </div>
        </div>
      )}

      {/* Transcript upload dialog */}
      {showUpload && (
        <div className="modal-overlay-2 fixed inset-0 bg-slate-900/30 z-50 flex items-center justify-center p-4 active" onClick={(e) => { if (e.target === e.currentTarget) setShowUpload(false); }}>
          <div className="modal-container-2 bg-white border border-slate-100 w-full max-w-lg rounded-[32px] shadow-[0_32px_80px_-16px_rgba(15,23,42,0.14)] overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">手动更新当前会议逐字稿</h3>
                <p className="text-[10px] text-slate-400 font-medium">更新或替换当前选定会议的转文字文本</p>
              </div>
              <button onClick={() => setShowUpload(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 flex items-center justify-center transition"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">选择输入方式</label>
                <div className="bg-slate-100 p-1 rounded-xl flex space-x-1 mb-2">
                  <button type="button" className="tab-btn flex-1 py-1.5 text-[11px] font-medium rounded-lg text-indigo-600 bg-white shadow-sm transition-all active">
                    <Upload className="h-3 w-3 mr-1 inline" />上传文件 (.md/.txt/.docx)
                  </button>
                  <button type="button" className="tab-btn flex-1 py-1.5 text-[11px] font-medium rounded-lg text-slate-600 transition-all">
                    手动输入
                  </button>
                </div>
                <div className="rigid-shell-container w-full relative">
                  <textarea
                    className="absolute inset-0 w-full h-full px-3.5 py-3.5 bg-slate-50/30 border border-slate-200 focus:border-indigo-500 rounded-2xl text-xs font-semibold focus:outline-none transition-all resize-none shadow-sm"
                    placeholder="请在此处直接粘贴您的会议转文字文本"
                    value={uploadText}
                    onChange={(e) => setUploadText(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end space-x-2 bg-white">
              <Button variant="outline" size="sm" onClick={() => setShowUpload(false)}>取消</Button>
              <Button size="sm" disabled={!uploadText.trim() || uploadMutation.isPending} onClick={() => uploadMutation.mutate(uploadText.trim())}>
                {uploadMutation.isPending ? "上传中..." : "确定上传"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
