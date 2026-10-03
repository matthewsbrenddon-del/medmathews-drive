import type { LucideIcon } from "lucide-react";
import {
  ListChecks,
  NotebookPen,
  Timer,
  BookOpen,
  Brain,
  Calendar,
  CalendarDays,
  Hourglass,
  Home,
  LayoutGrid,
  Layers,
  Search,
  Settings,
  Sparkles,
  Star,
  Video,
  TrendingUp,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Exibido também no menu inferior mobile (mantido enxuto). */
  mobile?: boolean;
  group: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home, mobile: true, group: "Principal" },
  { href: "/caderno", label: "Caderno", icon: NotebookPen, group: "Principal" },
  { href: "/disciplinas", label: "Disciplinas", icon: LayoutGrid, mobile: true, group: "Conteúdo" },
  { href: "/videoaulas", label: "Videoaulas", icon: Video, group: "Conteúdo" },
  { href: "/materiais", label: "Apostilas e Materiais", icon: BookOpen, group: "Conteúdo" },
  { href: "/questoes", label: "Questões", icon: Brain, mobile: true, group: "Prática" },
  { href: "/quizzes", label: "Quizzes com IA", icon: Sparkles, group: "Prática" },
  { href: "/flashcards", label: "Flashcards", icon: Layers, group: "Prática" },
  { href: "/questoes/prova", label: "Simulado", icon: Timer, group: "Prática" },
  { href: "/listas", label: "Minhas Listas", icon: ListChecks, group: "Prática" },
  { href: "/cronograma", label: "Cronograma", icon: Calendar, group: "Planejamento" },
  { href: "/agenda", label: "Agenda", icon: CalendarDays, group: "Planejamento" },
  { href: "/foco", label: "Modo foco", icon: Hourglass, group: "Planejamento" },
  { href: "/progresso", label: "Meu Progresso", icon: TrendingUp, mobile: true, group: "Planejamento" },
  { href: "/busca", label: "Busca", icon: Search, mobile: true, group: "Geral" },
  { href: "/favoritos", label: "Favoritos", icon: Star, group: "Geral" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, group: "Geral" },
];

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Mesmos itens de NAV_ITEMS, agrupados por seção (ordem de primeira aparição) — para a Sidebar. */
export const NAV_GROUPS: NavGroup[] = NAV_ITEMS.reduce<NavGroup[]>((groups, item) => {
  let group = groups.find((g) => g.label === item.group);
  if (!group) {
    group = { label: item.group, items: [] };
    groups.push(group);
  }
  group.items.push(item);
  return groups;
}, []);

/** Item ativo = o href mais específico que casa com a rota (ex.: em
 * /questoes/prova, "Simulado" fica ativo e "Questões" não). */
export function isNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  const matches = (h: string) => pathname === h || pathname.startsWith(h + "/");
  if (!matches(href)) return false;
  return !NAV_ITEMS.some((item) => item.href !== href && item.href.length > href.length && matches(item.href));
}
