"use client";

import { FileText } from "lucide-react";
import type { StudyContent } from "@/lib/types";

/** Leitor de PDF/documentos integrado, incorporando o preview do Drive. */
export function PDFViewer({ content }: { content: StudyContent }) {
  if (content.extension !== "pdf" || !content.embedUrl) {
    return (
      <div className="aspect-[4/3] sm:aspect-video w-full rounded-2xl bg-muted flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <FileText size={32} />
        <p className="text-sm text-center px-6">
          Pré-visualização integrada disponível para PDFs. Use &quot;Abrir no Google Drive&quot; para visualizar este
          arquivo.
        </p>
      </div>
    );
  }

  return (
    <div className="aspect-[4/3] sm:aspect-video w-full overflow-hidden rounded-2xl border border-border bg-muted shadow-card">
      <iframe src={content.embedUrl} title={content.displayTitle} className="h-full w-full" />
    </div>
  );
}
