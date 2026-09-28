"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Brain, Star } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { LibraryFileRow } from "@/components/LibraryFileRow";
import { LoadingState } from "@/components/LoadingState";
import { useLibraryStore } from "@/lib/libraryStore";
import { useStudyStore } from "@/lib/store";
import { useQuestionStore } from "@/lib/questionStore";
import { useQuestionProgressStore } from "@/lib/questionProgressStore";
import { fileKind, fullPath, naturalCompare, fileName } from "@/lib/library";
import { resolveSubject } from "@/lib/subjects";
import type { LibraryFile } from "@/lib/types";

export default function FavoritosPage() {
  const files = useLibraryStore((s) => s.files);
  const status = useLibraryStore((s) => s.status);
  const hydrate = useLibraryStore((s) => s.hydrate);
  const userStates = useStudyStore((s) => s.userStates);
  const questions = useQuestionStore((s) => s.questions);
  const questionProgress = useQuestionProgressStore((s) => s.progress);
  const [preview, setPreview] = useState<{ file: LibraryFile; playlist: LibraryFile[] } | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const favorites = useMemo(
    () => files.filter((f) => userStates[f.id]?.favorite).sort((a, b) => naturalCompare(fileName(a), fileName(b))),
    [files, userStates]
  );
  const videos = favorites.filter((f) => fileKind(f) === "video");
  const materials = favorites.filter((f) => fileKind(f) !== "video");
  const favoriteQuestions = useMemo(() => questions.filter((q) => questionProgress[q.id]?.favorite), [questions, questionProgress]);

  const total = favorites.length + favoriteQuestions.length;

  function Section({ title, items }: { title: string; items: LibraryFile[] }) {
    if (items.length === 0) return null;
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-foreground mb-2">
          {title} <span className="text-sm font-metric text-muted-foreground">({items.length})</span>
        </h2>
        {items.map((f) => (
          <LibraryFileRow
            key={f.id}
            file={f}
            subtitle={fullPath(f).slice(0, -1).join(" › ")}
            onOpen={() => setPreview({ file: f, playlist: items })}
          />
        ))}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground inline-flex items-center gap-2.5">
          <Star size={22} className="text-warning fill-warning" /> Meus favoritos
        </h1>
        <p className="text-muted-foreground mt-1">Aulas, materiais e questões que você marcou com estrela.</p>
      </div>

      {status !== "ready" ? (
        <LoadingState label="Carregando favoritos..." />
      ) : total === 0 ? (
        <EmptyState
          icon={Star}
          title="Você ainda não adicionou favoritos."
          description="Toque na estrela de qualquer aula, material ou questão para encontrá-lo aqui depois."
        />
      ) : (
        <>
          <Section title="Videoaulas" items={videos} />
          <Section title="Materiais" items={materials} />
          {favoriteQuestions.length > 0 && (
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h2 className="text-lg font-semibold text-foreground">
                  Questões <span className="text-sm font-metric text-muted-foreground">({favoriteQuestions.length})</span>
                </h2>
                <Link href="/questoes/estudo?favoritos=1" className="btn-primary btn-sm">
                  Resolver todas <ArrowRight size={13} />
                </Link>
              </div>
              {favoriteQuestions.slice(0, 20).map((q) => {
                const subject = resolveSubject(q.subjectName);
                return (
                  <Link
                    key={q.id}
                    href={`/questoes/estudo?favoritos=1&start=${q.id}`}
                    className="rounded-xl border border-border bg-surface px-3.5 py-2.5 flex items-center gap-3 hover:shadow-card hover:border-primary/40 transition-all"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <Brain size={16} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-foreground truncate">{q.enunciado}</span>
                      <span className="block text-[11px] truncate" style={{ color: `hsl(${subject.colorToken})` }}>
                        {subject.name}
                        {q.tema ? ` · ${q.tema}` : ""}
                        {q.banca ? ` · ${q.banca} ${q.ano ?? ""}` : ""}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </section>
          )}
        </>
      )}

      <FilePreviewModal
        file={preview?.file ?? null}
        playlist={preview?.playlist}
        onNavigate={(f) => setPreview((p) => (p ? { ...p, file: f } : p))}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
