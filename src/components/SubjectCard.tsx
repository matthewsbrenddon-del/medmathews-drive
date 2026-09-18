import Link from "next/link";
import { ArrowRight, BookOpen, Video } from "lucide-react";
import type { SubjectProgress } from "@/lib/progress";
import { ProgressBar } from "./ProgressBar";
import { SubjectIcon } from "./SubjectIcon";

export function SubjectCard({ subject }: { subject: SubjectProgress }) {
  return (
    <Link
      href={`/disciplinas/${subject.slug}`}
      className="card p-5 flex flex-col gap-4 hover:shadow-lift hover:-translate-y-0.5 transition-all duration-200 group"
    >
      <div className="flex items-center justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: `hsl(${subject.colorToken} / 0.12)`, color: `hsl(${subject.colorToken})` }}
        >
          <SubjectIcon name={subject.icon} size={19} />
        </div>
        <span className="text-lg font-semibold font-metric text-foreground">{subject.percent}%</span>
      </div>

      <div>
        <h3 className="font-semibold text-foreground">{subject.name}</h3>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Video size={12} /> {subject.totalLessons} aulas
          </span>
          <span className="inline-flex items-center gap-1">
            <BookOpen size={12} /> {subject.totalMaterials} materiais
          </span>
        </div>
      </div>

      <ProgressBar percent={subject.percent} colorToken={subject.colorToken} />

      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary mt-1">
        Acessar disciplina
        <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
