"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bookmark,
  Brain,
  ClipboardList,
  Eye,
  EyeOff,
  Filter,
  RotateCcw,
  Save,
  Search as SearchIcon,
  Sparkles,
  Tag,
  X,
  Zap,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSavedFilterStore } from "@/lib/savedFilterStore";
import { EmptyState } from "@/components/EmptyState";
import { EmptySearchIllustration } from "@/components/Illustrations";
import { LoadingState } from "@/components/LoadingState";
import { QuestionCard } from "@/components/QuestionCard";
import { useQuestionStore } from "@/lib/questionStore";
import { useQuestionProgressStore } from "@/lib/questionProgressStore";
import { needsReview } from "@/lib/questionProgressStore";
import {
  ORDER_LABELS,
  STATUS_TABS,
  describeFilters,
  filterQuestions,
  filtersToParams,
  paramsToFilters,
  removeFilterChip,
  sortQuestions,
  type QuestionOrder,
  getDistinctBancas,
  getDistinctSubtemas,
  getDistinctTags,
  getDistinctTemas,
  getDistinctYears,
  type QuestionFilters,
} from "@/lib/questionFilters";
import { getRecommendedTemas } from "@/lib/questionStats";
import { getSubjectsFromItems, resolveSubject } from "@/lib/subjects";
import { cn } from "@/lib/utils";

function QuestoesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const questions = useQuestionStore((s) => s.questions);
  const progressMap = useQuestionProgressStore((s) => s.progress);

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  // Mecânica de filtro em painel (inspirada no QConcursos): os campos ficam
  // num rascunho local e só valem depois de "Filtrar" — "Limpar" zera os
  // dois de uma vez. A busca por texto abaixo do painel continua instantânea.
  const [filters, setFilters] = useState<QuestionFilters>(() => {
    const initial = paramsToFilters(new URLSearchParams(searchParams.toString()));
    delete initial.q;
    return initial;
  });
  const [draftFilters, setDraftFilters] = useState<QuestionFilters>(filters);
  const [hideChips, setHideChips] = useState(false);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [previewLimit, setPreviewLimit] = useState(30);
  const saved = useSavedFilterStore((s) => s.saved);
  const saveFilter = useSavedFilterStore((s) => s.saveFilter);
  const updateSaved = useSavedFilterStore((s) => s.updateFilter);
  const deleteSaved = useSavedFilterStore((s) => s.deleteFilter);

  const subjects = useMemo(() => getSubjectsFromItems(questions), [questions]);
  const bancas = useMemo(() => getDistinctBancas(questions), [questions]);
  const anos = useMemo(() => getDistinctYears(questions), [questions]);
  const temas = useMemo(() => getDistinctTemas(questions, draftFilters.disciplina), [questions, draftFilters.disciplina]);
  const subtemas = useMemo(() => getDistinctSubtemas(questions, draftFilters.tema), [questions, draftFilters.tema]);
  const allTags = useMemo(() => getDistinctTags(questions), [questions]);

  const hasAppliedFilters = Object.values(filters).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v)));
  const hasDraftChanges = JSON.stringify(draftFilters) !== JSON.stringify(filters);

  const recommendations = useMemo(() => getRecommendedTemas(questions, progressMap), [questions, progressMap]);

  const results = useMemo(
    () => sortQuestions(filterQuestions(questions, { ...filters, q: query }, progressMap), filters.ordem, progressMap),
    [questions, filters, query, progressMap]
  );
  const chips = describeFilters({ ...filters, q: query || undefined }, (slug) => resolveSubject(slug).name);
  const activeSaved = saved.find((f) => f.id === activeSavedId);
  const savedChanged = activeSaved ? JSON.stringify(activeSaved.filters) !== JSON.stringify(filters) : false;

  /** Aplica na hora (abas "Minhas questões", ordenar, excluir anuladas, chips) — mantém o rascunho do painel em sincronia. */
  function applyNow(next: QuestionFilters) {
    setFilters(next);
    setDraftFilters(next);
  }

  function removeChip(key: Parameters<typeof removeFilterChip>[1]) {
    if (key === "q") {
      setQuery("");
      return;
    }
    applyNow(removeFilterChip(filters, key));
  }

  function loadSaved(id: string) {
    const item = saved.find((f) => f.id === id);
    if (!item) return;
    setActiveSavedId(id);
    applyNow(item.filters);
  }

  function relampago(f: QuestionFilters, nome?: string) {
    const extra: Record<string, string> = { limite: "20", seed: String(Date.now() % 1_000_000_000) };
    if (nome) extra.titulo = `⚡ ${nome}`;
    router.push(`/questoes/estudo?${filtersToParams(f, extra)}`);
  }

  const reviewCount = useMemo(
    () => questions.filter((q) => progressMap[q.id] && needsReview(progressMap[q.id])).length,
    [questions, progressMap]
  );

  function toggleTag(tag: string) {
    setDraftFilters((f) => {
      const current = f.tags ?? [];
      const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
      return { ...f, tags: next };
    });
  }

  function applyFilters() {
    setFilters(draftFilters);
  }

  function clearFilters() {
    setDraftFilters({});
    setFilters({});
  }

  function buildQuery(extra?: Record<string, string>) {
    return filtersToParams({ ...filters, q: query || undefined }, extra);
  }

  function trainTema(rec: { subjectSlug: string; tema: string }) {
    router.push(`/questoes/estudo?disciplina=${rec.subjectSlug}&tema=${encodeURIComponent(rec.tema)}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Banco de Questões</h1>
          <p className="text-muted-foreground mt-1">
            Encontramos <strong className="text-foreground font-metric">{results.length}</strong>{" "}
            {results.length === 1 ? "questão" : "questões"}
            {chips.length > 0 ? " com os filtros aplicados" : " no seu banco"}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>

      <section className="card p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap rounded-xl border border-border p-0.5 bg-muted/60" role="tablist" aria-label="Minhas questões">
            {STATUS_TABS.map((t) => {
              const active = (filters.status ?? "todos") === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => applyNow({ ...filters, status: t.id === "todos" ? undefined : t.id })}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                    active ? "bg-surface shadow-card text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={Boolean(filters.excluirAnuladas)}
                onChange={(e) => applyNow({ ...filters, excluirAnuladas: e.target.checked || undefined })}
                className="accent-[hsl(var(--primary))]"
              />
              Excluir anuladas
            </label>
            <select
              aria-label="Ordenar"
              value={filters.ordem ?? "padrao"}
              onChange={(e) => applyNow({ ...filters, ordem: e.target.value === "padrao" ? undefined : (e.target.value as QuestionOrder) })}
              className="input w-auto py-1.5 text-xs"
            >
              {(Object.keys(ORDER_LABELS) as QuestionOrder[]).map((o) => (
                <option key={o} value={o}>
                  Ordenar: {ORDER_LABELS[o]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {!hideChips &&
              chips.map((c) => (
                <span
                  key={String(c.key)}
                  className="inline-flex items-center gap-1 rounded-full bg-primary-light text-primary text-xs font-medium pl-2.5 pr-1 py-0.5"
                >
                  {c.label}
                  <button
                    type="button"
                    onClick={() => removeChip(c.key)}
                    aria-label={`Remover filtro ${c.label}`}
                    className="h-4 w-4 inline-flex items-center justify-center rounded-full hover:bg-primary/20"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            <button
              type="button"
              onClick={() => setHideChips((v) => !v)}
              className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 ml-1"
            >
              {hideChips ? <Eye size={12} /> : <EyeOff size={12} />}
              {hideChips ? `Mostrar ${chips.length} filtros aplicados` : "Esconder filtros aplicados"}
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mr-1 inline-flex items-center gap-1">
            <Bookmark size={12} /> Filtros salvos
          </span>
          {saved.length === 0 && savingName === null && (
            <span className="text-xs text-muted-foreground">Nenhum ainda — monte um filtro e salve para reabrir com um clique.</span>
          )}
          {saved.map((f) => (
            <span
              key={f.id}
              className={cn(
                "inline-flex items-center rounded-full border text-xs overflow-hidden",
                activeSavedId === f.id ? "border-primary bg-primary-light" : "border-border"
              )}
            >
              <button type="button" onClick={() => loadSaved(f.id)} className="px-2.5 py-1 font-medium text-foreground hover:bg-surface-hover">
                {f.nome}
              </button>
              <button
                type="button"
                onClick={() => relampago(f.filters, f.nome)}
                title="Simulado relâmpago: 20 questões deste filtro"
                className="px-1.5 py-1 text-warning hover:bg-warning/10 border-l border-border"
              >
                <Zap size={12} />
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteSaved(f.id);
                  if (activeSavedId === f.id) setActiveSavedId(null);
                }}
                aria-label={`Excluir filtro ${f.nome}`}
                className="px-1.5 py-1 text-muted-foreground hover:text-danger border-l border-border"
              >
                <X size={11} />
              </button>
            </span>
          ))}
          {activeSaved && savedChanged && (
            <button type="button" onClick={() => updateSaved(activeSaved.id, filters)} className="btn-outline btn-sm">
              <Save size={12} /> Atualizar “{activeSaved.nome}”
            </button>
          )}
          {savingName === null ? (
            <button type="button" onClick={() => setSavingName("")} className="btn-ghost btn-sm text-primary" disabled={chips.length === 0}>
              <Save size={12} /> Salvar filtro atual
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <input
                autoFocus
                value={savingName}
                onChange={(e) => setSavingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && savingName.trim()) {
                    setActiveSavedId(saveFilter(savingName, filters).id);
                    setSavingName(null);
                  }
                  if (e.key === "Escape") setSavingName(null);
                }}
                placeholder="Ex.: Cardio — só as que errei"
                className="input py-1 text-xs w-52"
              />
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={!savingName.trim()}
                onClick={() => {
                  setActiveSavedId(saveFilter(savingName, filters).id);
                  setSavingName(null);
                }}
              >
                Salvar
              </button>
            </span>
          )}
        </div>
      </section>

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
        <h2 className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
          <Filter size={14} className="text-muted-foreground" /> Filtros detalhados
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <select
            aria-label="Filtrar por disciplina"
            className="input text-sm"
            value={draftFilters.disciplina ?? "todas"}
            onChange={(e) => setDraftFilters((f) => ({ ...f, disciplina: e.target.value, tema: undefined, subtema: undefined }))}
          >
            <option value="todas">Todas as disciplinas</option>
            {subjects.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por tema"
            className="input text-sm"
            value={draftFilters.tema ?? "todos"}
            disabled={temas.length === 0}
            onChange={(e) => setDraftFilters((f) => ({ ...f, tema: e.target.value, subtema: undefined }))}
          >
            <option value="todos">Todos os temas</option>
            {temas.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por subtema"
            className="input text-sm"
            value={draftFilters.subtema ?? "todos"}
            disabled={subtemas.length === 0}
            onChange={(e) => setDraftFilters((f) => ({ ...f, subtema: e.target.value }))}
          >
            <option value="todos">Todos os subtemas</option>
            {subtemas.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por banca"
            className="input text-sm"
            value={draftFilters.banca ?? "todas"}
            disabled={bancas.length === 0}
            onChange={(e) => setDraftFilters((f) => ({ ...f, banca: e.target.value }))}
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
            className="input text-sm"
            value={draftFilters.ano ?? "todos"}
            disabled={anos.length === 0}
            onChange={(e) => setDraftFilters((f) => ({ ...f, ano: e.target.value }))}
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
            className="input text-sm"
            value={draftFilters.dificuldade ?? "todas"}
            onChange={(e) => setDraftFilters((f) => ({ ...f, dificuldade: e.target.value }))}
          >
            <option value="todas">Todas as dificuldades</option>
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={String(d)}>
                Dificuldade {d}
              </option>
            ))}
          </select>

        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag size={13} className="text-muted-foreground mr-0.5" />
            {allTags.map((tag) => {
              const active = (draftFilters.tags ?? []).includes(tag);
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

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground font-metric">
            {results.length} {results.length === 1 ? "questão encontrada" : "questões encontradas"}
            {hasAppliedFilters ? " com esses filtros" : ""}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-outline btn-sm" onClick={clearFilters} disabled={!hasAppliedFilters && !hasDraftChanges}>
              Limpar
            </button>
            <button type="button" className="btn-primary btn-sm" onClick={applyFilters} disabled={!hasDraftChanges}>
              <Filter size={13} /> Filtrar
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
          <button
            type="button"
            className="btn-primary"
            disabled={results.length === 0}
            onClick={() => router.push(`/questoes/estudo?${buildQuery()}`)}
          >
            <Brain size={15} /> Resolver {results.length} {results.length === 1 ? "questão" : "questões"}
          </button>
          <button
            type="button"
            className="btn-outline"
            disabled={results.length === 0}
            onClick={() => relampago({ ...filters, q: query || undefined })}
            title="20 questões sorteadas destes filtros"
          >
            <Zap size={15} className="text-warning" /> Relâmpago (20)
          </button>
          <button type="button" className="btn-outline" onClick={() => router.push(`/questoes/prova?${buildQuery()}`)}>
            <ClipboardList size={15} /> Simulado cronometrado
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
          illustration={<EmptySearchIllustration />}
          title="Nenhuma questão encontrada."
          description="Ajuste os filtros ou importe seu banco de questões em Configurações."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.slice(0, previewLimit).map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              onClick={() => router.push(`/questoes/estudo?${buildQuery({ start: question.id })}`)}
            />
          ))}
          {results.length > previewLimit && (
            <button type="button" className="btn-outline sm:col-span-2 lg:col-span-3 justify-self-center" onClick={() => setPreviewLimit((l) => l + 30)}>
              Mostrar mais ({results.length - previewLimit} restantes)
            </button>
          )}
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
