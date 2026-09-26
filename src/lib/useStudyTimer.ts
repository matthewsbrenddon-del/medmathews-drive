"use client";

import { useEffect, useRef } from "react";
import { useStudySessionStore } from "./studySessionStore";
import type { StudySession } from "./types";

/** Cronometra automaticamente uma sessão de estudo (Quizzes/Simulado/
 * Flashcards): marca o início ao montar (ou quando `active` vira true) e
 * grava a sessão consolidada ao desmontar (ou quando `active` vira false). */
export function useStudyTimer(kind: StudySession["kind"], active = true) {
  const addSession = useStudySessionStore((s) => s.addSession);
  const startedAtRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active) return;
    startedAtRef.current = new Date().toISOString();
    const startedAt = startedAtRef.current;
    return () => {
      addSession(kind, startedAt, new Date().toISOString());
      startedAtRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, kind]);
}
