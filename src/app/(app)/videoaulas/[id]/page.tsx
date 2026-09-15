"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, ExternalLink, Undo2 } from "lucide-react";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";
import { VideoPlayer } from "@/components/VideoPlayer";
import { VideoCard } from "@/components/VideoCard";
import { KNOWN_SUBJECTS } from "@/lib/classify";
import { useContent } from "@/lib/content";
import { useStudyStore } from "@/lib/store";
import { formatBytes, formatDuration, formatRelativeDate } from "@/lib/utils";

export default function VideoDetailPage({ params }: { params: { id: string } }) {
  const content = useContent();
  const item = content.find((c) => c.fileId === params.id && c.kind === "videoaula");
  if (!item) notFound();

  const userStates = useStudyStore((s) => s.userStates);
  const setWatchStatus = useStudyStore((s) => s.setWatchStatus);
  const setPlaybackProgress = useStudyStore((s) => s.setPlaybackProgress);
  const recordStudyToday = useStudyStore((s) => s.recordStudyToday);

  const subject = KNOWN_SUBJECTS.find((s) => s.slug === item.subjectSlug);
  const state = userStates[item.fileId];
  const status = state?.watchStatus ?? "nao_iniciada";
  const duration = item.durationSeconds ?? 0;
  const position = state?.playbackPositionSeconds ?? 0;

  function handleMarkWatched() {
    setWatchStatus(item!.fileId, "assistida");
    recordStudyToday();
  }

  function handleUndo() {
    setWatchStatus(item!.fileId, "nao_iniciada");
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const value = Number(e.target.value);
    setPlaybackProgress(item!.fileId, value, duration || 1);
    recordStudyToday();
  }

  const related = content
    .filter((c) => c.kind === "videoaula" && c.subjectSlug === item.subjectSlug && c.fileId !== item.fileId)
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-8">
      <VideoPlayer content={item} />

      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: subject ? `hsl(${subject.colorToken})` : undefined }}>
            {subject?.name ?? "Disciplina"}
          </p>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground mt-1">{item.displayTitle}</h1>
          {item.description && <p className="text-sm text-muted-foreground mt-2">{item.description}</p>}

          <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-muted-foreground">
            <span>{formatDuration(item.durationSeconds)}</span>
            <span aria-hidden>•</span>
            <span>{formatBytes(item.sizeBytes)}</span>
            <span aria-hidden>•</span>
            <span>Modificado {formatRelativeDate(item.modifiedAt)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            {status === "assistida" ? (
              <button type="button" onClick={handleUndo} className="btn-outline">
                <Undo2 size={15} /> Desfazer conclusão
              </button>
            ) : (
              <button type="button" onClick={handleMarkWatched} className="btn-primary">
                <Check size={15} /> Marcar como assistida
              </button>
            )}
            <FavoriteButton fileId={item.fileId} />
            <a href={item.webViewUrl} target="_blank" rel="noreferrer" className="btn-outline">
              <ExternalLink size={15} /> Abrir no Google Drive
            </a>
          </div>
        </div>

        <div className="w-full lg:w-72 card p-5 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-foreground">Seu progresso</p>
            <StatusBadge status={status} kind="watch" />
          </div>
          <ProgressBar percent={state?.progressPercent ?? 0} />
          <p className="text-xs text-muted-foreground mt-2">{state?.progressPercent ?? 0}% concluído</p>

          {duration > 0 && (
            <div className="mt-5">
              <label htmlFor="playback-position" className="text-xs text-muted-foreground block mb-2">
                Continuar de onde parou ({formatDuration(position)} / {formatDuration(duration)})
              </label>
              <input
                id="playback-position"
                type="range"
                min={0}
                max={duration}
                value={position}
                onChange={handleSeek}
                className="w-full accent-[hsl(var(--primary))]"
              />
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Outras aulas de {subject?.name}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {related.map((r) => (
              <VideoCard key={r.fileId} content={r} state={userStates[r.fileId]} />
            ))}
          </div>
        </section>
      )}

      <Link href={`/disciplinas/${item.subjectSlug}`} className="text-sm font-medium text-primary self-start">
        ← Voltar para {subject?.name ?? "a disciplina"}
      </Link>
    </div>
  );
}
