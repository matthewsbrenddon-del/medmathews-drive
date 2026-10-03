"use client";

// ============================================================================
// Google Agenda + Google Tasks direto do navegador (Google Identity Services).
//
// Precisa de um "ID do cliente OAuth" (tipo Aplicativo da Web) do Google Cloud,
// com a origem do site autorizada — em NEXT_PUBLIC_GOOGLE_CLIENT_ID ou colado
// pelo aluno na Agenda. O token de acesso fica só nesta aba (sessionStorage),
// expira em ~1h e nunca vai para o nosso servidor.
// ============================================================================

import type { AgendaEvent, AgendaTask, GoogleCalendarInfo } from "./agenda";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/tasks",
].join(" ");

const TOKEN_KEY = "medstudy-google-token";
const CAL_API = "https://www.googleapis.com/calendar/v3";
const TASKS_API = "https://tasks.googleapis.com/tasks/v1";

export const ENV_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export class GoogleAuthError extends Error {}

interface StoredToken {
  access_token: string;
  expires_at: number;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GisOauth2 {
  initTokenClient: (cfg: {
    client_id: string;
    scope: string;
    callback: (r: TokenResponse) => void;
    error_callback?: (e: { type: string; message?: string }) => void;
  }) => { requestAccessToken: (o?: { prompt?: string }) => void };
  revoke: (token: string, done?: () => void) => void;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GisOauth2 } };
  }
}

let gisPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("sem navegador"));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        gisPromise = null;
        reject(new Error("Não foi possível carregar o login do Google."));
      };
      document.head.appendChild(s);
    });
  }
  return gisPromise;
}

/** Carrega o script do Google antes do clique, para o popup de login não ser bloqueado. */
export function preloadGoogle() {
  loadGis().catch(() => undefined);
}

export function getStoredToken(): string | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as StoredToken;
    return t.expires_at > Date.now() + 60_000 ? t.access_token : null;
  } catch {
    return null;
  }
}

function storeToken(r: TokenResponse) {
  if (!r.access_token) return;
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ access_token: r.access_token, expires_at: Date.now() + (r.expires_in ?? 3600) * 1000 }));
  } catch {
    // sessionStorage indisponível: o token vale só enquanto a página estiver aberta
  }
}

/** Abre o consentimento do Google (precisa ser chamado num clique). */
export async function requestGoogleToken(clientId: string, prompt: "" | "consent" = ""): Promise<string> {
  if (!clientId) throw new GoogleAuthError("Configure o ID do cliente OAuth do Google primeiro.");
  await loadGis();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new GoogleAuthError("Login do Google indisponível.");
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (r) => {
        if (r.error || !r.access_token) return reject(new GoogleAuthError(r.error_description || r.error || "Acesso negado."));
        storeToken(r);
        resolve(r.access_token);
      },
      error_callback: (e) => reject(new GoogleAuthError(e.type === "popup_closed" ? "Janela do Google fechada." : e.message || "Falha no login.")),
    });
    client.requestAccessToken({ prompt });
  });
}

export function disconnectGoogle() {
  const t = getStoredToken();
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
  if (t) window.google?.accounts?.oauth2?.revoke(t);
}

async function gfetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  if (!token) throw new GoogleAuthError("Sessão do Google expirada.");
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status === 401) {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
    throw new GoogleAuthError("Sessão do Google expirada.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Google respondeu ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

interface GCalListEntry {
  id: string;
  summary: string;
  summaryOverride?: string;
  backgroundColor?: string;
  accessRole: string;
  primary?: boolean;
  selected?: boolean;
}

export async function listCalendars(): Promise<GoogleCalendarInfo[]> {
  const data = await gfetch<{ items: GCalListEntry[] }>(`${CAL_API}/users/me/calendarList?maxResults=100`);
  return (data.items ?? []).map((c) => ({
    id: c.id,
    summary: c.summaryOverride || c.summary,
    color: c.backgroundColor ?? "#4285f4",
    enabled: c.primary || c.selected !== false,
    writable: c.accessRole === "owner" || c.accessRole === "writer",
    primary: c.primary,
  }));
}

interface GEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
}

export async function listEvents(cal: GoogleCalendarInfo, timeMin: Date, timeMax: Date): Promise<AgendaEvent[]> {
  const out: AgendaEvent[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 5; page++) {
    const p = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    if (pageToken) p.set("pageToken", pageToken);
    const data = await gfetch<{ items: GEvent[]; nextPageToken?: string }>(`${CAL_API}/calendars/${encodeURIComponent(cal.id)}/events?${p}`);
    for (const e of data.items ?? []) {
      if (e.status === "cancelled") continue;
      const allDay = Boolean(e.start.date);
      out.push({
        id: `g:${cal.id}:${e.id}`,
        source: "google",
        calendarId: cal.id,
        calendarName: cal.summary,
        title: e.summary || "(sem título)",
        start: allDay ? e.start.date! : e.start.dateTime!,
        end: allDay ? e.end.date ?? e.start.date! : e.end.dateTime ?? e.start.dateTime!,
        allDay,
        color: cal.color,
        location: e.location,
        description: e.description?.slice(0, 1000),
        link: e.htmlLink,
      });
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

export async function insertEvent(
  calendarId: string,
  ev: { title: string; description?: string; allDay: boolean; start: string; end: string }
): Promise<void> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const body = {
    summary: ev.title,
    description: ev.description,
    start: ev.allDay ? { date: ev.start } : { dateTime: ev.start, timeZone: tz },
    end: ev.allDay ? { date: ev.end } : { dateTime: ev.end, timeZone: tz },
  };
  await gfetch(`${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events`, { method: "POST", body: JSON.stringify(body) });
}

export async function deleteGoogleEvent(calendarId: string, eventId: string): Promise<void> {
  await gfetch(`${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Tarefas (Google Tasks)
// ---------------------------------------------------------------------------

interface GTask {
  id: string;
  title?: string;
  notes?: string;
  due?: string;
  status: "needsAction" | "completed";
  completed?: string;
  updated?: string;
  deleted?: boolean;
  hidden?: boolean;
}

export async function listGoogleTasks(doing: Record<string, true>): Promise<AgendaTask[]> {
  const lists = await gfetch<{ items: { id: string; title: string }[] }>(`${TASKS_API}/users/@me/lists?maxResults=20`);
  const out: AgendaTask[] = [];
  for (const list of lists.items ?? []) {
    const p = new URLSearchParams({ maxResults: "100", showCompleted: "true", showHidden: "true" });
    const data = await gfetch<{ items?: GTask[] }>(`${TASKS_API}/lists/${encodeURIComponent(list.id)}/tasks?${p}`);
    for (const t of data.items ?? []) {
      if (t.deleted || !t.title?.trim()) continue;
      const id = `gt:${list.id}:${t.id}`;
      out.push({
        id,
        source: "google",
        listId: list.id,
        listName: list.title,
        title: t.title,
        notes: t.notes,
        due: t.due?.slice(0, 10),
        status: t.status === "completed" ? "done" : doing[id] ? "doing" : "todo",
        createdAt: t.updated ?? new Date().toISOString(),
        completedAt: t.completed,
      });
    }
  }
  return out;
}

export async function setGoogleTaskDone(task: AgendaTask, done: boolean): Promise<void> {
  const [, listId, taskId] = task.id.split(":");
  await gfetch(`${TASKS_API}/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    body: JSON.stringify(done ? { status: "completed" } : { status: "needsAction", completed: null }),
  });
}

export async function insertGoogleTask(t: { title: string; notes?: string; due?: string }): Promise<void> {
  const lists = await gfetch<{ items: { id: string }[] }>(`${TASKS_API}/users/@me/lists?maxResults=1`);
  const listId = lists.items?.[0]?.id;
  if (!listId) throw new Error("Nenhuma lista de tarefas no Google.");
  await gfetch(`${TASKS_API}/lists/${encodeURIComponent(listId)}/tasks`, {
    method: "POST",
    body: JSON.stringify({ title: t.title, notes: t.notes, ...(t.due ? { due: `${t.due}T00:00:00.000Z` } : {}) }),
  });
}
