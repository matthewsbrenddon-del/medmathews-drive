import { cn } from "@/lib/utils";

export function LoadingState({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground" role="status" aria-live="polite">
      <div className="h-8 w-8 rounded-full border-2 border-border border-t-primary animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("card p-4 animate-pulse", className)}>
      <div className="h-28 rounded-xl bg-muted mb-3" />
      <div className="h-3.5 w-3/4 rounded bg-muted mb-2" />
      <div className="h-3 w-1/2 rounded bg-muted" />
    </div>
  );
}
