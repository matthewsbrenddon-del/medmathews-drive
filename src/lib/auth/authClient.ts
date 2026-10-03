"use client";

import { create } from "zustand";
import { clearLocalData, flushSync, startSync, stopSync } from "../sync/syncEngine";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

type AuthStatus = "loading" | "disabled" | "anon" | "authed";

export const useAuthStore = create<{ status: AuthStatus; user: AuthUser | null; ready: boolean }>(() => ({
  status: "loading",
  user: null,
  /** true depois da primeira sincronização (as telas já abrem com os dados da conta). */
  ready: false,
}));

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Erro ${res.status}`);
  return body as T;
}

export async function loadSession() {
  try {
    const me = await call<{ enabled: boolean; user: AuthUser | null }>("/api/auth/me");
    if (!me.enabled) {
      useAuthStore.setState({ status: "disabled", user: null, ready: true });
      return;
    }
    if (!me.user) {
      useAuthStore.setState({ status: "anon", user: null, ready: true });
      return;
    }
    useAuthStore.setState({ status: "authed", user: me.user, ready: false });
    await startSync(me.user.id);
    useAuthStore.setState({ ready: true });
  } catch {
    // Sem conexão com o servidor: deixa usar o que está no navegador.
    useAuthStore.setState((s) => ({ status: s.user ? "authed" : "disabled", ready: true }));
  }
}

export async function login(email: string, password: string) {
  await call("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  await loadSession();
}

export async function signup(name: string, email: string, password: string) {
  await call("/api/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password }) });
  await loadSession();
}

export async function logout(everywhere = false) {
  await flushSync().catch(() => undefined);
  stopSync();
  await call(`/api/auth/logout${everywhere ? "?todos=1" : ""}`, { method: "POST" }).catch(() => undefined);
  // Não deixa os dados da conta no navegador (computador compartilhado, por exemplo).
  clearLocalData();
  window.location.href = "/entrar";
}

export async function changePassword(atual: string, nova: string) {
  await call("/api/auth/password", { method: "POST", body: JSON.stringify({ atual, nova }) });
}

export interface DeviceSession {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  userAgent: string | null;
  atual: boolean;
}

export async function listSessions(): Promise<DeviceSession[]> {
  return (await call<{ sessions: DeviceSession[] }>("/api/auth/sessions")).sessions;
}

export async function revokeSession(id: string) {
  await call(`/api/auth/sessions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** "Chrome no Windows", "Safari no iPhone"… a partir do user-agent. */
export function describeDevice(ua: string | null): string {
  if (!ua) return "Dispositivo desconhecido";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} no ${os}` : browser;
}
