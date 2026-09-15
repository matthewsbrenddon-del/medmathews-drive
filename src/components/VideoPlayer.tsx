"use client";

import { Play } from "lucide-react";
import type { StudyContent } from "@/lib/types";

/**
 * Player integrado ao Google Drive (spec seção 8): incorpora o preview
 * nativo do Drive via iframe, sem baixar o arquivo para o servidor.
 *
 * O player nativo do Drive não expõe eventos de progresso via postMessage
 * de forma confiável entre origens, então o acompanhamento de "continuar de
 * onde parou" é registrado pelas ações explícitas do usuário (botão
 * "Marcar como assistida" e o controle de progresso abaixo do player) — ver
 * VideoDetailProgress na página da aula.
 */
export function VideoPlayer({ content }: { content: StudyContent }) {
  if (!content.embedUrl) {
    return (
      <div className="aspect-video w-full rounded-2xl bg-foreground/90 flex flex-col items-center justify-center gap-3 text-background">
        <Play size={32} />
        <p className="text-sm">Pré-visualização indisponível para este arquivo.</p>
      </div>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-card">
      <iframe
        src={content.embedUrl}
        title={content.displayTitle}
        className="h-full w-full"
        allow="autoplay; fullscreen"
        allowFullScreen
      />
    </div>
  );
}
