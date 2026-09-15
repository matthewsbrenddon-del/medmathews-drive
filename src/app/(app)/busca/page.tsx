"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search as SearchIcon } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { FilterBar, TYPE_OPTIONS, STATUS_OPTIONS_GENERIC, type FilterValues } from "@/components/FilterBar";
import { MaterialCard } from "@/components/MaterialCard";
import { VideoCard } from "@/components/VideoCard";
import { useContent, useSubjects } from "@/lib/content";
import { useStudyStore } from "@/lib/store";
import { LoadingState } from "@/components/LoadingState";

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function BuscaContent() {
  const searchParams = useSearchParams();
  const content = useContent();
  const subjects = useSubjects();
  const userStates = useStudyStore((s) => s.userStates);

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [filters, setFilters] = useState<FilterValues>({});

  const results = useMemo(() => {
    const q = normalize(query.trim());
    return content
      .filter((c) => {
        if (!q) return true;
        const haystack = normalize(`${c.displayTitle} ${c.name} ${c.topic} ${c.folderPath.join(" ")}`);
        return haystack.includes(q);
      })
      .filter((c) => {
        if (!filters.tipo || filters.tipo === "todos") return true;
        if (filters.tipo === "videoaula") return c.kind === "videoaula";
        if (filters.tipo === "apostila") return c.kind === "apostila";
        if (filters.tipo === "pdf") return c.extension === "pdf";
        if (filters.tipo === "slides") return ["ppt", "pptx"].includes(c.extension);
        if (filters.tipo === "outro") return c.kind === "outro";
        return true;
      })
      .filter((c) => (filters.disciplina && filters.disciplina !== "todas" ? c.subjectSlug === filters.disciplina : true))
      .filter((c) => {
        if (!filters.status || filters.status === "todos") return true;
        const state = userStates[c.fileId];
        const done = c.kind === "videoaula" ? state?.watchStatus === "assistida" : state?.readStatus === "estudado";
        const inProgress =
          c.kind === "videoaula" ? state?.watchStatus === "em_andamento" : state?.readStatus === "acessado";
        if (filters.status === "concluido") return done;
        if (filters.status === "em_andamento") return inProgress;
        if (filters.status === "nao_iniciado") return !done && !inProgress;
        return true;
      })
      .filter((c) => (filters.favoritos ? userStates[c.fileId]?.favorite : true));
  }, [content, query, filters, userStates]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Busca</h1>
        <p className="text-muted-foreground mt-1">Encontre qualquer aula, disciplina, tema ou material.</p>
      </div>

      <div className="relative">
        <SearchIcon size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar aula, disciplina, tema ou material..."
          aria-label="Buscar aula, disciplina, tema ou material"
          autoFocus
          className="input pl-10"
        />
      </div>

      <FilterBar
        subjects={subjects}
        typeOptions={TYPE_OPTIONS}
        statusOptions={STATUS_OPTIONS_GENERIC}
        values={filters}
        onChange={setFilters}
      />

      <p className="text-sm text-muted-foreground">
        {results.length} {results.length === 1 ? "resultado encontrado" : "resultados encontrados"}
      </p>

      {results.length === 0 ? (
        <EmptyState icon={SearchIcon} title="Nenhum resultado encontrado." description="Tente outra palavra-chave ou ajuste os filtros." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {results.map((item) =>
            item.kind === "videoaula" ? (
              <VideoCard key={item.fileId} content={item} state={userStates[item.fileId]} />
            ) : (
              <MaterialCard key={item.fileId} content={item} state={userStates[item.fileId]} />
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function BuscaPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando busca..." />}>
      <BuscaContent />
    </Suspense>
  );
}
