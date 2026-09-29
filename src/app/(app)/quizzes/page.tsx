"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, CheckCircle2, Flame, FolderPlus, ListChecks, MoreHorizontal, Plus, Sparkles, Trash2, X } from "lucide-react";
import { NewQuizModal } from "@/components/quiz/NewQuizModal";
import {
  DIFICULDADE_LABEL,
  QUIZ_PALETTE,
  QUIZ_TIPOS,
  attemptSummary,
  lastFinishedAttempt,
  useQuizStore,
  type Quiz,
} from "@/lib/quizStore";
import { cn } from "@/lib/utils";

const WEEKS = 20;
const DAY_LETTERS = ["S", "T", "Q", "Q", "S", "S", "D"];

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function useQuizActivity(quizzes: Quiz[]) {
  return useMemo(() => {
    const perDay = new Map<string, number>();
    let points = 0;
    let answered = 0;
    for (const quiz of quizzes) {
      for (const attempt of quiz.attempts) {
        const n = Object.keys(attempt.answers).length;
        if (n === 0) continue;
        const key = dayKey(new Date(attempt.finishedAt ?? attempt.startedAt));
        perDay.set(key, (perDay.get(key) ?? 0) + n);
        answered += n;
        points += Object.values(attempt.scores).reduce((a, b) => a + b, 0);
      }
    }
    let streak = 0;
    const cursor = new Date();
    if (!perDay.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (perDay.has(dayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return { perDay, accuracy: answered > 0 ? Math.round((points / answered) * 100) : null, streak };
  }, [quizzes]);
}

function StatPill({ icon: Icon, children }: { icon: typeof Flame; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs font-metric text-muted-foreground">
      <Icon size={13} /> {children}
    </span>
  );
}

function Heatmap({ perDay }: { perDay: Map<string, number> }) {
  const today = new Date();
  // Começa na segunda-feira de WEEKS semanas atrás.
  const start = new Date(today);
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7) - (WEEKS - 1) * 7);
  const cols = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      return date;
    })
  );
  const max = Math.max(1, ...Array.from(perDay.values()));
  return (
    <div className="flex gap-[3px]" role="img" aria-label="Atividade nos quizzes nas últimas semanas">
      {cols.map((days, w) => (
        <div key={w} className="flex flex-col gap-[3px]">
          {days.map((date) => {
            const future = date > today;
            const n = perDay.get(dayKey(date)) ?? 0;
            const level = n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4));
            const isToday = dayKey(date) === dayKey(today);
            return (
              <span
                key={dayKey(date)}
                title={future ? undefined : `${date.toLocaleDateString("pt-BR")}: ${n} ${n === 1 ? "questão" : "questões"}`}
                className={cn(
                  "h-3.5 w-3.5 rounded-[3px]",
                  future ? "bg-transparent" : level === 0 ? "bg-primary/10" : "",
                  isToday && "ring-1 ring-primary ring-offset-1 ring-offset-surface"
                )}
                style={level > 0 ? { background: `hsl(var(--primary) / ${0.25 + level * 0.18})` } : undefined}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function QuizCard({ quiz, onDelete, onMove, folders }: { quiz: Quiz; onDelete: () => void; onMove: (folderId?: string) => void; folders: { id: string; nome: string }[] }) {
  const palette = QUIZ_PALETTE[quiz.cor % QUIZ_PALETTE.length];
  const last = lastFinishedAttempt(quiz);
  const summary = last ? attemptSummary(quiz, last) : null;
  const [menu, setMenu] = useState(false);
  const tipoLabels = quiz.tipos.map((t) => QUIZ_TIPOS.find((x) => x.id === t)?.label ?? t);

  return (
    <div className={cn("group relative rounded-3xl ring-4 transition-all hover:-translate-y-0.5 hover:shadow-lift", palette.ring)}>
      <Link
        href={`/quizzes/${quiz.id}`}
        className={cn("flex min-h-[210px] flex-col justify-between rounded-3xl p-6 border border-white/40 dark:border-white/5", palette.bg)}
      >
        <div className={cn("flex flex-wrap justify-end gap-x-4 gap-y-1 text-[13px] font-medium pr-8", palette.text)}>
          {tipoLabels.slice(0, 2).map((l) => (
            <span key={l}>{l}</span>
          ))}
          <span>Dificuldade: {DIFICULDADE_LABEL[quiz.dificuldade]}</span>
          <span>Questões: {quiz.questions.length}</span>
        </div>
        <div>
          <p className={cn("text-[13px] font-medium inline-flex items-center gap-1.5", palette.text)}>
            {new Date(quiz.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            <span className="opacity-60">·</span>
            {summary ? (
              <>
                Respondido <CheckCircle2 size={13} /> <span className="font-metric">{summary.percent}%</span>
              </>
            ) : (
              "Pronto"
            )}
            {quiz.fonte === "ia" && (
              <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-white/60 dark:bg-white/10 px-1.5 text-[10px]">
                <Sparkles size={10} /> IA
              </span>
            )}
          </p>
          <h3 className={cn("mt-1 text-xl sm:text-2xl font-semibold leading-snug line-clamp-2", palette.text)}>{quiz.titulo}</h3>
        </div>
      </Link>
      <button
        type="button"
        onClick={() => setMenu((v) => !v)}
        aria-label="Opções do quiz"
        className={cn("absolute top-4 right-4 h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-white/60 dark:hover:bg-white/10", palette.text)}
      >
        <MoreHorizontal size={17} />
      </button>
      {menu && (
        <div className="absolute top-12 right-4 z-20 w-52 rounded-xl border border-border bg-surface shadow-lift p-1.5 text-sm animate-fade-in" onMouseLeave={() => setMenu(false)}>
          <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">Mover para</p>
          <button type="button" onClick={() => { onMove(undefined); setMenu(false); }} className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-surface-hover">
            Sem pasta
          </button>
          {folders.map((f) => (
            <button key={f.id} type="button" onClick={() => { onMove(f.id); setMenu(false); }} className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-surface-hover truncate">
              {f.nome}
            </button>
          ))}
          <div className="h-px bg-border my-1" />
          <button type="button" onClick={onDelete} className="w-full text-left rounded-lg px-2 py-1.5 text-danger hover:bg-danger/10 inline-flex items-center gap-2">
            <Trash2 size={13} /> Excluir quiz
          </button>
        </div>
      )}
    </div>
  );
}

export default function QuizzesPage() {
  const router = useRouter();
  const quizzes = useQuizStore((s) => s.quizzes);
  const folders = useQuizStore((s) => s.folders);
  const createFolder = useQuizStore((s) => s.createFolder);
  const deleteFolder = useQuizStore((s) => s.deleteFolder);
  const deleteQuiz = useQuizStore((s) => s.deleteQuiz);
  const moveQuiz = useQuizStore((s) => s.moveQuiz);

  const [modalOpen, setModalOpen] = useState(false);
  const [folder, setFolder] = useState<string>("todos");
  const [newFolder, setNewFolder] = useState<string | null>(null);

  const { perDay, accuracy, streak } = useQuizActivity(quizzes);
  const visible = folder === "todos" ? quizzes : quizzes.filter((q) => q.folderId === folder);

  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  return (
    <div className="flex flex-col gap-8 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Quizzes</h1>
          <p className="text-muted-foreground mt-1">Teste seus conhecimentos com questões interativas e correção automática.</p>
        </div>
        <button type="button" className="btn-primary px-5 py-3 text-base rounded-2xl" onClick={() => setModalOpen(true)}>
          <Plus size={18} /> Novo Quiz
        </button>
      </div>

      <div className="grid md:grid-cols-[1.25fr_1fr] gap-5">
        <section className="rounded-3xl border border-border bg-surface p-6 shadow-card ring-8 ring-muted/40">
          <div className="flex items-center justify-between gap-3 mb-5">
            <h2 className="inline-flex items-center gap-3 text-xl font-semibold text-muted-foreground">
              <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary inline-flex items-center justify-center">
                <ListChecks size={20} />
              </span>
              Quizzes
            </h2>
            <div className="flex gap-1.5">
              <StatPill icon={CheckCircle2}>{accuracy === null ? "—" : `${accuracy}%`}</StatPill>
              <StatPill icon={Flame}>{streak}x</StatPill>
            </div>
          </div>
          <div className="overflow-x-auto pb-1">
            <Heatmap perDay={perDay} />
          </div>
          <p className="mt-4 text-sm text-muted-foreground inline-flex items-center gap-1.5">
            <CheckCircle2 size={14} /> {quizzes.length} {quizzes.length === 1 ? "quiz" : "quizzes"}
          </p>
        </section>

        <section className="rounded-3xl border border-border bg-surface p-6 shadow-card ring-8 ring-muted/40">
          <div className="flex items-center justify-between gap-3 mb-8">
            <h2 className="inline-flex items-center gap-3 text-xl font-semibold text-muted-foreground">
              <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary inline-flex items-center justify-center">
                <ListChecks size={20} />
              </span>
              Diário
            </h2>
            <div className="flex gap-1.5">
              <StatPill icon={CheckCircle2}>{accuracy === null ? "—" : `${accuracy}%`}</StatPill>
              <StatPill icon={Flame}>{streak}x</StatPill>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {DAY_LETTERS.map((letter, i) => {
              const date = new Date(monday);
              date.setDate(monday.getDate() + i);
              const n = perDay.get(dayKey(date)) ?? 0;
              const isToday = dayKey(date) === dayKey(today);
              return (
                <div key={i} className="flex flex-col items-center gap-2 rounded-2xl bg-muted/40 py-3" title={`${date.toLocaleDateString("pt-BR")}: ${n} questões`}>
                  <span
                    className={cn(
                      "h-8 w-8 rounded-full inline-flex items-center justify-center",
                      n > 0 ? "bg-primary text-primary-foreground" : "bg-primary/15",
                      isToday && n === 0 && "bg-transparent ring-2 ring-primary"
                    )}
                  >
                    {n > 0 && <CheckCircle2 size={15} />}
                  </span>
                  <span className={cn("text-sm font-semibold", isToday ? "text-primary" : "text-primary/70")}>{letter}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-foreground">Seus Quizzes</h2>
          <Archive size={18} className="text-muted-foreground" aria-hidden />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[{ id: "todos", nome: "Todos" }, ...folders].map((f) => (
            <span key={f.id} className="inline-flex items-center">
              <button
                type="button"
                onClick={() => setFolder(f.id)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  folder === f.id ? "bg-primary/15 text-primary ring-1 ring-primary/30" : "text-muted-foreground hover:bg-surface-hover"
                )}
              >
                {f.nome}
                {f.id !== "todos" && <span className="ml-1.5 font-metric text-xs opacity-70">{quizzes.filter((q) => q.folderId === f.id).length}</span>}
              </button>
              {f.id !== "todos" && folder === f.id && (
                <button
                  type="button"
                  aria-label={`Excluir pasta ${f.nome}`}
                  onClick={() => {
                    deleteFolder(f.id);
                    setFolder("todos");
                  }}
                  className="ml-0.5 h-6 w-6 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-danger"
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
          {newFolder === null ? (
            <button
              type="button"
              onClick={() => setNewFolder("")}
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/40 px-4 py-1.5 text-sm font-medium text-primary hover:bg-primary/5"
            >
              <FolderPlus size={14} /> Nova Pasta
            </button>
          ) : (
            <input
              autoFocus
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              onBlur={() => setNewFolder(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newFolder.trim()) {
                  setFolder(createFolder(newFolder).id);
                  setNewFolder(null);
                }
                if (e.key === "Escape") setNewFolder(null);
              }}
              placeholder="Nome da pasta + Enter"
              className="input py-1.5 text-sm w-52 rounded-full"
            />
          )}
        </div>

        {visible.length === 0 ? (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-3xl border-2 border-dashed border-border p-10 text-center hover:border-primary/40 hover:bg-primary/5 transition-colors"
          >
            <Sparkles size={26} className="mx-auto text-primary" />
            <p className="mt-3 font-semibold text-foreground">{quizzes.length === 0 ? "Crie seu primeiro quiz" : "Nenhum quiz nesta pasta"}</p>
            <p className="text-sm text-muted-foreground mt-1">Gere com IA a partir de um tema ou monte com questões reais do banco — sem precisar de IA.</p>
          </button>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {visible.map((quiz) => (
              <QuizCard
                key={quiz.id}
                quiz={quiz}
                folders={folders}
                onDelete={() => deleteQuiz(quiz.id)}
                onMove={(folderId) => moveQuiz(quiz.id, folderId)}
              />
            ))}
          </div>
        )}
      </section>

      <NewQuizModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultFolderId={folder !== "todos" ? folder : undefined}
        onCreated={(id) => {
          setModalOpen(false);
          router.push(`/quizzes/${id}`);
        }}
      />
    </div>
  );
}
