"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckSquare, Square } from "lucide-react";
import { addDays, eventBounds, eventsOnDay, fmtTime, startOfDay, startOfWeek, ymd, type AgendaEvent, type AgendaTask } from "@/lib/agenda";
import { cn } from "@/lib/utils";

const HOUR_PX = 48;
const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function Chip({ e, onClick, compact }: { e: AgendaEvent; onClick: () => void; compact?: boolean }) {
  const { start } = eventBounds(e);
  return (
    <button
      type="button"
      onClick={(ev) => {
        ev.stopPropagation();
        onClick();
      }}
      title={e.title}
      className={cn("w-full truncate rounded-md px-1.5 text-left leading-snug hover:brightness-110", compact ? "text-[10px] py-0" : "text-[11px] py-0.5")}
      style={e.allDay ? { background: e.color, color: "#fff" } : { color: e.color, background: `${e.color}1f` }}
    >
      {!e.allDay && <span className="font-metric opacity-80 mr-1">{fmtTime(start)}</span>}
      {e.title}
    </button>
  );
}

function TaskChip({ t, onToggle }: { t: AgendaTask; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(ev) => {
        ev.stopPropagation();
        onToggle();
      }}
      title={t.title}
      className={cn("w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] inline-flex items-center gap-1 border border-dashed border-border hover:bg-surface-hover", t.status === "done" && "line-through text-muted-foreground")}
    >
      {t.status === "done" ? <CheckSquare size={11} className="shrink-0 text-success" /> : <Square size={11} className="shrink-0" />}
      <span className="truncate">{t.title}</span>
    </button>
  );
}

export function MonthView({
  month,
  events,
  tasks,
  onDayClick,
  onEventClick,
  onToggleTask,
}: {
  month: Date;
  events: AgendaEvent[];
  tasks: AgendaTask[];
  onDayClick: (d: Date) => void;
  onEventClick: (e: AgendaEvent) => void;
  onToggleTask: (t: AgendaTask) => void;
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = ymd(new Date());

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const inMonth = d.getMonth() === month.getMonth();
          const key = ymd(d);
          const dayEvents = eventsOnDay(events, d).sort((a, b) => Number(b.allDay) - Number(a.allDay) || eventBounds(a).start.getTime() - eventBounds(b).start.getTime());
          const dayTasks = tasks.filter((t) => t.due === key);
          const items = dayEvents.length + dayTasks.length;
          const max = 3;
          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => onDayClick(d)}
              onKeyDown={(e) => e.key === "Enter" && onDayClick(d)}
              className={cn("min-h-[112px] border-b border-r border-border/60 p-1.5 flex flex-col gap-1 cursor-pointer hover:bg-surface-hover/50", !inMonth && "bg-muted/20")}
            >
              <span
                className={cn(
                  "self-start text-xs font-metric h-6 min-w-6 px-1 inline-flex items-center justify-center rounded-full",
                  key === today ? "bg-primary text-primary-foreground font-semibold" : inMonth ? "text-foreground" : "text-muted-foreground/60"
                )}
              >
                {d.getDate()}
              </span>
              {dayEvents.slice(0, max).map((e) => (
                <Chip key={e.id} e={e} onClick={() => onEventClick(e)} compact />
              ))}
              {dayTasks.slice(0, Math.max(0, max - dayEvents.length)).map((t) => (
                <TaskChip key={t.id} t={t} onToggle={() => onToggleTask(t)} />
              ))}
              {items > max && <span className="text-[10px] text-muted-foreground pl-1">+{items - max} mais</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface Placed {
  e: AgendaEvent;
  top: number;
  height: number;
  col: number;
  cols: number;
  start: Date;
  end: Date;
}

function layoutDay(events: AgendaEvent[], day: Date): Placed[] {
  const ds = startOfDay(day);
  const de = addDays(ds, 1);
  const items = events
    .filter((e) => !e.allDay)
    .map((e) => {
      const b = eventBounds(e);
      const start = b.start < ds ? ds : b.start;
      const end = b.end > de ? de : b.end;
      return { e, start, end };
    })
    .filter((x) => x.end > x.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());

  const placed: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = 0;
  let columnsEnd: number[] = [];
  const flush = () => {
    const n = columnsEnd.length;
    for (const p of cluster) p.cols = n;
    cluster = [];
    columnsEnd = [];
  };
  for (const it of items) {
    const s = it.start.getTime();
    if (s >= clusterEnd && cluster.length) flush();
    let col = columnsEnd.findIndex((end) => end <= s);
    if (col === -1) {
      col = columnsEnd.length;
      columnsEnd.push(it.end.getTime());
    } else columnsEnd[col] = it.end.getTime();
    const minutes = (it.start.getTime() - ds.getTime()) / 60000;
    const dur = (it.end.getTime() - it.start.getTime()) / 60000;
    const p: Placed = { e: it.e, top: (minutes / 60) * HOUR_PX, height: Math.max(18, (dur / 60) * HOUR_PX - 2), col, cols: 1, start: it.start, end: it.end };
    cluster.push(p);
    placed.push(p);
    clusterEnd = Math.max(clusterEnd, it.end.getTime());
  }
  flush();
  return placed;
}

export function TimeGridView({
  days,
  events,
  tasks,
  onSlotClick,
  onEventClick,
  onToggleTask,
}: {
  days: Date[];
  events: AgendaEvent[];
  tasks: AgendaTask[];
  onSlotClick: (d: Date) => void;
  onEventClick: (e: AgendaEvent) => void;
  onToggleTask: (t: AgendaTask) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = useNow();
  const todayKey = ymd(now);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_PX;
  }, []);

  const laid = useMemo(() => days.map((d) => layoutDay(events, d)), [days, events]);
  const allDay = days.map((d) => eventsOnDay(events, d).filter((e) => e.allDay));
  const dayTasks = days.map((d) => tasks.filter((t) => t.due === ymd(d)));
  const hasTop = allDay.some((l) => l.length) || dayTasks.some((l) => l.length);

  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="grid border-b border-border bg-muted/30" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}>
        <div />
        {days.map((d) => {
          const isToday = ymd(d) === todayKey;
          return (
            <div key={ymd(d)} className="px-2 py-2 text-center border-l border-border/60">
              <p className={cn("text-[11px] uppercase tracking-wide", isToday ? "text-primary font-semibold" : "text-muted-foreground")}>
                {d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
              </p>
              <p className={cn("text-lg font-metric leading-tight", isToday ? "text-primary" : "text-foreground")}>{d.getDate()}</p>
            </div>
          );
        })}
      </div>
      {hasTop && (
        <div className="grid border-b border-border" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}>
          <div className="text-[10px] text-muted-foreground px-1 py-1.5 text-right">dia todo</div>
          {days.map((d, i) => (
            <div key={ymd(d)} className="border-l border-border/60 p-1 flex flex-col gap-1 max-h-32 overflow-y-auto">
              {allDay[i].map((e) => (
                <Chip key={e.id} e={e} onClick={() => onEventClick(e)} />
              ))}
              {dayTasks[i].map((t) => (
                <TaskChip key={t.id} t={t} onToggle={() => onToggleTask(t)} />
              ))}
            </div>
          ))}
        </div>
      )}
      <div ref={scrollRef} className="relative overflow-y-auto" style={{ maxHeight: "68vh" }}>
        <div className="grid relative" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))`, height: 24 * HOUR_PX }}>
          <div className="relative">
            {Array.from({ length: 24 }).map((_, h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[10px] font-metric text-muted-foreground" style={{ top: h * HOUR_PX }}>
                {h > 0 ? `${String(h).padStart(2, "0")}:00` : ""}
              </span>
            ))}
          </div>
          {days.map((d, i) => {
            const isToday = ymd(d) === todayKey;
            return (
              <div
                key={ymd(d)}
                className={cn("relative border-l border-border/60", isToday && "bg-primary/[0.03]")}
                onClick={(ev) => {
                  const rect = (ev.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const minutes = Math.floor(((ev.clientY - rect.top) / HOUR_PX) * 2) * 30;
                  const slot = startOfDay(d);
                  slot.setMinutes(minutes);
                  onSlotClick(slot);
                }}
              >
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-border/40" style={{ top: h * HOUR_PX }} />
                ))}
                {laid[i].map((p) => (
                  <button
                    key={p.e.id}
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onEventClick(p.e);
                    }}
                    className="absolute rounded-lg px-1.5 py-1 text-left overflow-hidden border-l-[3px] hover:brightness-110 shadow-sm"
                    style={{
                      top: p.top,
                      height: p.height,
                      left: `calc(${(p.col / p.cols) * 100}% + 2px)`,
                      width: `calc(${100 / p.cols}% - 4px)`,
                      background: `${p.e.color}26`,
                      borderColor: p.e.color,
                    }}
                    title={`${p.e.title} · ${fmtTime(p.start)}–${fmtTime(p.end)}`}
                  >
                    <span className="block text-[11px] font-medium text-foreground leading-tight line-clamp-2">{p.e.title}</span>
                    {p.height > 34 && (
                      <span className="block text-[10px] font-metric text-muted-foreground">
                        {fmtTime(p.start)}–{fmtTime(p.end)}
                      </span>
                    )}
                  </button>
                ))}
                {isToday && (
                  <div className="absolute inset-x-0 z-10 pointer-events-none" style={{ top: ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_PX }}>
                    <div className="h-0.5 bg-danger relative">
                      <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-danger" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
