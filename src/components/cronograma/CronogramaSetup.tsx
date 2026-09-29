"use client";

import { Fragment, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
  Plus,
  Search as SearchIcon,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import type { ClassifiedFile } from "@/lib/classification";
import {
  TIPOS_MATERIAL,
  buildCronograma,
  type CronogramaConfig,
  type Prioridade,
  type TemaInfo,
} from "@/lib/cronograma";
import { addDaysIso, diffInDays, todayIso } from "@/lib/dateUtil";
import { KNOWN_SUBJECTS } from "@/lib/subjects";
import type { ContentProgress, Question, QuestionProgress } from "@/lib/types";
import { cn, normalizeText } from "@/lib/utils";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const STEPS = [
  { id: 0, label: "Período", icon: CalendarRange },
  { id: 1, label: "Disponibilidade", icon: Clock },
  { id: 2, label: "Conteúdo", icon: Layers },
  { id: 3, label: "Estratégia", icon: Settings2 },
];

export function fmtHoras(min: number): string {
  if (min <= 0) return "0h";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h === 0 ? `${m}min` : m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

function fmtDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function CronogramaSetup({
  initial,
  catalog,
  files,
  userStates,
  questions,
  questionProgress,
  onSave,
  onCancel,
}: {
  initial: CronogramaConfig;
  catalog: Map<string, TemaInfo[]>;
  files: ClassifiedFile[];
  userStates: Record<string, ContentProgress>;
  questions: Question[];
  questionProgress: Record<string, QuestionProgress>;
  onSave: (config: CronogramaConfig) => void;
  onCancel?: () => void;
}) {
  const [cfg, setCfg] = useState<CronogramaConfig>(initial);
  const [step, setStep] = useState(0);
  const [openArea, setOpenArea] = useState<string | null>(null);
  const [temaSearch, setTemaSearch] = useState("");
  const [folgaDraft, setFolgaDraft] = useState("");

  const update = (patch: Partial<CronogramaConfig>) => setCfg((c) => ({ ...c, ...patch }));

  const preview = useMemo(
    () => buildCronograma({ config: cfg, files, userStates, questions, questionProgress }),
    [cfg, files, userStates, questions, questionProgress]
  );

  const cursosDisponiveis = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of files) if (f.tema && f.tipo !== "Imagem de questão") counts.set(f.curso, (counts.get(f.curso) ?? 0) + 1);
    return Array.from(counts.entries())
      .filter(([c]) => !c.startsWith("PROVAS"))
      .sort((a, b) => b[1] - a[1]);
  }, [files]);

  const totalTemas = Object.values(cfg.areas).reduce((n, a) => n + a.temas.length, 0);
  const semanas = Math.max(1, Math.round((diffInDays(cfg.inicio, cfg.fim) + 1) / 7));
  const minutosSemana = cfg.minutosPorDia.reduce((a, b) => a + b, 0);
  const coverage = preview.totalConteudoMin > 0 ? Math.min(100, Math.round(((preview.totalConteudoMin - preview.sobra.minutos) / preview.totalConteudoMin) * 100)) : 0;

  function setArea(slug: string, patch: Partial<{ prioridade: Prioridade; temas: string[] }>) {
    const current = cfg.areas[slug] ?? { prioridade: 2 as Prioridade, temas: [] };
    update({ areas: { ...cfg.areas, [slug]: { ...current, ...patch } } });
  }

  function toggleTema(slug: string, tema: string) {
    const current = cfg.areas[slug]?.temas ?? [];
    setArea(slug, { temas: current.includes(tema) ? current.filter((t) => t !== tema) : [...current, tema] });
  }

  const canSave = totalTemas > 0 && minutosSemana > 0 && cfg.fim > cfg.inicio;

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="flex flex-col gap-5 min-w-0">
        {/* Stepper */}
        <div className="grid grid-cols-4 gap-2">
          {STEPS.map((s) => {
            const active = step === s.id;
            const done = step > s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                  active ? "border-primary bg-primary-light text-primary font-semibold" : done ? "border-success/40 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "h-7 w-7 shrink-0 rounded-full inline-flex items-center justify-center text-xs",
                    active ? "bg-primary text-primary-foreground" : done ? "bg-success/15 text-success" : "bg-muted"
                  )}
                >
                  {done ? <Check size={14} /> : <s.icon size={14} />}
                </span>
                <span className="hidden sm:block truncate">{s.label}</span>
              </button>
            );
          })}
        </div>

        {step === 0 && (
          <section className="card p-6 flex flex-col gap-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Para qual período?</h2>
              <p className="text-sm text-muted-foreground">Uma prova, um rodízio, um bloco de revisão — o cronograma cabe exatamente nesse intervalo.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Início</span>
                <input type="date" value={cfg.inicio} onChange={(e) => update({ inicio: e.target.value })} className="input" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Fim (data da prova ou meta)</span>
                <input type="date" value={cfg.fim} min={cfg.inicio} onChange={(e) => update({ fim: e.target.value })} className="input" />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {[14, 30, 60, 90, 120, 180].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => update({ fim: addDaysIso(cfg.inicio, n - 1) })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm",
                    diffInDays(cfg.inicio, cfg.fim) + 1 === n ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {n} dias
                </button>
              ))}
              <button type="button" onClick={() => update({ inicio: todayIso() })} className="rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground hover:text-foreground">
                Começar hoje
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              {fmtDate(cfg.inicio)} → {fmtDate(cfg.fim)} · <strong className="text-foreground font-metric">{semanas}</strong> semanas
            </p>
          </section>
        )}

        {step === 1 && (
          <section className="card p-6 flex flex-col gap-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Quanto tempo por dia?</h2>
              <p className="text-sm text-muted-foreground">Ajuste cada dia da semana ao seu momento: plantões, aulas, fim de semana.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Intensivo", v: [360, 360, 360, 360, 360, 240, 120] },
                { label: "Moderado", v: [180, 180, 180, 180, 180, 120, 0] },
                { label: "Leve", v: [90, 90, 90, 90, 90, 60, 0] },
                { label: "Só fim de semana", v: [0, 0, 0, 0, 0, 300, 240] },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => update({ minutosPorDia: p.v })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm",
                    JSON.stringify(cfg.minutosPorDia) === JSON.stringify(p.v) ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2.5">
              {WEEKDAYS.map((d, i) => (
                <div key={d} className="grid grid-cols-[44px_1fr_64px] items-center gap-3">
                  <span className="text-sm font-medium text-foreground">{d}</span>
                  <input
                    type="range"
                    min={0}
                    max={600}
                    step={30}
                    value={cfg.minutosPorDia[i]}
                    onChange={(e) => {
                      const next = [...cfg.minutosPorDia];
                      next[i] = Number(e.target.value);
                      update({ minutosPorDia: next });
                    }}
                    className="accent-[hsl(var(--primary))]"
                    aria-label={`Minutos de estudo — ${d}`}
                  />
                  <span className={cn("font-metric text-sm text-right", cfg.minutosPorDia[i] === 0 ? "text-muted-foreground" : "text-foreground")}>
                    {cfg.minutosPorDia[i] === 0 ? "folga" : fmtHoras(cfg.minutosPorDia[i])}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground font-metric">{fmtHoras(minutosSemana)}</strong> por semana
            </p>
            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground mb-2">Folgas e dias sem estudo (plantão, viagem, feriado)</p>
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" value={folgaDraft} min={cfg.inicio} max={cfg.fim} onChange={(e) => setFolgaDraft(e.target.value)} className="input w-auto py-1.5 text-sm" />
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  disabled={!folgaDraft || cfg.folgas.includes(folgaDraft)}
                  onClick={() => {
                    update({ folgas: [...cfg.folgas, folgaDraft].sort() });
                    setFolgaDraft("");
                  }}
                >
                  <Plus size={13} /> Adicionar folga
                </button>
                {cfg.folgas.map((f) => (
                  <span key={f} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground">
                    {new Date(`${f}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    <button type="button" onClick={() => update({ folgas: cfg.folgas.filter((x) => x !== f) })} aria-label="Remover folga">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="flex flex-col gap-3">
            <div className="card p-5">
              <h2 className="text-lg font-semibold text-foreground">O que entra no cronograma?</h2>
              <p className="text-sm text-muted-foreground">
                Escolha as grandes áreas, a prioridade de cada uma e os temas específicos. Os temas vêm do seu acervo e estão
                ordenados pelos mais cobrados no banco de questões.
              </p>
              <div className="relative mt-3">
                <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={temaSearch} onChange={(e) => setTemaSearch(e.target.value)} placeholder="Buscar tema em todas as áreas…" className="input pl-9 py-2 text-sm" />
              </div>
            </div>
            {KNOWN_SUBJECTS.map((s) => {
              const temas = catalog.get(s.slug) ?? [];
              const area = cfg.areas[s.slug];
              const selected = area?.temas ?? [];
              const q = normalizeText(temaSearch.trim());
              const visible = q ? temas.filter((t) => normalizeText(t.tema).includes(q)) : temas;
              const open = openArea === s.slug || (q.length > 0 && visible.length > 0);
              if (q && visible.length === 0) return null;
              return (
                <div key={s.slug} className="card overflow-hidden">
                  <div className="flex flex-wrap items-center gap-3 px-5 py-4" style={{ borderLeft: `4px solid hsl(${s.colorToken})` }}>
                    <button type="button" onClick={() => setOpenArea(open ? null : s.slug)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                      {open ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                      <span className="font-semibold text-foreground">{s.name}</span>
                      <span className="text-xs text-muted-foreground font-metric">
                        {selected.length}/{temas.length} temas
                      </span>
                    </button>
                    <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
                      {([1, 2, 3] as Prioridade[]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setArea(s.slug, { prioridade: p })}
                          className={cn("px-2.5 py-1 rounded-md", (area?.prioridade ?? 2) === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                        >
                          {p === 1 ? "Baixa" : p === 2 ? "Média" : "Alta"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {open && (
                    <div className="border-t border-border px-5 py-3">
                      <div className="flex flex-wrap gap-3 text-xs mb-2">
                        <button type="button" className="text-primary hover:underline" onClick={() => setArea(s.slug, { temas: temas.map((t) => t.tema) })}>
                          Marcar todos
                        </button>
                        <button type="button" className="text-primary hover:underline" onClick={() => setArea(s.slug, { temas: temas.filter((t) => !t.geral).slice(0, 15).map((t) => t.tema) })}>
                          15 mais cobrados
                        </button>
                        <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setArea(s.slug, { temas: [] })}>
                          Limpar
                        </button>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-1 max-h-[360px] overflow-y-auto">
                        {visible.map((t, i) => {
                          const checked = selected.includes(t.tema);
                          const firstGeral = t.geral && (i === 0 || !visible[i - 1].geral);
                          return (
                            <Fragment key={t.tema}>
                            {firstGeral && (
                              <p className="sm:col-span-2 mt-2 px-2.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                                Blocos amplos (especialidade inteira ou módulo do curso)
                              </p>
                            )}
                            <button
                              key={t.tema}
                              type="button"
                              role="checkbox"
                              aria-checked={checked}
                              onClick={() => toggleTema(s.slug, t.tema)}
                              className={cn("flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors", checked ? "bg-primary-light" : "hover:bg-surface-hover")}
                            >
                              <span
                                className={cn(
                                  "mt-0.5 h-4 w-4 shrink-0 rounded-[5px] border inline-flex items-center justify-center",
                                  checked ? "bg-primary border-primary text-primary-foreground" : "border-border"
                                )}
                              >
                                {checked && <Check size={11} strokeWidth={3} />}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm text-foreground truncate">{t.tema}</span>
                                <span className="block text-[11px] text-muted-foreground font-metric">
                                  {t.aulas} aulas · {t.materiais} materiais · {t.questoes} questões · {t.cursos.length} {t.cursos.length === 1 ? "curso" : "cursos"}
                                </span>
                              </span>
                            </button>
                            </Fragment>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {step === 3 && (
          <section className="card p-6 flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Como estudar</h2>
              <p className="text-sm text-muted-foreground">Fontes, tipos de material e a mistura de cada dia.</p>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Cursos {cfg.cursos.length === 0 && <span className="text-muted-foreground font-normal">(todos)</span>}</p>
              <div className="flex flex-wrap gap-2">
                {cursosDisponiveis.map(([c, n]) => {
                  const active = cfg.cursos.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => update({ cursos: active ? cfg.cursos.filter((x) => x !== c) : [...cfg.cursos, c] })}
                      className={cn("rounded-full border px-3 py-1 text-xs", active ? "border-primary bg-primary-light text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground")}
                    >
                      {c} <span className="font-metric opacity-70">{n}</span>
                    </button>
                  );
                })}
              </div>
              <label className="mt-3 flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={cfg.umCursoPorTema} onChange={(e) => update({ umCursoPorTema: e.target.checked })} className="mt-1 accent-[hsl(var(--primary))]" />
                <span>
                  <span className="text-sm text-foreground">Um curso por tema</span>
                  <span className="block text-xs text-muted-foreground">Para cada tema, usa só o curso com mais aulas dele — evita assistir o mesmo assunto várias vezes.</span>
                </span>
              </label>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Tipos de material</p>
              <div className="flex flex-wrap gap-2">
                {TIPOS_MATERIAL.map((t) => {
                  const active = cfg.tipos.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => update({ tipos: active ? cfg.tipos.filter((x) => x !== t) : [...cfg.tipos, t] })}
                      className={cn("rounded-full border px-3 py-1 text-xs", active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground")}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-3">Mistura de cada dia</p>
              {(["aulas", "questoes", "revisao"] as const).map((k) => (
                <div key={k} className="grid grid-cols-[110px_1fr_48px] items-center gap-3 mb-2">
                  <span className="text-sm text-foreground">{k === "aulas" ? "Aulas e leitura" : k === "questoes" ? "Questões" : "Revisão"}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={cfg.mix[k]}
                    onChange={(e) => update({ mix: { ...cfg.mix, [k]: Number(e.target.value) } })}
                    className="accent-[hsl(var(--primary))]"
                  />
                  <span className="font-metric text-sm text-right text-foreground">
                    {Math.round((cfg.mix[k] / Math.max(1, cfg.mix.aulas + cfg.mix.questoes + cfg.mix.revisao)) * 100)}%
                  </span>
                </div>
              ))}
              <div className="flex h-2 rounded-full overflow-hidden mt-2">
                <span className="bg-primary" style={{ flex: cfg.mix.aulas }} />
                <span className="bg-accent" style={{ flex: cfg.mix.questoes }} />
                <span className="bg-success" style={{ flex: cfg.mix.revisao }} />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Ordem dos temas</p>
                <div className="inline-flex rounded-xl border border-border p-0.5 text-sm">
                  {(["intercalado", "sequencial"] as const).map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => update({ ordem: o })}
                      className={cn("px-3 py-1.5 rounded-lg", cfg.ordem === o ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                    >
                      {o === "intercalado" ? "Intercalar áreas" : "Uma área por vez"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {cfg.ordem === "intercalado" ? "Alterna as áreas (as de prioridade alta aparecem mais) — melhor retenção." : "Termina uma área antes de começar a próxima."}
                </p>
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={cfg.revisaoEspacada} onChange={(e) => update({ revisaoEspacada: e.target.checked })} className="mt-1 accent-[hsl(var(--primary))]" />
                <span>
                  <span className="text-sm text-foreground">Revisão espaçada</span>
                  <span className="block text-xs text-muted-foreground">Revisa cada tema 1, 7 e 30 dias depois de terminá-lo.</span>
                </span>
              </label>
            </div>
          </section>
        )}

        <div className="flex items-center justify-between">
          <button type="button" className="btn-ghost" onClick={() => (step === 0 ? onCancel?.() : setStep(step - 1))} disabled={step === 0 && !onCancel}>
            {step === 0 ? "Cancelar" : "Voltar"}
          </button>
          {step < 3 ? (
            <button type="button" className="btn-primary" onClick={() => setStep(step + 1)}>
              Continuar <ChevronRight size={15} />
            </button>
          ) : (
            <button type="button" className="btn-primary" disabled={!canSave} onClick={() => onSave({ ...cfg, active: true })}>
              <Sparkles size={15} /> Gerar cronograma
            </button>
          )}
        </div>
      </div>

      {/* Resumo ao vivo */}
      <aside className="card p-5 flex flex-col gap-4 lg:sticky lg:top-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumo</p>
        <div className="flex flex-col gap-2 text-sm">
          <Row label="Período" value={`${semanas} semanas`} />
          <Row label="Disponível" value={fmtHoras(preview.disponivelMin)} />
          <Row label="Temas" value={String(totalTemas)} />
          <Row label="Conteúdo escolhido" value={fmtHoras(preview.totalConteudoMin)} />
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Cabe no período</span>
            <span className={cn("font-metric", coverage >= 100 ? "text-success" : coverage >= 70 ? "text-warning" : "text-danger")}>{totalTemas ? `${coverage}%` : "—"}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className={cn("h-full rounded-full", coverage >= 100 ? "bg-success" : coverage >= 70 ? "bg-warning" : "bg-danger")} style={{ width: `${coverage}%` }} />
          </div>
          {preview.sobra.itens > 0 && totalTemas > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Ficam de fora {preview.sobra.itens} itens ({fmtHoras(preview.sobra.minutos)}). Aumente o tempo diário, estenda o período, use
              &quot;um curso por tema&quot; ou reduza os tipos de material.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BookOpen size={13} /> Aulas do seu acervo + questões do banco
        </div>
        <button type="button" className="btn-primary w-full" disabled={!canSave} onClick={() => onSave({ ...cfg, active: true })}>
          <Sparkles size={15} /> Gerar cronograma
        </button>
        {!canSave && <p className="text-[11px] text-muted-foreground">Escolha pelo menos um tema e algum tempo de estudo na semana.</p>}
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-metric text-foreground">{value}</span>
    </div>
  );
}
