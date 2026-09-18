import Link from "next/link";
import { File, FileSpreadsheet, FileText, Presentation } from "lucide-react";
import { resolveSubject } from "@/lib/subjects";
import type { StudyContent, ContentProgress } from "@/lib/types";
import { FavoriteButton } from "./FavoriteButton";
import { PriorityBadge } from "./PriorityBadge";
import { StatusBadge } from "./StatusBadge";

function iconFor(extension: string) {
  if (["ppt", "pptx"].includes(extension)) return Presentation;
  if (["xls", "xlsx", "csv"].includes(extension)) return FileSpreadsheet;
  if (["pdf", "doc", "docx", "epub"].includes(extension)) return FileText;
  return File;
}

export function MaterialCard({ content, state }: { content: StudyContent; state?: ContentProgress }) {
  const subject = resolveSubject(content.subjectName);
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
          style={{ backgroundColor: `hsl(${subject.colorToken} / 0.12)`, color: `hsl(${subject.colorToken})` }}
        >
          <Icon size={20} />
        </div>
        <FavoriteButton fileId={content.fileId} size="sm" />
      </div>

      <div>
        <p className="text-xs font-medium" style={{ color: `hsl(${subject.colorToken})` }}>
          {subject.name}
        </p>
        <h3 className="font-medium text-sm text-foreground leading-snug line-clamp-2 mt-0.5">
          {content.displayTitle}
        </h3>
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-auto pt-1">
        <span className="uppercase">{content.extension}</span>
        {content.modulo && <span className="truncate max-w-[100px]">{content.modulo}</span>}
        <PriorityBadge priority={content.priority} />
      </div>

      <StatusBadge status={status} kind="read" />
    </Link>
  );
}
