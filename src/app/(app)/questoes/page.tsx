"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Brain, ClipboardList, RotateCcw, Search as SearchIcon, Sparkles, Tag } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { QuestionCard } from "@/components/QuestionCard";
import { useQuestionStore } from "@/lib/questionStore";
import { useQuestionProgressStore } from "@/lib/questionProgressStore";
import { needsReview } from "@/lib/questionProgressStore";
import {
  filterQuestions,
  getDistinctBancas,
  getDistinctSubtemas,
  getDistinctTags,
  getDistinctTemas,
  getDistinctYears,
  type QuestionFilters,
} from "@/lib/questionFilters";
import { getRecommendedTemas } from "@/lib/questionStats";
import { getSubjectsFromItems } from "@/lib/subjects";
import { cn } from "@/lib/utils";

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
  const temas = useMemo(() => getDistinctTemas(questions, filters.disciplina), [questions, filters.disciplina]);
  const subtemas = useMemo(() => getDistinctSubtemas(questions, filters.tema), [questions, filters.tema]);
  const allTags = useMemo(() => getDistinctTags(questions), [questions]);

  const recommendations = useMemo(() => getRecommendedTemas(questions, progressMap), [questions, progressMap]);

  const results = useMemo(
    () => filterQuestions(questions, { ...filters, q: query }, progressMap),
    [questions, filters, query, progressMap]
  );

  const reviewCount = useMemo(
    () => questions.filter((q) => progressMap[q.id] && needsReview(progressMap[q.id])).length,
    [questions, progressMap]
  );

  function toggleTag(tag: string) {
    setFilters((f) => {
      const current = f.tags ?? [];
      const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
      return { ...f, tags: next };
    });
  }

  function buildQuery(extra?: Record<string, string>) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (filters.disciplina && filters.disciplina !== "todas") params.set("disciplina", filters.disciplina);
    if (filters.tema && filters.tema !== "todos") params.set("tema", filters.tema);
    if (filters.subtema && filters.subtema !== "todos") params.set("subtema", filters.subtema);
    if (filters.tags && filters.tags.length > 0) params.set("tags", filters.tags.join(","));
    if (filters.banca && filters.banca !== "todas") params.set("banca", filters.banca);
    if (filters.ano && filters.ano !== "todos") params.set("ano", filters.ano);
    if (filters.dificuldade && filters.dificuldade !== "todas") params.set("dificuldade", filters.dificuldade);
    if (filters.status && filters.status !== "todos") params.set("status", filters.status);
    if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v);
    return params.toString();
  }

  function trainTema(rec: { subjectSlug: string; tema: string }) {
    router.push(`/questoes/estudo?disciplina=${rec.subjectSlug}&tema=${encodeURIComponent(rec.tema)}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Banco de Questões</h1>
        <p className="text-muted-foreground mt-1">Pratique com questões de residência médica, no seu ritmo.</p>
      </div>

      {recommendations.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-3 inline-flex items-center gap-1.5">
            <Sparkles size={15} className="text-accent" /> Temas recomendados para treino
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recommendations.map((rec) => (
              <button
                key={`${rec.subjectSlug}-${rec.tema}`}
                type="button"
                onClick={() => trainTema(rec)}
                className="card p-4 text-left hover:shadow-lift hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium" style={{ color: `hsl(${rec.colorToken})` }}>
                    {rec.subjectName}
                  </span>
                  <span className="text-xs font-metric text-danger">{rec.accuracyPercent}%</span>
                </div>
                <p className="text-sm font-medium text-foreground mt-1.5 line-clamp-2">{rec.tema}</p>
                <p className="text-xs text-muted-foreground mt-1 font-metric">
                  {rec.correct}/{rec.answered} acertos até agora
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="card p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">Monte sua sessão personalizada</h2>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filtrar por disciplina"
            className="input w-auto py-2 text-sm"
            value={filters.disciplina ?? "todas"}
            onChange={(e) => setFilters((f) => ({ ...f, disciplina: e.target.value, tema: undefined, subtema: undefined }))}
          >
            <option value="todas">Todas as disciplinas</option>
            {subjects.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>

          {temas.length > 0 && (
            <select
              aria-label="Filtrar por tema"
              className="input w-auto py-2 text-sm"
              value={filters.tema ?? "todos"}
              onChange={(e) => setFilters((f) => ({ ...f, tema: e.target.value, subtema: undefined }))}
            >
              <option value="todos">Todos os temas</option>
              {temas.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}

          {subtemas.length > 0 && (
            <select
              aria-label="Filtrar por subtema"
              className="input w-auto py-2 text-sm"
              value={filters.subtema ?? "todos"}
              onChange={(e) => setFilters((f) => ({ ...f, subtema: e.target.value }))}
            >
              <option value="todos">Todos os subtemas</option>
              {subtemas.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}

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
            <option value="todos">Feitas ou não — todas</option>
            <option value="nao_respondida">Ainda não feitas</option>
            <option value="acertada">Já acertadas</option>
            <option value="errada">Já erradas</option>
          </select>
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag size={13} className="text-muted-foreground mr-0.5" />
            {allTags.map((tag) => {
              const active = (filters.tags ?? []).includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border/60 text-muted-foreground hover:bg-surface-hover"
                  )}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground font-metric">
          {results.length} {results.length === 1 ? "questão encontrada" : "questões encontradas"} com esses filtros
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary" onClick={() => router.push(`/questoes/estudo?${buildQuery()}`)}>
            <Brain size={15} /> Iniciar sessão personalizada
          </button>
          <button type="button" className="btn-outline" onClick={() => router.push(`/questoes/prova?${buildQuery()}`)}>
            <ClipboardList size={15} /> Modo Prova com esses filtros
          </button>
          <button
            type="button"
            disabled={reviewCount === 0}
            className="btn-outline disabled:opacity-50"
            onClick={() => router.push(`/questoes/estudo?${buildQuery({ modo: "revisao" })}`)}
          >
            <RotateCcw size={15} />
            {reviewCount > 0 ? `Revisar ${reviewCount} erradas` : "Nenhuma questão para revisar"}
          </button>
        </div>
      </section>

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
