"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  ListChecks,
  Play,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { EmptyState } from "@/components/EmptyState";
import { QuizQuestionView } from "@/components/quiz/QuizQuestionView";
import { ApostilaExportModal } from "@/components/ApostilaExportModal";
import {
  DIFICULDADE_LABEL,
  QUIZ_PALETTE,
  QUIZ_TIPOS,
  attemptSummary,
  lastFinishedAttempt,
  useQuizStore,
} from "@/lib/quizStore";
import { KNOWN_SUBJECTS } from "@/lib/subjects";
import type { Question, QuestionAlternative } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filtro = "todas" | "acertos" | "erros";

export default function QuizDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const quiz = useQuizStore((s) => s.quizzes.find((q) => q.id === params.id));
  const deleteQuiz = useQuizStore((s) => s.deleteQuiz);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [open, setOpen] = useState<string | null>(null);
  const [statsFor, setStatsFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const last = quiz ? lastFinishedAttempt(quiz) : undefined;
  const inProgress = quiz ? [...quiz.attempts].reverse().find((a) => !a.finishedAt && Object.keys(a.answers).length > 0) : undefined;

  const printable = useMemo<Question[]>(() => {
    if (!quiz) return [];
    const subject = KNOWN_SUBJECTS.find((s) => s.slug === quiz.subjectSlug) ?? KNOWN_SUBJECTS[0];
    return quiz.questions
      .filter((q) => q.alternatives && q.gabarito)
      .map((q) => ({
        id: q.id,
        subjectSlug: subject.slug,
        subjectName: subject.name,
        tema: q.tema,
        enunciado: q.enunciado,
        alternatives: q.alternatives as QuestionAlternative[],
        gabarito: q.gabarito!,
        comentario: q.comentario,
        dificuldade: 0,
        tags: [],
        origem: quiz.fonte === "ia" ? "ia" : "banco",
      }));
  }, [quiz]);

  if (!quiz) {
    return (
      <EmptyState
        illustration={<ListChecks size={36} className="text-muted-foreground" />}
        title="Quiz não encontrado."
        action={
          <Link href="/quizzes" className="btn-primary">
            Voltar para Quizzes
          </Link>
        }
      />
    );
  }

  const palette = QUIZ_PALETTE[quiz.cor % QUIZ_PALETTE.length];
  const temas = new Set(quiz.questions.map((q) => q.tema).filter(Boolean));
  const finished = quiz.attempts.filter((a) => a.finishedAt);
  const visible = quiz.questions.filter((q) => {
    if (filtro === "todas" || !last) return true;
    const sc = last.scores[q.id] ?? 0;
    return filtro === "acertos" ? sc >= 0.999 : sc < 0.999;
  });
  const difColor = quiz.dificuldade === "dificil" ? "text-danger bg-danger/10 border-danger/30" : quiz.dificuldade === "facil" ? "text-success bg-success/10 border-success/30" : "text-warning bg-warning/10 border-warning/30";

  return (
    <div className="flex flex-col gap-8 max-w-5xl">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground" aria-label="Trilha">
        <ListChecks size={16} className="text-primary" />
        <ChevronRight size={14} />
        <Link href="/quizzes" className="hover:text-foreground">
          Quizzes
        </Link>
        <ChevronRight size={14} />
        <span className={cn("truncate max-w-[240px]", palette.text)}>{quiz.titulo}</span>
        <ChevronRight size={14} />
        <span className="rounded-lg bg-primary/10 text-primary px-2 py-0.5">Revisar quiz</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">{quiz.titulo}</h1>
          <p className="text-muted-foreground mt-3">
            {quiz.questions.length} questões | {temas.size} {temas.size === 1 ? "subtópico" : "subtópicos"}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-sm", difColor)}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" /> {DIFICULDADE_LABEL[quiz.dificuldade]}
            </span>
            <span className="rounded-full border border-primary/30 bg-primary/10 text-primary px-3 py-0.5 text-sm">{quiz.questions.length} questões</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 text-accent px-3 py-0.5 text-sm">
              {quiz.fonte === "ia" ? (
                <>
                  <Sparkles size={12} /> IA
                </>
              ) : (
                "Banco de questões"
              )}
            </span>
            {quiz.tipos.map((t) => (
              <span key={t} className="rounded-full border border-border px-3 py-0.5 text-sm text-muted-foreground">
                {QUIZ_TIPOS.find((x) => x.id === t)?.label}
              </span>
            ))}
          </div>
          <p className="flex flex-wrap gap-5 mt-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={14} /> Criada em {new Date(quiz.createdAt).toLocaleDateString("pt-BR")}
            </span>
            {last?.finishedAt && (
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} /> Última tentativa: {new Date(last.finishedAt).toLocaleDateString("pt-BR")}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-ghost" onClick={() => setExportOpen(true)} disabled={printable.length === 0} title="Baixar apostila em PDF">
            <Download size={18} />
          </button>
          <button type="button" className="btn-ghost hover:text-danger" onClick={() => setConfirmDelete(true)} title="Excluir quiz">
            <Trash2 size={18} />
          </button>
          <Link href={`/quizzes/${quiz.id}/responder`} className="btn-primary px-5 py-3 text-base rounded-2xl">
            <Play size={16} /> {inProgress ? "Continuar" : finished.length > 0 ? "Responder novamente" : "Responder"}
          </Link>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-foreground">Tentativas</h2>
        {quiz.attempts.filter((a) => Object.keys(a.answers).length > 0).length === 0 && (
          <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border px-4 py-5">
            Nenhuma tentativa ainda — clique em <strong>Responder</strong> para começar. A correção é automática, questão a questão.
          </p>
        )}
        {quiz.attempts
          .map((a, i) => ({ a, n: i + 1 }))
          .filter(({ a }) => Object.keys(a.answers).length > 0)
          .reverse()
          .map(({ a, n }) => {
            const s = attemptSummary(quiz, a);
            const done = Boolean(a.finishedAt);
            const byTipo = quiz.tipos.map((t) => {
              const qs = quiz.questions.filter((q) => q.tipo === t);
              const pts = qs.reduce((sum, q) => sum + (a.scores[q.id] ?? 0), 0);
              return { t, total: qs.length, pct: qs.length ? Math.round((pts / qs.length) * 100) : 0 };
            });
            return (
              <div key={a.id} className={cn("rounded-2xl border bg-surface", done ? "border-primary/40" : "border-border")}>
                <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <span className={cn("h-11 w-11 rounded-full inline-flex items-center justify-center", done ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
                    {done ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground inline-flex items-center gap-2">
                      Tentativa {n}
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", done ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
                        {done ? "Concluída" : "Em andamento"}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(a.finishedAt ?? a.startedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} ·{" "}
                      <span className="text-success font-medium font-metric">
                        {s.certas}/{s.total} acertos
                      </span>
                    </p>
                  </div>
                  <button type="button" className="btn-outline btn-sm" onClick={() => setStatsFor(statsFor === a.id ? null : a.id)}>
                    <BarChart3 size={13} /> Ver estatísticas
                  </button>
                </div>
                {statsFor === a.id && (
                  <div className="border-t border-border px-5 py-4 grid sm:grid-cols-2 gap-3 animate-fade-in">
                    {byTipo.map((b) => (
                      <div key={b.t}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-foreground">{QUIZ_TIPOS.find((x) => x.id === b.t)?.label} ({b.total})</span>
                          <span className="font-metric text-muted-foreground">{b.pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className={cn("h-full rounded-full", b.pct >= 70 ? "bg-success" : b.pct >= 50 ? "bg-warning" : "bg-danger")} style={{ width: `${b.pct}%` }} />
                        </div>
                      </div>
                    ))}
                    <p className="sm:col-span-2 text-xs text-muted-foreground">
                      Aproveitamento geral: <strong className="font-metric text-foreground">{s.percent}%</strong>
                    </p>
                  </div>
                )}
              </div>
            );
          })}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">Questões</h2>
          <div className="flex gap-1">
            {([
              { id: "todas", label: "Todas", icon: null },
              { id: "acertos", label: "Acertos", icon: CheckCircle2 },
              { id: "erros", label: "Erros", icon: XCircle },
            ] as const).map((f) => (
              <button
                key={f.id}
                type="button"
                disabled={f.id !== "todas" && !last}
                onClick={() => setFiltro(f.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40",
                  filtro === f.id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.icon && <f.icon size={15} />} {f.label}
              </button>
            ))}
          </div>
        </div>

        {visible.map((q) => {
          const idx = quiz.questions.indexOf(q);
          const sc = last?.scores[q.id];
          const isOpen = open === q.id;
          const title = q.enunciado.split(/(?<=[.?:])\s/).filter(Boolean).pop() ?? q.enunciado;
          return (
            <div key={q.id} className="rounded-2xl border border-border bg-surface overflow-hidden">
              <button type="button" onClick={() => setOpen(isOpen ? null : q.id)} className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-surface-hover">
                <span
                  className={cn(
                    "h-8 w-8 shrink-0 rounded-full inline-flex items-center justify-center text-sm font-semibold",
                    sc === undefined ? "bg-muted text-muted-foreground" : sc >= 0.999 ? "bg-success/15 text-success" : sc > 0 ? "bg-warning/15 text-warning" : "bg-danger/15 text-danger"
                  )}
                >
                  {idx + 1}
                </span>
                <span className="flex-1 min-w-0 truncate text-foreground">{title}</span>
                {isOpen ? <ChevronDown size={17} className="text-muted-foreground" /> : <ChevronRight size={17} className="text-muted-foreground" />}
              </button>
              {isOpen && (
                <div className="border-t border-border px-5 py-5 animate-fade-in">
                  <QuizQuestionView question={q} answer={last?.answers[q.id]} revealed={true} number={idx + 1} />
                </div>
              )}
            </div>
          );
        })}
      </section>

      <ConfirmationModal
        open={confirmDelete}
        title="Excluir este quiz?"
        description="As questões e as tentativas deste quiz serão apagadas. Questões salvas no banco continuam lá."
        confirmLabel="Excluir"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteQuiz(quiz.id);
          router.push("/quizzes");
        }}
      />
      <ApostilaExportModal open={exportOpen} onClose={() => setExportOpen(false)} questions={printable} title={quiz.titulo} subtitle={`Quiz · ${DIFICULDADE_LABEL[quiz.dificuldade]}`} />
    </div>
  );
}
