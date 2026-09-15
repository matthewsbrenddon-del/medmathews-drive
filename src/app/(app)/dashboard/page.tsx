"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, Clock, GraduationCap, TrendingUp, Video } from "lucide-react";
import { DashboardCard } from "@/components/DashboardCard";
import { EmptyState } from "@/components/EmptyState";
import { ProgressBar } from "@/components/ProgressBar";
import { SubjectCard } from "@/components/SubjectCard";
import { useContent } from "@/lib/content";
import { computeOverallProgress, computeSubjectProgress, getContinueStudying } from "@/lib/progress";
import { useStudyStore } from "@/lib/store";
import { KNOWN_SUBJECTS } from "@/lib/classify";
import { formatDuration } from "@/lib/utils";

export default function DashboardPage() {
  const content = useContent();
  const userStates = useStudyStore((s) => s.userStates);

  const overall = computeOverallProgress(content, userStates);
  const subjects = computeSubjectProgress(content, userStates);
  const continuing = getContinueStudying(content, userStates, 3);

  return (
    <div className="flex flex-col gap-9">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Olá, estudante 👋</h1>
        <p className="text-muted-foreground mt-1.5">Continue seus estudos de onde parou.</p>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Resumo geral">
        <DashboardCard icon={TrendingUp} label="Progresso total" value={`${overall.percent}%`} accentToken="217 65% 30%" />
        <DashboardCard
          icon={Video}
          label="Aulas assistidas"
          value={`${overall.watchedLessons} / ${overall.totalLessons}`}
          accentToken="199 75% 42%"
        />
        <DashboardCard
          icon={BookOpen}
          label="Materiais estudados"
          value={`${overall.studiedMaterials} / ${overall.totalMaterials}`}
          accentToken="152 55% 36%"
        />
        <DashboardCard
          icon={Clock}
          label="Tempo de estudo"
          value={formatDuration(overall.totalStudySeconds)}
          sublabel="em videoaulas assistidas"
          accentToken="38 92% 50%"
        />
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Continue estudando</h2>
          {continuing.length > 0 && (
            <Link href="/videoaulas" className="text-sm font-medium text-primary inline-flex items-center gap-1">
              Ver tudo <ArrowRight size={14} />
            </Link>
          )}
        </div>

        {continuing.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="Comece sua primeira aula para acompanhar seu progresso."
            description="Assim que você iniciar uma videoaula ou apostila, ela aparecerá aqui para você continuar de onde parou."
            action={
              <Link href="/videoaulas" className="btn-primary">
                Explorar videoaulas
              </Link>
            }
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {continuing.map((item) => {
              const subject = KNOWN_SUBJECTS.find((s) => s.slug === item.subjectSlug);
              const state = userStates[item.fileId];
              const href = item.kind === "videoaula" ? `/videoaulas/${item.fileId}` : `/materiais/${item.fileId}`;
              return (
                <Link key={item.fileId} href={href} className="card p-4 flex flex-col gap-3 hover:shadow-lift hover:-translate-y-0.5 transition-all">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: `hsl(${subject?.colorToken ?? "217 65% 30%"})` }}
                    />
                    <p className="text-xs font-medium text-muted-foreground">{subject?.name ?? "Disciplina"}</p>
                  </div>
                  <h3 className="font-medium text-sm text-foreground line-clamp-2">{item.displayTitle}</h3>
                  <div className="mt-auto flex flex-col gap-2">
                    <ProgressBar percent={state?.progressPercent ?? 0} size="sm" />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{state?.progressPercent ?? 0}%</span>
                      <span className="text-xs font-medium text-primary inline-flex items-center gap-1">
                        Continuar <ArrowRight size={12} />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Suas disciplinas</h2>
          <Link href="/disciplinas" className="text-sm font-medium text-primary inline-flex items-center gap-1">
            Ver todas <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {subjects.slice(0, 8).map((subject) => (
            <SubjectCard key={subject.slug} subject={subject} />
          ))}
        </div>
      </section>

      {overall.percent > 0 && (
        <section className="card p-5 flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success/10 text-success shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <p className="text-sm text-foreground">
            Você já concluiu <strong>{overall.percent}%</strong> do seu material de estudo. Continue assim!
          </p>
        </section>
      )}
    </div>
  );
}
