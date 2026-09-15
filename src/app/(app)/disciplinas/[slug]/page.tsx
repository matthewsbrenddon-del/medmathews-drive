"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import { BookOpen, CheckCircle2, Video } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { MaterialCard } from "@/components/MaterialCard";
import { ProgressCircle } from "@/components/ProgressCircle";
import { SubjectIcon } from "@/components/SubjectIcon";
import { VideoCard } from "@/components/VideoCard";
import { KNOWN_SUBJECTS } from "@/lib/classify";
import { useContent } from "@/lib/content";
import { computeSubjectProgress } from "@/lib/progress";
import { useStudyStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "geral", label: "Visão geral" },
  { id: "videoaulas", label: "Videoaulas" },
  { id: "apostilas", label: "Apostilas" },
  { id: "outros", label: "Outros" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function DisciplinaPage({ params }: { params: { slug: string } }) {
  const subjectMeta = KNOWN_SUBJECTS.find((s) => s.slug === params.slug);
  if (!subjectMeta) notFound();

  const content = useContent();
  const userStates = useStudyStore((s) => s.userStates);
  const [tab, setTab] = useState<TabId>("geral");

  const items = content.filter((c) => c.subjectSlug === params.slug);
  const lessons = items.filter((c) => c.kind === "videoaula");
  const materials = items.filter((c) => c.kind === "apostila");
  const others = items.filter((c) => c.kind === "outro");
  const progress = computeSubjectProgress(content, userStates).find((s) => s.slug === params.slug);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `hsl(${subjectMeta.colorToken} / 0.12)`, color: `hsl(${subjectMeta.colorToken})` }}
        >
          <SubjectIcon name={subjectMeta.icon} size={26} />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-foreground">{subjectMeta.name}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Video size={13} /> {progress?.watchedLessons ?? 0}/{progress?.totalLessons ?? 0} aulas assistidas
            </span>
            <span className="inline-flex items-center gap-1">
              <BookOpen size={13} /> {progress?.studiedMaterials ?? 0}/{progress?.totalMaterials ?? 0} materiais estudados
            </span>
          </div>
        </div>
        <ProgressCircle percent={progress?.percent ?? 0} size={84} strokeWidth={8} />
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "geral" && (
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="card p-5">
            <p className="text-sm text-muted-foreground">Progresso da disciplina</p>
            <p className="text-2xl font-semibold text-foreground mt-1.5">{progress?.percent ?? 0}%</p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-muted-foreground">Aulas</p>
            <p className="text-2xl font-semibold text-foreground mt-1.5">{lessons.length}</p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-muted-foreground">Materiais</p>
            <p className="text-2xl font-semibold text-foreground mt-1.5">{materials.length + others.length}</p>
          </div>

          {(progress?.percent ?? 0) === 100 && (
            <div className="sm:col-span-3 card p-5 flex items-center gap-3 bg-success/5 border-success/20">
              <CheckCircle2 size={20} className="text-success" />
              <p className="text-sm text-foreground">Parabéns! Você concluiu toda a disciplina de {subjectMeta.name}.</p>
            </div>
          )}
        </div>
      )}

      {tab === "videoaulas" &&
        (lessons.length === 0 ? (
          <EmptyState icon={Video} title="Nenhuma videoaula encontrada." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lessons.map((item) => (
              <VideoCard key={item.fileId} content={item} state={userStates[item.fileId]} />
            ))}
          </div>
        ))}

      {tab === "apostilas" &&
        (materials.length === 0 ? (
          <EmptyState icon={BookOpen} title="Nenhuma apostila encontrada." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {materials.map((item) => (
              <MaterialCard key={item.fileId} content={item} state={userStates[item.fileId]} />
            ))}
          </div>
        ))}

      {tab === "outros" &&
        (others.length === 0 ? (
          <EmptyState icon={BookOpen} title="Nenhum material adicional encontrado." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {others.map((item) => (
              <MaterialCard key={item.fileId} content={item} state={userStates[item.fileId]} />
            ))}
          </div>
        ))}
    </div>
  );
}
