"use client";

import { LayoutGrid } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { SubjectCard } from "@/components/SubjectCard";
import { useContent } from "@/lib/content";
import { computeSubjectProgress } from "@/lib/progress";
import { useStudyStore } from "@/lib/store";

export default function DisciplinasPage() {
  const content = useContent();
  const userStates = useStudyStore((s) => s.userStates);
  const subjects = computeSubjectProgress(content, userStates);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Disciplinas</h1>
        <p className="text-muted-foreground mt-1">Todas as disciplinas encontradas na sua pasta do Google Drive.</p>
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="Nenhuma disciplina encontrada."
          description="Sincronize seu Google Drive para identificar automaticamente as disciplinas dos seus materiais."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {subjects.map((subject) => (
            <SubjectCard key={subject.slug} subject={subject} />
          ))}
        </div>
      )}
    </div>
  );
}
