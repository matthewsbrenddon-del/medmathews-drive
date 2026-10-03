"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Columns3, LayoutGrid, ListTodo, Loader2, Plus, RefreshCcw, Rows3, Square } from "lucide-react";
import { EventDetailModal, NewItemModal, SourcesPanel, type NewItemDraft } from "@/components/agenda/AgendaPanels";
import { MonthView, TimeGridView } from "@/components/agenda/CalendarViews";
import { KanbanView, TodoView } from "@/components/agenda/TaskViews";
import { fmtHoras } from "@/components/cronograma/CronogramaSetup";
import {
  CRONOGRAMA_COLOR,
  addDays,
  startOfDay,
  startOfWeek,
  useAgendaStore,
  ymd,
  type AgendaEvent,
  type AgendaTask,
  type AgendaView,
  type TaskStatus,
} from "@/lib/agenda";
import { classifyLibrary } from "@/lib/classification";
import { useClassificationStore } from "@/lib/classificationStore";
import { buildCronograma, useCronogramaStore } from "@/lib/cronograma";
import { deleteGoogleEvent, getStoredToken, insertEvent, insertGoogleTask, setGoogleTaskDone } from "@/lib/googleCalendar";
import { useLibraryStore } from "@/lib/libraryStore";
import { useQuestionProgressStore } from "@/lib/questionProgressStore";
import { useQuestionStore } from "@/lib/questionStore";
import { useStudyStore } from "@/lib/store";
import { useAgendaData } from "@/lib/useAgendaData";
import { cn } from "@/lib/utils";

const VIEWS: { id: AgendaView; label: string; icon: typeof CalendarDays }[] = [
  { id: "mes", label: "Mês", icon: LayoutGrid },
  { id: "semana", label: "Semana", icon: Columns3 },
  { id: "dia", label: "Dia", icon: Square },
  { id: "todo", label: "To-do", icon: ListTodo },
  { id: "kanban", label: "Kanban", icon: Rows3 },
];

/** Dias do cronograma de estudos como eventos de dia inteiro. */
function useCronogramaEvents(enabled: boolean): AgendaEvent[] {
  const config = useCronogramaStore((s) => s.config);
  const files = useLibraryStore((s) => s.files);
  const hydrate = useLibraryStore((s) => s.hydrate);
  const overrides = useClassificationStore((s) => s.overrides);
  const questions = useQuestionStore((s) => s.questions);
  const questionProgress = useQuestionProgressStore((s) => s.progress);
  const userStates = useStudyStore((s) => s.userStates);
  const active = enabled && config.active;

  useEffect(() => {
    if (active) hydrate();
  }, [active, hydrate]);

  return useMemo(() => {
    if (!active || files.length === 0) return [];
    const plan = buildCronograma({ config, files: classifyLibrary(files, overrides), userStates, questions, questionProgress });
    return plan.days
      .filter((d) => d.items.length > 0)
      .map((d) => {
        const aulas = d.items.filter((i) => i.kind === "aula" || i.kind === "material").length;
        const questoes = d.items.reduce((s, i) => s + (i.questionCount ?? 0), 0);
        const temas = Array.from(new Set(d.items.map((i) => i.tema)));
        return {
          id: `crono:${d.date}`,
          source: "cronograma" as const,
          calendarId: "cronograma",
          calendarName: "Cronograma MedStudy",
          title: `📚 ${temas.slice(0, 2).join(" · ")}${temas.length > 2 ? "…" : ""}`,
          start: d.date,
          end: ymd(addDays(new Date(`${d.date}T12:00:00`), 1)),
          allDay: true,
          color: CRONOGRAMA_COLOR,
          description: [`${fmtHoras(d.used)} planejados · ${aulas} aulas/materiais · ${questoes} questões`, "", ...d.items.map((i) => `• ${i.title}`)].join("\n"),
          href: "/cronograma",
        };
      });
  }, [active, config, files, overrides, userStates, questions, questionProgress]);
}

export default function AgendaPage() {
  const view = useAgendaStore((s) => s.view);
  const setView = useAgendaStore((s) => s.setView);
  const layers = useAgendaStore((s) => s.layers);
  const addEvent = useAgendaStore((s) => s.addEvent);
  const deleteEvent = useAgendaStore((s) => s.deleteEvent);
  const addTask = useAgendaStore((s) => s.addTask);
  const updateTask = useAgendaStore((s) => s.updateTask);
  const deleteTask = useAgendaStore((s) => s.deleteTask);
  const setGoogleDoing = useAgendaStore((s) => s.setGoogleDoing);
  const googleConnected = useAgendaStore((s) => s.googleConnected);
  const googleCalendars = useAgendaStore((s) => s.googleCalendars);

  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [draft, setDraft] = useState<NewItemDraft | null>(null);
  const [detail, setDetail] = useState<AgendaEvent | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Intervalo carregado: o mês inteiro em volta do cursor (cobre mês/semana/dia sem refazer a busca a cada clique).
  const range = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = addDays(startOfWeek(first), -7);
    return { start, end: addDays(start, 56) };
  }, [cursor]);

  const cronoEvents = useCronogramaEvents(layers.cronograma);
  const { events, tasks, googleState, icsErrors, lastSync, syncing, refresh, setRemoteTasks } = useAgendaData(range.start, range.end, cronoEvents);
  const calendarTasks = layers.tarefas ? tasks : [];
  const googleReady = googleConnected && googleState === "ok" && Boolean(getStoredToken());

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const days = useMemo(() => {
    if (view === "dia") return [cursor];
    const ws = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  }, [view, cursor]);

  function move(dir: -1 | 1) {
    if (view === "mes") setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1));
    else setCursor(addDays(cursor, view === "semana" ? 7 * dir : dir));
  }

  const title =
    view === "mes"
      ? cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      : view === "semana"
        ? `${days[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${days[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`
        : cursor.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  async function withError(fn: () => Promise<void>) {
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Algo deu errado.");
    }
  }

  function toggleTask(t: AgendaTask) {
    const done = t.status !== "done";
    if (t.source === "local") {
      updateTask(t.id, { status: done ? "done" : "todo" });
      return;
    }
    setRemoteTasks((list) => list.map((x) => (x.id === t.id ? { ...x, status: done ? "done" : "todo" } : x)));
    withError(async () => {
      await setGoogleTaskDone(t, done);
      refresh();
    });
  }

  function moveTask(t: AgendaTask, status: TaskStatus) {
    if (t.source === "local") {
      updateTask(t.id, { status });
      return;
    }
    setGoogleDoing(t.id, status === "doing");
    const wasDone = t.status === "done";
    const willBeDone = status === "done";
    setRemoteTasks((list) => list.map((x) => (x.id === t.id ? { ...x, status } : x)));
    if (wasDone !== willBeDone)
      withError(async () => {
        await setGoogleTaskDone(t, willBeDone);
        refresh();
      });
  }

  const syncLabel = lastSync ? `Sincronizado há ${Math.max(0, Math.round((Date.now() - lastSync.getTime()) / 1000))}s` : "Sincronizando…";
  const hasRemote = googleConnected || useAgendaStore.getState().icsFeeds.some((f) => f.enabled);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground inline-flex items-center gap-2.5">
            <CalendarDays size={22} className="text-accent" /> Agenda
          </h1>
          <p className="text-muted-foreground mt-1">Google Agenda, tarefas, cronograma e sessões de estudo — tudo num lugar só.</p>
        </div>
        <div className="flex items-center gap-2">
          {hasRemote && (
            <button type="button" onClick={refresh} className="btn-ghost btn-sm text-muted-foreground" title="Sincronizar agora">
              {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
              <span className="font-metric text-[11px]">{syncLabel}</span>
            </button>
          )}
          <button type="button" className="btn-primary" onClick={() => setDraft({ kind: view === "todo" || view === "kanban" ? "tarefa" : "evento", date: ymd(cursor) })}>
            <Plus size={15} /> Novo
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-border p-0.5 bg-muted/60">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={cn("px-3 py-1.5 text-sm rounded-lg inline-flex items-center gap-1.5 transition-colors", view === v.id ? "bg-surface shadow-card text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              <v.icon size={14} /> {v.label}
            </button>
          ))}
        </div>
        {(view === "mes" || view === "semana" || view === "dia") && (
          <div className="flex items-center gap-2">
            <button type="button" className="btn-outline btn-sm" onClick={() => setCursor(startOfDay(new Date()))}>
              Hoje
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => move(-1)} aria-label="Anterior">
              <ChevronLeft size={16} />
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => move(1)} aria-label="Próximo">
              <ChevronRight size={16} />
            </button>
            <span className="text-sm font-semibold text-foreground first-letter:uppercase min-w-[180px]">{title}</span>
          </div>
        )}
      </div>

      {actionError && <p className="text-sm text-danger">{actionError}</p>}

      <div className="grid xl:grid-cols-[1fr_280px] gap-5 items-start">
        <div className="min-w-0 order-2 xl:order-1">
          {view === "mes" && (
            <MonthView
              month={cursor}
              events={events}
              tasks={calendarTasks}
              onDayClick={(d) => {
                setCursor(d);
                setView("dia");
              }}
              onEventClick={setDetail}
              onToggleTask={toggleTask}
            />
          )}
          {(view === "semana" || view === "dia") && (
            <TimeGridView
              days={days}
              events={events}
              tasks={calendarTasks}
              onSlotClick={(d) => setDraft({ kind: "evento", date: ymd(d), time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` })}
              onEventClick={setDetail}
              onToggleTask={toggleTask}
            />
          )}
          {view === "todo" && (
            <TodoView
              tasks={tasks}
              onToggle={toggleTask}
              onDelete={(t) => deleteTask(t.id)}
              onQuickAdd={(title, due) => addTask({ title, due })}
            />
          )}
          {view === "kanban" && (
            <KanbanView tasks={tasks} onMove={moveTask} onDelete={(t) => deleteTask(t.id)} onAdd={(title, status) => addTask({ title, status })} />
          )}
        </div>
        <div className="order-1 xl:order-2">
          <SourcesPanel googleState={googleState} icsErrors={icsErrors} onSynced={refresh} />
        </div>
      </div>

      {draft && (
        <NewItemModal
          draft={draft}
          googleReady={googleReady}
          onClose={() => setDraft(null)}
          onCreateEvent={async (e) => {
            if (e.destino === "local") {
              addEvent({ title: e.title, description: e.description, allDay: e.allDay, start: e.start, end: e.end });
              return;
            }
            await insertEvent(e.destino, e);
            refresh();
          }}
          onCreateTask={async (t) => {
            if (t.destino === "google") {
              await insertGoogleTask({ title: t.title, notes: t.notes, due: t.due });
              refresh();
              return;
            }
            addTask({ title: t.title, notes: t.notes, due: t.due, dueTime: t.dueTime, prioridade: t.prioridade, tag: t.tag });
          }}
        />
      )}
      {detail && (
        <EventDetailModal
          event={detail}
          onClose={() => setDetail(null)}
          onDelete={
            detail.source === "local"
              ? () => deleteEvent(detail.id)
              : detail.source === "google" && googleReady && googleCalendars.find((c) => c.id === detail.calendarId)?.writable
                ? async () => {
                    await deleteGoogleEvent(detail.calendarId, detail.id.slice(`g:${detail.calendarId}:`.length));
                    refresh();
                  }
                : undefined
          }
        />
      )}
    </div>
  );
}
