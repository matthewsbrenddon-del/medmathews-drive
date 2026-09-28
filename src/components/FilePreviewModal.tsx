"use client";

import { useEffect } from "react";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  File,
  FileText,
  Image as ImageIcon,
  Info,
  Music,
  Undo2,
  Video,
  X,
} from "lucide-react";
import type { LibraryFile } from "@/lib/types";
import { fileEmbedUrl, fileKind, fileName, fileWebViewUrl, type LibraryFileKind } from "@/lib/library";
import { FavoriteButton } from "./FavoriteButton";
import { NoteButton } from "./NoteButton";
import { useStudyStore } from "@/lib/store";

const KIND_ICON: Record<LibraryFileKind, typeof Video> = {
  video: Video,
  pdf: FileText,
  image: ImageIcon,
  audio: Music,
  epub: BookOpen,
  outro: File,
};

const KIND_LABEL: Record<LibraryFileKind, string> = {
  video: "Vídeo",
  pdf: "PDF",
  image: "Imagem",
  audio: "Áudio",
  epub: "E-book",
  outro: "Arquivo",
};

/**
 * Player/visualizador único do acervo — usado por Disciplinas (as duas visões),
 * Videoaulas, Materiais, Dashboard e Busca. `playlist` (opcional) é a lista de
 * arquivos da mesma pasta, habilitando Anterior/Próxima (e as setas ← →).
 */
export function FilePreviewModal({
  file,
  onClose,
  playlist,
  onNavigate,
}: {
  file: LibraryFile | null;
  onClose: () => void;
  playlist?: LibraryFile[];
  onNavigate?: (file: LibraryFile) => void;
}) {
  const userStates = useStudyStore((s) => s.userStates);
  const setWatchStatus = useStudyStore((s) => s.setWatchStatus);
  const setReadStatus = useStudyStore((s) => s.setReadStatus);
  const markOpened = useStudyStore((s) => s.markOpened);
  const recordStudyToday = useStudyStore((s) => s.recordStudyToday);

  const index = file && playlist ? playlist.findIndex((f) => f.id === file.id) : -1;
  const prev = index > 0 ? playlist![index - 1] : undefined;
  const next = index >= 0 && index < playlist!.length - 1 ? playlist![index + 1] : undefined;

  useEffect(() => {
    if (!file) return;
    markOpened(file.id, fileKind(file) === "video");
  }, [file, markOpened]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && next && onNavigate) onNavigate(next);
      if (e.key === "ArrowLeft" && prev && onNavigate) onNavigate(prev);
    }
    if (file) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [file, onClose, next, prev, onNavigate]);

  if (!file) return null;

  const kind = fileKind(file);
  const isVideo = kind === "video";
  const state = userStates[file.id];
  const done = isVideo ? state?.watchStatus === "assistida" : state?.readStatus === "estudado";

  function toggleDone() {
    if (isVideo) setWatchStatus(file!.id, done ? "em_andamento" : "assistida");
    else setReadStatus(file!.id, done ? "acessado" : "estudado");
    if (!done) recordStudyToday();
  }

  function completeAndNext() {
    if (!done) {
      if (isVideo) setWatchStatus(file!.id, "assistida");
      else setReadStatus(file!.id, "estudado");
      recordStudyToday();
    }
    if (next && onNavigate) onNavigate(next);
  }

  const Icon = KIND_ICON[kind];
  const name = fileName(file);
  const isCompact = kind === "audio";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-foreground/40 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-preview-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[96vh] rounded-2xl bg-surface border border-border shadow-lift overflow-hidden animate-scale-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-4 sm:p-5 border-b border-border/60">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent shrink-0">
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {file.curso} · {file.area} · {KIND_LABEL[kind]}
                {index >= 0 && playlist && (
                  <span className="font-metric"> · {index + 1} de {playlist.length}</span>
                )}
              </p>
              <h2 id="file-preview-title" className="font-semibold text-foreground truncate" title={name}>
                {name}
              </h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className={isCompact ? "p-6" : "bg-black"}>
          <div
            className={isCompact ? "rounded-xl overflow-hidden border border-border" : kind === "pdf" || kind === "epub" ? "h-[70vh] w-full" : "aspect-video w-full"}
            style={isCompact ? { height: 100 } : undefined}
          >
            <iframe
              key={file.id}
              src={fileEmbedUrl(file)}
              title={name}
              className="h-full w-full"
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          </div>
        </div>

        <p className="px-4 sm:px-5 pt-3 text-[11px] text-muted-foreground inline-flex items-start gap-1.5">
          <Info size={12} className="shrink-0 mt-0.5" />
          Se o player mostrar &quot;Você precisa de acesso&quot; ou ficar em branco, o arquivo precisa estar compartilhado no
          Drive como &quot;Qualquer pessoa com o link&quot;.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 p-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={toggleDone} className={done ? "btn-outline btn-sm" : "btn-primary btn-sm"}>
              {done ? <Undo2 size={14} /> : <Check size={14} />}
              {done ? "Desfazer conclusão" : isVideo ? "Marcar como assistida" : "Marcar como estudado"}
            </button>
            <FavoriteButton fileId={file.id} size="sm" />
            <NoteButton
              origin={{ tipo: isVideo ? "aula" : "material", id: file.id, label: `${isVideo ? "Aula" : "Material"}: ${name}` }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {playlist && onNavigate && (
              <>
                <button type="button" className="btn-outline btn-sm" disabled={!prev} onClick={() => prev && onNavigate(prev)}>
                  <ChevronLeft size={14} /> Anterior
                </button>
                {next && (
                  <button type="button" className="btn-outline btn-sm" onClick={completeAndNext}>
                    {done ? "Próxima" : "Concluir e próxima"} <ChevronRight size={14} />
                  </button>
                )}
              </>
            )}
            <a href={fileWebViewUrl(file)} target="_blank" rel="noreferrer" className="btn-ghost btn-sm text-muted-foreground">
              <ExternalLink size={14} /> Drive
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
