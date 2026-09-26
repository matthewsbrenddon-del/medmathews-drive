export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(baseIso: string, days: number): string {
  const d = new Date(`${baseIso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffInDays(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00`).getTime();
  const to = new Date(`${toIso}T00:00:00`).getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

export function formatDayLabel(iso: string): string {
  const diff = diffInDays(todayIso(), iso);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

/** Segunda-feira da semana que contém `iso` (semana começa na segunda, como no calendário brasileiro). */
export function startOfWeekIso(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const day = d.getDay(); // 0=dom, 1=seg, ..., 6=sáb
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function formatWeekdayShort(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}

export function formatDayNum(iso: string): string {
  return String(new Date(`${iso}T00:00:00`).getDate());
}

export function formatWeekRangeLabel(startIso: string, endIso: string): string {
  const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return `${fmt(startIso)} – ${fmt(endIso)}`;
}
