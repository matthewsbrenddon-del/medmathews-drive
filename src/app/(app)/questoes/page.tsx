"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bookmark,
  Brain,
  ClipboardList,
  Eye,
  EyeOff,
  FileDown,
  ListOrdered,
  RotateCcw,
  Save,
  Search as SearchIcon,
  Shuffle,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { ApostilaExportModal } from "@/components/ApostilaExportModal";
import { QuestionFacetPanel } from "@/components/QuestionFacetPanel";
import { useNotebookStore } from "@/lib/notebookStore";
import { usePracticePrefsStore } from "@/lib/practicePrefsStore";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSavedFilterStore } from "@/lib/savedFilterStore";
import { EmptyState } from "@/components/EmptyState";
import { EmptySearchIllustration } from "@/components/Illustrations";
import { LoadingState } from "@/components/LoadingState";
import { QuestionCard } from "@/components/QuestionCard";
import { useQuestionStore, useQuestionsReady } from "@/lib/questionStore";
import { useQuestionProgressStore } from "@/lib/questionProgressStore";
import { needsReview } from "@/lib/questionProgressStore";
import {
  ORDER_LABELS,
  SCOPE_LABELS,
  STATUS_TABS,
  computeFacets,
  describeFilters,
  filterQuestions,
  filtersToParams,
  hasAnyFilter,
  normalizeFilters,
  paramsToFilters,
  removeFilterChip,
  seededShuffle,
  sortQuestions,
  type QuestionFilters,
  type QuestionOrder,
  type SearchScope,
} from "@/lib/questionFilters";
import { getRecommendedTemas } from "@/lib/questionStats";
import { resolveSubject } from "@/lib/subjects";
import type { Question } from "@/lib/types";
import { cn } from "@/lib/utils";

function QuestoesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const questions = useQuestionStore((s) => s.questions);
  const progressMap = useQuestionProgressStore((s) => s.progress);

  const ready = useQuestionsReady();
  const listEntries = useNotebookStore((s) => s.entries);
  const notebooks = useNotebookStore((s) => s.notebooks);
  const sessionSize = usePracticePrefsStore((s) => s.sessionSize);
  const setSessionSize = usePracticePrefsStore((s) => s.setSessionSize);
  const sessionRandom = usePracticePrefsStore((s) => s.sessionRandom);
  const setSessionRandom = usePracticePrefsStore((s) => s.setSessionRandom);

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [escopo, setEscopo] = useState<SearchScope>((searchParams.get("escopo") as SearchScope) || "tudo");
  // Mecânica de filtro em painel (inspirada no QConcursos): as facetas ficam
  // num rascunho local e só valem depois de "Filtrar" — "Limpar" zera os
  // dois de uma vez. A busca por texto continua instantânea.
  const [filters, setFilters] = useState<QuestionFilters>(() => {
    const initial = normalizeFilters(paramsToFilters(new URLSearchParams(searchParams.toString())));
    delete initial.q;
    delete initial.escopo;
    return initial;
  });
  const [draftFilters, setDraftFilters] = useState<QuestionFilters>(filters);
  const [hideChips, setHideChips] = useState(false);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [previewLimit, setPreviewLimit] = useState(30);
  const [customSize, setCustomSize] = useState("");
  const [exportSelection, setExportSelection] = useState<Question[] | null>(null);
  const saved = useSavedFilterStore((s) => s.saved);
  const saveFilter = useSavedFilterStore((s) => s.saveFilter);
  const updateSaved = useSavedFilterStore((s) => s.updateFilter);
  const deleteSaved = useSavedFilterStore((s) => s.deleteFilter);

  const liveQuery = useMemo<QuestionFilters>(() => (query.trim() ? { q: query.trim(), escopo } : {}), [query, escopo]);
  const filterCtx = useMemo(() => ({ listEntries }), [listEntries]);
  const listName = (id: string) => notebooks.find((n) => n.id === id)?.name ?? "lista removida";

  const hasAppliedFilters = hasAnyFilter(filters);
  const hasDraftChanges = JSON.stringify(draftFilters) !== JSON.stringify(filters);

  const facets = useMemo(
    () =>
      computeFacets(questions, { ...draftFilters, ...liveQuery }, progressMap, filterCtx, {
        area: (slug) => resolveSubject(slug).name,
        lista: listName,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions, draftFilters, liveQuery, progressMap, filterCtx, notebooks]
  );
  const draftCount = useMemo(
    () => (hasDraftChanges ? filterQuestions(questions, { ...draftFilters, ...liveQuery }, progressMap, filterCtx).length : 0),
    [hasDraftChanges, questions, draftFilters, liveQuery, progressMap, filterCtx]
  );

  const recommendations = useMemo(() => getRecommendedTemas(questions, progressMap), [questions, progressMap]);

  const results = useMemo(
    () => sortQuestions(filterQuestions(questions, { ...filters, ...liveQuery }, progressMap, filterCtx), filters.ordem, progressMap),
    [questions, filters, liveQuery, progressMap, filterCtx]
  );
  const chips = describeFilters({ ...filters, ...liveQuery }, (slug) => resolveSubject(slug).name, listName);
  const selectedCount = sessionSize > 0 ? Math.min(sessionSize, results.length) : results.length;
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
      setEscopo("tudo");
      return;
    }
    applyNow(removeFilterChip(filters, key));
  }

  function loadSaved(id: string) {
    const item = saved.find((f) => f.id === id);
    if (!item) return;
    setActiveSavedId(id);
    applyNow(normalizeFilters(item.filters));
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

  function applyFilters() {
    setFilters(draftFilters);
  }

  function clearFilters() {
    setDraftFilters({});
    setFilters({});
  }

  function buildQuery(extra?: Record<string, string>) {
    return filtersToParams({ ...filters, ...liveQuery }, extra);
  }

  /** Parâmetros da sessão escolhida: quantidade + sorteio (mesma semente vira a mesma ordem). */
  function sessionParams(seed: number): Record<string, string> {
    const extra: Record<string, string> = {};
    if (sessionSize > 0 && sessionSize < results.length) extra.limite = String(sessionSize);
    if (sessionRandom) extra.seed = String(seed);
    return extra;
  }

  function selection(seed: number): Question[] {
    const base = sessionRandom ? seededShuffle(results, seed) : results;
    return sessionSize > 0 ? base.slice(0, sessionSize) : base;
  }

  const newSeed = () => (Date.now() % 1_000_000_000) + 1;

  function trainTema(rec: { subjectSlug: string; tema: string }) {
    router.push(`/questoes/estudo?disciplina=${rec.subjectSlug}&tema=${encodeURIComponent(rec.tema)}`);
  }

  if (!ready) return <LoadingState label="Carregando o banco de questões..." />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Banco de Questões</h1>
          <p className="text-muted-foreground mt-1">
            <strong className="text-foreground font-metric">{results.length.toLocaleString("pt-BR")}</strong>{" "}
            {results.length === 1 ? "questão" : "questões"}
            {chips.length > 0 ? " com os filtros aplicados" : " no seu banco"}
            {chips.length > 0 && (
              <span className="font-metric"> · de {questions.length.toLocaleString("pt-BR")}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="relative">
          <SearchIcon size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Buscar: termos, "frase exata" ou -excluir (ex.: meningite "líquor turvo" -neonatal)'
            aria-label="Buscar questões"
            className="input pl-10 pr-4 py-3"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground mr-1">Buscar em:</span>
          {(Object.keys(SCOPE_LABELS) as SearchScope[]).map((sc) => (
            <button
              key={sc}
              type="button"
              onClick={() => setEscopo(sc)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 transition-colors",
                escopo === sc ? "border-primary bg-primary-light text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {SCOPE_LABELS[sc]}
            </button>
          ))}
        </div>
      </div>

      <QuestionFacetPanel
        draft={draftFilters}
        onDraftChange={setDraftFilters}
        facets={facets}
        draftCount={draftCount}
        onApply={applyFilters}
        onClear={clearFilters}
        hasChanges={hasDraftChanges}
        canClear={hasAppliedFilters || hasDraftChanges}
      />

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

      <section className="card relative overflow-hidden p-5 flex flex-col gap-4">
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-2xl" />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground inline-flex items-center gap-2">
              <ListOrdered size={17} className="text-primary" /> Monte sua sessão
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quantas questões por vez? Vale para resolver, simulado cronometrado e apostila em PDF.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            <strong className="text-2xl text-foreground font-metric">{selectedCount.toLocaleString("pt-BR")}</strong>
            <span className="font-metric"> / {results.length.toLocaleString("pt-BR")}</span> questões
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[10, 20, 30, 50, 100, 200, 0].map((n) => {
            const active = sessionSize === n;
            const disabled = n > 0 && n > results.length && results.length > 0 && !active;
            return (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setSessionSize(n);
                  setCustomSize("");
                }}
                disabled={disabled}
                className={cn(
                  "min-w-[52px] rounded-xl border px-3 py-2 text-sm font-metric transition-all",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-card"
                    : "border-border bg-surface text-foreground hover:border-primary/50 hover:bg-primary-light disabled:opacity-35 disabled:hover:bg-surface"
                )}
              >
                {n === 0 ? "Todas" : n}
              </button>
            );
          })}
          <label className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border px-2.5 py-1.5 text-xs text-muted-foreground focus-within:border-primary">
            Outra:
            <input
              type="number"
              min={1}
              max={results.length || undefined}
              value={customSize || (![10, 20, 30, 50, 100, 200, 0].includes(sessionSize) ? String(sessionSize) : "")}
              onChange={(e) => {
                setCustomSize(e.target.value);
                const n = Number(e.target.value);
                if (n > 0) setSessionSize(n);
              }}
              placeholder="ex.: 45"
              className="w-16 bg-transparent font-metric text-sm text-foreground outline-none"
              aria-label="Quantidade personalizada de questões"
            />
          </label>
          <span className="mx-1 hidden sm:block h-6 w-px bg-border" />
          <div className="inline-flex rounded-xl border border-border p-0.5 bg-muted/60 text-xs">
            <button
              type="button"
              onClick={() => setSessionRandom(false)}
              className={cn("px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5", !sessionRandom ? "bg-surface shadow-card text-foreground" : "text-muted-foreground")}
            >
              <ListOrdered size={13} /> Na ordem
            </button>
            <button
              type="button"
              onClick={() => setSessionRandom(true)}
              className={cn("px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5", sessionRandom ? "bg-surface shadow-card text-foreground" : "text-muted-foreground")}
            >
              <Shuffle size={13} /> Sorteadas
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/60">
          <button
            type="button"
            className="btn-primary"
            disabled={results.length === 0}
            onClick={() => router.push(`/questoes/estudo?${buildQuery(sessionParams(newSeed()))}`)}
          >
            <Brain size={15} /> Resolver {selectedCount} {selectedCount === 1 ? "questão" : "questões"}
          </button>
          <button
            type="button"
            className="btn-outline"
            disabled={results.length === 0}
            onClick={() => router.push(`/questoes/prova?${buildQuery({ ...sessionParams(newSeed()), limite: String(selectedCount) })}`)}
          >
            <ClipboardList size={15} /> Simulado cronometrado
          </button>
          <button type="button" className="btn-outline" disabled={results.length === 0} onClick={() => setExportSelection(selection(newSeed()))}>
            <FileDown size={15} className="text-primary" /> Apostila PDF ({selectedCount})
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={results.length === 0}
            onClick={() => relampago({ ...filters, ...liveQuery })}
            title="20 questões sorteadas destes filtros"
          >
            <Zap size={15} className="text-warning" /> Relâmpago
          </button>
          <button
            type="button"
            disabled={reviewCount === 0}
            className="btn-ghost disabled:opacity-50"
            onClick={() => router.push(`/questoes/estudo?${buildQuery({ modo: "revisao" })}`)}
          >
            <RotateCcw size={15} />
            {reviewCount > 0 ? `Revisar ${reviewCount} erradas` : "Nada para revisar"}
          </button>
        </div>
      </section>

      <ApostilaExportModal
        open={exportSelection !== null}
        onClose={() => setExportSelection(null)}
        questions={exportSelection ?? []}
        subtitle={chips.length > 0 ? chips.map((c) => c.label).join(" · ") : "Seleção do banco de questões"}
      />

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
