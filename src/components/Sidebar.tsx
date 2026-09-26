"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useContentStore } from "@/lib/contentStore";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export function Sidebar() {
  const pathname = usePathname();
  const hasImported = useContentStore((s) => s.hasImported);

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
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary-light text-primary"
                        : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={18} strokeWidth={2} />
                    {item.label}
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
