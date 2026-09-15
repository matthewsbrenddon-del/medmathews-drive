"use client";

import { Star } from "lucide-react";
import { useStudyStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  fileId,
  className,
  size = "md",
}: {
  fileId: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const favorite = useStudyStore((s) => s.userStates[fileId]?.favorite ?? false);
  const toggleFavorite = useStudyStore((s) => s.toggleFavorite);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(fileId);
      }}
      aria-pressed={favorite}
      aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      title={favorite ? "Remover dos favoritos" : "Favoritar"}
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-border bg-surface transition-colors hover:bg-surface-hover",
        size === "sm" ? "h-8 w-8" : "h-10 w-10",
        className
      )}
    >
      <Star
        size={size === "sm" ? 15 : 17}
        className={favorite ? "fill-warning text-warning" : "text-muted-foreground"}
      />
    </button>
  );
}
