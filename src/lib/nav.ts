import type { LucideIcon } from "lucide-react";
import {
  BookMarked,
  BookOpen,
  Brain,
  Calendar,
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
  { href: "/disciplinas", label: "Disciplinas", icon: LayoutGrid, mobile: true, group: "Conteúdo" },
  { href: "/videoaulas", label: "Videoaulas", icon: Video, group: "Conteúdo" },
  { href: "/materiais", label: "Apostilas e Materiais", icon: BookOpen, group: "Conteúdo" },
  { href: "/questoes", label: "Questões", icon: Brain, mobile: true, group: "Prática" },
  { href: "/quizzes", label: "Quizzes com IA", icon: Sparkles, group: "Prática" },
  { href: "/flashcards", label: "Flashcards", icon: Layers, group: "Prática" },
  { href: "/cadernos", label: "Meus Cadernos", icon: BookMarked, group: "Prática" },
  { href: "/cronograma", label: "Cronograma", icon: Calendar, group: "Planejamento" },
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
