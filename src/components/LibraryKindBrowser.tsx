"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleDot, Play, Search, Star, Video } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { EmptySearchIllustration } from "./Illustrations";
import { FilePreviewModal } from "./FilePreviewModal";
import { FavoriteButton } from "./FavoriteButton";
import { KIND_ICON, KIND_SHORT, LibraryFileRow } from "./LibraryFileRow";
import { LoadingState } from "./LoadingState";
import { ThematicCover } from "./ThematicCover";
import { useLibraryStore } from "@/lib/libraryStore";
import { useClassificationStore } from "@/lib/classificationStore";
import { classifyLibrary, type ClassifiedFile } from "@/lib/classification";
import {
  UNCLASSIFIED_LABEL,
  fileKind,
  fileName,
  fullPath,
  isFileComplete,
  isFileStarted,
  naturalCompare,
} from "@/lib/library";
import { useStudyStore } from "@/lib/store";
import { KNOWN_SUBJECTS, resolveSubject } from "@/lib/subjects";
import type { LibraryFile } from "@/lib/types";
import { cn, normalizeText } from "@/lib/utils";

const PAGE_SIZE = 48;

type StatusFilter = "todos" | "nao_iniciado" | "em_andamento" | "concluido";

function folderOf(file: LibraryFile): string {
  return fullPath(file).slice(0, -1).join(" › ");
}

function VideoThumb({ file }: { file: ClassifiedFile }) {
  return (
    <div className="relative">
      <ThematicCover file={file} className="aspect-video" />
      <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift">
          <Play size={20} className="fill-current ml-0.5" />
        </span>
      </span>
    </div>
  );
}

/** Navegador do acervo real por tipo (Videoaulas ou Materiais) — mesmo player,
 * mesmo progresso e mesma classificação de Disciplinas. */
export function LibraryKindBrowser({ mode }: { mode: "video" | "material" }) {
  const files = useLibraryStore((s) => s.files);
  const status = useLibraryStore((s) => s.status);
  const hydrate = useLibraryStore((s) => s.hydrate);
  const overrides = useClassificationStore((s) => s.overrides);
  const userStates = useStudyStore((s) => s.userStates);

  const [area, setArea] = useState("todas");
  const [curso, setCurso] = useState("todos");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [preview, setPreview] = useState<{ file: LibraryFile; playlist: LibraryFile[] } | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const pool = useMemo(() => {
    const matchesKind = (f: LibraryFile) => {
      const k = fileKind(f);
      return mode === "video" ? k === "video" : k === "pdf" || k === "epub";
    };
    return classifyLibrary(files.filter(matchesKind), overrides).sort((a, b) =>
      naturalCompare(`${folderOf(a)} › ${fileName(a)}`, `${folderOf(b)} › ${fileName(b)}`)
    );
  }, [files, overrides, mode]);

  const siblingsByFolder = useMemo(() => {
    const map = new Map<string, ClassifiedFile[]>();
    for (const f of pool) {
      const key = folderOf(f);
      const list = map.get(key) ?? [];
      list.push(f);
      map.set(key, list);
    }
    return map;
  }, [pool]);

  const cursos = useMemo(() => Array.from(new Set(pool.map((f) => f.curso))).sort(naturalCompare), [pool]);

  const filtered = useMemo(() => {
    const q = normalizeText(query.trim());
    return pool.filter((f) => {
      if (area !== "todas") {
        if (area === "__none") {
          if (f.subjectSlug) return false;
        } else if (f.subjectSlug !== area) return false;
      }
      if (curso !== "todos" && f.curso !== curso) return false;
      const state = userStates[f.id];
      if (onlyFavorites && !state?.favorite) return false;
      if (statusFilter !== "todos") {
        const done = isFileComplete(f, state);
        const started = !done && isFileStarted(f, state);
        if (statusFilter === "concluido" && !done) return false;
        if (statusFilter === "em_andamento" && !started) return false;
        if (statusFilter === "nao_iniciado" && (done || started)) return false;
      }
      if (q && !normalizeText(`${f.curso} ${f.area} ${f.conteudo} ${f.disciplina ?? ""}`).includes(q)) return false;
      return true;
    });
  }, [pool, area, curso, statusFilter, onlyFavorites, query, userStates]);

  useEffect(() => setLimit(PAGE_SIZE), [area, curso, statusFilter, onlyFavorites, query]);

  function open(file: ClassifiedFile) {
    setPreview({ file, playlist: siblingsByFolder.get(folderOf(file)) ?? [file] });
  }

  const title = mode === "video" ? "Videoaulas" : "Apostilas e Materiais";
  const noun = mode === "video" ? "videoaulas" : "materiais";
  const Icon = mode === "video" ? Video : KIND_ICON.pdf;
  const doneCount = useMemo(() => pool.filter((f) => isFileComplete(f, userStates[f.id])).length, [pool, userStates]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground inline-flex items-center gap-2.5">
            <Icon size={22} className="text-accent" /> {title}
          </h1>
          <p className="text-muted-foreground mt-1">
            {status === "ready"
              ? `${pool.length.toLocaleString("pt-BR")} ${noun} do seu acervo real — abrem no player dentro da plataforma.`
              : "Carregando o acervo…"}
          </p>
        </div>
        {status === "ready" && (
          <span className="text-sm font-metric text-muted-foreground">
            <strong className="text-foreground">{doneCount}</strong> / {pool.length.toLocaleString("pt-BR")} concluídos
          </span>
        )}
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar ${noun}…`}
            className="input pl-9 py-2 text-sm"
            aria-label={`Buscar ${noun}`}
          />
        </div>
        <select value={area} onChange={(e) => setArea(e.target.value)} className="input w-auto py-2 text-sm" aria-label="Grande área">
          <option value="todas">Todas as áreas</option>
          {KNOWN_SUBJECTS.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
          <option value="__none">{UNCLASSIFIED_LABEL}</option>
        </select>
        <select value={curso} onChange={(e) => setCurso(e.target.value)} className="input w-auto max-w-[220px] py-2 text-sm" aria-label="Curso">
          <option value="todos">Todos os cursos</option>
          {cursos.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="input w-auto py-2 text-sm"
          aria-label="Status"
        >
          <option value="todos">Todos os status</option>
          <option value="nao_iniciado">Não iniciados</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluido">Concluídos</option>
        </select>
        <button
          type="button"
          onClick={() => setOnlyFavorites((v) => !v)}
          className={cn("btn-sm", onlyFavorites ? "btn-primary" : "btn-outline")}
          aria-pressed={onlyFavorites}
        >
          <Star size={13} className={onlyFavorites ? "fill-current" : ""} /> Favoritos
        </button>
      </div>

      {status !== "ready" ? (
        <LoadingState label="Carregando o acervo completo..." />
      ) : filtered.length === 0 ? (
        <EmptyState illustration={<EmptySearchIllustration />} title={`Nenhum(a) ${noun.slice(0, -1)} com esses filtros.`} description="Ajuste os filtros ou a busca." />
      ) : (
        <>
          <p className="text-xs text-muted-foreground font-metric -mt-2">
            {filtered.length.toLocaleString("pt-BR")} resultado{filtered.length === 1 ? "" : "s"}
          </p>
          {mode === "video" ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.slice(0, limit).map((file) => {
                const state = userStates[file.id];
                const done = isFileComplete(file, state);
                const started = !done && isFileStarted(file, state);
                const subject = file.subjectSlug ? resolveSubject(file.subjectSlug) : undefined;
                return (
                  <div key={file.id} className="card overflow-hidden group flex flex-col hover:shadow-lift hover:-translate-y-0.5 transition-all">
                    <button type="button" onClick={() => open(file)} className="text-left" aria-label={`Assistir ${fileName(file)}`}>
                      <VideoThumb file={file} />
                    </button>
                    <div className="p-3.5 flex flex-col gap-1.5 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-[11px] font-medium truncate"
                          style={subject ? { color: `hsl(${subject.colorToken})` } : undefined}
                        >
                          {subject?.name ?? UNCLASSIFIED_LABEL}
                          {file.disciplina ? ` · ${file.disciplina}` : ""}
                        </span>
                        <FavoriteButton fileId={file.id} size="sm" />
                      </div>
                      <button type="button" onClick={() => open(file)} className="text-left">
                        <p className="text-sm font-medium text-foreground line-clamp-2" title={fileName(file)}>
                          {fileName(file)}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={folderOf(file)}>
                          {folderOf(file)}
                        </p>
                      </button>
                      <span
                        className={cn(
                          "mt-auto self-start inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                          done ? "bg-success/10 text-success" : started ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {done ? <CheckCircle2 size={11} /> : <CircleDot size={11} />}
                        {done ? "Assistida" : started ? "Em andamento" : "Não iniciada"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filtered.slice(0, limit).map((file) => (
                <LibraryFileRow key={file.id} file={file} subtitle={`${folderOf(file)} · ${KIND_SHORT[fileKind(file)]}`} onOpen={() => open(file)} />
              ))}
            </div>
          )}
          {filtered.length > limit && (
            <button type="button" className="btn-outline self-center" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
              Carregar mais ({(filtered.length - limit).toLocaleString("pt-BR")} restantes)
            </button>
          )}
        </>
      )}

      <FilePreviewModal
        file={preview?.file ?? null}
        playlist={preview?.playlist}
        onNavigate={(f) => setPreview((p) => (p ? { ...p, file: f } : p))}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
