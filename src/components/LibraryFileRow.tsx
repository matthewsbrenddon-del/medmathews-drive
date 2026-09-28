"use client";

import { BookOpen, CheckCircle2, CircleDot, File, FileText, Image as ImageIcon, Music, Play, Video } from "lucide-react";
import { fileKind, fileName, isFileComplete, isFileStarted, type LibraryFileKind } from "@/lib/library";
import { useStudyStore } from "@/lib/store";
import type { LibraryFile } from "@/lib/types";
import { cn } from "@/lib/utils";

export const KIND_ICON: Record<LibraryFileKind, typeof Video> = {
  video: Video,
  pdf: FileText,
  image: ImageIcon,
  audio: Music,
  epub: BookOpen,
  outro: File,
};

export const KIND_SHORT: Record<LibraryFileKind, string> = {
  video: "Vídeo",
  pdf: "PDF",
  image: "Imagem",
  audio: "Áudio",
  epub: "E-book",
  outro: "Arquivo",
};

export function LibraryFileRow({
  file,
  onOpen,
  subtitle,
  highlight,
}: {
  file: LibraryFile;
  onOpen: () => void;
  subtitle?: string;
  highlight?: boolean;
}) {
  const state = useStudyStore((s) => s.userStates[file.id]);
  const kind = fileKind(file);
  const done = isFileComplete(file, state);
  const started = !done && isFileStarted(file, state);
  const Icon = KIND_ICON[kind];

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group w-full rounded-xl border px-3.5 py-2.5 flex items-center gap-3 text-left transition-all hover:shadow-card hover:border-primary/40",
        highlight ? "border-primary/50 bg-primary-light" : "border-border bg-surface"
      )}
    >
      <span
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
          done ? "bg-success/10 text-success" : kind === "video" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
        )}
      >
        {done ? <CheckCircle2 size={16} /> : <Icon size={16} className="group-hover:opacity-0 transition-opacity" />}
        {!done && kind === "video" && (
          <Play size={15} className="absolute opacity-0 group-hover:opacity-100 transition-opacity fill-current" />
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span className={cn("block text-sm truncate", done ? "text-muted-foreground" : "text-foreground font-medium")}>
          {fileName(file)}
        </span>
        {subtitle && <span className="block text-[11px] text-muted-foreground truncate">{subtitle}</span>}
      </span>
      {started && (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-warning shrink-0">
          <CircleDot size={11} /> Em andamento
        </span>
      )}
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-metric shrink-0">{KIND_SHORT[kind]}</span>
    </button>
  );
}
