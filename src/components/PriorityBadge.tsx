import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

/** Indicador visual da prioridade (1–5) definida na planilha — usada pelo cronograma adaptativo. */
export function PriorityBadge({ priority, className }: { priority: number; className?: string }) {
  const clamped = Math.min(5, Math.max(1, priority));
  const label = clamped >= 4 ? "Alta prioridade" : clamped === 3 ? "Prioridade média" : "Baixa prioridade";

  return (
    <span
      title={`${label} (${clamped}/5)`}
      className={cn(
        "inline-flex items-center gap-0.5 font-metric text-xs",
        clamped >= 4 ? "text-danger" : clamped === 3 ? "text-warning" : "text-muted-foreground",
        className
      )}
    >
      <Flame size={11} className={clamped >= 4 ? "fill-current" : undefined} />
      {clamped}
    </span>
  );
}
