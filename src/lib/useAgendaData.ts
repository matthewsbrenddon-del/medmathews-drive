"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FOCO_COLOR, eventBounds, useAgendaStore, type AgendaEvent, type AgendaTask } from "./agenda";
import { GoogleAuthError, getStoredToken, listCalendars, listEvents, listGoogleTasks } from "./googleCalendar";
import { STUDY_KIND_LABELS, useStudySessionStore } from "./studySessionStore";

const POLL_MS = 60_000;

export type SyncState = "off" | "ok" | "loading" | "expired" | "error";

/**
 * Junta todas as fontes da Agenda no intervalo pedido. Google (conta ou iCal)
 * é sincronizado ao abrir, a cada minuto e sempre que a aba volta ao foco —
 * eventos criados/alterados no Google aparecem aqui sem recarregar a página.
 */
export function useAgendaData(rangeStart: Date, rangeEnd: Date, extraEvents: AgendaEvent[] = []) {
  const localEvents = useAgendaStore((s) => s.localEvents);
  const localTasks = useAgendaStore((s) => s.tasks);
  const icsFeeds = useAgendaStore((s) => s.icsFeeds);
  const googleCalendars = useAgendaStore((s) => s.googleCalendars);
  const googleConnected = useAgendaStore((s) => s.googleConnected);
  const googleDoing = useAgendaStore((s) => s.googleDoing);
  const layers = useAgendaStore((s) => s.layers);
  const setGoogleCalendars = useAgendaStore((s) => s.setGoogleCalendars);
  const sessions = useStudySessionStore((s) => s.sessions);

  const [remote, setRemote] = useState<{ google: AgendaEvent[]; ics: AgendaEvent[]; gtasks: AgendaTask[] }>({ google: [], ics: [], gtasks: [] });
  const [googleState, setGoogleState] = useState<SyncState>("off");
  const [icsErrors, setIcsErrors] = useState<Record<string, string>>({});
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const runRef = useRef(0);

  const fromIso = rangeStart.toISOString();
  const toIso = rangeEnd.toISOString();
  const feedsKey = JSON.stringify(icsFeeds.filter((f) => f.enabled).map((f) => [f.id, f.url, f.color, f.name]));
  const calsKey = JSON.stringify(googleCalendars.filter((c) => c.enabled).map((c) => [c.id, c.color]));

  const sync = useCallback(async () => {
    const run = ++runRef.current;
    setSyncing(true);
    const from = new Date(fromIso);
    const to = new Date(toIso);

    // iCal
    const feeds = icsFeeds.filter((f) => f.enabled);
    const icsResults = await Promise.all(
      feeds.map(async (f) => {
        try {
          const res = await fetch(`/api/calendar/ics?${new URLSearchParams({ url: f.url, from: fromIso, to: toIso })}`, { cache: "no-store" });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
          return {
            id: f.id,
            events: (data.events as { id: string; title: string; start: string; end: string; allDay: boolean; location?: string; description?: string }[]).map(
              (e) =>
                ({
                  ...e,
                  id: `ics:${f.id}:${e.id}`,
                  source: "ics",
                  calendarId: f.id,
                  calendarName: f.name || data.calendarName,
                  color: f.color,
                }) as AgendaEvent
            ),
          };
        } catch (err) {
          return { id: f.id, error: err instanceof Error ? err.message : "Falha ao ler o calendário." };
        }
      })
    );

    // Conta Google
    let google: AgendaEvent[] = [];
    let gtasks: AgendaTask[] = [];
    let gState: SyncState = "off";
    if (googleConnected) {
      if (!getStoredToken()) gState = "expired";
      else {
        try {
          let cals = useAgendaStore.getState().googleCalendars;
          if (cals.length === 0) {
            setGoogleCalendars(await listCalendars());
            cals = useAgendaStore.getState().googleCalendars;
          }
          const lists = await Promise.all(cals.filter((c) => c.enabled).map((c) => listEvents(c, from, to)));
          google = lists.flat();
          gtasks = await listGoogleTasks(useAgendaStore.getState().googleDoing);
          gState = "ok";
        } catch (err) {
          gState = err instanceof GoogleAuthError ? "expired" : "error";
        }
      }
    }

    if (run !== runRef.current) return; // uma sincronização mais nova já começou
    const errors: Record<string, string> = {};
    const ics: AgendaEvent[] = [];
    for (const r of icsResults) {
      if ("error" in r && r.error) errors[r.id] = r.error;
      else if ("events" in r && r.events) ics.push(...r.events);
    }
    setIcsErrors(errors);
    setRemote((prev) => ({ google: gState === "ok" ? google : gState === "off" ? [] : prev.google, ics, gtasks: gState === "ok" ? gtasks : gState === "off" ? [] : prev.gtasks }));
    setGoogleState(gState);
    setLastSync(new Date());
    setSyncing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromIso, toIso, feedsKey, calsKey, googleConnected]);

  useEffect(() => {
    sync();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") sync();
    }, POLL_MS);
    const onFocus = () => sync();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [sync]);

  const events = useMemo(() => {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    const inRange = (e: AgendaEvent) => {
      const { start, end } = eventBounds(e);
      return start < to && end > from;
    };
    const focus: AgendaEvent[] = layers.foco
      ? sessions
          .filter((s) => s.endedAt >= fromIso && s.startedAt < toIso && s.durationSeconds >= 120)
          .map((s) => ({
            id: `foco:${s.id}`,
            source: "foco",
            calendarId: "foco",
            calendarName: "Sessões de estudo",
            title: `${s.kind === "foco" ? "⏱" : "📘"} ${s.label || STUDY_KIND_LABELS[s.kind]}`,
            start: s.startedAt,
            end: s.endedAt,
            allDay: false,
            color: FOCO_COLOR,
            href: "/foco",
          }))
      : [];
    return [...(layers.local ? localEvents : []), ...remote.google, ...remote.ics, ...extraEvents, ...focus].filter(inRange);
  }, [fromIso, toIso, layers.local, layers.foco, localEvents, remote, extraEvents, sessions]);

  const tasks = useMemo(() => {
    const google = layers.googleTasks ? remote.gtasks.map((t) => (t.status !== "done" ? { ...t, status: googleDoing[t.id] ? ("doing" as const) : ("todo" as const) } : t)) : [];
    return [...localTasks, ...google];
  }, [localTasks, remote.gtasks, googleDoing, layers.googleTasks]);

  return { events, tasks, googleState, icsErrors, lastSync, syncing, refresh: sync, setRemoteTasks: (fn: (t: AgendaTask[]) => AgendaTask[]) => setRemote((r) => ({ ...r, gtasks: fn(r.gtasks) })) };
}
