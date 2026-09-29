"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  FileText,
  Loader2,
  Pencil,
  PlayCircle,
  Power,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";
import { CronogramaSetup, fmtHoras } from "@/components/cronograma/CronogramaSetup";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { LoadingState } from "@/components/LoadingState";
import { classifyLibrary, type ClassifiedFile } from "@/lib/classification";
import { useClassificationStore } from "@/lib/classificationStore";
import {
  buildCronograma,
  buildTemaCatalog,
  questoesHref,
  useCronogramaStore,
  type CronoItem,
  type CronoPlan,
} from "@/lib/cronograma";
import { addDaysIso, diffInDays, formatWeekRangeLabel, startOfWeekIso, todayIso } from "@/lib/dateUtil";
import { isFileComplete } from "@/lib/library";
import { useLibraryStore } from "@/lib/libraryStore";
import { useQuestionProgressStore } from "@/lib/questionProgressStore";
import { useQuestionStore, useQuestionsReady } from "@/lib/questionStore";
import { useStudyStore } from "@/lib/store";
import { resolveSubject } from "@/lib/subjects";
import type { LibraryFile } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<CronoItem["kind"], typeof PlayCircle> = {
  aula: PlayCircle,
  material: FileText,
  questoes: Target,
  revisao: RotateCcw,
};

export default function CronogramaPage() {
  const files = useLibraryStore((s) => s.files);
  const libStatus = useLibraryStore((s) => s.status);
  const hydrate = useLibraryStore((s) => s.hydrate);
  const overrides = useClassificationStore((s) => s.overrides);
  const questions = useQuestionStore((s) => s.questions);
  const questionsReady = useQuestionsReady();
  const questionProgress = useQuestionProgressStore((s) => s.progress);
  const userStates = useStudyStore((s) => s.userStates);
  const config = useCronogramaStore((s) => s.config);
  const setConfig = useCronogramaStore((s) => s.setConfig);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const classified = useMemo(() => classifyLibrary(files, overrides), [files, overrides]);
  const catalog = useMemo(() => buildTemaCatalog(classified, questions), [classified, questions]);

  if (libStatus !== "ready" && libStatus !== "error") return <LoadingState label="Carregando seu acervo..." />;
  if (!questionsReady) return <LoadingState label="Carregando o banco de questões..." />;

  if (!config.active || editing) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground inline-flex items-center gap-2.5">
            <CalendarDays size={22} className="text-accent" /> {config.active ? "Ajustar cronograma" : "Monte seu cronograma"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Do seu jeito: período, horas de cada dia, as grandes áreas e os temas exatos que você quer estudar agora.
          </p>
        </div>
        <CronogramaSetup
          initial={config}
          catalog={catalog}
          files={classified}
          userStates={userStates}
          questions={questions}
          questionProgress={questionProgress}
          onCancel={config.active ? () => setEditing(false) : undefined}
          onSave={(c) => {
            setConfig(c);
            setEditing(false);
          }}
        />
      </div>
    );
  }

  return <PlanView files={classified} onEdit={() => setEditing(true)} />;
}

function PlanView({ files, onEdit }: { files: ClassifiedFile[]; onEdit: () => void }) {
  const router = useRouter();
  const config = useCronogramaStore((s) => s.config);
  const feitos = useCronogramaStore((s) => s.feitos);
  const toggleFeito = useCronogramaStore((s) => s.toggleFeito);
  const deactivate = useCronogramaStore((s) => s.deactivate);
  const questions = useQuestionStore((s) => s.questions);
  const questionProgress = useQuestionProgressStore((s) => s.progress);
  const userStates = useStudyStore((s) => s.userStates);

  const plan = useMemo<CronoPlan>(
    () => buildCronograma({ config, files, userStates, questions, questionProgress }),
    [config, files, userStates, questions, questionProgress]
  );

  const today = todayIso();
  const [weekStart, setWeekStart] = useState(() => startOfWeekIso(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [preview, setPreview] = useState<{ file: LibraryFile; playlist: LibraryFile[] } | null>(null);
  const [aiDays, setAiDays] = useState<Map<string, { items: CronoItem[]; notes: Record<string, string> }> | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const daysByDate = useMemo(() => new Map(plan.days.map((d) => [d.date, d])), [plan.days]);
  const itemsFor = (date: string): CronoItem[] => {
    const ai = aiDays?.get(date);
    const items = ai ? ai.items : daysByDate.get(date)?.items ?? [];
    return items.filter((i) => i.kind !== "revisao" || !feitos[i.key]);
  };
  const weekDates = Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i));
  const todayItems = itemsFor(selectedDate);
  const selectedDay = daysByDate.get(selectedDate);
  const coverage = plan.totalConteudoMin > 0 ? Math.round(((plan.totalConteudoMin - plan.sobra.minutos) / plan.totalConteudoMin) * 100) : 100;
  const diasRestantes = Math.max(0, diffInDays(today, config.fim) + 1);
  const questoesPrevistas = plan.days.reduce((s, d) => s + d.items.reduce((a, i) => a + (i.questionCount ?? 0), 0), 0);

  const timeline = useMemo(() => {
    return Array.from(plan.terminoPorTema.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .slice(0, 40);
  }, [plan.terminoPorTema]);

  function openItem(item: CronoItem, dayItems: CronoItem[]) {
    if (item.file) {
      const playlist = dayItems.filter((i) => i.file).map((i) => i.file!) as LibraryFile[];
      setPreview({ file: item.file, playlist });
      return;
    }
    if (item.kind === "questoes") {
      router.push(questoesHref(item.tema, item.questionCount ?? 10));
      return;
    }
    // Revisão: abre o resumo/mapa mental do tema, se houver.
    const resumo =
      files.find((f) => f.tema === item.tema && (f.tipo === "Resumo" || f.tipo === "Mapa mental")) ??
      files.find((f) => f.tema === item.tema && f.tipo === "Pílula");
    if (resumo) setPreview({ file: resumo, playlist: [resumo] });
    else router.push(questoesHref(item.tema, 10));
  }

  async function otimizarComIA() {
    setAiLoading(true);
    setAiError(null);
    try {
      const horizon = plan.days.filter((d) => d.date >= today).slice(0, 14);
      const all = horizon.flatMap((d) => d.items);
      const byKey = new Map(all.map((i) => [i.key, i]));
      const res = await fetch("/api/ai/cronograma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itensPendentes: all.map((i) => ({
            key: i.key,
            title: `${i.title} [${i.kind}]`,
            subjectName: resolveSubject(i.areaSlug).name,
            estimatedMinutes: i.minutes,
            priority: (config.areas[i.areaSlug]?.prioridade ?? 2) + 2,
          })),
          desempenhoPorTema: [],
          dataAlvo: horizon[horizon.length - 1]?.date ?? config.fim,
          disponibilidadeDiaria: Math.round(horizon.reduce((s, d) => s + d.budget, 0) / Math.max(1, horizon.filter((d) => d.budget > 0).length)),
          itensConcluidos: 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiError(data.error ?? "Não foi possível otimizar com IA agora.");
        return;
      }
      const map = new Map<string, { items: CronoItem[]; notes: Record<string, string> }>();
      for (const d of data.dias as { data: string; itens: { key: string; justificativa?: string }[] }[]) {
        const items: CronoItem[] = [];
        const notes: Record<string, string> = {};
        for (const it of d.itens) {
          const found = byKey.get(it.key);
          if (found) {
            items.push(found);
            if (it.justificativa) notes[it.key] = it.justificativa;
          }
        }
        if (items.length) map.set(d.data, { items, notes });
      }
      if (map.size === 0) setAiError("A IA não devolveu um plano utilizável. Tente novamente.");
      else setAiDays(map);
    } catch {
      setAiError("Não foi possível conectar à IA agora.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground inline-flex items-center gap-2.5">
            <CalendarDays size={22} className="text-accent" /> Meu cronograma
          </h1>
          <p className="text-muted-foreground mt-1">
            {new Date(`${config.inicio}T12:00:00`).toLocaleDateString("pt-BR")} → {new Date(`${config.fim}T12:00:00`).toLocaleDateString("pt-BR")} ·{" "}
            {plan.temasTotal} temas · recalcula sozinho conforme você conclui as aulas
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline btn-sm" onClick={onEdit}>
            <Pencil size={13} /> Ajustar
          </button>
          {aiDays ? (
            <button type="button" className="btn-outline btn-sm" onClick={() => setAiDays(null)}>
              <RotateCcw size={13} /> Voltar ao plano automático
            </button>
          ) : (
            <button type="button" className="btn-outline btn-sm" onClick={otimizarComIA} disabled={aiLoading}>
              {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} className="text-accent" />} Otimizar 14 dias com IA
            </button>
          )}
          <button type="button" className="btn-ghost btn-sm text-muted-foreground" onClick={deactivate} title="Desativar cronograma">
            <Power size={13} />
          </button>
        </div>
      </div>

      {aiError && <p className="text-sm text-danger">{aiError}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Faltam" value={`${diasRestantes} dias`} hint={`${fmtHoras(plan.disponivelMin)} de estudo planejado`} />
        <Stat label="Temas concluídos" value={`${plan.temasConcluidos}/${plan.temasTotal}`} hint="conteúdo de todos os cursos escolhidos" />
        <Stat label="Conteúdo que cabe" value={`${Math.min(100, coverage)}%`} hint={`${fmtHoras(plan.totalConteudoMin)} de aulas e leituras`} tone={coverage >= 100 ? "success" : coverage >= 70 ? "warning" : "danger"} />
        <Stat label="Questões previstas" value={questoesPrevistas.toLocaleString("pt-BR")} hint="dos temas que você acabou de estudar" />
      </div>

      {plan.sobra.itens > 0 && (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-start gap-2 text-foreground">
            <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
            {plan.sobra.itens} itens ({fmtHoras(plan.sobra.minutos)}) não cabem até o fim do período. Aumente cerca de{" "}
            {fmtHoras(Math.ceil(plan.sobra.minutos / Math.max(1, plan.days.filter((d) => d.budget > 0).length)))} por dia de estudo, estenda a data
            ou reduza temas/tipos de material.
          </span>
          <button type="button" className="btn-outline btn-sm" onClick={onEdit}>
            Ajustar
          </button>
        </div>
      )}

      <div className="grid xl:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          {/* Semana */}
          <div className="flex items-center justify-between">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setWeekStart(addDaysIso(weekStart, -7))} aria-label="Semana anterior">
              <ChevronLeft size={16} />
            </button>
            <p className="text-sm font-semibold text-foreground">{formatWeekRangeLabel(weekDates[0], weekDates[6])}</p>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setWeekStart(addDaysIso(weekStart, 7))} aria-label="Próxima semana">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {weekDates.map((date) => {
              const day = daysByDate.get(date);
              const items = itemsFor(date);
              const isToday = date === today;
              const isSel = date === selectedDate;
              const past = date < today;
              const off = !day || day.budget === 0;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-2xl border p-2 text-left min-h-[180px] transition-colors",
                    isSel ? "border-primary bg-primary-light/60" : "border-border bg-surface hover:border-primary/40",
                    past && !isSel && "opacity-50"
                  )}
                >
                  <div className="flex items-baseline justify-between">
                    <span className={cn("text-[11px] uppercase font-semibold", isToday ? "text-primary" : "text-muted-foreground")}>
                      {new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
                    </span>
                    <span className={cn("text-sm font-metric", isToday ? "h-6 w-6 rounded-full bg-primary text-primary-foreground inline-flex items-center justify-center" : "text-foreground")}>
                      {new Date(`${date}T12:00:00`).getDate()}
                    </span>
                  </div>
                  {off ? (
                    <span className="mt-2 text-[11px] text-muted-foreground">{past ? "" : "Folga"}</span>
                  ) : (
                    <>
                      <span className="text-[10px] font-metric text-muted-foreground">{fmtHoras(day!.used)}</span>
                      {items.slice(0, 5).map((it) => (
                        <span
                          key={it.key}
                          className="truncate rounded-md px-1.5 py-0.5 text-[10px] leading-tight"
                          style={{ background: `hsl(${resolveSubject(it.areaSlug).colorToken} / 0.16)`, color: `hsl(${resolveSubject(it.areaSlug).colorToken})` }}
                          title={it.title}
                        >
                          {it.kind === "questoes" ? "◎ " : it.kind === "revisao" ? "↺ " : ""}
                          {it.tema}
                        </span>
                      ))}
                      {items.length > 5 && <span className="text-[10px] text-muted-foreground">+{items.length - 5}</span>}
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {/* Dia selecionado */}
          <section className="card p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-foreground">
                {selectedDate === today ? "Hoje" : new Date(`${selectedDate}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              </h2>
              {selectedDay && selectedDay.budget > 0 && (
                <span className="text-xs font-metric text-muted-foreground">
                  {fmtHoras(selectedDay.used)} de {fmtHoras(selectedDay.budget)}
                </span>
              )}
            </div>
            {todayItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {selectedDay && selectedDay.budget > 0 ? "Tudo concluído por aqui. 🎉" : "Dia de folga — descanse também faz parte."}
              </p>
            ) : (
              todayItems.map((item) => {
                const Icon = KIND_ICON[item.kind];
                const color = resolveSubject(item.areaSlug).colorToken;
                const done = item.file ? isFileComplete(item.file, userStates[item.file.id]) : Boolean(feitos[item.key]);
                const note = aiDays?.get(selectedDate)?.notes[item.key];
                return (
                  <div key={item.key} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 hover:bg-surface-hover">
                    {item.kind === "revisao" ? (
                      <button type="button" onClick={() => toggleFeito(item.key)} aria-label="Marcar revisão como feita" className="text-muted-foreground hover:text-success">
                        {done ? <CheckCircle2 size={18} className="text-success" /> : <Circle size={18} />}
                      </button>
                    ) : (
                      <span className="h-8 w-8 shrink-0 rounded-lg inline-flex items-center justify-center" style={{ background: `hsl(${color} / 0.14)`, color: `hsl(${color})` }}>
                        {done ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                      </span>
                    )}
                    <button type="button" onClick={() => openItem(item, todayItems)} className="flex-1 min-w-0 text-left">
                      <span className={cn("block text-sm truncate", done ? "text-muted-foreground line-through" : "text-foreground font-medium")}>{item.title}</span>
                      <span className="block text-[11px] truncate" style={{ color: `hsl(${color})` }}>
                        {resolveSubject(item.areaSlug).name} · {item.tema}
                        {item.file ? ` · ${item.file.curso}` : ""}
                      </span>
                      {note && <span className="block text-[11px] text-accent mt-0.5">✦ {note}</span>}
                    </button>
                    <span className="text-xs font-metric text-muted-foreground shrink-0">{fmtHoras(item.minutes)}</span>
                  </div>
                );
              })
            )}
          </section>
        </div>

        {/* Linha do tempo dos temas */}
        <aside className="card p-5 flex flex-col gap-3">
          <h2 className="font-semibold text-foreground inline-flex items-center gap-2">
            <Brain size={16} className="text-accent" /> Linha do tempo dos temas
          </h2>
          <p className="text-xs text-muted-foreground">Quando o conteúdo de cada tema termina — as questões e revisões vêm logo depois.</p>
          <ol className="relative flex flex-col gap-2.5 pl-4 before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-border">
            {timeline.map(([tema, date]) => {
              const unitArea = Object.entries(config.areas).find(([, a]) => a.temas.includes(tema))?.[0];
              const color = unitArea ? resolveSubject(unitArea).colorToken : "var(--primary)";
              return (
                <li key={tema} className="relative">
                  <span className="absolute -left-4 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface" style={{ background: `hsl(${color})` }} />
                  <button
                    type="button"
                    onClick={() => {
                      setWeekStart(startOfWeekIso(date));
                      setSelectedDate(date);
                    }}
                    className="text-left"
                  >
                    <span className="block text-sm text-foreground leading-snug">{tema}</span>
                    <span className="block text-[11px] font-metric text-muted-foreground">
                      {new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </span>
                  </button>
                </li>
              );
            })}
            {timeline.length === 0 && <li className="text-sm text-muted-foreground">Nenhum tema com conteúdo pendente.</li>}
          </ol>
          <Link href="/questoes" className="btn-outline btn-sm self-start mt-2">
            <Target size={13} /> Banco de questões
          </Link>
        </aside>
      </div>

      <FilePreviewModal
        file={preview?.file ?? null}
        playlist={preview?.playlist}
        onClose={() => setPreview(null)}
        onNavigate={(f) => setPreview((p) => (p ? { ...p, file: f } : p))}
      />
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "success" | "warning" | "danger" }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-2xl font-semibold font-metric mt-1",
          tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-foreground"
        )}
      >
        {value}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

