"use client";

import { useMemo, useState } from "react";
import {
  BookMarked,
  CalendarDays,
  Check,
  Filter,
  Gauge,
  History,
  Landmark,
  Layers,
  ListChecks,
  Search as SearchIcon,
  Sparkles,
  Stethoscope,
  X,
} from "lucide-react";
import { FACETS, type FacetKey, type FacetOption, type QuestionFilters } from "@/lib/questionFilters";
import { KNOWN_SUBJECTS } from "@/lib/subjects";
import { cn, normalizeText } from "@/lib/utils";

const FACET_ICONS: Record<FacetKey, typeof Filter> = {
  areas: Layers,
  especialidades: Stethoscope,
  temas: BookMarked,
  origens: Landmark,
  provas: ListChecks,
  anos: CalendarDays,
  dificuldades: Gauge,
  caracteristicas: Sparkles,
  historico: History,
  listas: ListChecks,
};

const AREA_COLOR: Record<string, string> = Object.fromEntries(KNOWN_SUBJECTS.map((s) => [s.slug, s.colorToken]));

/**
 * Painel de filtros no estilo QConcursos: facetas à esquerda, opções com
 * contagem à direita. Tudo é rascunho até clicar em "Filtrar".
 */
export function QuestionFacetPanel({
  draft,
  onDraftChange,
  facets,
  draftCount,
  onApply,
  onClear,
  hasChanges,
  canClear,
}: {
  draft: QuestionFilters;
  onDraftChange: (next: QuestionFilters) => void;
  facets: Record<FacetKey, FacetOption[]>;
  draftCount: number;
  onApply: () => void;
  onClear: () => void;
  hasChanges: boolean;
  canClear: boolean;
}) {
  const [active, setActive] = useState<FacetKey>("areas");
  const [search, setSearch] = useState("");
  const facet = FACETS.find((f) => f.key === active)!;
  const selected = draft[active] ?? [];
  const options = useMemo(() => facets[active] ?? [], [facets, active]);
  const maxCount = Math.max(1, ...options.map((o) => o.count));

  const visible = useMemo(() => {
    const q = normalizeText(search.trim());
    return q ? options.filter((o) => normalizeText(o.label).includes(q)) : options;
  }, [options, search]);

  function toggle(value: string) {
    const current = draft[active] ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    const copy = { ...draft, [active]: next };
    if (next.length === 0) delete copy[active];
    onDraftChange(copy);
  }

  function selectVisible() {
    const values = visible.filter((o) => o.count > 0).map((o) => o.value);
    onDraftChange({ ...draft, [active]: Array.from(new Set([...(draft[active] ?? []), ...values])) });
  }

  function clearFacet() {
    const copy = { ...draft };
    delete copy[active];
    onDraftChange(copy);
  }

  const totalSelected = FACETS.reduce((n, f) => n + (draft[f.key]?.length ?? 0), 0);

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border bg-muted/30">
        <h2 className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
          <Filter size={15} className="text-primary" /> Filtros
          {totalSelected > 0 && (
            <span className="rounded-full bg-primary text-primary-foreground text-[10px] font-metric px-1.5 py-0.5">{totalSelected}</span>
          )}
        </h2>
        <p className="text-[11px] text-muted-foreground hidden sm:block">
          Marque quantas opções quiser — o número ao lado é quantas questões você terá.
        </p>
      </div>

      <div className="grid md:grid-cols-[230px_1fr] min-h-[340px]">
        {/* Facetas */}
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible p-2 border-b md:border-b-0 md:border-r border-border bg-surface" aria-label="Categorias de filtro">
          {FACETS.map((f) => {
            const Icon = FACET_ICONS[f.key];
            const count = draft[f.key]?.length ?? 0;
            const isActive = f.key === active;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setActive(f.key);
                  setSearch("");
                }}
                className={cn(
                  "relative shrink-0 inline-flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  isActive ? "bg-primary-light text-primary font-medium" : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                )}
              >
                {isActive && <span className="hidden md:block absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary" />}
                <Icon size={15} className="shrink-0" />
                <span className="flex-1 whitespace-nowrap">{f.label}</span>
                {count > 0 && <span className="rounded-full bg-primary/15 text-primary text-[10px] font-metric px-1.5">{count}</span>}
              </button>
            );
          })}
        </nav>

        {/* Opções */}
        <div className="flex flex-col min-w-0">
          <div className="flex flex-wrap items-center gap-2 px-4 pt-3.5 pb-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{facet.label}</p>
              <p className="text-[11px] text-muted-foreground">
                {facet.hint}
                {facet.and ? " · todas as marcadas precisam valer" : " · qualquer uma das marcadas"}
              </p>
            </div>
            {(facet.searchable || options.length > 12) && (
              <div className="relative w-full sm:w-56">
                <SearchIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Buscar ${facet.label.toLowerCase()}…`}
                  className="input py-1.5 pl-8 text-xs"
                  aria-label={`Buscar em ${facet.label}`}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 px-4 pb-2 text-[11px]">
            <button type="button" onClick={selectVisible} className="text-primary hover:underline disabled:opacity-40" disabled={visible.length === 0 || facet.and}>
              Marcar {search ? "encontradas" : "todas"}
            </button>
            <button type="button" onClick={clearFacet} className="text-muted-foreground hover:text-foreground disabled:opacity-40" disabled={selected.length === 0}>
              Desmarcar
            </button>
            <span className="ml-auto text-muted-foreground font-metric">{visible.length} opções</span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[320px] px-2 pb-3 grid sm:grid-cols-2 gap-x-2 content-start">
            {visible.length === 0 && (
              <p className="sm:col-span-2 px-2 py-6 text-center text-xs text-muted-foreground">
                {active === "listas" ? "Você ainda não criou listas — use o ícone de lista numa questão." : "Nenhuma opção encontrada."}
              </p>
            )}
            {visible.map((o) => {
              const checked = selected.includes(o.value);
              const color = active === "areas" ? AREA_COLOR[o.value] : undefined;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggle(o.value)}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors overflow-hidden",
                    checked ? "bg-primary-light" : "hover:bg-surface-hover",
                    o.count === 0 && !checked && "opacity-45"
                  )}
                >
                  <span
                    aria-hidden
                    className="absolute left-0 bottom-0 h-[2px] rounded-full opacity-60"
                    style={{ width: `${(o.count / maxCount) * 100}%`, background: color ? `hsl(${color})` : "hsl(var(--primary))" }}
                  />
                  <span
                    className={cn(
                      "h-4 w-4 shrink-0 rounded-[5px] border inline-flex items-center justify-center transition-colors",
                      checked ? "bg-primary border-primary text-primary-foreground" : "border-border group-hover:border-primary/60"
                    )}
                  >
                    {checked && <Check size={11} strokeWidth={3} />}
                  </span>
                  {color && <span className="h-2 w-2 rounded-full shrink-0" style={{ background: `hsl(${color})` }} />}
                  <span className={cn("flex-1 min-w-0 truncate", checked ? "text-foreground font-medium" : "text-foreground/90")} title={o.label}>
                    {o.label}
                  </span>
                  <span className="font-metric text-[11px] text-muted-foreground shrink-0">{o.count.toLocaleString("pt-BR")}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {totalSelected > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-5 py-2.5 border-t border-border bg-muted/20">
          {FACETS.flatMap((f) =>
            (draft[f.key] ?? []).map((v) => {
              const label = facets[f.key]?.find((o) => o.value === v)?.label ?? v;
              return (
                <span key={`${f.key}:${v}`} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-surface text-xs pl-2.5 pr-1 py-0.5">
                  <span className="text-muted-foreground">{f.label}:</span>
                  <span className="text-foreground font-medium max-w-[200px] truncate">{label}</span>
                  <button
                    type="button"
                    aria-label={`Remover ${label}`}
                    onClick={() => {
                      const next = (draft[f.key] ?? []).filter((x) => x !== v);
                      const copy = { ...draft, [f.key]: next };
                      if (next.length === 0) delete copy[f.key];
                      onDraftChange(copy);
                    }}
                    className="h-4 w-4 inline-flex items-center justify-center rounded-full hover:bg-primary/15"
                  >
                    <X size={10} />
                  </button>
                </span>
              );
            })
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-border">
        <p className="text-xs text-muted-foreground">
          {hasChanges ? (
            <>
              Com estes filtros: <strong className="text-foreground font-metric">{draftCount.toLocaleString("pt-BR")}</strong> questões
            </>
          ) : (
            "Filtros aplicados à lista abaixo."
          )}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-outline btn-sm" onClick={onClear} disabled={!canClear}>
            Limpar tudo
          </button>
          <button type="button" className="btn-primary btn-sm" onClick={onApply} disabled={!hasChanges}>
            <Filter size={13} /> Filtrar {hasChanges ? `(${draftCount.toLocaleString("pt-BR")})` : ""}
          </button>
        </div>
      </div>
    </section>
  );
}
