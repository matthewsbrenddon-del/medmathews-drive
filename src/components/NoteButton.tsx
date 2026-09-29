"use client";

import { NotebookPen } from "lucide-react";
import { sendToCaderno, useCadernoDockStore } from "@/lib/cadernoDockStore";
import type { NoteOrigin } from "@/lib/types";

/** "Anotar": abre o Caderno acoplado ao lado do conteúdo, já com a referência
 * de origem inserida no fim e o cursor pronto para escrever. */
export function NoteButton({ origin, className, label = "Anotar" }: { origin?: NoteOrigin; className?: string; label?: string }) {
  const setContext = useCadernoDockStore((s) => s.setContext);
  return (
    <button
      type="button"
      onClick={() => {
        if (origin) setContext(origin);
        sendToCaderno("", origin);
      }}
      className={className ?? "btn-outline btn-sm"}
      title="Anotar no Caderno (abre ao lado)"
    >
      <NotebookPen size={14} /> {label}
    </button>
  );
}
