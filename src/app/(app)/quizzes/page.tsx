"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Check, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useQuestionStore } from "@/lib/questionStore";
import { KNOWN_SUBJECTS, resolveSubject } from "@/lib/subjects";
import { seededHash } from "@/lib/utils";
import type { Question, QuestionAlternative } from "@/lib/types";

interface ReviewQuestion {
  tempId: string;
  enunciado: string;
  alternatives: QuestionAlternative[];
  gabarito: string;
  comentario: string;
  tema: string;
  approved: boolean;
}

export default function QuizzesPage() {
  const router = useRouter();
  const importQuestions = useQuestionStore((s) => s.importQuestions);

  const [prompt, setPrompt] = useState("");
  const [materialText, setMaterialText] = useState("");
  const [subjectSlug, setSubjectSlug] = useState(KNOWN_SUBJECTS[0].slug);
  const [quantidade, setQuantidade] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewQuestion[] | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  const approvedCount = useMemo(() => review?.filter((q) => q.approved).length ?? 0, [review]);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setReview(null);
    setSaved(null);
    try {
      const res = await fetch("/api/ai/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), materialText: materialText.trim() || undefined, quantidade }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível gerar as questões agora.");
        return;
      }
      setReview(
        (data.questions as { enunciado: string; alternatives: { letter: string; text: string }[]; gabarito: string; comentario: string; tema: string }[]).map(
          (q, i) => ({
            tempId: `gen-${i}-${Date.now()}`,
            enunciado: q.enunciado,
            alternatives: q.alternatives as QuestionAlternative[],
            gabarito: q.gabarito,
            comentario: q.comentario,
            tema: q.tema,
            approved: true,
          })
        )
      );
    } catch {
      setError("Não foi possível conectar à IA agora. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function updateQuestion(tempId: string, patch: Partial<ReviewQuestion>) {
    setReview((cur) => cur?.map((q) => (q.tempId === tempId ? { ...q, ...patch } : q)) ?? cur);
  }

  function handleSave() {
    if (!review) return;
    const subject = resolveSubject(subjectSlug);
    const approved = review.filter((q) => q.approved && q.enunciado.trim() && q.alternatives.length >= 2);
    const questions: Question[] = approved.map((q) => ({
      id: `quiz-${seededHash(`${q.enunciado}-${Date.now()}-${Math.random()}`)}`,
      subjectSlug: subject.slug,
      subjectName: subject.name,
      tema: q.tema || undefined,
      banca: "Gerado por IA",
      enunciado: q.enunciado.trim(),
      alternatives: q.alternatives,
      gabarito: q.gabarito,
      comentario: q.comentario || undefined,
      dificuldade: 3,
      tags: ["Quiz IA"],
      origem: "ia",
    }));
    importQuestions(questions, {
      fileName: `Quiz IA — ${prompt.slice(0, 40)}`,
      importedAt: new Date().toISOString(),
      totalRows: questions.length,
      imported: questions.length,
      skipped: 0,
    });
    setSaved(questions.length);
    setReview(null);
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-foreground inline-flex items-center gap-2.5">
          <Sparkles size={22} className="text-accent" /> Quizzes
        </h1>
        <p className="text-muted-foreground mt-1">
          Gere questões de múltipla escolha em tempo real com IA, a partir de um tema ou de um material de
          referência colado abaixo — revise antes de salvar no Banco de Questões.
        </p>
      </div>

      {!review && (
        <section className="card p-6 flex flex-col gap-4">
          <div>
            <label htmlFor="quiz-prompt" className="text-sm font-medium text-foreground block mb-1.5">
              Tema ou instrução
            </label>
            <textarea
              id="quiz-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex.: Insuficiência cardíaca descompensada em pronto-socorro, com foco em manejo inicial"
              rows={2}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="quiz-material" className="text-sm font-medium text-foreground block mb-1.5">
              Material de referência (opcional) — cole um trecho de texto para a IA usar como base
            </label>
            <textarea
              id="quiz-material"
              value={materialText}
              onChange={(e) => setMaterialText(e.target.value)}
              placeholder="Cole aqui um resumo, protocolo ou trecho de apostila..."
              rows={5}
              className="input"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <select value={subjectSlug} onChange={(e) => setSubjectSlug(e.target.value)} className="input w-auto">
              {KNOWN_SUBJECTS.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={20}
              value={quantidade}
              onChange={(e) => setQuantidade(Number(e.target.value) || 5)}
              className="input w-24"
              aria-label="Quantidade de questões"
            />
            <button type="button" className="btn-primary" onClick={handleGenerate} disabled={loading || !prompt.trim()}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {loading ? "Gerando..." : "Gerar questões"}
            </button>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          {saved !== null && (
            <div className="rounded-xl bg-success/10 text-success px-4 py-3 text-sm flex items-center justify-between gap-3">
              <span>{saved} questões salvas no Banco de Questões.</span>
              <button type="button" className="btn-outline btn-sm" onClick={() => router.push("/questoes")}>
                Ver no Banco de Questões
              </button>
            </div>
          )}
        </section>
      )}

      {review && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              {review.length} questões geradas — revise antes de salvar ({approvedCount} aprovadas)
            </p>
            <button type="button" className="btn-outline btn-sm" onClick={() => setReview(null)}>
              Descartar tudo
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {review.map((q) => (
              <div key={q.tempId} className={`card p-5 flex flex-col gap-3 ${q.approved ? "" : "opacity-50"}`}>
                <textarea
                  value={q.enunciado}
                  onChange={(e) => updateQuestion(q.tempId, { enunciado: e.target.value })}
                  rows={4}
                  className="input text-sm"
                  placeholder="Enunciado"
                />
                <div className="flex flex-col gap-1.5">
                  {q.alternatives.map((alt) => (
                    <div key={alt.letter} className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold w-6 shrink-0 ${alt.letter === q.gabarito ? "text-success" : "text-muted-foreground"}`}
                      >
                        {alt.letter})
                      </span>
                      <input
                        type="text"
                        value={alt.text}
                        onChange={(e) =>
                          updateQuestion(q.tempId, {
                            alternatives: q.alternatives.map((a) => (a.letter === alt.letter ? { ...a, text: e.target.value } : a)),
                          })
                        }
                        className="input text-sm flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => updateQuestion(q.tempId, { gabarito: alt.letter })}
                        className={`btn-sm shrink-0 ${alt.letter === q.gabarito ? "btn-primary" : "btn-outline"}`}
                        title="Marcar como gabarito"
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                <textarea
                  value={q.comentario}
                  onChange={(e) => updateQuestion(q.tempId, { comentario: e.target.value })}
                  rows={2}
                  className="input text-sm"
                  placeholder="Comentário"
                />
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={q.tema}
                    onChange={(e) => updateQuestion(q.tempId, { tema: e.target.value })}
                    className="input text-sm w-auto"
                    placeholder="Tema"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQuestion(q.tempId, { approved: !q.approved })}
                      className={q.approved ? "btn-primary btn-sm" : "btn-outline btn-sm"}
                    >
                      <Check size={13} /> {q.approved ? "Aprovada" : "Aprovar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReview((cur) => cur?.filter((x) => x.tempId !== q.tempId) ?? cur)}
                      aria-label="Descartar questão"
                      className="text-muted-foreground hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button type="button" className="btn-primary self-start" onClick={handleSave} disabled={approvedCount === 0}>
            <Brain size={15} /> Salvar {approvedCount} questões no Banco
          </button>
        </div>
      )}
    </div>
  );
}
