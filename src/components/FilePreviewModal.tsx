"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ExternalLink,
  File,
  FileText,
  Image as ImageIcon,
  Info,
  Music,
  NotebookPen,
  Play,
  Undo2,
  Video,
  X,
} from "lucide-react";
import type { LibraryFile } from "@/lib/types";
import {
  fileEmbedUrl,
  fileKind,
  fileName, fileTitle,
  fileWebViewUrl,
  isFileComplete,
  isFileStarted,
  type LibraryFileKind,
} from "@/lib/library";
import { FavoriteButton } from "./FavoriteButton";
import { FocusTimerInline } from "./FocusTimer";
import { NoteButton } from "./NoteButton";
import { CadernoDock } from "./CadernoDock";
import { ThematicCover } from "./ThematicCover";
import { useStudyStore } from "@/lib/store";
import { useCadernoDockStore } from "@/lib/cadernoDockStore";
import { usePracticePrefsStore } from "@/lib/practicePrefsStore";
import { cn } from "@/lib/utils";

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
 * Videoaulas, Materiais, Dashboard, Busca e Aulas relacionadas. Vídeos abrem
 * primeiro numa capa de pré-visualização (tema, posição na pasta, próximas
 * aulas); o Caderno pode ficar aberto ao lado do vídeo. `playlist` = arquivos
 * da mesma pasta, habilitando Anterior/Próxima (e as setas ← →).
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
  const skipVideoPreview = usePracticePrefsStore((s) => s.skipVideoPreview);
  const setSkipVideoPreview = usePracticePrefsStore((s) => s.setSkipVideoPreview);
  const dockOpen = useCadernoDockStore((s) => s.open);
  const toggleDock = useCadernoDockStore((s) => s.toggleDock);
  const setDockContext = useCadernoDockStore((s) => s.setContext);

  const [started, setStarted] = useState(false);
  const wasOpenRef = useRef(false);

  const index = file && playlist ? playlist.findIndex((f) => f.id === file.id) : -1;
  const prev = index > 0 ? playlist![index - 1] : undefined;
  const next = index >= 0 && index < playlist!.length - 1 ? playlist![index + 1] : undefined;
  const isVideo = file ? fileKind(file) === "video" : false;
  const showCover = Boolean(file) && isVideo && !started;

  // Capa só ao abrir o player; navegando entre aulas (Próxima) segue direto no vídeo.
  useEffect(() => {
    if (!file) {
      wasOpenRef.current = false;
      return;
    }
    if (!wasOpenRef.current) setStarted(!isVideo || skipVideoPreview);
    wasOpenRef.current = true;
  }, [file, isVideo, skipVideoPreview]);

  // Abrir a capa não conta como assistir — só quando o vídeo começa.
  useEffect(() => {
    if (!file || showCover) return;
    markOpened(file.id, isVideo);
    recordStudyToday();
  }, [file, showCover, isVideo, markOpened, recordStudyToday]);

  useEffect(() => {
    if (!file) return;
    setDockContext({
      tipo: isVideo ? "aula" : "material",
      id: file.id,
      label: `${isVideo ? "Aula" : "Material"}: ${fileTitle(file)}`,
    });
    return () => setDockContext(null);
  }, [file, isVideo, setDockContext]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && showCover) setStarted(true);
      if (e.key === "ArrowRight" && next && onNavigate) onNavigate(next);
      if (e.key === "ArrowLeft" && prev && onNavigate) onNavigate(prev);
    }
    if (file) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [file, onClose, next, prev, onNavigate, showCover]);

  if (!file) return null;

  const kind = fileKind(file);
  const state = userStates[file.id];
  const done = isVideo ? state?.watchStatus === "assistida" : state?.readStatus === "estudado";

  function toggleDone() {
    if (isVideo) setWatchStatus(file!.id, done ? "em_andamento" : "assistida");
    else setReadStatus(file!.id, done ? "acessado" : "estudado");
    if (!done) recordStudyToday();
  }

  function completeAndNext() {
    if (!done && !showCover) {
      if (isVideo) setWatchStatus(file!.id, "assistida");
      else setReadStatus(file!.id, "estudado");
      recordStudyToday();
    }
    if (next && onNavigate) onNavigate(next);
  }

  const Icon = KIND_ICON[kind];
  const name = fileTitle(file);
  const isCompact = kind === "audio";
  const upcoming = playlist && index >= 0 ? playlist.slice(index + 1, index + 4) : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-foreground/40 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-preview-title"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full max-h-[96vh] rounded-2xl bg-surface border border-border shadow-lift overflow-hidden animate-scale-in flex flex-col transition-[max-width]",
          dockOpen ? "max-w-[1400px]" : "max-w-5xl"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-4 sm:px-5 border-b border-border/60">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent shrink-0">
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {file.curso} · {file.area} · {KIND_LABEL[kind]}
                {index >= 0 && playlist && (
                  <span className="font-metric">
                    {" "}
                    · {index + 1} de {playlist.length}
                  </span>
                )}
              </p>
              <h2 id="file-preview-title" className="font-semibold text-foreground truncate" title={name}>
                {name}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <FocusTimerInline label={`${isVideo ? "Aula" : "Material"}: ${name}`} className="mr-1" />
            <button
              type="button"
              onClick={toggleDock}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                dockOpen ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              )}
              title={dockOpen ? "Fechar Caderno" : "Abrir Caderno ao lado do vídeo"}
            >
              <NotebookPen size={14} /> <span className="hidden sm:inline">Caderno</span>
            </button>
            <button type="button" onClick={onClose} aria-label="Fechar" className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-foreground">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className={cn("min-h-0 flex-1 overflow-y-auto lg:overflow-hidden", dockOpen && "lg:grid lg:grid-cols-[1fr_360px]")}>
          <div className="min-w-0 flex flex-col lg:overflow-y-auto">
            {showCover ? (
              <div className="relative">
                <button type="button" onClick={() => setStarted(true)} className="group relative block w-full text-left" aria-label={`Assistir ${name}`}>
                  <ThematicCover file={file} large className="aspect-video" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift ring-8 ring-primary/25 group-hover:scale-110 transition-transform">
                      <Play size={32} className="fill-current ml-1" />
                    </span>
                  </span>
                </button>
                <div className="p-4 sm:px-5 flex flex-col gap-3 border-b border-border/60">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setStarted(true)} className="btn-primary">
                      <Play size={15} className="fill-current" /> {isFileStarted(file, state) && !done ? "Continuar aula" : "Assistir agora"}
                    </button>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                        done ? "bg-success/10 text-success" : isFileStarted(file, state) ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {done ? <CheckCircle2 size={12} /> : <CircleDot size={12} />}
                      {done ? "Assistida" : isFileStarted(file, state) ? "Em andamento" : "Não iniciada"}
                    </span>
                    <label className="ml-auto inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={skipVideoPreview}
                        onChange={(e) => setSkipVideoPreview(e.target.checked)}
                        className="accent-[hsl(var(--primary))]"
                      />
                      Ir direto para o vídeo nas próximas vezes
                    </label>
                  </div>
                  {upcoming.length > 0 && onNavigate && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">A seguir nesta pasta</p>
                      <div className="grid grid-cols-3 gap-2">
                        {upcoming.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => onNavigate(f)}
                            className="group rounded-xl overflow-hidden border border-border text-left hover:border-primary/50 transition-colors"
                          >
                            <ThematicCover file={f} className="aspect-video" />
                            <span className="flex items-center gap-1 px-2 py-1.5">
                              {isFileComplete(f, userStates[f.id]) && <CheckCircle2 size={11} className="text-success shrink-0" />}
                              <span className="text-[11px] text-foreground truncate">{fileTitle(f)}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className={isCompact ? "p-6" : "bg-black"}>
                  <div
                    className={
                      isCompact ? "rounded-xl overflow-hidden border border-border" : kind === "pdf" || kind === "epub" ? "h-[70vh] w-full" : "aspect-video w-full"
                    }
                    style={isCompact ? { height: 100 } : undefined}
                  >
                    <iframe key={file.id} src={fileEmbedUrl(file)} title={name} className="h-full w-full" allow="autoplay; fullscreen" allowFullScreen />
                  </div>
                </div>
                <p className="px-4 sm:px-5 pt-3 text-[11px] text-muted-foreground inline-flex items-start gap-1.5">
                  <Info size={12} className="shrink-0 mt-0.5" />
                  Se o player mostrar &quot;Você precisa de acesso&quot; ou ficar em branco, o arquivo precisa estar compartilhado no Drive como
                  &quot;Qualquer pessoa com o link&quot;.
                </p>
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 p-4 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={toggleDone} className={done ? "btn-outline btn-sm" : "btn-primary btn-sm"}>
                  {done ? <Undo2 size={14} /> : <Check size={14} />}
                  {done ? "Desfazer conclusão" : isVideo ? "Marcar como assistida" : "Marcar como estudado"}
                </button>
                <FavoriteButton fileId={file.id} size="sm" />
                <NoteButton origin={{ tipo: isVideo ? "aula" : "material", id: file.id, label: `${isVideo ? "Aula" : "Material"}: ${name}` }} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {playlist && onNavigate && (
                  <>
                    <button type="button" className="btn-outline btn-sm" disabled={!prev} onClick={() => prev && onNavigate(prev)}>
                      <ChevronLeft size={14} /> Anterior
                    </button>
                    {next && (
                      <button type="button" className="btn-outline btn-sm" onClick={completeAndNext}>
                        {done || showCover ? "Próxima" : "Concluir e próxima"} <ChevronRight size={14} />
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

          {dockOpen && (
            <div className="border-t lg:border-t-0 border-border h-[60vh] lg:h-auto lg:max-h-[calc(96vh-73px)] min-h-0">
              <CadernoDock variant="inline" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
