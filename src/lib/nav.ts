import type { LucideIcon } from "lucide-react";
import { BookOpen, Home, LayoutGrid, Search, Settings, Star, Video, TrendingUp } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Exibido também no menu inferior mobile (mantido enxuto). */
  mobile?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home, mobile: true },
  { href: "/disciplinas", label: "Disciplinas", icon: LayoutGrid, mobile: true },
  { href: "/videoaulas", label: "Videoaulas", icon: Video, mobile: true },
  { href: "/materiais", label: "Apostilas e Materiais", icon: BookOpen },
  { href: "/busca", label: "Busca", icon: Search, mobile: true },
  { href: "/progresso", label: "Meu Progresso", icon: TrendingUp },
  { href: "/favoritos", label: "Favoritos", icon: Star },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];
