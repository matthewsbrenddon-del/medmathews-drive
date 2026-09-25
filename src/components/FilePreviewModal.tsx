"use client";

import { useEffect } from "react";
import { BookOpen, Check, ExternalLink, File, FileText, Image as ImageIcon, Music, Undo2, Video, X } from "lucide-react";
import type { LibraryFile } from "@/lib/types";
import { fileEmbedUrl, fileKind, fileName, fileWebViewUrl, type LibraryFileKind } from "@/lib/library";
import { FavoriteButton } from "./FavoriteButton";
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

export function FilePreviewModal({ file, onClose }: { file: LibraryFile | null; onClose: () => void }) {
  const userStates = useStudyStore((s) => s.userStates);
  const setWatchStatus = useStudyStore((s) => s.setWatchStatus);
  const setReadStatus = useStudyStore((s) => s.setReadStatus);
  const recordStudyToday = useStudyStore((s) => s.recordStudyToday);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (file) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [file, onClose]);

  if (!file) return null;

  const kind = fileKind(file);
  const isVideo = kind === "video";
  const state = userStates[file.id];
  const done = isVideo ? state?.watchStatus === "assistida" : state?.readStatus === "estudado";

  function toggleDone() {
    if (isVideo) setWatchStatus(file!.id, done ? "nao_iniciada" : "assistida");
    else setReadStatus(file!.id, done ? "acessado" : "estudado");
    if (!done) recordStudyToday();
  }

  const Icon = KIND_ICON[kind];
  const name = fileName(file);
  const embedUrl = fileEmbedUrl(file);
  const webViewUrl = fileWebViewUrl(file);
  const isCompact = kind === "audio";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-preview-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl bg-surface border border-border shadow-lift overflow-hidden animate-scale-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-border/60">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent shrink-0">
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {file.curso} · {file.area} · {KIND_LABEL[kind]}
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
          <div className={isCompact ? "rounded-xl overflow-hidden border border-border" : "aspect-video w-full"} style={isCompact ? { height: 100 } : undefined}>
            <iframe src={embedUrl} title={name} className="h-full w-full" allow="autoplay; fullscreen" allowFullScreen />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 p-4 border-t border-border/60">
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggleDone} className={done ? "btn-outline btn-sm" : "btn-primary btn-sm"}>
              {done ? <Undo2 size={14} /> : <Check size={14} />}
              {done ? "Desfazer conclusão" : isVideo ? "Marcar como assistida" : "Marcar como estudado"}
            </button>
            <FavoriteButton fileId={file.id} size="sm" />
          </div>
          <a href={webViewUrl} target="_blank" rel="noreferrer" className="btn-outline btn-sm">
            <ExternalLink size={14} /> Abrir no Google Drive
          </a>
        </div>
      </div>
    </div>
  );
}
