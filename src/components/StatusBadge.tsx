import { Check, CircleDashed, Clock, X } from "lucide-react";
import type { QuestionStatus, ReadStatus, WatchStatus } from "@/lib/types";
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

const QUESTION_LABEL: Record<QuestionStatus, string> = {
  nao_respondida: "Não respondida",
  acertada: "Acertada",
  errada: "Errada",
};

function styleFor(status: string) {
  if (status === "assistida" || status === "estudado" || status === "acertada") {
    return "bg-success/10 text-success border-success/20";
  }
  if (status === "em_andamento" || status === "acessado") {
    return "bg-warning/10 text-warning border-warning/25";
  }
  if (status === "errada") {
    return "bg-danger/10 text-danger border-danger/20";
  }
  return "bg-muted text-muted-foreground border-transparent";
}

function iconFor(status: string) {
  if (status === "assistida" || status === "estudado" || status === "acertada") return Check;
  if (status === "em_andamento" || status === "acessado") return Clock;
  if (status === "errada") return X;
  return CircleDashed;
}

export function StatusBadge({
  status,
  kind,
  className,
}: {
  status: WatchStatus | ReadStatus | QuestionStatus;
  kind: "watch" | "read" | "question";
  className?: string;
}) {
  const label =
    kind === "watch"
      ? WATCH_LABEL[status as WatchStatus]
      : kind === "read"
        ? READ_LABEL[status as ReadStatus]
        : QUESTION_LABEL[status as QuestionStatus];
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
