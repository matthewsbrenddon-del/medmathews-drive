import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardCard({
  icon: Icon,
  label,
  value,
  sublabel,
  accentToken,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sublabel?: string;
  accentToken?: string;
  className?: string;
}) {
  return (
    <div className={cn("card p-5 flex items-start justify-between gap-4", className)}>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold text-foreground mt-1.5">{value}</p>
        {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
      </div>
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{
          backgroundColor: `hsl(${accentToken ?? "217 65% 30%"} / 0.12)`,
          color: `hsl(${accentToken ?? "217 65% 30%"})`,
        }}
      >
        <Icon size={20} />
      </div>
    </div>
  );
}
