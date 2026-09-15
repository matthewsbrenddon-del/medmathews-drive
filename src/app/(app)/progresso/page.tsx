"use client";

import { Flame, Layers, Video as VideoIcon, BookOpen as BookOpenIcon } from "lucide-react";
import { ProgressBar } from "@/components/ProgressBar";
import { ProgressCircle } from "@/components/ProgressCircle";
import { SubjectIcon } from "@/components/SubjectIcon";
import { useContent } from "@/lib/content";
import { computeOverallProgress, computeSubjectProgress } from "@/lib/progress";
import { useStudyStore } from "@/lib/store";

export default function ProgressoPage() {
  const content = useContent();
  const userStates = useStudyStore((s) => s.userStates);
  const currentStreak = useStudyStore((s) => s.currentStreak());

  const overall = computeOverallProgress(content, userStates);
  const subjects = computeSubjectProgress(content, userStates);
  const remaining = content.length - overall.watchedLessons - overall.studiedMaterials;

  return (
    <div className="flex flex-col gap-9">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Meu Progresso</h1>
        <p className="text-muted-foreground mt-1">Acompanhe sua evolução acadêmica em cada disciplina.</p>
      </div>

      <section className="card p-7 flex flex-col sm:flex-row items-center gap-8">
        <ProgressCircle percent={overall.percent} size={168} strokeWidth={14} sublabel="concluído" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 flex-1 w-full">
          <div>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <VideoIcon size={13} /> Aulas concluídas
            </p>
            <p className="text-xl font-semibold text-foreground mt-1">
              {overall.watchedLessons}/{overall.totalLessons}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <BookOpenIcon size={13} /> Materiais estudados
            </p>
            <p className="text-xl font-semibold text-foreground mt-1">
              {overall.studiedMaterials}/{overall.totalMaterials}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <Layers size={13} /> Conteúdos restantes
            </p>
            <p className="text-xl font-semibold text-foreground mt-1">{Math.max(remaining, 0)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <Flame size={13} /> Sequência de estudos
            </p>
            <p className="text-xl font-semibold text-foreground mt-1">
              {currentStreak} {currentStreak === 1 ? "dia" : "dias"}
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">Progresso por disciplina</h2>
        <div className="card divide-y divide-border">
          {subjects.map((subject) => (
            <div key={subject.slug} className="flex items-center gap-4 px-5 py-4">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `hsl(${subject.colorToken} / 0.12)`, color: `hsl(${subject.colorToken})` }}
              >
                <SubjectIcon name={subject.icon} size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground truncate">{subject.name}</p>
                  <span className="text-sm font-semibold text-foreground shrink-0">{subject.percent}%</span>
                </div>
                <div className="mt-2">
                  <ProgressBar percent={subject.percent} colorToken={subject.colorToken} size="sm" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
