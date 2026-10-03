"use client";

// ============================================================================
// Sincronização entre dispositivos.
//
// Todo o estado do aluno vive em stores Zustand persistidos no localStorage
// (chaves "medstudy-hub-*"). Com a conta conectada, cada chave é espelhada no
// servidor (/api/sync):
//   - ao entrar: baixa a conta e aplica no dispositivo (conta nova: envia o
//     que já existe neste navegador);
//   - ao mudar algo: envia só as chaves alteradas (com 1,5 s de folga);
//   - a cada 30 s e ao voltar para a aba: busca o que mudou em outros
//     dispositivos e aplica ao vivo (rehydrate dos stores, sem recarregar);
//   - conflito: vence a alteração mais recente daquela chave.
// ============================================================================

import { create } from "zustand";
import { useAgendaStore } from "../agenda";
import { useCadernoDockStore } from "../cadernoDockStore";
import { useCadernoStore } from "../cadernoStore";
import { useClassificationStore } from "../classificationStore";
import { useContentStore } from "../contentStore";
import { useCronogramaStore } from "../cronograma";
import { useFlashcardProgressStore } from "../flashcardProgressStore";
import { useFlashcardStore } from "../flashcardStore";
import { useFocusTimerStore } from "../focusTimerStore";
import { useHighlightStore } from "../highlightStore";
import { useLibraryNavStore } from "../libraryNavStore";
import { useNotebookStore } from "../notebookStore";
import { usePracticePrefsStore } from "../practicePrefsStore";
import { useQuestionProgressStore } from "../questionProgressStore";
import { useQuestionStore } from "../questionStore";
import { useQuizStore } from "../quizStore";
import { useSavedFilterStore } from "../savedFilterStore";
import { useStudyStore } from "../store";
import { useStudySessionStore } from "../studySessionStore";

interface PersistedStore {
  subscribe: (listener: () => void) => () => void;
  persist: { rehydrate: () => Promise<void> | void };
}

const REGISTRY: Record<string, PersistedStore> = {
  "medstudy-hub-store": useStudyStore,
  "medstudy-hub-question-progress": useQuestionProgressStore,
  "medstudy-hub-questions": useQuestionStore,
  "medstudy-hub-caderno": useCadernoStore,
  "medstudy-hub-caderno-dock": useCadernoDockStore,
  "medstudy-hub-notebooks": useNotebookStore,
  "medstudy-hub-highlights": useHighlightStore,
  "medstudy-hub-flashcards": useFlashcardStore,
  "medstudy-hub-flashcard-progress": useFlashcardProgressStore,
  "medstudy-hub-quizzes": useQuizStore,
  "medstudy-hub-study-sessions": useStudySessionStore,
  "medstudy-hub-focus-timer": useFocusTimerStore,
  "medstudy-hub-cronograma": useCronogramaStore,
  "medstudy-hub-agenda": useAgendaStore,
  "medstudy-hub-classification": useClassificationStore,
  "medstudy-hub-content": useContentStore,
  "medstudy-hub-saved-filters": useSavedFilterStore,
  "medstudy-hub-practice-prefs": usePracticePrefsStore,
  "medstudy-hub-library-nav": useLibraryNavStore,
} as unknown as Record<string, PersistedStore>;

export const SYNC_KEYS = Object.keys(REGISTRY);
const META_KEY = "medstudy-hub-sync-meta";
const PUSH_DELAY = 1500;
const PULL_EVERY = 30_000;

interface KeyMeta {
  /** Hash do valor atual no localStorage. */
  hash: string;
  /** Hash da última versão confirmada pelo servidor. */
  syncedHash?: string;
  /** Quando o valor atual foi alterado (neste ou em outro dispositivo). */
  modifiedAt: string;
}

interface SyncMeta {
  userId: string | null;
  serverTime?: string;
  keys: Record<string, KeyMeta>;
}

export type SyncStatus = "off" | "syncing" | "ok" | "offline" | "error";

export const useSyncStatus = create<{ status: SyncStatus; lastSyncAt: string | null; error: string | null }>(() => ({
  status: "off",
  lastSyncAt: null,
  error: null,
}));

function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${s.length.toString(36)}-${(h >>> 0).toString(36)}`;
}

function readMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) return JSON.parse(raw) as SyncMeta;
  } catch {
    // meta corrompida: recomeça
  }
  return { userId: null, keys: {} };
}

function writeMeta(meta: SyncMeta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // sem espaço: a sincronização segue em memória
  }
}

let meta: SyncMeta = { userId: null, keys: {} };
let currentUser: string | null = null;
let unsubscribers: (() => void)[] = [];
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pullTimer: ReturnType<typeof setInterval> | null = null;
let pushing = false;
let applying = false;

function setStatus(status: SyncStatus, error: string | null = null) {
  useSyncStatus.setState({ status, error, ...(status === "ok" ? { lastSyncAt: new Date().toISOString() } : {}) });
}

/** Lê o localStorage e marca como alterado o que mudou desde a última leitura. */
function scan(): boolean {
  let dirty = false;
  const now = new Date().toISOString();
  for (const key of SYNC_KEYS) {
    const value = localStorage.getItem(key);
    if (value === null) continue;
    const h = hashString(value);
    const km = meta.keys[key];
    if (!km || km.hash !== h) {
      meta.keys[key] = { hash: h, syncedHash: km?.syncedHash, modifiedAt: now };
    }
    if (meta.keys[key].hash !== meta.keys[key].syncedHash) dirty = true;
  }
  writeMeta(meta);
  return dirty;
}

async function applyRemote(key: string, data: string, modifiedAt: string) {
  const store = REGISTRY[key];
  if (!store) return;
  const h = hashString(data);
  meta.keys[key] = { hash: h, syncedHash: h, modifiedAt };
  try {
    localStorage.setItem(key, data);
  } catch {
    return;
  }
  applying = true;
  try {
    await store.persist.rehydrate();
  } finally {
    applying = false;
  }
  // O rehydrate pode regravar o valor normalizado (migrações) — atualiza o hash sem marcar como alteração local.
  const after = localStorage.getItem(key);
  if (after !== null && after !== data) meta.keys[key] = { hash: hashString(after), syncedHash: hashString(after), modifiedAt };
}

async function push(keepalive = false) {
  if (!currentUser || pushing) return;
  scan();
  const dirty = SYNC_KEYS.filter((k) => meta.keys[k] && meta.keys[k].hash !== meta.keys[k].syncedHash);
  if (dirty.length === 0) return;
  pushing = true;
  setStatus("syncing");
  try {
    const sent = dirty.map((key) => ({ key, data: localStorage.getItem(key) ?? "", modifiedAt: meta.keys[key].modifiedAt }));
    const res = await fetch("/api/sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ states: sent }),
      keepalive: keepalive && JSON.stringify(sent).length < 60_000,
    });
    if (res.status === 401) {
      setStatus("error", "Sessão expirada — entre novamente.");
      return;
    }
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Erro ${res.status}`);
    const body = (await res.json()) as { applied: string[]; newer: { key: string; data: string; modifiedAt: string }[] };
    for (const key of body.applied) {
      const s = sent.find((x) => x.key === key);
      if (s && meta.keys[key]) meta.keys[key].syncedHash = hashString(s.data);
    }
    for (const n of body.newer) await applyRemote(n.key, n.data, n.modifiedAt);
    writeMeta(meta);
    setStatus("ok");
  } catch (err) {
    setStatus(navigator.onLine ? "error" : "offline", err instanceof Error ? err.message : "Falha ao sincronizar.");
  } finally {
    pushing = false;
  }
}

async function pull(full = false) {
  if (!currentUser) return;
  try {
    const qs = !full && meta.serverTime ? `?since=${encodeURIComponent(meta.serverTime)}` : "";
    const res = await fetch(`/api/sync${qs}`, { cache: "no-store" });
    if (res.status === 401) {
      setStatus("error", "Sessão expirada — entre novamente.");
      return;
    }
    if (!res.ok) throw new Error(`Erro ${res.status}`);
    const body = (await res.json()) as { serverTime: string; states: { key: string; data: string; modifiedAt: string }[] };
    scan();
    for (const s of body.states) {
      if (!REGISTRY[s.key]) continue;
      const km = meta.keys[s.key];
      const localDirty = km && km.hash !== km.syncedHash;
      if (km && km.hash === hashString(s.data)) {
        km.syncedHash = km.hash;
        continue;
      }
      if (localDirty && new Date(km.modifiedAt).getTime() > new Date(s.modifiedAt).getTime()) continue; // o local é mais novo: vai no push
      await applyRemote(s.key, s.data, s.modifiedAt);
    }
    meta.serverTime = body.serverTime;
    writeMeta(meta);
    setStatus("ok");
  } catch (err) {
    setStatus(navigator.onLine ? "error" : "offline", err instanceof Error ? err.message : "Falha ao sincronizar.");
  }
}

function schedulePush() {
  if (applying || !currentUser) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => push(), PUSH_DELAY);
}

function onVisibility() {
  if (document.visibilityState === "hidden") push(true);
  else pull();
}

/** Apaga do navegador os dados do aluno (ao sair, ou ao entrar com outra conta). */
export function clearLocalData() {
  for (const key of SYNC_KEYS) localStorage.removeItem(key);
  localStorage.removeItem(META_KEY);
}

/**
 * Liga a sincronização para o usuário. Resolve depois da primeira troca com
 * o servidor, para as telas já abrirem com os dados da conta.
 */
export async function startSync(userId: string): Promise<void> {
  if (currentUser === userId) return;
  stopSync();
  meta = readMeta();

  if (meta.userId && meta.userId !== userId) {
    // Dados de outra conta neste navegador: não misturar.
    clearLocalData();
    await Promise.all(SYNC_KEYS.map((k) => REGISTRY[k].persist.rehydrate()));
    meta = { userId: null, keys: {} };
  }
  const firstTimeHere = meta.userId !== userId;
  currentUser = userId;
  setStatus("syncing");

  if (firstTimeHere) {
    // Primeiro acesso desta conta neste navegador: o que a conta já tem vence;
    // o que só existe aqui (ex.: estudou antes de criar a conta) é enviado.
    meta.serverTime = undefined;
    scan();
    const epoch = new Date(0).toISOString();
    for (const k of Object.keys(meta.keys)) {
      meta.keys[k].syncedHash = undefined;
      meta.keys[k].modifiedAt = epoch;
    }
  }
  meta.userId = userId;
  writeMeta(meta);
  await pull(true);
  await push();

  unsubscribers = SYNC_KEYS.map((key) => REGISTRY[key].subscribe(() => queueMicrotask(schedulePush)));
  pullTimer = setInterval(() => {
    if (document.visibilityState === "visible") pull();
  }, PULL_EVERY);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("online", onVisibility);
}

export function stopSync() {
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
  if (pushTimer) clearTimeout(pushTimer);
  if (pullTimer) clearInterval(pullTimer);
  pushTimer = null;
  pullTimer = null;
  document.removeEventListener("visibilitychange", onVisibility);
  window.removeEventListener("online", onVisibility);
  currentUser = null;
  setStatus("off");
}

/** Envia pendências agora (ex.: antes de sair). */
export async function flushSync() {
  await push();
}

export async function syncNow() {
  await push();
  await pull();
}
