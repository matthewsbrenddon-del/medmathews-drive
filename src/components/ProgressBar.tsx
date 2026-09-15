import { cn } from "@/lib/utils";

export function ProgressBar({
  percent,
  className,
  trackClassName,
  colorToken,
  size = "md",
}: {
  percent: number;
  className?: string;
  trackClassName?: string;
  colorToken?: string;
  size?: "sm" | "md";
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("w-full overflow-hidden rounded-full bg-muted", size === "sm" ? "h-1.5" : "h-2.5", trackClassName)}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-500", !colorToken && "bg-primary", className)}
        style={{
          width: `${clamped}%`,
          backgroundColor: colorToken ? `hsl(${colorToken})` : undefined,
        }}
      />
    </div>
  );
}
