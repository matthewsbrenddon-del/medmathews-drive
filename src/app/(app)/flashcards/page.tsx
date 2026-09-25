"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Layers, Plus, Sparkles, Wand2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useFlashcardStore } from "@/lib/flashcardStore";
import { useFlashcardProgressStore, getDueCards } from "@/lib/flashcardProgressStore";
import { useQuestionStore } from "@/lib/questionStore";
import { useQuestionProgressStore, needsReview } from "@/lib/questionProgressStore";
import { getSubjectsFromItems, resolveSubject } from "@/lib/subjects";

export default function FlashcardsPage() {
  const decks = useFlashcardStore((s) => s.decks);
  const cards = useFlashcardStore((s) => s.cards);
  const createDeck = useFlashcardStore((s) => s.createDeck);
  const generateFromQuestions = useFlashcardStore((s) => s.generateFromQuestions);
  const progressMap = useFlashcardProgressStore((s) => s.progress);

  const questions = useQuestionStore((s) => s.questions);
  const questionProgress = useQuestionProgressStore((s) => s.progress);
  const subjects = useMemo(() => getSubjectsFromItems(questions), [questions]);

  const [showNewDeck, setShowNewDeck] = useState(false);
  const [deckName, setDeckName] = useState("");
  const [deckSubject, setDeckSubject] = useState("");

  const [showGenerate, setShowGenerate] = useState(false);
  const [genSubject, setGenSubject] = useState("todas");
  const [genSource, setGenSource] = useState<"erradas" | "todas">("erradas");
  const [genDeckId, setGenDeckId] = useState<string>("");
  const [genResult, setGenResult] = useState<number | null>(null);

  const wrongQuestions = questions.filter((q) => {
    const p = questionProgress[q.id];
    return p && needsReview(p);
  });

  function handleCreateDeck() {
    if (!deckName.trim()) return;
    const deck = createDeck(deckName.trim(), deckSubject || undefined);
    setDeckName("");
    setDeckSubject("");
    setShowNewDeck(false);
    setGenDeckId(deck.id);
  }

  function handleGenerate() {
    if (!genDeckId) return;
    const pool = genSource === "erradas" ? wrongQuestions : questions;
    const filtered = genSubject === "todas" ? pool : pool.filter((q) => q.subjectSlug === genSubject);
    const created = generateFromQuestions(genDeckId, filtered);
    setGenResult(created);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Flashcards</h1>
          <p className="text-muted-foreground mt-1">Memorização ativa com repetição espaçada — crie decks manualmente ou gere a partir das suas questões.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowNewDeck((v) => !v)}>
          <Plus size={15} /> Novo deck
        </button>
      </div>

      {showNewDeck && (
        <section className="card p-5 flex flex-col gap-3 animate-fade-in">
          <h2 className="text-sm font-semibold text-foreground">Criar deck</h2>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="Nome do deck (ex.: Cirurgia Geral — Revisão)"
              className="input flex-1 min-w-[220px]"
            />
            <select value={deckSubject} onChange={(e) => setDeckSubject(e.target.value)} className="input w-auto">
              <option value="">Sem disciplina fixa</option>
              {subjects.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn-primary" onClick={handleCreateDeck} disabled={!deckName.trim()}>
              Criar
            </button>
          </div>
        </section>
      )}

      <section className="card p-5 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent shrink-0">
            <Sparkles size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Gerar flashcards automaticamente</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Transforma questões do seu banco em cartões (enunciado na frente, resposta comentada no verso) — sem
              depender de IA externa. Ideal para virar o &quot;caderno de erros&quot; em revisão ativa com um clique.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setShowGenerate((v) => !v)} className="btn-outline self-start">
            <Wand2 size={14} /> {showGenerate ? "Fechar" : "Configurar geração"}
          </button>
          <button
            type="button"
            disabled
            title="Geração por IA generativa requer um provedor de IA configurado — ainda não disponível nesta versão."
            className="btn-outline self-start opacity-50 cursor-not-allowed"
          >
            <Sparkles size={14} /> Gerar com IA (em breve)
          </button>
        </div>

        {showGenerate && (
          <div className="flex flex-col gap-3 animate-fade-in">
            <div className="flex flex-wrap gap-2.5">
              <select value={genSource} onChange={(e) => setGenSource(e.target.value as "erradas" | "todas")} className="input w-auto">
                <option value="erradas">Só questões que já errei ({wrongQuestions.length})</option>
                <option value="todas">Todas as questões do banco ({questions.length})</option>
              </select>
              <select value={genSubject} onChange={(e) => setGenSubject(e.target.value)} className="input w-auto">
                <option value="todas">Todas as disciplinas</option>
                {subjects.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select value={genDeckId} onChange={(e) => setGenDeckId(e.target.value)} className="input w-auto">
                <option value="">Escolha o deck de destino...</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button type="button" className="btn-primary" onClick={handleGenerate} disabled={!genDeckId}>
                Gerar cartões
              </button>
            </div>
            {genResult !== null && (
              <p className="text-xs text-success">{genResult} cartões novos criados (duplicados por questão de origem foram ignorados).</p>
            )}
            {decks.length === 0 && <p className="text-xs text-muted-foreground">Crie um deck primeiro para poder gerar cartões nele.</p>}
          </div>
        )}
      </section>

      {decks.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Nenhum deck ainda."
          description="Crie um deck manualmente ou gere um a partir das questões que você já errou."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map((deck) => {
            const deckCards = cards.filter((c) => c.deckId === deck.id);
            const due = getDueCards(deckCards, progressMap).length;
            const subject = deck.subjectSlug ? resolveSubject(deck.subjectSlug) : undefined;
            return (
              <Link
                key={deck.id}
                href={`/flashcards/${deck.id}`}
                className="card p-5 flex flex-col gap-3 hover:shadow-lift hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: `hsl(${subject?.colorToken ?? "var(--accent)"} / 0.12)`,
                      color: `hsl(${subject?.colorToken ?? "var(--accent)"})`,
                    }}
                  >
                    <Layers size={18} />
                  </div>
                  {due > 0 && (
                    <span className="rounded-full bg-primary/10 text-primary text-xs font-medium font-metric px-2 py-1">
                      {due} para revisar
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{deck.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 font-metric">{deckCards.length} cartões</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
