import Link from "next/link";
import { File, FileSpreadsheet, FileText, Presentation } from "lucide-react";
import { KNOWN_SUBJECTS } from "@/lib/classify";
import type { StudyContent, UserFileState } from "@/lib/types";
import { formatBytes, formatRelativeDate } from "@/lib/utils";
import { FavoriteButton } from "./FavoriteButton";
import { StatusBadge } from "./StatusBadge";

function iconFor(extension: string) {
  if (["ppt", "pptx"].includes(extension)) return Presentation;
  if (["xls", "xlsx", "csv"].includes(extension)) return FileSpreadsheet;
  if (["pdf", "doc", "docx", "epub"].includes(extension)) return FileText;
  return File;
}

export function MaterialCard({ content, state }: { content: StudyContent; state?: UserFileState }) {
  const subject = KNOWN_SUBJECTS.find((s) => s.slug === content.subjectSlug);
  const status = state?.readStatus ?? "nao_acessado";
  const Icon = iconFor(content.extension);

  return (
    <Link
      href={`/materiais/${content.fileId}`}
      className="card p-4 flex flex-col gap-3 hover:shadow-lift hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `hsl(${subject?.colorToken ?? "217 65% 30%"} / 0.12)`, color: `hsl(${subject?.colorToken ?? "217 65% 30%"})` }}
        >
          <Icon size={20} />
        </div>
        <FavoriteButton fileId={content.fileId} size="sm" />
      </div>

      <div>
        <p className="text-xs font-medium" style={{ color: subject ? `hsl(${subject.colorToken})` : undefined }}>
          {subject?.name ?? "Disciplina"}
        </p>
        <h3 className="font-medium text-sm text-foreground leading-snug line-clamp-2 mt-0.5">
          {content.displayTitle}
        </h3>
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-auto pt-1">
        <span className="uppercase">{content.extension}</span>
        <span>{formatBytes(content.sizeBytes)}</span>
        <span>{formatRelativeDate(content.modifiedAt)}</span>
      </div>

      <StatusBadge status={status} kind="read" />
    </Link>
  );
}
