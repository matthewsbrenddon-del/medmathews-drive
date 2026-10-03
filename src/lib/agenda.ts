"use client";

// ============================================================================
// Agenda — eventos e tarefas de várias fontes numa visão só:
//   - Google Agenda (conta conectada via OAuth no navegador: lê e cria
//     eventos; lê/conclui/cria tarefas do Google Tasks)
//   - Google Agenda por link iCal secreto (somente leitura, sem configurar nada)
//   - Eventos e tarefas criados aqui (locais)
//   - Camadas da própria plataforma: Cronograma e sessões de estudo (Pomodoro)
// ============================================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { seededHash } from "./utils";

export type EventSource = "google" | "ics" | "local" | "cronograma" | "foco";

export interface AgendaEvent {
  id: string;
  source: EventSource;
  calendarId: string;
  calendarName: string;
  title: string;
  /** ISO datetime; ou YYYY-MM-DD quando allDay (fim exclusivo). */
  start: string;
  end: string;
  allDay: boolean;
  color: string;
  location?: string;
  description?: string;
  link?: string;
  /** Rota interna para abrir (ex.: /cronograma). */
  href?: string;
}

export type TaskStatus = "todo" | "doing" | "done";

export interface AgendaTask {
  id: string;
  source: "local" | "google";
  /** Lista do Google Tasks. */
  listId?: string;
  listName?: string;
  title: string;
  notes?: string;
  /** YYYY-MM-DD */
  due?: string;
  /** HH:mm (só local — o Google Tasks não guarda horário) */
  dueTime?: string;
  status: TaskStatus;
  prioridade?: 1 | 2 | 3;
  tag?: string;
  createdAt: string;
  completedAt?: string;
}

export interface IcsFeed {
  id: string;
  url: string;
  name: string;
  color: string;
  enabled: boolean;
}

export interface GoogleCalendarInfo {
  id: string;
  summary: string;
  color: string;
  enabled: boolean;
  writable: boolean;
  primary?: boolean;
}

export type AgendaView = "mes" | "semana" | "dia" | "todo" | "kanban";

export const FEED_COLORS = ["#4285f4", "#0b8043", "#8e24aa", "#e67c73", "#f6bf26", "#039be5", "#d50000", "#33b679"];
export const LOCAL_COLOR = "#f59e0b";
export const CRONOGRAMA_COLOR = "#a855f7";
export const FOCO_COLOR = "#f97316";

interface AgendaState {
  view: AgendaView;
  localEvents: AgendaEvent[];
  tasks: AgendaTask[];
  /** Coluna "Fazendo" para tarefas do Google (o Google Tasks só tem pendente/concluída). */
  googleDoing: Record<string, true>;
  icsFeeds: IcsFeed[];
  googleCalendars: GoogleCalendarInfo[];
  googleConnected: boolean;
  /** Client ID OAuth informado pelo aluno (quando não há NEXT_PUBLIC_GOOGLE_CLIENT_ID). */
  googleClientId: string;
  layers: { local: boolean; cronograma: boolean; foco: boolean; tarefas: boolean; googleTasks: boolean };

  setView: (v: AgendaView) => void;
  addEvent: (e: Omit<AgendaEvent, "id" | "source" | "calendarId" | "calendarName" | "color"> & { color?: string }) => void;
  updateEvent: (id: string, patch: Partial<AgendaEvent>) => void;
  deleteEvent: (id: string) => void;
  addTask: (t: Omit<AgendaTask, "id" | "source" | "createdAt" | "status"> & { status?: TaskStatus }) => void;
  updateTask: (id: string, patch: Partial<AgendaTask>) => void;
  deleteTask: (id: string) => void;
  setGoogleDoing: (id: string, doing: boolean) => void;
  addFeed: (url: string, name: string) => void;
  updateFeed: (id: string, patch: Partial<IcsFeed>) => void;
  removeFeed: (id: string) => void;
  setGoogleCalendars: (cals: GoogleCalendarInfo[]) => void;
  toggleGoogleCalendar: (id: string) => void;
  setGoogleConnected: (v: boolean) => void;
  setGoogleClientId: (v: string) => void;
  toggleLayer: (k: keyof AgendaState["layers"]) => void;
}

const uid = (p: string) => `${p}-${seededHash(`${Date.now()}-${Math.random()}`)}`;

export const useAgendaStore = create<AgendaState>()(
  persist(
    (set) => ({
      view: "semana",
      localEvents: [],
      tasks: [],
      googleDoing: {},
      icsFeeds: [],
      googleCalendars: [],
      googleConnected: false,
      googleClientId: "",
      layers: { local: true, cronograma: true, foco: true, tarefas: true, googleTasks: true },

      setView: (view) => set({ view }),
      addEvent: (e) =>
        set((s) => ({
          localEvents: [
            ...s.localEvents,
            { ...e, id: uid("evt"), source: "local", calendarId: "local", calendarName: "MedStudy", color: e.color ?? LOCAL_COLOR },
          ],
        })),
      updateEvent: (id, patch) => set((s) => ({ localEvents: s.localEvents.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      deleteEvent: (id) => set((s) => ({ localEvents: s.localEvents.filter((e) => e.id !== id) })),
      addTask: (t) =>
        set((s) => ({
          tasks: [...s.tasks, { ...t, id: uid("tsk"), source: "local", createdAt: new Date().toISOString(), status: t.status ?? "todo" }],
        })),
      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? { ...t, ...patch, ...(patch.status ? { completedAt: patch.status === "done" ? new Date().toISOString() : undefined } : {}) }
              : t
          ),
        })),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      setGoogleDoing: (id, doing) =>
        set((s) => {
          const next = { ...s.googleDoing };
          if (doing) next[id] = true;
          else delete next[id];
          return { googleDoing: next };
        }),
      addFeed: (url, name) =>
        set((s) => ({
          icsFeeds: [...s.icsFeeds, { id: uid("ics"), url: url.trim(), name: name.trim() || "Google Agenda", color: FEED_COLORS[s.icsFeeds.length % FEED_COLORS.length], enabled: true }],
        })),
      updateFeed: (id, patch) => set((s) => ({ icsFeeds: s.icsFeeds.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
      removeFeed: (id) => set((s) => ({ icsFeeds: s.icsFeeds.filter((f) => f.id !== id) })),
      setGoogleCalendars: (cals) =>
        set((s) => ({
          googleCalendars: cals.map((c) => ({ ...c, enabled: s.googleCalendars.find((x) => x.id === c.id)?.enabled ?? c.enabled })),
        })),
      toggleGoogleCalendar: (id) => set((s) => ({ googleCalendars: s.googleCalendars.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)) })),
      setGoogleConnected: (googleConnected) => set({ googleConnected }),
      setGoogleClientId: (googleClientId) => set({ googleClientId: googleClientId.trim() }),
      toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
    }),
    {
      name: "medstudy-hub-agenda",
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AgendaState>;
        return { ...current, ...p, layers: { ...current.layers, ...(p.layers ?? {}) } };
      },
    }
  )
);

// ---------------------------------------------------------------------------
// Datas (sempre no fuso local do aluno)
// ---------------------------------------------------------------------------

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** Início e fim (exclusivo) do evento como Date local. */
export function eventBounds(e: AgendaEvent): { start: Date; end: Date } {
  if (e.allDay) {
    const start = parseYmd(e.start.slice(0, 10));
    const end = e.end ? parseYmd(e.end.slice(0, 10)) : addDays(start, 1);
    return { start, end: end > start ? end : addDays(start, 1) };
  }
  const start = new Date(e.start);
  const end = new Date(e.end || e.start);
  return { start, end: end > start ? end : new Date(start.getTime() + 30 * 60_000) };
}

/** Eventos que tocam o dia (para mês/semana/dia). */
export function eventsOnDay(events: AgendaEvent[], day: Date): AgendaEvent[] {
  const ds = startOfDay(day);
  const de = addDays(ds, 1);
  return events.filter((e) => {
    const { start, end } = eventBounds(e);
    return start < de && end > ds;
  });
}

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
