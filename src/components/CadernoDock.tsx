"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CornerDownLeft, ExternalLink, NotebookPen, Plus, X } from "lucide-react";
import { CadernoEditor } from "./CadernoEditor";
import { useCadernoStore } from "@/lib/cadernoStore";
import { ensureCaderno, useCadernoDockStore } from "@/lib/cadernoDockStore";
import { cn } from "@/lib/utils";

/**
 * Caderno acoplado à tela de estudo. `variant="fixed"` = coluna fixa à direita
 * (tela de questões; o conteúdo encolhe para caber). `variant="inline"` =
 * coluna dentro do player de aula, lado a lado com o vídeo.
 */
export function CadernoDock({ variant = "fixed" }: { variant?: "fixed" | "inline" }) {
  const open = useCadernoDockStore((s) => s.open);
  const cadernoId = useCadernoDockStore((s) => s.cadernoId);
  const context = useCadernoDockStore((s) => s.context);
  const closeDock = useCadernoDockStore((s) => s.closeDock);
  const setCaderno = useCadernoDockStore((s) => s.setCaderno);
  const cadernos = useCadernoStore((s) => s.cadernos);
  const createCaderno = useCadernoStore((s) => s.createCaderno);
  const appendEntry = useCadernoStore((s) => s.appendEntry);

  const exists = cadernoId && cadernos.some((c) => c.id === cadernoId);

  useEffect(() => {
    if (open && !exists) setCaderno(ensureCaderno());
  }, [open, exists, setCaderno]);

  if (!open || !exists) return null;

  return (
    <aside
      aria-label="Caderno"
      className={cn(
        "flex flex-col bg-surface",
        variant === "fixed"
          ? "fixed z-40 inset-x-0 bottom-0 h-[55vh] border-t lg:inset-x-auto lg:right-0 lg:top-0 lg:h-auto lg:w-[380px] lg:border-t-0 lg:border-l border-border shadow-lift animate-fade-in"
          : "h-full min-h-0 border-l border-border"
      )}
    >
      <div className="flex items-center gap-2 px-4 h-14 border-b border-border shrink-0">
        <NotebookPen size={16} className="text-accent shrink-0" />
        <select
          value={cadernoId ?? ""}
          onChange={(e) => {
            if (e.target.value === "__novo") setCaderno(createCaderno("Novo caderno").id);
            else setCaderno(e.target.value);
          }}
          className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-foreground outline-none truncate"
          aria-label="Caderno aberto"
        >
          {cadernos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.titulo}
            </option>
          ))}
          <option value="__novo">+ Novo caderno</option>
        </select>
        <Link href={`/caderno?id=${cadernoId}`} title="Abrir página do Caderno" className="text-muted-foreground hover:text-foreground">
          <ExternalLink size={15} />
        </Link>
        <button type="button" onClick={closeDock} aria-label="Fechar caderno" className="text-muted-foreground hover:text-foreground">
          <X size={17} />
        </button>
      </div>

      {context && (
        <div className="px-4 pt-3 shrink-0">
          <button
            type="button"
            onClick={() => appendEntry(cadernoId!, "", context)}
            className="w-full inline-flex items-center gap-2 rounded-xl border border-dashed border-accent/40 bg-accent/5 px-3 py-2 text-left text-xs text-accent hover:bg-accent/10 transition-colors"
          >
            <Plus size={13} className="shrink-0" />
            <span className="truncate">
              Referenciar <strong>{context.label}</strong>
            </span>
            <CornerDownLeft size={12} className="ml-auto shrink-0 opacity-70" />
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 p-4 flex flex-col">
        <CadernoEditor key={cadernoId} cadernoId={cadernoId!} compact fill hideTitle />
      </div>

      <p className="px-4 pb-3 text-[11px] text-muted-foreground shrink-0">
        Dica: selecione um trecho {variant === "fixed" ? "da questão" : "do texto"} e toque em <strong>Enviar ao Caderno</strong>.
      </p>
    </aside>
  );
}
