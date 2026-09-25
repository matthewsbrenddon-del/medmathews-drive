"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, Layers, Loader2, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useFlashcardStore } from "@/lib/flashcardStore";
import { useFlashcardProgressStore, getDueCards } from "@/lib/flashcardProgressStore";
import { useQuestionStore } from "@/lib/questionStore";
import { useQuestionProgressStore, needsReview } from "@/lib/questionProgressStore";
import { getSubjectsFromItems, resolveSubject } from "@/lib/subjects";
import type { Question } from "@/lib/types";

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

  const [showAiGenerate, setShowAiGenerate] = useState(false);

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
          <button type="button" onClick={() => setShowAiGenerate((v) => !v)} className="btn-outline self-start">
            <Sparkles size={14} /> {showAiGenerate ? "Fechar" : "Gerar com IA"}
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

        {showAiGenerate && (
          <AiGeneratePanel
            questions={questions}
            wrongQuestions={wrongQuestions}
            subjects={subjects}
            decks={decks}
          />
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

interface ReviewCard {
  tempId: string;
  frente: string;
  verso: string;
  tema: string;
  sourceQuestionId?: string;
  approved: boolean;
}

const AI_MAX_SOURCE_QUESTIONS = 15;

function AiGeneratePanel({
  questions,
  wrongQuestions,
  subjects,
  decks,
}: {
  questions: Question[];
  wrongQuestions: Question[];
  subjects: ReturnType<typeof getSubjectsFromItems>;
  decks: ReturnType<typeof useFlashcardStore.getState>["decks"];
}) {
  const addGeneratedCards = useFlashcardStore((s) => s.addGeneratedCards);

  const [source, setSource] = useState<"erradas" | "todas">("erradas");
  const [subjectSlug, setSubjectSlug] = useState("todas");
  const [deckId, setDeckId] = useState("");
  const [quantidade, setQuantidade] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewCards, setReviewCards] = useState<ReviewCard[] | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  const pool = source === "erradas" ? wrongQuestions : questions;
  const filtered = subjectSlug === "todas" ? pool : pool.filter((q) => q.subjectSlug === subjectSlug);
  const sourceQuestions = filtered.slice(0, AI_MAX_SOURCE_QUESTIONS);

  async function handleGenerate() {
    if (sourceQuestions.length === 0) return;
    setLoading(true);
    setError(null);
    setReviewCards(null);
    setSaved(null);
    try {
      const res = await fetch("/api/ai/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantidade,
          questions: sourceQuestions.map((q) => ({
            id: q.id,
            subjectName: q.subjectName,
            tema: q.tema,
            enunciado: q.enunciado,
            alternatives: q.alternatives,
            gabarito: q.gabarito,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível gerar os flashcards agora.");
        return;
      }
      setReviewCards(
        (data.cards as { questionId: string; frente: string; verso: string; tema: string }[]).map((c, i) => ({
          tempId: `${c.questionId}-${i}`,
          frente: c.frente,
          verso: c.verso,
          tema: c.tema,
          sourceQuestionId: c.questionId || undefined,
          approved: true,
        }))
      );
    } catch {
      setError("Não foi possível conectar à IA agora. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function updateReviewCard(tempId: string, patch: Partial<ReviewCard>) {
    setReviewCards((cur) => cur?.map((c) => (c.tempId === tempId ? { ...c, ...patch } : c)) ?? cur);
  }

  function handleSaveApproved() {
    if (!reviewCards || !deckId) return;
    const approved = reviewCards.filter((c) => c.approved && c.frente.trim() && c.verso.trim());
    const created = addGeneratedCards(
      deckId,
      approved.map((c) => ({ front: c.frente.trim(), back: c.verso.trim(), tags: c.tema ? [c.tema] : [], sourceQuestionId: c.sourceQuestionId }))
    );
    setSaved(created);
    setReviewCards(null);
  }

  return (
    <div className="flex flex-col gap-3 animate-fade-in border-t border-border/60 pt-4">
      <p className="text-xs text-muted-foreground">
        A IA lê os casos clínicos selecionados do banco de questões (não temos acesso ao texto de aulas/apostilas do Drive)
        e escreve cartões de recuperação ativa. Revise, edite ou descarte antes de salvar.
      </p>

      {!reviewCards && (
        <div className="flex flex-wrap gap-2.5 items-center">
          <select value={source} onChange={(e) => setSource(e.target.value as "erradas" | "todas")} className="input w-auto">
            <option value="erradas">Só questões que já errei ({wrongQuestions.length})</option>
            <option value="todas">Todas as questões do banco ({questions.length})</option>
          </select>
          <select value={subjectSlug} onChange={(e) => setSubjectSlug(e.target.value)} className="input w-auto">
            <option value="todas">Todas as disciplinas</option>
            {subjects.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={40}
            value={quantidade}
            onChange={(e) => setQuantidade(Number(e.target.value) || 15)}
            className="input w-24"
            aria-label="Quantidade de cartões"
          />
          <button type="button" className="btn-primary" onClick={handleGenerate} disabled={loading || sourceQuestions.length === 0}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? "Gerando..." : "Gerar cartões"}
          </button>
          {sourceQuestions.length === 0 && (
            <p className="text-xs text-muted-foreground w-full">Nenhuma questão disponível com esses filtros.</p>
          )}
          {sourceQuestions.length > 0 && (
            <p className="text-xs text-muted-foreground w-full">
              Material de origem: {sourceQuestions.length} questão(ões){filtered.length > sourceQuestions.length ? ` (de ${filtered.length} — limitado a ${AI_MAX_SOURCE_QUESTIONS} por chamada)` : ""}.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      {saved !== null && <p className="text-xs text-success">{saved} cartões aprovados salvos no deck.</p>}

      {reviewCards && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground">
              {reviewCards.length} cartões gerados — revise antes de salvar ({reviewCards.filter((c) => c.approved).length} aprovados)
            </p>
            <select value={deckId} onChange={(e) => setDeckId(e.target.value)} className="input w-auto">
              <option value="">Escolha o deck de destino...</option>
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
            {reviewCards.map((c) => (
              <div key={c.tempId} className={`card p-3 flex flex-col gap-2 ${c.approved ? "" : "opacity-50"}`}>
                <textarea
                  value={c.frente}
                  onChange={(e) => updateReviewCard(c.tempId, { frente: e.target.value })}
                  rows={2}
                  className="input text-sm"
                  placeholder="Frente (pergunta)"
                />
                <textarea
                  value={c.verso}
                  onChange={(e) => updateReviewCard(c.tempId, { verso: e.target.value })}
                  rows={2}
                  className="input text-sm"
                  placeholder="Verso (resposta)"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{c.tema}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateReviewCard(c.tempId, { approved: !c.approved })}
                      className={`btn-sm ${c.approved ? "btn-primary" : "btn-outline"}`}
                    >
                      <Check size={13} /> {c.approved ? "Aprovado" : "Aprovar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewCards((cur) => cur?.filter((x) => x.tempId !== c.tempId) ?? cur)}
                      aria-label="Descartar cartão"
                      className="text-muted-foreground hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button type="button" className="btn-primary self-start" onClick={handleSaveApproved} disabled={!deckId}>
              Salvar aprovados
            </button>
            <button type="button" className="btn-outline self-start" onClick={() => setReviewCards(null)}>
              Descartar tudo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
