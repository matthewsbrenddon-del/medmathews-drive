"use client";

import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export function Header({ title }: { title?: string }) {
  return (
    <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 border-b border-border bg-surface/90 backdrop-blur">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Logo size={15} />
        </div>
        <span className="font-semibold text-sm">{title ?? "MedStudy Hub"}</span>
      </div>
      <ThemeToggle />
    </header>
  );
}
