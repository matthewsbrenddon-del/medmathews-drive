"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, File, FileText, Folder, Image as ImageIcon, Library, Music, Search, Video, BookOpen } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { useLibraryStore } from "@/lib/libraryStore";
import { listChildren, searchFiles, type LibraryFileKind, type LibraryNode } from "@/lib/library";
import type { LibraryFile } from "@/lib/types";

const KIND_ICON: Record<LibraryFileKind, typeof Video> = {
  video: Video,
  pdf: FileText,
  image: ImageIcon,
  audio: Music,
  epub: BookOpen,
  outro: File,
};

export default function BibliotecaPage() {
  const files = useLibraryStore((s) => s.files);
  const status = useLibraryStore((s) => s.status);
  const hydrate = useLibraryStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const [path, setPath] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [previewFile, setPreviewFile] = useState<LibraryFile | null>(null);

  const searching = query.trim().length > 0;
  const searchResults = useMemo(() => (searching ? searchFiles(files, query) : []), [files, query, searching]);
  const children = useMemo(() => (searching ? [] : listChildren(files, path)), [files, path, searching]);

  function openFolder(nodePath: string[]) {
    setPath(nodePath);
    setQuery("");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground inline-flex items-center gap-2.5">
          <Library size={22} className="text-accent" /> Biblioteca Completa
        </h1>
        <p className="text-muted-foreground mt-1">
          Todo o acervo mapeado — cursinhos, e-books e bancos de questões — organizado exatamente como nas suas
          pastas do Drive. Cada arquivo abre num player embutido, sem sair da plataforma.
        </p>
      </div>

      <div className="relative">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar em ~13,6 mil arquivos por nome, curso ou área..."
          aria-label="Buscar na biblioteca"
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
            Biblioteca
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
        <EmptyState
          icon={Library}
          title="Não foi possível carregar a biblioteca."
          description="Verifique sua conexão e recarregue a página."
        />
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
        <EmptyState icon={Folder} title="Pasta vazia." />
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
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
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
