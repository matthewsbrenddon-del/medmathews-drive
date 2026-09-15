"use client";

import { useMemo, useState } from "react";
import { Video } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { FilterBar, STATUS_OPTIONS_GENERIC, type FilterValues } from "@/components/FilterBar";
import { VideoCard } from "@/components/VideoCard";
import { useContent, useSubjects } from "@/lib/content";
import { useStudyStore } from "@/lib/store";
import type { WatchStatus } from "@/lib/types";

const STATUS_MAP: Record<string, WatchStatus | undefined> = {
  nao_iniciado: "nao_iniciada",
  em_andamento: "em_andamento",
  concluido: "assistida",
};

export default function VideoaulasPage() {
  const content = useContent();
  const subjects = useSubjects();
  const userStates = useStudyStore((s) => s.userStates);
  const [filters, setFilters] = useState<FilterValues>({});

  const videos = useMemo(() => {
    return content
      .filter((c) => c.kind === "videoaula")
      .filter((c) => (filters.disciplina && filters.disciplina !== "todas" ? c.subjectSlug === filters.disciplina : true))
      .filter((c) => {
        if (!filters.status || filters.status === "todos") return true;
        const wanted = STATUS_MAP[filters.status];
        const actual = userStates[c.fileId]?.watchStatus ?? "nao_iniciada";
        return actual === wanted;
      })
      .filter((c) => (filters.favoritos ? userStates[c.fileId]?.favorite : true))
      .sort((a, b) => a.displayTitle.localeCompare(b.displayTitle, "pt-BR"));
  }, [content, filters, userStates]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Videoaulas</h1>
        <p className="text-muted-foreground mt-1">Sua biblioteca de videoaulas, organizada por disciplina.</p>
      </div>

      <FilterBar
        subjects={subjects}
        statusOptions={STATUS_OPTIONS_GENERIC}
        values={filters}
        onChange={setFilters}
      />

      {videos.length === 0 ? (
        <EmptyState
          icon={Video}
          title="Nenhuma videoaula encontrada."
          description="Ajuste os filtros ou sincronize seu Google Drive para encontrar mais conteúdos."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((item) => (
            <VideoCard key={item.fileId} content={item} state={userStates[item.fileId]} />
          ))}
        </div>
      )}
    </div>
  );
}
