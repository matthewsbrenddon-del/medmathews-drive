"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ChevronRight,
  ClipboardList,
  File,
  FileText,
  Folder,
  Image as ImageIcon,
  LayoutGrid,
  Music,
  Search,
  Video,
  BookOpen,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { useLibraryStore } from "@/lib/libraryStore";
import { useClassificationStore } from "@/lib/classificationStore";
import { classifyLibrary } from "@/lib/classification";
import {
  UNCLASSIFIED_LABEL,
  listChildren,
  listChildrenByGrandeArea,
  searchFiles,
  type LibraryFileKind,
  type LibraryNode,
} from "@/lib/library";
import { resolveSubject } from "@/lib/subjects";
import type { LibraryFile } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<LibraryFileKind, typeof Video> = {
  video: Video,
  pdf: FileText,
  image: ImageIcon,
  audio: Music,
  epub: BookOpen,
  outro: File,
};

type ViewMode = "area" | "curso";

function DisciplinasContent() {
  const searchParams = useSearchParams();
  const files = useLibraryStore((s) => s.files);
  const status = useLibraryStore((s) => s.status);
  const hydrate = useLibraryStore((s) => s.hydrate);
  const overrides = useClassificationStore((s) => s.overrides);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const classified = useMemo(() => classifyLibrary(files, overrides), [files, overrides]);
  const unclassifiedCount = useMemo(() => classified.filter((f) => !f.subjectSlug).length, [classified]);

  const [view, setView] = useState<ViewMode>("area");
  const [path, setPath] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [previewFile, setPreviewFile] = useState<LibraryFile | null>(null);
  const [initializedFromQuery, setInitializedFromQuery] = useState(false);

  useEffect(() => {
    if (initializedFromQuery || status !== "ready") return;
    const areaSlug = searchParams.get("area");
    if (areaSlug) {
      const subject = resolveSubject(areaSlug);
      setView("area");
      setPath([subject.name]);
    }
    setInitializedFromQuery(true);
  }, [initializedFromQuery, status, searchParams]);

  const searching = query.trim().length > 0;
  const searchResults = useMemo(() => (searching ? searchFiles(classified, query) : []), [classified, query, searching]);
  const children = useMemo(() => {
    if (searching) return [];
    return view === "area" ? listChildrenByGrandeArea(classified, path) : listChildren(files, path);
  }, [searching, view, classified, files, path]);

  function openFolder(nodePath: string[]) {
    setPath(nodePath);
    setQuery("");
  }

  function switchView(next: ViewMode) {
    setView(next);
    setPath([]);
    setQuery("");
  }

  const rootLabel = view === "area" ? "Grandes Áreas" : "Biblioteca";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground inline-flex items-center gap-2.5">
            <LayoutGrid size={22} className="text-accent" /> Disciplinas
          </h1>
          <p className="text-muted-foreground mt-1">
            Todo o seu acervo real — navegue pela classificação clínica (ENAMED) ou pela estrutura original de cada
            cursinho. É o mesmo conteúdo nas duas visões.
          </p>
        </div>
        <div className="flex rounded-xl border border-border p-1 bg-muted shrink-0">
          <button
            type="button"
            onClick={() => switchView("area")}
            className={cn("px-3 py-1.5 text-sm font-medium rounded-lg transition-colors", view === "area" ? "bg-surface shadow-card text-foreground" : "text-muted-foreground")}
          >
            Por Grande Área
          </button>
          <button
            type="button"
            onClick={() => switchView("curso")}
            className={cn("px-3 py-1.5 text-sm font-medium rounded-lg transition-colors", view === "curso" ? "bg-surface shadow-card text-foreground" : "text-muted-foreground")}
          >
            Por Curso
          </button>
        </div>
      </div>

      {unclassifiedCount > 0 && (
        <Link
          href="/disciplinas/classificar"
          className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 flex items-center gap-3 hover:bg-accent/10 transition-colors"
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
          placeholder={`Buscar em ~${files.length.toLocaleString("pt-BR")} arquivos por nome, curso ou área...`}
          aria-label="Buscar em Disciplinas"
          className="input pl-10"
        />
      </div>

      {!searching && (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <button
            type="button"
            onClick={() => openFolder([])}
            className={path.length === 0 ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}
          >
            {rootLabel}
          </button>
          {path.map((segment, idx) => (
            <span key={idx} className="inline-flex items-center gap-1.5">
              <ChevronRight size={14} className="text-muted-foreground" />
              <button
                type="button"
                onClick={() => openFolder(path.slice(0, idx + 1))}
                className={idx === path.length - 1 ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}
              >
                {segment}
              </button>
            </span>
          ))}
        </div>
      )}

      {status === "loading" || status === "idle" ? (
        <LoadingState label="Carregando o acervo completo..." />
      ) : status === "error" ? (
        <EmptyState icon={LayoutGrid} title="Não foi possível carregar a biblioteca." description="Verifique sua conexão e recarregue a página." />
      ) : searching ? (
        searchResults.length === 0 ? (
          <EmptyState icon={Search} title="Nenhum arquivo encontrado." description="Tente outros termos de busca." />
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground font-metric">
              {searchResults.length} resultado{searchResults.length === 1 ? "" : "s"}
              {searchResults.length >= 150 ? " (mostrando os 150 primeiros — refine a busca)" : ""}
            </p>
            {searchResults.map((node) => (
              <FileRow key={node.file.id} node={node} onOpen={() => setPreviewFile(node.file)} showPath />
            ))}
          </div>
        )
      ) : children.length === 0 ? (
        <EmptyState icon={Folder} title="Nada por aqui ainda." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {children.map((node) =>
            node.type === "folder" ? (
              <button
                key={node.name}
                type="button"
                onClick={() => openFolder(node.path)}
                className="card px-4 py-3 flex items-center gap-3 text-left hover:shadow-lift hover:-translate-y-0.5 transition-all"
              >
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl shrink-0",
                    node.name === UNCLASSIFIED_LABEL ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"
                  )}
                >
                  <Folder size={16} />
                </div>
                <span className="flex-1 min-w-0 truncate font-medium text-foreground">{node.name}</span>
                <span className="text-xs text-muted-foreground font-metric shrink-0">
                  {node.fileCount} arquivo{node.fileCount === 1 ? "" : "s"}
                </span>
                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              </button>
            ) : (
              <FileRow key={node.file.id} node={node} onOpen={() => setPreviewFile(node.file)} />
            )
          )}
        </div>
      )}

      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
}

function FileRow({
  node,
  onOpen,
  showPath,
}: {
  node: Extract<LibraryNode, { type: "file" }>;
  onOpen: () => void;
  showPath?: boolean;
}) {
  const Icon = KIND_ICON[node.kind];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card px-4 py-3 flex items-center gap-3 text-left hover:shadow-lift hover:-translate-y-0.5 transition-all"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent shrink-0">
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{node.name}</p>
        {showPath && <p className="text-xs text-muted-foreground truncate">{node.path.slice(0, -1).join(" › ")}</p>}
      </div>
    </button>
  );
}

export default function DisciplinasPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando disciplinas..." />}>
      <DisciplinasContent />
    </Suspense>
  );
}
