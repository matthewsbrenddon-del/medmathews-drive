"use client";

import { useMemo, useState } from "react";
import { Brain, Filter, Flame, Layers, Target, Video as VideoIcon, BookOpen as BookOpenIcon, X } from "lucide-react";
import { ProgressBar } from "@/components/ProgressBar";
import { ProgressCircle } from "@/components/ProgressCircle";
import { SubjectIcon } from "@/components/SubjectIcon";
import { useContent } from "@/lib/content";
import { computeOverallProgress, computeSubjectProgress } from "@/lib/progress";
import { useStudyStore } from "@/lib/store";
import { useQuestionStore } from "@/lib/questionStore";
import { useQuestionProgressStore } from "@/lib/questionProgressStore";
import { computeQuestionStats } from "@/lib/questionStats";
import { filterQuestions, getDistinctBancas, getDistinctYears, type QuestionFilters } from "@/lib/questionFilters";
import { getSubjectsFromItems, resolveSubject } from "@/lib/subjects";

export default function ProgressoPage() {
  const content = useContent();
  const userStates = useStudyStore((s) => s.userStates);
  const currentStreak = useStudyStore((s) => s.currentStreak());
  const questions = useQuestionStore((s) => s.questions);
  const questionProgress = useQuestionProgressStore((s) => s.progress);

  const overall = computeOverallProgress(content, userStates);
  const subjects = computeSubjectProgress(content, userStates);
  const remaining = content.length - overall.watchedLessons - overall.studiedMaterials;

  const [questionFilters, setQuestionFilters] = useState<QuestionFilters>({});
  const questionSubjects = useMemo(() => getSubjectsFromItems(questions), [questions]);
  const bancas = useMemo(() => getDistinctBancas(questions), [questions]);
  const anos = useMemo(() => getDistinctYears(questions), [questions]);
  const filteredQuestions = useMemo(
    () => filterQuestions(questions, questionFilters, questionProgress),
    [questions, questionFilters, questionProgress]
  );
  const questionStats = computeQuestionStats(filteredQuestions, questionProgress);
  const hasActiveFilters = Object.values(questionFilters).some(Boolean);

  return (
    <div className="flex flex-col gap-9">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Meu Progresso</h1>
        <p className="text-muted-foreground mt-1">Acompanhe sua evolução acadêmica em cada disciplina.</p>
      </div>

      <section className="card p-7 flex flex-col sm:flex-row items-center gap-8">
        <ProgressCircle percent={overall.percent} size={168} strokeWidth={14} sublabel="concluído" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 flex-1 w-full">
          <div>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <VideoIcon size={13} /> Aulas concluídas
            </p>
            <p className="text-xl font-semibold text-foreground mt-1">
              {overall.watchedLessons}/{overall.totalLessons}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <BookOpenIcon size={13} /> Materiais estudados
            </p>
            <p className="text-xl font-semibold text-foreground mt-1">
              {overall.studiedMaterials}/{overall.totalMaterials}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <Layers size={13} /> Conteúdos restantes
            </p>
            <p className="text-xl font-semibold text-foreground mt-1">{Math.max(remaining, 0)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <Flame size={13} /> Sequência de estudos
            </p>
            <p className="text-xl font-semibold text-foreground mt-1">
              {currentStreak} {currentStreak === 1 ? "dia" : "dias"}
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">Progresso por disciplina</h2>
        <div className="card divide-y divide-border">
          {subjects.map((subject) => (
            <div key={subject.slug} className="flex items-center gap-4 px-5 py-4">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `hsl(${subject.colorToken} / 0.12)`, color: `hsl(${subject.colorToken})` }}
              >
                <SubjectIcon name={subject.icon} size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground truncate">{subject.name}</p>
                  <span className="text-sm font-semibold font-metric text-foreground shrink-0">{subject.percent}%</span>
                </div>
                <div className="mt-2">
                  <ProgressBar percent={subject.percent} colorToken={subject.colorToken} size="sm" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-foreground">Desempenho em questões</h2>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => setQuestionFilters({})}
              className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <X size={12} /> Limpar filtros
            </button>
          )}
        </div>

        <div className="card p-4 flex flex-wrap items-center gap-2.5 mb-4">
          <Filter size={14} className="text-muted-foreground shrink-0" />
          <select
            aria-label="Filtrar por disciplina"
            value={questionFilters.disciplina ?? "todas"}
            onChange={(e) => setQuestionFilters((f) => ({ ...f, disciplina: e.target.value }))}
            className="input w-auto py-1.5 text-sm"
          >
            <option value="todas">Todas as disciplinas</option>
            {questionSubjects.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por banca"
            value={questionFilters.banca ?? "todas"}
            onChange={(e) => setQuestionFilters((f) => ({ ...f, banca: e.target.value }))}
            className="input w-auto py-1.5 text-sm"
          >
            <option value="todas">Todas as bancas</option>
            {bancas.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por ano"
            value={questionFilters.ano ?? "todos"}
            onChange={(e) => setQuestionFilters((f) => ({ ...f, ano: e.target.value }))}
            className="input w-auto py-1.5 text-sm"
          >
            <option value="todos">Todos os anos</option>
            {anos.map((a) => (
              <option key={a} value={String(a)}>
                {a}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por dificuldade"
            value={questionFilters.dificuldade ?? "todas"}
            onChange={(e) => setQuestionFilters((f) => ({ ...f, dificuldade: e.target.value }))}
            className="input w-auto py-1.5 text-sm"
          >
            <option value="todas">Todas as dificuldades</option>
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={String(d)}>
                Dificuldade {d}
              </option>
            ))}
          </select>
        </div>

        {questionStats.overall.answered === 0 ? (
          <div className="card p-6 flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent shrink-0">
              <Brain size={20} />
            </div>
            <p className="text-sm text-muted-foreground">
              Responda questões no Banco de Questões para acompanhar seu percentual de acerto aqui.
            </p>
          </div>
        ) : (
          <div className="card p-6 flex flex-col gap-5">
            <div className="flex items-center gap-6">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <Target size={26} />
              </div>
              <div>
                <p className="text-2xl font-semibold font-metric text-foreground">{questionStats.overall.accuracyPercent}%</p>
                <p className="text-sm text-muted-foreground">
                  {questionStats.overall.correct} acertos em {questionStats.overall.answered} questões respondidas
                </p>
              </div>
            </div>

            <div className="divide-y divide-border">
              {questionStats.bySubject.map((s) => (
                <div key={s.slug} className="flex items-center gap-4 py-3">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `hsl(${s.colorToken} / 0.12)`, color: `hsl(${s.colorToken})` }}
                  >
                    <SubjectIcon name={resolveSubject(s.name).icon} size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                      <span className="text-xs font-metric text-muted-foreground shrink-0">
                        {s.correct}/{s.answered} · {s.accuracyPercent}%
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <ProgressBar percent={s.accuracyPercent} colorToken={s.colorToken} size="sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
