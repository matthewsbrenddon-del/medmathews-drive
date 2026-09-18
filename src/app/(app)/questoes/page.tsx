"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Brain, ClipboardList, RotateCcw, Search as SearchIcon } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { QuestionCard } from "@/components/QuestionCard";
import { useQuestionStore } from "@/lib/questionStore";
import { useQuestionProgressStore } from "@/lib/questionProgressStore";
import { needsReview } from "@/lib/questionProgressStore";
import { filterQuestions, getDistinctBancas, getDistinctYears, type QuestionFilters } from "@/lib/questionFilters";
import { getSubjectsFromItems } from "@/lib/subjects";

function QuestoesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const questions = useQuestionStore((s) => s.questions);
  const progressMap = useQuestionProgressStore((s) => s.progress);

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [filters, setFilters] = useState<QuestionFilters>({});

  const subjects = useMemo(() => getSubjectsFromItems(questions), [questions]);
  const bancas = useMemo(() => getDistinctBancas(questions), [questions]);
  const anos = useMemo(() => getDistinctYears(questions), [questions]);

  const results = useMemo(
    () => filterQuestions(questions, { ...filters, q: query }, progressMap),
    [questions, filters, query, progressMap]
  );

  const reviewCount = useMemo(
    () => questions.filter((q) => progressMap[q.id] && needsReview(progressMap[q.id])).length,
    [questions, progressMap]
  );

  function buildQuery(extra?: Record<string, string>) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (filters.disciplina && filters.disciplina !== "todas") params.set("disciplina", filters.disciplina);
    if (filters.banca && filters.banca !== "todas") params.set("banca", filters.banca);
    if (filters.ano && filters.ano !== "todos") params.set("ano", filters.ano);
    if (filters.dificuldade && filters.dificuldade !== "todas") params.set("dificuldade", filters.dificuldade);
    if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v);
    return params.toString();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Banco de Questões</h1>
        <p className="text-muted-foreground mt-1">Pratique com questões de residência médica, no seu ritmo.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => router.push(`/questoes/estudo?${buildQuery()}`)}
          className="card p-5 flex items-center gap-4 text-left hover:shadow-lift transition-all"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-primary shrink-0">
            <Brain size={20} />
          </div>
          <div>
            <p className="font-medium text-foreground">Modo Estudo</p>
            <p className="text-xs text-muted-foreground mt-0.5">Uma questão por vez, com feedback na hora</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => router.push(`/questoes/prova?${buildQuery()}`)}
          className="card p-5 flex items-center gap-4 text-left hover:shadow-lift transition-all"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent shrink-0">
            <ClipboardList size={20} />
          </div>
          <div>
            <p className="font-medium text-foreground">Modo Prova</p>
            <p className="text-xs text-muted-foreground mt-0.5">Bloco cronometrado, gabarito só no final</p>
          </div>
        </button>

        <button
          type="button"
          disabled={reviewCount === 0}
          onClick={() => router.push(`/questoes/estudo?${buildQuery({ modo: "revisao" })}`)}
          className="card p-5 flex items-center gap-4 text-left hover:shadow-lift transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/10 text-warning shrink-0">
            <RotateCcw size={20} />
          </div>
          <div>
            <p className="font-medium text-foreground">Revisão de erradas</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {reviewCount > 0 ? `${reviewCount} questões para revisar` : "Nenhuma questão pendente"}
            </p>
          </div>
        </button>
      </div>

      <div className="relative">
        <SearchIcon size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por enunciado, tema ou tag..."
          aria-label="Buscar questões"
          className="input pl-10"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <select
          aria-label="Filtrar por disciplina"
          className="input w-auto py-2 text-sm"
          value={filters.disciplina ?? "todas"}
          onChange={(e) => setFilters((f) => ({ ...f, disciplina: e.target.value }))}
        >
          <option value="todas">Todas as disciplinas</option>
          {subjects.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>

        {bancas.length > 0 && (
          <select
            aria-label="Filtrar por banca"
            className="input w-auto py-2 text-sm"
            value={filters.banca ?? "todas"}
            onChange={(e) => setFilters((f) => ({ ...f, banca: e.target.value }))}
          >
            <option value="todas">Todas as bancas</option>
            {bancas.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        )}

        {anos.length > 0 && (
          <select
            aria-label="Filtrar por ano"
            className="input w-auto py-2 text-sm"
            value={filters.ano ?? "todos"}
            onChange={(e) => setFilters((f) => ({ ...f, ano: e.target.value }))}
          >
            <option value="todos">Todos os anos</option>
            {anos.map((a) => (
              <option key={a} value={String(a)}>
                {a}
              </option>
            ))}
          </select>
        )}

        <select
          aria-label="Filtrar por dificuldade"
          className="input w-auto py-2 text-sm"
          value={filters.dificuldade ?? "todas"}
          onChange={(e) => setFilters((f) => ({ ...f, dificuldade: e.target.value }))}
        >
          <option value="todas">Todas as dificuldades</option>
          {[1, 2, 3, 4, 5].map((d) => (
            <option key={d} value={String(d)}>
              Dificuldade {d}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrar por status"
          className="input w-auto py-2 text-sm"
          value={filters.status ?? "todos"}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="todos">Todos os status</option>
          <option value="nao_respondida">Não respondida</option>
          <option value="acertada">Acertada</option>
          <option value="errada">Errada</option>
        </select>
      </div>

      <p className="text-sm text-muted-foreground">
        {results.length} {results.length === 1 ? "questão encontrada" : "questões encontradas"}
      </p>

      {results.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="Nenhuma questão encontrada."
          description="Ajuste os filtros ou importe seu banco de questões em Configurações."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              onClick={() => router.push(`/questoes/estudo?${buildQuery({ start: question.id })}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function QuestoesPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando questões..." />}>
      <QuestoesContent />
    </Suspense>
  );
}
