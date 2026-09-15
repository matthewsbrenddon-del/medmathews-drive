"use client";

import { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { FilterBar, STATUS_OPTIONS_GENERIC, type FilterValues } from "@/components/FilterBar";
import { MaterialCard } from "@/components/MaterialCard";
import { useContent, useSubjects } from "@/lib/content";
import { useStudyStore } from "@/lib/store";
import type { ReadStatus } from "@/lib/types";

const STATUS_MAP: Record<string, ReadStatus | undefined> = {
  nao_iniciado: "nao_acessado",
  em_andamento: "acessado",
  concluido: "estudado",
};

export default function MateriaisPage() {
  const content = useContent();
  const subjects = useSubjects();
  const userStates = useStudyStore((s) => s.userStates);
  const [filters, setFilters] = useState<FilterValues>({});

  const materials = useMemo(() => {
    return content
      .filter((c) => c.kind !== "videoaula")
      .filter((c) => (filters.disciplina && filters.disciplina !== "todas" ? c.subjectSlug === filters.disciplina : true))
      .filter((c) => {
        if (!filters.status || filters.status === "todos") return true;
        const wanted = STATUS_MAP[filters.status];
        const actual = userStates[c.fileId]?.readStatus ?? "nao_acessado";
        return actual === wanted;
      })
      .filter((c) => (filters.favoritos ? userStates[c.fileId]?.favorite : true))
      .sort((a, b) => a.displayTitle.localeCompare(b.displayTitle, "pt-BR"));
  }, [content, filters, userStates]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Apostilas e Materiais</h1>
        <p className="text-muted-foreground mt-1">PDFs, slides e outros materiais de apoio da sua biblioteca.</p>
      </div>

      <FilterBar subjects={subjects} statusOptions={STATUS_OPTIONS_GENERIC} values={filters} onChange={setFilters} />

      {materials.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Nenhum material encontrado."
          description="Ajuste os filtros ou sincronize seu Google Drive para encontrar mais materiais."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {materials.map((item) => (
            <MaterialCard key={item.fileId} content={item} state={userStates[item.fileId]} />
          ))}
        </div>
      )}
    </div>
  );
}
