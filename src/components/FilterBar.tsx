"use client";

import { Star } from "lucide-react";
import type { Subject } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface FilterValues {
  tipo?: string;
  disciplina?: string;
  status?: string;
  favoritos?: boolean;
}

interface FilterOption {
  value: string;
  label: string;
}

export function FilterBar({
  subjects,
  typeOptions,
  statusOptions,
  values,
  onChange,
  showFavorites = true,
}: {
  subjects: Subject[];
  typeOptions?: FilterOption[];
  statusOptions?: FilterOption[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  showFavorites?: boolean;
}) {
  function set(patch: Partial<FilterValues>) {
    onChange({ ...values, ...patch });
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {typeOptions && (
        <select
          aria-label="Filtrar por tipo"
          className="input w-auto py-2 text-sm"
          value={values.tipo ?? "todos"}
          onChange={(e) => set({ tipo: e.target.value })}
        >
          {typeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      <select
        aria-label="Filtrar por disciplina"
        className="input w-auto py-2 text-sm"
        value={values.disciplina ?? "todas"}
        onChange={(e) => set({ disciplina: e.target.value })}
      >
        <option value="todas">Todas as disciplinas</option>
        {subjects.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.name}
          </option>
        ))}
      </select>

      {statusOptions && (
        <select
          aria-label="Filtrar por status"
          className="input w-auto py-2 text-sm"
          value={values.status ?? "todos"}
          onChange={(e) => set({ status: e.target.value })}
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {showFavorites && (
        <button
          type="button"
          onClick={() => set({ favoritos: !values.favoritos })}
          aria-pressed={values.favoritos}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors",
            values.favoritos
              ? "border-warning/30 bg-warning/10 text-warning"
              : "border-border bg-surface text-muted-foreground hover:bg-surface-hover"
          )}
        >
          <Star size={14} className={values.favoritos ? "fill-warning" : ""} />
          Favoritos
        </button>
      )}
    </div>
  );
}

export const STATUS_OPTIONS_GENERIC: FilterOption[] = [
  { value: "todos", label: "Todos os status" },
  { value: "nao_iniciado", label: "Não iniciado" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluído" },
];

export const TYPE_OPTIONS: FilterOption[] = [
  { value: "todos", label: "Todos" },
  { value: "videoaula", label: "Videoaulas" },
  { value: "apostila", label: "Apostilas" },
  { value: "pdf", label: "PDFs" },
  { value: "slides", label: "Slides" },
  { value: "outro", label: "Outros" },
];
