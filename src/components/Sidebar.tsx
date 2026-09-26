"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame } from "lucide-react";
import { NAV_GROUPS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useContent } from "@/lib/content";
import { useContentStore } from "@/lib/contentStore";
import { useStudyStore } from "@/lib/store";
import { useQuestionProgressStore } from "@/lib/questionProgressStore";
import { useNotebookStore } from "@/lib/notebookStore";
import { useLibraryStore } from "@/lib/libraryStore";
import { useClassificationStore } from "@/lib/classificationStore";
import { classifyLibrary } from "@/lib/classification";
import { computeOverallProgress } from "@/lib/progress";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "E";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Sidebar() {
  const pathname = usePathname();
  const hasImported = useContentStore((s) => s.hasImported);

  const content = useContent();
  const userStates = useStudyStore((s) => s.userStates);
  const studentName = useStudyStore((s) => s.studentName);
  const streak = useStudyStore((s) => s.currentStreak());
  const overall = useMemo(() => computeOverallProgress(content, userStates), [content, userStates]);

  const questionFavoritesCount = useQuestionProgressStore(
    (s) => Object.values(s.progress).filter((p) => p.favorite).length
  );
  const contentFavoritesCount = useMemo(
    () => Object.values(userStates).filter((s) => s.favorite).length,
    [userStates]
  );
  const notebooksCount = useNotebookStore((s) => s.notebooks.length);

  const libraryFiles = useLibraryStore((s) => s.files);
  const classificationOverrides = useClassificationStore((s) => s.overrides);
  const unclassifiedCount = useMemo(() => {
    if (libraryFiles.length === 0) return 0;
    return classifyLibrary(libraryFiles, classificationOverrides).filter((f) => !f.subjectSlug).length;
  }, [libraryFiles, classificationOverrides]);

  const badges: Record<string, number> = {
    "/disciplinas": unclassifiedCount,
    "/cadernos": notebooksCount,
    "/favoritos": contentFavoritesCount + questionFavoritesCount,
  };

  const displayName = studentName.trim() || "Estudante";

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-border bg-surface">
      <div className="flex items-center gap-2.5 px-6 h-16 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Logo size={19} />
        </div>
        <div>
          <p className="font-semibold leading-tight text-foreground">MedStudy Hub</p>
          <p className="text-[11px] text-muted-foreground leading-tight">Biblioteca de estudos</p>
        </div>
      </div>

      <Link
        href="/configuracoes"
        className="flex items-center gap-3 px-4 py-3.5 border-b border-border hover:bg-surface-hover transition-colors"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent font-semibold text-sm">
          {initials(displayName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
          <div className="flex items-center gap-2.5 mt-0.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-metric text-warning">
              <Flame size={11} className={streak > 0 ? "fill-warning" : ""} />
              {streak}
            </span>
            <span className="text-[11px] font-metric text-muted-foreground">{overall.percent}% concluído</span>
          </div>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-5" aria-label="Navegação principal">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                const Icon = item.icon;
                const badge = badges[item.href] ?? 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary-light text-primary"
                        : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-primary" />}
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                        active ? "bg-primary/15 text-primary" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    >
                      <Icon size={16} strokeWidth={2} />
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {badge > 0 && (
                      <span
                        className={cn(
                          "shrink-0 rounded-full text-[10px] font-medium font-metric px-1.5 py-0.5 leading-none",
                          item.href === "/disciplinas" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex items-center justify-between px-4 py-4 border-t border-border">
        <p className="text-xs text-muted-foreground">{hasImported ? "Biblioteca importada" : "Dados de exemplo"}</p>
        <ThemeToggle />
      </div>
    </aside>
  );
}
