import Link from "next/link";
import { Play, Video as VideoIcon } from "lucide-react";
import { KNOWN_SUBJECTS } from "@/lib/classify";
import type { StudyContent, UserFileState } from "@/lib/types";
import { formatDuration } from "@/lib/utils";
import { FavoriteButton } from "./FavoriteButton";
import { ProgressBar } from "./ProgressBar";
import { StatusBadge } from "./StatusBadge";

export function VideoCard({ content, state }: { content: StudyContent; state?: UserFileState }) {
  const subject = KNOWN_SUBJECTS.find((s) => s.slug === content.subjectSlug);
  const status = state?.watchStatus ?? "nao_iniciada";

  return (
    <Link href={`/videoaulas/${content.fileId}`} className="card overflow-hidden group flex flex-col hover:shadow-lift hover:-translate-y-0.5 transition-all duration-200">
      <div className="relative aspect-video bg-muted overflow-hidden">
        {content.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={content.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <VideoIcon size={28} />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-foreground/0 group-hover:bg-foreground/20 transition-colors">
          <div className="h-11 w-11 rounded-full bg-surface/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Play size={18} className="text-primary ml-0.5" fill="currentColor" />
          </div>
        </div>
        {content.durationSeconds && (
          <span className="absolute bottom-2 right-2 rounded-md bg-foreground/80 text-background text-[11px] font-medium px-1.5 py-0.5">
            {formatDuration(content.durationSeconds)}
          </span>
        )}
        <div className="absolute top-2 right-2">
          <FavoriteButton fileId={content.fileId} size="sm" />
        </div>
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <p className="text-xs font-medium" style={{ color: subject ? `hsl(${subject.colorToken})` : undefined }}>
          {subject?.name ?? "Disciplina"}
        </p>
        <h3 className="font-medium text-sm text-foreground leading-snug line-clamp-2">{content.displayTitle}</h3>
        <div className="mt-auto pt-1 flex flex-col gap-2">
          {state && state.progressPercent > 0 && status !== "nao_iniciada" && (
            <ProgressBar percent={state.progressPercent} size="sm" />
          )}
          <StatusBadge status={status} kind="watch" />
        </div>
      </div>
    </Link>
  );
}
