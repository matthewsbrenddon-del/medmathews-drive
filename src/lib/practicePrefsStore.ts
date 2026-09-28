"use client";

// Preferências da tela de resolver questões + posição salva em cada lista.

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const FONT_SCALES = [0.9, 1, 1.12, 1.25] as const;

interface PracticePrefsState {
  fontScaleIndex: number;
  /** Clicar numa alternativa já responde (sem precisar do botão "Responder"). */
  answerOnClick: boolean;
  /** Após responder, avança para a próxima questão automaticamente. */
  autoAdvance: boolean;
  showTimer: boolean;
  /** Gabaritos comentados já abertos (tira o ponto de "não lido"). */
  readComments: Record<string, true>;
  /** Última questão vista em cada lista (chave = filtros da URL). */
  positions: Record<string, string>;

  setFontScaleIndex: (i: number) => void;
  setAnswerOnClick: (v: boolean) => void;
  setAutoAdvance: (v: boolean) => void;
  setShowTimer: (v: boolean) => void;
  markCommentRead: (questionId: string) => void;
  savePosition: (listKey: string, questionId: string) => void;
  clearPosition: (listKey: string) => void;
}

export const usePracticePrefsStore = create<PracticePrefsState>()(
  persist(
    (set) => ({
      fontScaleIndex: 1,
      answerOnClick: false,
      autoAdvance: false,
      showTimer: true,
      readComments: {},
      positions: {},
      setFontScaleIndex: (i) => set({ fontScaleIndex: Math.max(0, Math.min(FONT_SCALES.length - 1, i)) }),
      setAnswerOnClick: (v) => set({ answerOnClick: v }),
      setAutoAdvance: (v) => set({ autoAdvance: v }),
      setShowTimer: (v) => set({ showTimer: v }),
      markCommentRead: (id) => set((s) => (s.readComments[id] ? s : { readComments: { ...s.readComments, [id]: true } })),
      savePosition: (key, id) => set((s) => ({ positions: { ...s.positions, [key]: id } })),
      clearPosition: (key) =>
        set((s) => {
          const next = { ...s.positions };
          delete next[key];
          return { positions: next };
        }),
    }),
    { name: "medstudy-hub-practice-prefs" }
  )
);
