"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@repo/ui/components/button";
import { Sparkles } from "lucide-react";

type MeetingItem = Record<string, unknown>;

interface CalendarViewProps {
  meetings: MeetingItem[];
  generatingId: string | null;
  onMeetingClick: (id: string) => void;
  onGenerate: (id: string) => void;
}

const MONTH_NAMES = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
const SUB_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEEK_DAYS = ["一", "二", "三", "四", "五", "六", "日"];

export function CalendarView({ meetings, generatingId, onMeetingClick, onGenerate }: CalendarViewProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  const isTodayMonth = year === today.getFullYear() && month === today.getMonth();
  const todayDate = today.getDate();

  // Group meetings by date
  const meetingsByDate = new Map<number, MeetingItem[]>();
  for (const m of meetings) {
    const st = m.startTime;
    if (!st) continue;
    const d = new Date(st as string);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!meetingsByDate.has(day)) meetingsByDate.set(day, []);
      meetingsByDate.get(day)!.push(m);
    }
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7;

  // Smart popover positioning
  const positionPopover = useCallback(() => {
    if (!activeDay || !popoverRef.current) return;
    const trigger = document.getElementById(`art-trigger-${activeDay}`);
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const pw = popoverRef.current.offsetWidth;
    const ph = popoverRef.current.offsetHeight;

    if (activeDay <= 7) {
      // Top edge — pop below, anchor top-left
      popoverRef.current.style.transformOrigin = "top left";
      popoverRef.current.style.top = `${rect.bottom + window.scrollY + 10}px`;
      popoverRef.current.style.left = `${rect.left + window.scrollX}px`;
    } else {
      // Center/bottom — pop above, anchor bottom-center
      popoverRef.current.style.transformOrigin = "bottom center";
      popoverRef.current.style.top = `${rect.top + window.scrollY - ph - 10}px`;
      popoverRef.current.style.left = `${rect.left + window.scrollX + rect.width / 2 - pw / 2}px`;
    }
  }, [activeDay]);

  // Sync popover position
  useEffect(() => {
    if (activeDay) positionPopover();
  }, [activeDay, positionPopover]);

  // RAF reposition listener
  useEffect(() => {
    const handleScroll = () => { if (activeDay) positionPopover(); };
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [activeDay, positionPopover]);

  // Global click-outside dismiss
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) && !(e.target as HTMLElement).closest(".art-cell")) {
        setActiveDay(null);
        setIsExpanded(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openDay = (day: number) => {
    if (activeDay === day) { setActiveDay(null); return; }
    setActiveDay(day);
    setIsExpanded(false);
  };

  const toggleMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);

    // RAF high-frequency anti-drift tracking
    let startTime: number | null = null;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      positionPopover();
      if (timestamp - startTime < 360) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        positionPopover();
      }
    };
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(animate);
  };

  const changeMonth = (dir: number) => {
    const grid = gridRef.current;
    if (!grid) return;
    setActiveDay(null);

    grid.classList.add(dir === 1 ? "slide-left-out" : "slide-right-out");
    setTimeout(() => {
      let newMonth = month + dir;
      let newYear = year;
      if (newMonth > 11) { newMonth = 0; newYear++; }
      if (newMonth < 0) { newMonth = 11; newYear--; }
      setYear(newYear);
      setMonth(newMonth);
      grid.className = `grid grid-cols-7 grid-rows-5 gap-y-1 grid-animator ${dir === 1 ? "slide-left-in" : "slide-right-in"}`;
      setTimeout(() => {
        grid.className = "grid grid-cols-7 grid-rows-5 gap-y-1 grid-animator";
      }, 50);
    }, 250);
  };

  const goBackToToday = () => {
    const grid = gridRef.current;
    if (!grid) return;
    grid.classList.add("slide-right-out");
    setTimeout(() => {
      setYear(today.getFullYear());
      setMonth(today.getMonth());
      setActiveDay(null);
      grid.className = "grid grid-cols-7 grid-rows-5 gap-y-1 grid-animator slide-left-in";
      setTimeout(() => {
        grid.className = "grid grid-cols-7 grid-rows-5 gap-y-1 grid-animator";
        const todayCell = document.getElementById(`art-trigger-${todayDate}`);
        if (todayCell) {
          todayCell.classList.add("ping-active");
          setTimeout(() => todayCell.classList.remove("ping-active"), 1600);
        }
      }, 50);
    }, 250);
  };

  const activeMeetings = activeDay ? (meetingsByDate.get(activeDay) ?? []) : [];
  const hasMore = activeMeetings.length > 3;
  const visibleMeetings = activeMeetings.slice(0, 3);
  const hiddenCount = activeMeetings.length - 3;

  const getRecordStatus = (records: Array<Record<string, unknown>>) => {
    if (records.some((r) => r.status === "processing")) return "processing";
    if (records.length > 0) {
      const allBad = records.every((r) => r.status === "failed" || r.status === "skipped");
      return allBad ? "failed" : "completed";
    }
    return null;
  };

  return (
    <div className="w-full bg-slate-100/60 p-3 rounded-[32px] border border-white/40 shadow-sm relative">
      <div className="bg-white/80 backdrop-blur-md rounded-[24px] p-6 overflow-hidden">
        {/* ── Header ── */}
        <div className="flex items-end justify-between mb-8 px-3 relative w-full">
          <div className="relative min-w-[200px]">
            <div className="absolute -left-3 -top-7 text-7xl font-black text-slate-900/[0.03] tracking-tighter select-none pointer-events-none z-0 font-sans">
              {String(month + 1).padStart(2, "0")}
            </div>
            <div className="flex items-baseline space-x-2 relative z-10 w-full">
              <h2 className="text-3xl font-black tracking-tight text-slate-900 leading-none font-sans">
                {MONTH_NAMES[month]}
              </h2>
              <span className="text-base font-light tracking-wide text-slate-400 leading-none font-sans">
                {year}
              </span>
            </div>
            <div className="flex items-center space-x-2 mt-2.5 relative z-10">
              <span className="w-2 h-1.5 rounded-sm bg-gradient-to-r from-indigo-500 to-purple-500 shadow-sm shadow-indigo-200" />
              <p className="text-[9px] font-bold text-slate-400 tracking-[0.2em] uppercase font-mono">
                {SUB_NAMES[month]} / TIMEFLOW MANAGEMENT
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 relative z-10 shrink-0">
            <button
              type="button"
              className={`btn-today bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-semibold tracking-wide px-3.5 py-2 rounded-xl shadow-md shadow-slate-900/10 flex items-center space-x-1.5 border border-slate-950/10 transition-all ${
                isTodayMonth ? "" : "show"
              }`}
              onClick={goBackToToday}
            >
              <span className="text-[8px] opacity-90">↖</span>
              <span>回到今天</span>
            </button>

            <div className="flex items-center space-x-0.5 bg-slate-100/60 p-1 rounded-xl border border-slate-200/30">
              <button type="button" onClick={() => changeMonth(-1)}
                className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg text-slate-400 hover:text-slate-800 transition-all">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button type="button" onClick={() => changeMonth(1)}
                className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg text-slate-400 hover:text-slate-800 transition-all">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── Week headers ── */}
        <div className="grid grid-cols-7 text-center mb-4 text-[10px] font-bold text-slate-400/80 tracking-widest uppercase">
          {WEEK_DAYS.map((w) => <div key={w}>{w}</div>)}
        </div>

        {/* ── Grid ── */}
        <div className="relative overflow-hidden min-h-[400px]">
          <div ref={gridRef} className="grid grid-cols-7 grid-rows-5 gap-y-1 grid-animator">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="art-cell min-h-[90px]" />
            ))}

            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dayMeetings = meetingsByDate.get(day) ?? [];
              const isToday = isTodayMonth && day === todayDate;
              const isActive = activeDay === day;
              const count = dayMeetings.length;

              return (
                <div
                  key={day}
                  id={`art-trigger-${day}`}
                  className={`art-cell min-h-[90px] p-3 flex flex-col justify-between cursor-pointer ${
                    isToday ? "today-glow" : ""
                  } ${isActive ? "ring-1 ring-indigo-200" : ""}`}
                  onClick={() => openDay(day)}
                >
                  <div className="z-10 flex justify-between items-center w-full">
                    <span className={`text-sm font-bold ${isToday ? "text-indigo-600" : "text-slate-700"}`}>
                      {String(day).padStart(2, "0")}
                    </span>
                    {count > 0 && (
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        isToday ? "bg-indigo-500 shadow-sm" : "bg-slate-300"
                      }`} />
                    )}
                  </div>
                  {count > 0 ? (
                    <span className={`z-10 text-[10px] font-semibold tracking-wide px-1.5 py-0.5 rounded-md w-max ${
                      isToday ? "text-indigo-500 bg-indigo-50/60" : "text-slate-500 bg-slate-50"
                    }`}>
                      {count}个会
                    </span>
                  ) : (
                    <span className="z-10 text-[10px] text-transparent">·</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Popover ── */}
      {activeDay && (
        <div
          ref={popoverRef}
          id="ultimate-popover"
          className="ultimate-popover fixed z-50 rounded-[24px] w-[340px] p-5 flex flex-col active"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3.5 shrink-0">
            <span className="text-xs font-bold text-slate-900 tracking-tight">
              {month + 1}月{String(activeDay).padStart(2, "0")}日
            </span>
            <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold tracking-wider">
              {activeMeetings.length} MEETINGS
            </span>
          </div>

          {/* Visible meeting cards */}
          <div className="space-y-2 shrink-0">
            {visibleMeetings.map((m) => {
              const id = m.id as string;
              const topic = (m.topic as string) || "未命名会议";
              const startTime = m.startTime ? new Date(m.startTime as string) : null;
              const endTime = m.endTime ? new Date(m.endTime as string) : null;
              const records = (m.meetingRecords as Array<Record<string, unknown>>) ?? [];
              const recStatus = getRecordStatus(records);

              return (
                <div
                  key={id}
                  className="p-3 bg-white/90 border border-slate-100 rounded-xl shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => onMeetingClick(id)}
                >
                  <div className="flex justify-between items-start">
                    <h4 className="text-xs font-semibold text-slate-800 truncate max-w-[180px]">{topic}</h4>
                    <span className="text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-bold">
                      {(m.source as string) === "manual" ? "手动" : "飞书"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                    <span className="font-medium">
                      {startTime ? `${startTime.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}${endTime ? ` - ${endTime.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}` : ""}` : ""}
                    </span>
                    {recStatus === "completed" ? (
                      <span className="text-emerald-600 font-bold flex items-center bg-emerald-50 px-1.5 py-0.5 rounded-md">
                        {records.length}份纪要
                      </span>
                    ) : recStatus === "processing" ? (
                      <span className="text-blue-600 font-bold flex items-center bg-blue-50 px-1.5 py-0.5 rounded-md">
                        处理中
                      </span>
                    ) : recStatus === "failed" ? (
                      <span className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md">失败</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px]"
                        disabled={generatingId === id}
                        onClick={(e) => { e.stopPropagation(); onGenerate(id); }}
                      >
                        <Sparkles className="h-3 w-3 mr-0.5" />生成纪要
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {visibleMeetings.length === 0 && (
              <div className="text-center py-6 text-xs text-slate-400">当天暂无会议</div>
            )}
          </div>

          {/* Expandable more-meetings slot */}
          {hasMore && (
            <>
              <div id="expanded-box" className={`more-meetings-container space-y-2 ${isExpanded ? "expanded" : ""}`}>
                {activeMeetings.slice(3).map((m) => {
                  const id = m.id as string;
                  const topic = (m.topic as string) || "未命名会议";
                  const records = (m.meetingRecords as Array<Record<string, unknown>>) ?? [];
                  const recStatus = getRecordStatus(records);

                  return (
                    <div
                      key={id}
                      className="p-3 bg-white/90 border border-slate-100 rounded-xl shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => onMeetingClick(id)}
                    >
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-semibold text-slate-800 truncate max-w-[180px]">{topic}</h4>
                        <span className="text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-bold">
                          {(m.source as string) === "manual" ? "手动" : "飞书"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                        <span className="font-medium">{(m.participantCount as number) ?? 0}人</span>
                        {recStatus === "completed" ? (
                          <span className="text-emerald-600 font-bold flex items-center bg-emerald-50 px-1.5 py-0.5 rounded-md">
                            {records.length}份纪要
                          </span>
                        ) : recStatus === "processing" ? (
                          <span className="text-blue-600 font-bold flex items-center bg-blue-50 px-1.5 py-0.5 rounded-md">处理中</span>
                        ) : (
                          <span className="text-slate-400">暂无纪要</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-center shrink-0">
                <button
                  type="button"
                  onClick={toggleMore}
                  className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-all flex items-center space-x-1 py-0.5 px-3 rounded-full hover:bg-slate-50"
                >
                  <span>{isExpanded ? "收起内容" : `展开更多 (还有 ${hiddenCount} 场)`}</span>
                  <svg className={`w-2 h-2 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
