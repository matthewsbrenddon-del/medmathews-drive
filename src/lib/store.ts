"use client";

// ============================================================================
// Estado do usuário (client-side), persistido em localStorage.
//
// Em produção, este é o ponto que passaria a escrever na tabela
// "UserFileState" via API/Prisma (ver prisma/schema.prisma e
// src/app/api/progress/route.ts) em vez de localStorage — a MESMA forma de
// dado é usada nos dois casos, então a troca é apenas de "onde persistir".
// ============================================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ReadStatus, UserFileState, WatchStatus } from "./types";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

interface StudyStoreState {
  onboarded: boolean;
  connectedFolderName: string | null;
  demoMode: boolean;
  userStates: Record<string, UserFileState>;
  studyDates: string[];

  completeOnboarding: (folderName: string, demoMode: boolean) => void;
  resetConnection: () => void;

  getFileState: (fileId: string) => UserFileState;
  toggleFavorite: (fileId: string) => void;
  setWatchStatus: (fileId: string, status: WatchStatus) => void;
  setPlaybackProgress: (fileId: string, positionSeconds: number, durationSeconds: number) => void;
  setReadStatus: (fileId: string, status: ReadStatus) => void;
  recordStudyToday: () => void;
  currentStreak: () => number;
}

function emptyState(fileId: string): UserFileState {
  return { fileId, progressPercent: 0, favorite: false };
}

export const useStudyStore = create<StudyStoreState>()(
  persist(
    (set, get) => ({
      onboarded: false,
      connectedFolderName: null,
      demoMode: true,
      userStates: {},
      studyDates: [],

      completeOnboarding: (folderName, demoMode) =>
        set({ onboarded: true, connectedFolderName: folderName, demoMode }),

      resetConnection: () =>
        set({ onboarded: false, connectedFolderName: null, userStates: {}, studyDates: [] }),

      getFileState: (fileId) => get().userStates[fileId] ?? emptyState(fileId),

      toggleFavorite: (fileId) =>
        set((s) => {
          const current = s.userStates[fileId] ?? emptyState(fileId);
          return {
            userStates: {
              ...s.userStates,
              [fileId]: { ...current, favorite: !current.favorite },
            },
          };
        }),

      setWatchStatus: (fileId, status) =>
        set((s) => {
          const current = s.userStates[fileId] ?? emptyState(fileId);
          const progressPercent = status === "assistida" ? 100 : status === "nao_iniciada" ? 0 : current.progressPercent || 10;
          const next: UserFileState = {
            ...current,
            watchStatus: status,
            progressPercent,
            lastViewedAt: new Date().toISOString(),
            completedAt: status === "assistida" ? new Date().toISOString() : undefined,
          };
          return { userStates: { ...s.userStates, [fileId]: next } };
        }),

      setPlaybackProgress: (fileId, positionSeconds, durationSeconds) =>
        set((s) => {
          const current = s.userStates[fileId] ?? emptyState(fileId);
          const pct = durationSeconds > 0 ? Math.min(99, Math.round((positionSeconds / durationSeconds) * 100)) : current.progressPercent;
          const status: WatchStatus = pct >= 95 ? "assistida" : pct > 0 ? "em_andamento" : "nao_iniciada";
          return {
            userStates: {
              ...s.userStates,
              [fileId]: {
                ...current,
                watchStatus: status,
                playbackPositionSeconds: positionSeconds,
                progressPercent: status === "assistida" ? 100 : pct,
                lastViewedAt: new Date().toISOString(),
                completedAt: status === "assistida" ? new Date().toISOString() : current.completedAt,
              },
            },
          };
        }),

      setReadStatus: (fileId, status) =>
        set((s) => {
          const current = s.userStates[fileId] ?? emptyState(fileId);
          return {
            userStates: {
              ...s.userStates,
              [fileId]: {
                ...current,
                readStatus: status,
                progressPercent: status === "estudado" ? 100 : status === "acessado" ? 50 : 0,
                lastViewedAt: new Date().toISOString(),
                completedAt: status === "estudado" ? new Date().toISOString() : undefined,
              },
            },
          };
        }),

      recordStudyToday: () =>
        set((s) => (s.studyDates.includes(todayKey()) ? s : { studyDates: [...s.studyDates, todayKey()] })),

      currentStreak: () => {
        const dates = new Set(get().studyDates);
        let streak = 0;
        const cursor = new Date();
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const key = cursor.toISOString().slice(0, 10);
          if (dates.has(key)) {
            streak += 1;
            cursor.setDate(cursor.getDate() - 1);
          } else {
            break;
          }
        }
        return streak;
      },
    }),
    { name: "medstudy-hub-store" }
  )
);
