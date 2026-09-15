import { Check, CircleDashed, Clock } from "lucide-react";
import type { ReadStatus, WatchStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const WATCH_LABEL: Record<WatchStatus, string> = {
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  assistida: "Assistida",
};

const READ_LABEL: Record<ReadStatus, string> = {
  nao_acessado: "Não acessado",
  acessado: "Acessado",
  estudado: "Estudado",
};

function styleFor(status: string) {
  if (status === "assistida" || status === "estudado") {
    return "bg-success/10 text-success border-success/20";
  }
  if (status === "em_andamento" || status === "acessado") {
    return "bg-warning/10 text-warning border-warning/25";
  }
  return "bg-muted text-muted-foreground border-transparent";
}

function iconFor(status: string) {
  if (status === "assistida" || status === "estudado") return Check;
  if (status === "em_andamento" || status === "acessado") return Clock;
  return CircleDashed;
}

export function StatusBadge({
  status,
  kind,
  className,
}: {
  status: WatchStatus | ReadStatus;
  kind: "watch" | "read";
  className?: string;
}) {
  const label = kind === "watch" ? WATCH_LABEL[status as WatchStatus] : READ_LABEL[status as ReadStatus];
  const Icon = iconFor(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        styleFor(status),
        className
      )}
    >
      <Icon size={12} />
      {label}
    </span>
  );
}
