"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Brain, ClipboardList, Clock, Flame, Play, RotateCcw, Video } from "lucide-react";
import { DashboardCard } from "@/components/DashboardCard";
import { EmptyState } from "@/components/EmptyState";
import { EmptyBoxIllustration, StudyIllustration } from "@/components/Illustrations";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { SubjectCard } from "@/components/SubjectCard";
import { useStudyStore } from "@/lib/store";
import { useLibraryStore } from "@/lib/libraryStore";
import { useClassificationStore } from "@/lib/classificationStore";
import { useQuestionStore } from "@/lib/questionStore";
import { useQuestionProgressStore } from "@/lib/questionProgressStore";
import { useStudySessionStore, sumDurationSeconds } from "@/lib/studySessionStore";
import { computeQuestionStats } from "@/lib/questionStats";
import { classifyLibrary } from "@/lib/classification";
import {
  computeSubjectProgressFromLibrary,
  fileKind,
  fileName, fileTitle,
  fullPath,
  isFileComplete,
  naturalCompare,
} from "@/lib/library";
import { resolveSubject } from "@/lib/subjects";
import type { LibraryFile } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

function folderKey(file: LibraryFile) {
  return fullPath(file).slice(0, -1).join(" › ");
}

export default function DashboardPage() {
  const userStates = useStudyStore((s) => s.userStates);
  const studentName = useStudyStore((s) => s.studentName);
  const streak = useStudyStore((s) => s.currentStreak());

  const files = useLibraryStore((s) => s.files);
  const libraryStatus = useLibraryStore((s) => s.status);
  const hydrateLibrary = useLibraryStore((s) => s.hydrate);
  const overrides = useClassificationStore((s) => s.overrides);
  const questions = useQuestionStore((s) => s.questions);
  const questionProgress = useQuestionProgressStore((s) => s.progress);
  const sessions = useStudySessionStore((s) => s.sessions);

  const [preview, setPreview] = useState<{ file: LibraryFile; playlist: LibraryFile[] } | null>(null);

  useEffect(() => {
    hydrateLibrary();
  }, [hydrateLibrary]);

  const classified = useMemo(() => classifyLibrary(files, overrides), [files, overrides]);
  const unclassifiedCount = useMemo(() => classified.filter((f) => !f.subjectSlug).length, [classified]);
  const subjects = useMemo(() => computeSubjectProgressFromLibrary(classified, userStates), [classified, userStates]);

  const libraryStats = useMemo(() => {
    let videos = 0,
      videosDone = 0,
      materials = 0,
      materialsDone = 0;
    for (const f of classified) {
      const k = fileKind(f);
      const done = isFileComplete(f, userStates[f.id]);
      if (k === "video") {
        videos++;
        if (done) videosDone++;
      } else if (k === "pdf" || k === "epub") {
        materials++;
        if (done) materialsDone++;
      }
    }
    return { videos, videosDone, materials, materialsDone };
  }, [classified, userStates]);

  const questionStats = useMemo(() => computeQuestionStats(questions, questionProgress), [questions, questionProgress]);
  const weekSeconds = sumDurationSeconds(sessions, "7d");

  const continuing = useMemo(() => {
    return classified
      .filter((f) => userStates[f.id]?.lastViewedAt && !isFileComplete(f, userStates[f.id]))
      .sort((a, b) => (userStates[b.id]!.lastViewedAt! > userStates[a.id]!.lastViewedAt! ? 1 : -1))
      .slice(0, 3);
  }, [classified, userStates]);

  function openWithFolder(file: LibraryFile) {
    const key = folderKey(file);
    const playlist = files.filter((f) => folderKey(f) === key).sort((a, b) => naturalCompare(fileName(a), fileName(b)));
    setPreview({ file, playlist });
  }

  const firstName = studentName.trim().split(/\s+/)[0];

  return (
    <div className="flex flex-col gap-9">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Olá, {firstName || "estudante"} 👋</h1>
        <p className="text-muted-foreground mt-1.5">
          {streak > 0 ? `${streak} ${streak === 1 ? "dia" : "dias"} seguidos de estudo — não quebre a sequência!` : "Continue seus estudos de onde parou."}
        </p>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Resumo geral">
        <DashboardCard
          icon={Video}
          label="Aulas assistidas"
          value={libraryStatus === "ready" ? `${libraryStats.videosDone} / ${libraryStats.videos.toLocaleString("pt-BR")}` : "…"}
          accentToken="var(--accent)"
        />
        <DashboardCard
          icon={BookOpen}
          label="Materiais estudados"
          value={libraryStatus === "ready" ? `${libraryStats.materialsDone} / ${libraryStats.materials.toLocaleString("pt-BR")}` : "…"}
          accentToken="var(--success)"
        />
        <DashboardCard
          icon={Brain}
          label="Questões respondidas"
          value={`${questionStats.overall.answered}`}
          sublabel={questionStats.overall.answered > 0 ? `${questionStats.overall.accuracyPercent}% de acerto` : "de " + questions.length + " no banco"}
          accentToken="var(--primary)"
        />
        <DashboardCard
          icon={streak > 0 ? Flame : Clock}
          label="Horas líquidas (7 dias)"
          value={formatDuration(weekSeconds)}
          sublabel={streak > 0 ? `🔥 ${streak} ${streak === 1 ? "dia" : "dias"} de sequência` : "cronometradas nas sessões"}
          accentToken="var(--warning)"
        />
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Continue estudando</h2>
          <Link href="/disciplinas" className="text-sm font-medium text-primary inline-flex items-center gap-1">
            Abrir biblioteca <ArrowRight size={14} />
          </Link>
        </div>

        {continuing.length === 0 ? (
          <EmptyState
            illustration={<StudyIllustration />}
            title="Abra sua primeira aula para acompanhar seu progresso."
            description="Assim que você abrir uma videoaula ou material, ela aparece aqui para você continuar de onde parou."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/disciplinas" className="btn-primary">
                  <Play size={15} /> Comece por aqui
                </Link>
                <Link href="/videoaulas" className="btn-outline">
                  Ver todas as videoaulas
                </Link>
              </div>
            }
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {continuing.map((file) => {
              const subject = file.subjectSlug ? resolveSubject(file.subjectSlug) : undefined;
              const isVideo = fileKind(file) === "video";
              return (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => openWithFolder(file)}
                  className="card p-4 flex flex-col gap-3 text-left hover:shadow-lift hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: subject ? `hsl(${subject.colorToken})` : "hsl(var(--muted-foreground))" }}
                    />
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      {subject?.name ?? file.curso}
                      {file.disciplina ? ` · ${file.disciplina}` : ""}
                    </p>
                  </div>
                  <h3 className="font-medium text-sm text-foreground line-clamp-2">{fileTitle(file)}</h3>
                  <p className="text-[11px] text-muted-foreground truncate">{folderKey(file)}</p>
                  <span className="mt-auto text-xs font-medium text-primary inline-flex items-center gap-1">
                    <RotateCcw size={12} /> {isVideo ? "Continuar aula" : "Continuar leitura"}
                  </span>
                </button>
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

        {unclassifiedCount > 0 && (
          <Link
            href="/disciplinas/classificar"
            className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 flex items-center gap-3 hover:bg-accent/10 transition-colors mb-4"
          >
            <ClipboardList size={16} className="text-accent shrink-0" />
            <p className="text-sm text-foreground flex-1">
              <strong className="font-metric">{unclassifiedCount}</strong> itens aguardando classificação por grande área.
            </p>
            <ArrowRight size={14} className="text-accent shrink-0" />
          </Link>
        )}

        {libraryStatus === "ready" && subjects.length === 0 ? (
          <EmptyState
            illustration={<EmptyBoxIllustration />}
            title="Nenhuma disciplina classificada ainda."
            description="Assim que os itens do seu acervo forem classificados, eles aparecem aqui."
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {subjects.slice(0, 8).map((subject) => (
              <SubjectCard key={subject.slug} subject={subject} />
            ))}
          </div>
        )}
      </section>

      <FilePreviewModal
        file={preview?.file ?? null}
        playlist={preview?.playlist}
        onNavigate={(f) => setPreview((p) => (p ? { ...p, file: f } : p))}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
