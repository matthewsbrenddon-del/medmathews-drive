"use client";

// ============================================================================
// Flashcards — decks e cartões, persistidos em localStorage.
//
// "Geração com IA" de verdade (um modelo de linguagem lendo o material e
// escrevendo os cartões) não está implementada nesta versão — não há
// nenhum provedor de IA configurado no app (ver README). O que funciona
// hoje, de forma determinística e sem depender de IA externa, é gerar
// cartões automaticamente a partir do banco de questões (enunciado ->
// frente, resposta comentada -> verso) — um "loop fechado" simples: toda
// questão errada vira um cartão de revisão com um clique.
// ============================================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { seededHash } from "./utils";
import type { Flashcard, FlashcardDeck, Question } from "./types";

interface FlashcardStoreState {
  decks: FlashcardDeck[];
  cards: Flashcard[];

  createDeck: (name: string, subjectSlug?: string, description?: string) => FlashcardDeck;
  renameDeck: (deckId: string, name: string) => void;
  deleteDeck: (deckId: string) => void;

  addCard: (deckId: string, front: string, back: string, tags?: string[]) => void;
  updateCard: (cardId: string, patch: Partial<Pick<Flashcard, "front" | "back" | "tags">>) => void;
  deleteCard: (cardId: string) => void;

  /** Gera cartões determinísticos a partir de questões (enunciado/resposta), evitando duplicar por questão de origem. */
  generateFromQuestions: (deckId: string, questions: Question[]) => number;
}

function newId(prefix: string, seed: string) {
  return `${prefix}-${seededHash(`${seed}-${Date.now()}-${Math.random()}`)}`;
}

export const useFlashcardStore = create<FlashcardStoreState>()(
  persist(
    (set, get) => ({
      decks: [],
      cards: [],

      createDeck: (name, subjectSlug, description) => {
        const deck: FlashcardDeck = {
          id: newId("deck", name),
          name,
          subjectSlug,
          description,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ decks: [...s.decks, deck] }));
        return deck;
      },

      renameDeck: (deckId, name) =>
        set((s) => ({ decks: s.decks.map((d) => (d.id === deckId ? { ...d, name } : d)) })),

      deleteDeck: (deckId) =>
        set((s) => ({
          decks: s.decks.filter((d) => d.id !== deckId),
          cards: s.cards.filter((c) => c.deckId !== deckId),
        })),

      addCard: (deckId, front, back, tags = []) =>
        set((s) => ({
          cards: [
            ...s.cards,
            {
              id: newId("card", front),
              deckId,
              front,
              back,
              tags,
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      updateCard: (cardId, patch) =>
        set((s) => ({ cards: s.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)) })),

      deleteCard: (cardId) => set((s) => ({ cards: s.cards.filter((c) => c.id !== cardId) })),

      generateFromQuestions: (deckId, questions) => {
        const existingSourceIds = new Set(get().cards.map((c) => c.sourceQuestionId).filter(Boolean));
        const toCreate = questions.filter((q) => !existingSourceIds.has(q.id));
        const newCards: Flashcard[] = toCreate.map((q) => {
          const correct = q.alternatives.find((a) => a.letter === q.gabarito);
          const back = [
            `Resposta: ${q.gabarito}) ${correct?.text ?? ""}`,
            q.comentario ? `\n${q.comentario}` : "",
          ].join("");
          return {
            id: newId("card", q.id),
            deckId,
            subjectSlug: q.subjectSlug,
            subjectName: q.subjectName,
            front: q.enunciado,
            back,
            tags: q.tags,
            sourceQuestionId: q.id,
            createdAt: new Date().toISOString(),
          };
        });
        if (newCards.length > 0) set((s) => ({ cards: [...s.cards, ...newCards] }));
        return newCards.length;
      },
    }),
    { name: "medstudy-hub-flashcards" }
  )
);
