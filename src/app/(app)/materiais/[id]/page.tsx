"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";
import { Check, ExternalLink, Undo2 } from "lucide-react";
import { FavoriteButton } from "@/components/FavoriteButton";
import { MaterialCard } from "@/components/MaterialCard";
import { PDFViewer } from "@/components/PDFViewer";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { resolveSubject } from "@/lib/subjects";
import { useContent } from "@/lib/content";
import { useStudyStore } from "@/lib/store";

export default function MaterialDetailPage({ params }: { params: { id: string } }) {
  const content = useContent();
  const item = content.find((c) => c.fileId === params.id && c.kind !== "videoaula");
  if (!item) notFound();

  const userStates = useStudyStore((s) => s.userStates);
  const setReadStatus = useStudyStore((s) => s.setReadStatus);
  const recordStudyToday = useStudyStore((s) => s.recordStudyToday);

  const subject = resolveSubject(item.subjectName);
  const state = userStates[item.fileId];
  const status = state?.readStatus ?? "nao_acessado";

  useEffect(() => {
    if (!state?.readStatus) {
      setReadStatus(item!.fileId, "acessado");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.fileId]);

  function handleMarkStudied() {
    setReadStatus(item!.fileId, "estudado");
    recordStudyToday();
  }

  function handleUndo() {
    setReadStatus(item!.fileId, "acessado");
  }

  const related = content
    .filter((c) => c.kind !== "videoaula" && c.subjectSlug === item.subjectSlug && c.fileId !== item.fileId)
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-8">
      <PDFViewer content={item} />

      <div className="flex flex-col sm:flex-row sm:items-start gap-6 justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium" style={{ color: `hsl(${subject.colorToken})` }}>
              {subject.name}
            </p>
            {item.modulo && <span className="text-xs text-muted-foreground">· {item.modulo}</span>}
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground mt-1">{item.displayTitle}</h1>
          {item.topic && <p className="text-sm text-muted-foreground mt-2">{item.topic}</p>}
          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
            <span className="uppercase">{item.extension}</span>
            <span aria-hidden>•</span>
            <PriorityBadge priority={item.priority} />
          </div>
          <div className="mt-3">
            <StatusBadge status={status} kind="read" />
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            {status === "estudado" ? (
              <button type="button" onClick={handleUndo} className="btn-outline">
                <Undo2 size={15} /> Desfazer conclusão
              </button>
            ) : (
              <button type="button" onClick={handleMarkStudied} className="btn-primary">
                <Check size={15} /> Marcar como estudado
              </button>
            )}
            <FavoriteButton fileId={item.fileId} />
            <a href={item.webViewUrl} target="_blank" rel="noreferrer" className="btn-outline">
              <ExternalLink size={15} /> Abrir no Google Drive
            </a>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Outros materiais de {subject.name}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {related.map((r) => (
              <MaterialCard key={r.fileId} content={r} state={userStates[r.fileId]} />
            ))}
          </div>
        </section>
      )}

      <Link href={`/disciplinas/${item.subjectSlug}`} className="text-sm font-medium text-primary self-start">
        ← Voltar para {subject.name}
      </Link>
    </div>
  );
}
