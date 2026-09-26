import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon = Inbox,
  illustration,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  /** Ilustração maior (ver src/components/Illustrations.tsx) — quando presente, substitui o ícone em círculo. */
  illustration?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl border border-dashed border-border">
      {illustration ? (
        <div className="mb-2">{illustration}</div>
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
          <Icon size={24} className="text-muted-foreground" />
        </div>
      )}
      <h3 className="font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
