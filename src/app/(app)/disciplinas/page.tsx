"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Folder,
  FolderOpen,
  LayoutGrid,
  Play,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { EmptyBoxIllustration, EmptySearchIllustration } from "@/components/Illustrations";
import { LoadingState } from "@/components/LoadingState";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { LibraryFileRow } from "@/components/LibraryFileRow";
import { ProgressBar } from "@/components/ProgressBar";
import { useLibraryStore } from "@/lib/libraryStore";
import { useLibraryNavStore } from "@/lib/libraryNavStore";
import { useClassificationStore } from "@/lib/classificationStore";
import { classifyLibrary, type ClassifiedFile } from "@/lib/classification";
import {
  UNCLASSIFIED_LABEL,
  buildLibraryTree,
  computeTreeProgress,
  fileKind,
  fileName,
  findTreeNode,
  nodeKey,
  pickStartHere,
  searchFiles,
  treePathFor,
  type LibraryTreeNode,
  type LibraryView,
  type NodeProgress,
  fileTitle,
} from "@/lib/library";
import { useStudyStore } from "@/lib/store";
import { resolveSubject } from "@/lib/subjects";
import type { LibraryFile } from "@/lib/types";
import { cn } from "@/lib/utils";

type KindFilter = "todos" | "video" | "pdf" | "outros";

function pct(p: NodeProgress | undefined, total: number) {
  return total > 0 && p ? Math.round((p.done / total) * 100) : 0;
}

function nodeColor(node: LibraryTreeNode, view: LibraryView): string | undefined {
  if (view === "curso" || node.path.length === 0) return undefined;
  if (node.path[0] === UNCLASSIFIED_LABEL) return undefined;
  return resolveSubject(node.path[0]).colorToken;
}

function TreeRow({
  node,
  depth,
  view,
  progress,
  selectedKey,
  expanded,
  onSelect,
  onToggle,
}: {
  node: LibraryTreeNode;
  depth: number;
  view: LibraryView;
  progress: Map<string, NodeProgress>;
  selectedKey: string;
  expanded: Set<string>;
  onSelect: (node: LibraryTreeNode) => void;
  onToggle: (node: LibraryTreeNode) => void;
}) {
  const isOpen = expanded.has(node.key);
  const hasChildren = node.children.length > 0;
  const percent = pct(progress.get(node.key), node.total);
  const color = nodeColor(node, view);
  const selected = selectedKey === node.key;

  return (
    <>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-lg pr-2 transition-colors",
          selected ? "bg-primary-light text-primary" : "hover:bg-surface-hover text-foreground"
        )}
        style={{ paddingLeft: 4 + depth * 12 }}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node)}
          aria-label={isOpen ? `Recolher ${node.name}` : `Expandir ${node.name}`}
          className={cn("h-6 w-6 shrink-0 inline-flex items-center justify-center rounded text-muted-foreground", !hasChildren && "invisible")}
        >
          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <button type="button" onClick={() => onSelect(node)} className="flex-1 min-w-0 flex items-center gap-2 py-1.5 text-left">
          {depth === 0 && color ? (
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: `hsl(${color})` }} />
          ) : null}
          <span className={cn("truncate text-[13px]", depth === 0 && "font-medium")} title={node.name}>
            {node.name}
          </span>
        </button>
        <span className={cn("text-[10px] font-metric shrink-0", percent === 100 ? "text-success" : "text-muted-foreground")}>
          {percent > 0 ? `${percent}%` : node.total}
        </span>
      </div>
      {isOpen &&
        node.children.map((child) => (
          <TreeRow
            key={child.key}
            node={child}
            depth={depth + 1}
            view={view}
            progress={progress}
            selectedKey={selectedKey}
            expanded={expanded}
            onSelect={onSelect}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

function DisciplinasContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const files = useLibraryStore((s) => s.files);
  const status = useLibraryStore((s) => s.status);
  const hydrate = useLibraryStore((s) => s.hydrate);
  const overrides = useClassificationStore((s) => s.overrides);
  const userStates = useStudyStore((s) => s.userStates);

  const view = useLibraryNavStore((s) => s.view);
  const setView = useLibraryNavStore((s) => s.setView);
  const path = useLibraryNavStore((s) => s.pathByView[s.view]);
  const setPathFor = useLibraryNavStore((s) => s.setPath);
  const expandedList = useLibraryNavStore((s) => s.expandedByView[s.view]);
  const toggleExpanded = useLibraryNavStore((s) => s.toggleExpanded);
  const expandMany = useLibraryNavStore((s) => s.expandMany);

  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("todos");
  const [preview, setPreview] = useState<{ file: LibraryFile; playlist: LibraryFile[] } | null>(null);
  const [handledParams, setHandledParams] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const classified = useMemo(() => classifyLibrary(files, overrides), [files, overrides]);
  const unclassifiedCount = useMemo(() => classified.filter((f) => !f.subjectSlug).length, [classified]);
  const tree = useMemo(() => buildLibraryTree(classified, view), [classified, view]);
  const progress = useMemo(() => computeTreeProgress(tree, userStates), [tree, userStates]);
  const expanded = useMemo(() => new Set(expandedList), [expandedList]);

  const current = findTreeNode(tree, path) ?? tree;

  const selectPath = useCallback(
    (v: LibraryView, p: string[]) => {
      setPathFor(v, p);
      const keys = p.map((_, i) => nodeKey(p.slice(0, i + 1)));
      expandMany(v, keys);
    },
    [setPathFor, expandMany]
  );

  // Deep-links: ?area=<slug> (cards do Dashboard) e ?abrir=<fileId> (Caderno, Busca).
  useEffect(() => {
    if (handledParams || status !== "ready") return;
    const areaSlug = searchParams.get("area");
    const abrir = searchParams.get("abrir");
    if (abrir) {
      const file = classified.find((f) => f.id === abrir);
      if (file) {
        const folder = treePathFor(file, view);
        selectPath(view, folder);
        const folderNode = findTreeNode(buildLibraryTree(classified, view), folder);
        setPreview({ file, playlist: folderNode?.files ?? [file] });
      }
    } else if (areaSlug) {
      setView("area");
      selectPath("area", [resolveSubject(areaSlug).name]);
    }
    if (abrir || areaSlug) router.replace("/disciplinas", { scroll: false });
    setHandledParams(true);
  }, [handledParams, status, searchParams, classified, view, selectPath, setView, router]);

  const searching = query.trim().length > 0;
  const searchResults = useMemo(() => (searching ? searchFiles(classified, query) : []), [classified, query, searching]);

  const visibleFiles = useMemo(() => {
    return current.files.filter((f) => {
      const k = fileKind(f);
      if (kindFilter === "todos") return true;
      if (kindFilter === "video") return k === "video";
      if (kindFilter === "pdf") return k === "pdf" || k === "epub";
      return k !== "video" && k !== "pdf" && k !== "epub";
    });
  }, [current, kindFilter]);

  const startHere = useMemo(() => (current.total > 0 ? pickStartHere(current, userStates) : undefined), [current, userStates]);

  function openFile(file: LibraryFile, playlist: LibraryFile[]) {
    setPreview({ file, playlist });
  }

  function openStartHere() {
    if (!startHere) return;
    const folderPath = treePathFor(startHere.file as ClassifiedFile, view);
    const folderNode = findTreeNode(tree, folderPath);
    openFile(startHere.file, folderNode?.files ?? [startHere.file]);
  }

  function switchView(next: LibraryView) {
    setView(next);
    setQuery("");
  }

  const currentProgress = progress.get(current.key);
  const currentPercent = pct(currentProgress, current.total);
  const pdfCount = current.total - current.videos;
  const rootLabel = view === "area" ? "Grandes Áreas" : view === "tema" ? "Temas" : "Cursos";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground inline-flex items-center gap-2.5">
            <LayoutGrid size={22} className="text-accent" /> Disciplinas
          </h1>
          <p className="text-muted-foreground mt-1">
            Todo o acervo real, com player embutido — pela classificação clínica, por tema (o mesmo assunto de todos os
            cursinhos junto) ou pela estrutura de cada curso. Mesmo conteúdo e mesmo progresso nas três visões.
          </p>
        </div>
        <div className="flex rounded-xl border border-border p-1 bg-muted shrink-0">
          {(
            [
              ["area", "Por Grande Área"],
              ["tema", "Por Tema"],
              ["curso", "Por Curso"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => switchView(id)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                view === id ? "bg-surface shadow-card text-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {unclassifiedCount > 0 && view === "area" && (
        <Link
          href="/disciplinas/classificar"
          className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-2.5 flex items-center gap-3 hover:bg-accent/10 transition-colors"
        >
          <ClipboardList size={16} className="text-accent shrink-0" />
          <p className="text-sm text-foreground flex-1">
            <strong className="font-metric">{unclassifiedCount}</strong> itens aguardando classificação por grande área.
          </p>
          <ChevronRight size={16} className="text-accent shrink-0" />
        </Link>
      )}

      <div className="relative">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Buscar aula ou material em ${files.length.toLocaleString("pt-BR")} arquivos…`}
          aria-label="Buscar em Disciplinas"
          className="input pl-10"
        />
      </div>

      {status === "loading" || status === "idle" ? (
        <LoadingState label="Carregando o acervo completo..." />
      ) : status === "error" ? (
        <EmptyState icon={LayoutGrid} title="Não foi possível carregar a biblioteca." description="Verifique sua conexão e recarregue a página." />
      ) : searching ? (
        searchResults.length === 0 ? (
          <EmptyState illustration={<EmptySearchIllustration />} title="Nenhum arquivo encontrado." description="Tente outros termos de busca." />
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground font-metric">
              {searchResults.length} resultado{searchResults.length === 1 ? "" : "s"}
              {searchResults.length >= 150 ? " (mostrando os 150 primeiros — refine a busca)" : ""}
            </p>
            {searchResults.map((node) => (
              <LibraryFileRow
                key={node.file.id}
                file={node.file}
                subtitle={node.path.slice(0, -1).join(" › ")}
                onOpen={() => openFile(node.file, searchResults.map((r) => r.file))}
              />
            ))}
          </div>
        )
      ) : (
        <div className="grid lg:grid-cols-[300px_1fr] gap-5 items-start">
          <aside className="hidden lg:flex card p-2 flex-col lg:sticky lg:top-6 max-h-[calc(100vh-7rem)]">
            <p className="px-2 pt-1.5 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">{rootLabel}</p>
            <div className="overflow-y-auto flex flex-col gap-0.5 pb-1">
              {tree.children.map((node) => (
                <TreeRow
                  key={node.key}
                  node={node}
                  depth={0}
                  view={view}
                  progress={progress}
                  selectedKey={current.key}
                  expanded={expanded}
                  onSelect={(n) => selectPath(view, n.path)}
                  onToggle={(n) => toggleExpanded(view, n.key)}
                />
              ))}
            </div>
          </aside>

          <section className="flex flex-col gap-4 min-w-0">
            <nav className="flex flex-wrap items-center gap-1.5 text-sm" aria-label="Caminho">
              <button
                type="button"
                onClick={() => selectPath(view, [])}
                className={path.length === 0 ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}
              >
                {rootLabel}
              </button>
              {current.path.map((segment, idx) => (
                <span key={idx} className="inline-flex items-center gap-1.5 min-w-0">
                  <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                  <button
                    type="button"
                    onClick={() => selectPath(view, current.path.slice(0, idx + 1))}
                    className={cn(
                      "truncate max-w-[220px]",
                      idx === current.path.length - 1 ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                    title={segment}
                  >
                    {segment}
                  </button>
                </span>
              ))}
            </nav>

            <div className="card p-5 flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-foreground truncate">{current.name || rootLabel}</h2>
                  <p className="text-xs text-muted-foreground font-metric mt-0.5">
                    {currentProgress?.done ?? 0} de {current.total} concluídos · {current.videos} vídeos · {pdfCount} materiais
                  </p>
                </div>
                <span className="text-2xl font-semibold font-metric text-foreground">{currentPercent}%</span>
              </div>
              <ProgressBar percent={currentPercent} size="sm" />

              {startHere && (
                <button
                  type="button"
                  onClick={openStartHere}
                  className="group rounded-xl border border-primary/40 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent p-4 flex items-center gap-4 text-left hover:border-primary transition-colors"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shrink-0 shadow-card group-hover:scale-105 transition-transform">
                    {startHere.reason === "continuar" ? <RotateCcw size={18} /> : <Play size={18} className="fill-current ml-0.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-primary inline-flex items-center gap-1">
                      <Sparkles size={11} /> {startHere.reason === "continuar" ? "Continue de onde parou" : "Comece por aqui"}
                    </span>
                    <span className="block font-medium text-foreground truncate">{fileTitle(startHere.file)}</span>
                    <span className="block text-xs text-muted-foreground truncate">
                      {treePathFor(startHere.file as ClassifiedFile, view).slice(current.path.length).join(" › ") || current.name}
                    </span>
                  </span>
                </button>
              )}
            </div>

            {current.children.length > 0 && (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {current.children.map((child) => {
                  const p = progress.get(child.key);
                  const percent = pct(p, child.total);
                  const color = nodeColor(child, view);
                  return (
                    <button
                      key={child.key}
                      type="button"
                      onClick={() => selectPath(view, child.path)}
                      className="card p-4 flex flex-col gap-3 text-left hover:shadow-lift hover:-translate-y-0.5 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-xl shrink-0",
                            child.name === UNCLASSIFIED_LABEL ? "bg-warning/10 text-warning" : !color ? "bg-primary/10 text-primary" : ""
                          )}
                          style={color ? { backgroundColor: `hsl(${color} / 0.12)`, color: `hsl(${color})` } : undefined}
                        >
                          {percent > 0 ? <FolderOpen size={16} /> : <Folder size={16} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-foreground text-sm leading-snug line-clamp-2" title={child.name}>
                            {child.name}
                          </span>
                          <span className="block text-[11px] text-muted-foreground font-metric mt-0.5">
                            {child.videos > 0 && `${child.videos} vídeos`}
                            {child.videos > 0 && child.total - child.videos > 0 && " · "}
                            {child.total - child.videos > 0 && `${child.total - child.videos} materiais`}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <ProgressBar percent={percent} colorToken={color} size="sm" />
                        </div>
                        <span className="text-[11px] font-metric text-muted-foreground w-9 text-right">{percent}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {current.files.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">Arquivos nesta pasta</p>
                  <div className="flex rounded-lg border border-border p-0.5 bg-muted/60 text-xs">
                    {(
                      [
                        ["todos", "Todos"],
                        ["video", "Vídeos"],
                        ["pdf", "PDFs"],
                        ["outros", "Outros"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setKindFilter(id)}
                        className={cn(
                          "px-2.5 py-1 rounded-md font-medium transition-colors",
                          kindFilter === id ? "bg-surface shadow-card text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {visibleFiles.map((file) => (
                  <LibraryFileRow
                    key={file.id}
                    file={file}
                    highlight={startHere?.file.id === file.id}
                    onOpen={() => openFile(file, visibleFiles)}
                  />
                ))}
                {visibleFiles.length === 0 && <p className="text-sm text-muted-foreground py-3">Nenhum arquivo desse tipo nesta pasta.</p>}
              </div>
            )}

            {current.children.length === 0 && current.files.length === 0 && (
              <EmptyState illustration={<EmptyBoxIllustration />} title="Nada por aqui ainda." />
            )}
          </section>
        </div>
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

export default function DisciplinasPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando..." />}>
      <DisciplinasContent />
    </Suspense>
  );
}
