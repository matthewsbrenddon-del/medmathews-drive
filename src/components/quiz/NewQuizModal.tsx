"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  CircleHelp,
  Database,
  GraduationCap,
  Link2,
  Loader2,
  Sparkles,
  Stethoscope,
  X,
} from "lucide-react";
import { QUIZ_TIPOS, useQuizStore, type QuizDificuldade, type QuizTipo } from "@/lib/quizStore";
import { buildQuizFromBank, fromAiQuestions } from "@/lib/quizBuilder";
import { useQuestionStore } from "@/lib/questionStore";
import { useQuestionProgressStore } from "@/lib/questionProgressStore";
import { KNOWN_SUBJECTS } from "@/lib/subjects";
import { cn } from "@/lib/utils";

const TIPO_ICON: Record<QuizTipo, typeof CircleHelp> = {
  multipla: CircleHelp,
  vinheta: Stethoscope,
  vf: CheckCircle2,
  correlacao: Link2,
  enamed: GraduationCap,
};

const BANK_TIPOS: QuizTipo[] = ["multipla", "enamed"];

export function NewQuizModal({
  open,
  onClose,
  onCreated,
  defaultFolderId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (quizId: string) => void;
  defaultFolderId?: string;
}) {
  const createQuiz = useQuizStore((s) => s.createQuiz);
  const folders = useQuizStore((s) => s.folders);
  const bank = useQuestionStore((s) => s.questions);
  const progressMap = useQuestionProgressStore((s) => s.progress);

  const [fonte, setFonte] = useState<"ia" | "banco">("ia");
  const [quantidade, setQuantidade] = useState(10);
  const [tipos, setTipos] = useState<QuizTipo[]>(["multipla"]);
  const [dificuldade, setDificuldade] = useState<QuizDificuldade>("medio");
  const [tema, setTema] = useState("");
  const [titulo, setTitulo] = useState("");
  const [area, setArea] = useState("");
  const [contexto, setContexto] = useState("");
  const [folderId, setFolderId] = useState(defaultFolderId ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; canFallback?: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFolderId(defaultFolderId ?? "");
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, defaultFolderId]);

  if (!open) return null;

  const effectiveTipos = fonte === "banco" ? tipos.filter((t) => BANK_TIPOS.includes(t)) : tipos;
  const canSubmit = !loading && effectiveTipos.length > 0 && (fonte === "banco" || tema.trim().length > 0);

  function toggleTipo(t: QuizTipo) {
    setTipos((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  function finish(questions: ReturnType<typeof fromAiQuestions>, source: "ia" | "banco") {
    const subject = KNOWN_SUBJECTS.find((s) => s.slug === area);
    const temaTitle = tema.trim() ? tema.trim()[0].toUpperCase() + tema.trim().slice(1) : "";
    const quiz = createQuiz({
      titulo: titulo.trim() || temaTitle || (subject ? `Quiz de ${subject.name}` : "Quiz do banco de questões"),
      folderId: folderId || undefined,
      fonte: source,
      tipos: Array.from(new Set(questions.map((q) => q.tipo))),
      dificuldade,
      subjectSlug: area || undefined,
      contexto: contexto.trim() || undefined,
      questions,
    });
    onCreated(quiz.id);
  }

  function generateFromBank() {
    const questions = buildQuizFromBank(bank, {
      quantidade,
      subjectSlug: area || undefined,
      busca: tema,
      dificuldade,
      progressMap,
      somenteRevalida: effectiveTipos.length === 1 && effectiveTipos[0] === "enamed",
    });
    if (questions.length === 0) {
      setError({ message: "Nenhuma questão do banco combina com esse tema/área. Tente um termo mais amplo." });
      return;
    }
    finish(questions, "banco");
  }

  async function handleSubmit() {
    setError(null);
    if (fonte === "banco") {
      generateFromBank();
      return;
    }
    setLoading(true);
    try {
      const subject = KNOWN_SUBJECTS.find((s) => s.slug === area);
      const res = await fetch("/api/ai/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: subject ? `${tema.trim()} (${subject.name})` : tema.trim(),
          materialText: contexto.trim() || undefined,
          quantidade,
          tipos: effectiveTipos,
          dificuldade,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ message: data.error ?? "Não foi possível gerar o quiz agora.", canFallback: true });
        return;
      }
      finish(fromAiQuestions(data.questions), "ia");
    } catch {
      setError({ message: "Não foi possível conectar à IA agora.", canFallback: true });
    } finally {
      setLoading(false);
    }
  }

  const seg = (active: boolean) =>
    cn(
      "rounded-xl border py-2.5 text-sm font-medium transition-all",
      active ? "border-primary bg-primary text-primary-foreground shadow-card" : "border-border bg-muted/50 text-foreground hover:border-primary/40"
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="novo-quiz-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-surface border border-border shadow-lift animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur px-7 pt-6 pb-4 border-b border-border/60 flex items-start justify-between gap-4">
          <div>
            <h2 id="novo-quiz-title" className="text-2xl font-semibold text-foreground">
              Novo Quiz
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Configure e gere um quiz com questões interativas e correção automática.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground mt-1">
            <X size={20} />
          </button>
        </div>

        <div className="px-7 py-5 flex flex-col gap-6">
          <section>
            <p className="text-sm font-semibold text-foreground mb-2">Fonte das questões</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { id: "ia" as const, icon: Sparkles, label: "Gerar com IA", desc: "Questões inéditas sobre o seu tema ou material." },
                { id: "banco" as const, icon: Database, label: "Do banco de questões", desc: `${bank.length.toLocaleString("pt-BR")} questões reais — funciona sem IA.` },
              ].map((f) => {
                const active = fonte === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFonte(f.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-2xl border p-4 text-left transition-all",
                      active ? "border-primary bg-primary text-primary-foreground shadow-card" : "border-border bg-muted/40 hover:border-primary/40"
                    )}
                  >
                    <f.icon size={20} className="shrink-0 mt-0.5" />
                    <span>
                      <span className="block font-semibold">{f.label}</span>
                      <span className={cn("block text-xs mt-0.5", active ? "text-primary-foreground/85" : "text-muted-foreground")}>{f.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <p className="text-sm font-semibold text-foreground mb-2">Quantidade de questões</p>
            <div className="grid grid-cols-6 gap-2">
              {[5, 10, 15, 20, 25, 30].map((n) => (
                <button key={n} type="button" onClick={() => setQuantidade(n)} className={seg(quantidade === n)}>
                  <span className="font-metric">{n}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="text-sm font-semibold text-foreground mb-2">
              Tipo de questão <span className="font-normal text-muted-foreground text-xs">(selecione um ou mais)</span>
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {QUIZ_TIPOS.map((t) => {
                const Icon = TIPO_ICON[t.id];
                const disabled = fonte === "banco" && !BANK_TIPOS.includes(t.id);
                const active = tipos.includes(t.id) && !disabled;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleTipo(t.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-2xl border p-4 text-left transition-all",
                      active ? "border-primary bg-primary text-primary-foreground shadow-card" : "border-border bg-muted/40 hover:border-primary/40",
                      disabled && "opacity-40 cursor-not-allowed hover:border-border"
                    )}
                  >
                    <Icon size={20} className="shrink-0 mt-0.5" />
                    <span>
                      <span className="block font-semibold">{t.label}</span>
                      <span className={cn("block text-xs mt-0.5", active ? "text-primary-foreground/85" : "text-muted-foreground")}>
                        {disabled ? "Disponível ao gerar com IA." : t.descricao}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <p className="text-sm font-semibold text-foreground mb-2">Dificuldade</p>
            <div className="flex flex-wrap gap-2">
              {(["facil", "medio", "dificil"] as QuizDificuldade[]).map((d, i) => {
                const active = dificuldade === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDificuldade(d)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all",
                      active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground hover:border-primary/40"
                    )}
                  >
                    <span className="relative h-4 w-4 rounded-full border-2 border-current inline-flex items-center justify-center">
                      {i >= 1 && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                      {i === 2 && <span className="absolute inset-[-5px] rounded-full border border-current opacity-60" />}
                    </span>
                    {d === "facil" ? "Fácil" : d === "medio" ? "Médio" : "Difícil"}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="grid sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-semibold text-foreground">
                Tema {fonte === "ia" ? <span className="text-danger">*</span> : <span className="font-normal text-muted-foreground text-xs">(opcional — filtra o banco)</span>}
              </span>
              <input
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                placeholder="Ex.: Sedação, analgesia e delirium na UTI"
                className="input"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-foreground">Grande área</span>
              <select value={area} onChange={(e) => setArea(e.target.value)} className="input">
                <option value="">Todas</option>
                {KNOWN_SUBJECTS.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-foreground">Pasta</span>
              <select value={folderId} onChange={(e) => setFolderId(e.target.value)} className="input">
                <option value="">Sem pasta</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-semibold text-foreground">
                Título <span className="font-normal text-muted-foreground text-xs">(opcional)</span>
              </span>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Medicina Intensiva — Bloco 3" className="input" />
            </label>
          </section>

          {fonte === "ia" && (
            <section>
              <p className="text-sm font-semibold text-foreground">Contexto</p>
              <p className="text-sm text-muted-foreground mt-1 mb-2">
                Cole um trecho do que você está estudando: livro, apostila, resumo ou slide de aula. A IA usa esse conteúdo
                para gerar questões sobre exatamente o que está na sua frente.
              </p>
              <textarea
                value={contexto}
                onChange={(e) => setContexto(e.target.value)}
                rows={4}
                placeholder="Ex.: cole aqui aquele capítulo do seu livro, um trecho da sua apostila ou o resumo que você fez da aula…"
                className="input"
              />
            </section>
          )}

          {error && (
            <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger flex flex-wrap items-center justify-between gap-3">
              <span>{error.message}</span>
              {error.canFallback && (
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() => {
                    setFonte("banco");
                    setError(null);
                  }}
                >
                  <Database size={13} /> Montar pelo banco de questões
                </button>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-surface/95 backdrop-blur px-7 py-4 border-t border-border/60 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {effectiveTipos.length === 0 ? "Escolha pelo menos um tipo de questão." : `${quantidade} questões · ${effectiveTipos.length} ${effectiveTipos.length === 1 ? "tipo" : "tipos"}`}
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" disabled={!canSubmit} onClick={handleSubmit}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : fonte === "ia" ? <Sparkles size={15} /> : <Database size={15} />}
              {loading ? "Gerando…" : "Gerar quiz"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
