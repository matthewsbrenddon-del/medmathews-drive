"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Inbox,
  Loader2,
  PartyPopper,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PriorityBadge } from "@/components/PriorityBadge";
import { useContent } from "@/lib/content";
import { useStudyStore } from "@/lib/store";
import { useQuestionStore } from "@/lib/questionStore";
import { useQuestionProgressStore } from "@/lib/questionProgressStore";
import { useScheduleStore } from "@/lib/scheduleStore";
import { getSubjectsFromContentAndQuestions, resolveSubject } from "@/lib/subjects";
import { getRecommendedTemas } from "@/lib/questionStats";
import { buildStudyPlan, type PlanItem } from "@/lib/studyPlan";
import {
  addDaysIso,
  formatDayLabel,
  formatDayNum,
  formatWeekRangeLabel,
  formatWeekdayShort,
  startOfWeekIso,
  todayIso,
} from "@/lib/dateUtil";
import { cn } from "@/lib/utils";

function SetupForm() {
  const content = useContent();
  const questions = useQuestionStore((s) => s.questions);
  const config = useScheduleStore((s) => s.config);
  const setConfig = useScheduleStore((s) => s.setConfig);
  const subjects = useMemo(() => getSubjectsFromContentAndQuestions(content, questions), [content, questions]);

  const [selected, setSelected] = useState<string[]>(config.selectedSubjects.length > 0 ? config.selectedSubjects : subjects.map((s) => s.slug));
  const [targetDate, setTargetDate] = useState(config.targetDate);
  const [dailyMinutes, setDailyMinutes] = useState(config.dailyMinutes);

  function toggleSubject(slug: string) {
    setSelected((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));
  }

  function handleGenerate() {
    setConfig({ active: true, selectedSubjects: selected, targetDate, dailyMinutes });
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-6">
      <div className="text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary mx-auto">
          <Calendar size={26} />
        </div>
        <h1 className="text-xl font-semibold text-foreground mt-4">Monte seu cronograma</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Escolha as disciplinas prioritárias e uma data-alvo — distribuímos as aulas, materiais e questões
          pendentes entre os dias disponíveis.
        </p>
      </div>

      <div className="card p-6 flex flex-col gap-5">
        <div>
          <p className="text-sm font-medium text-foreground mb-2">Disciplinas a priorizar</p>
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => toggleSubject(s.slug)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  selected.includes(s.slug)
                    ? "border-primary bg-primary-light text-primary"
                    : "border-border text-muted-foreground hover:bg-surface-hover"
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="target-date" className="text-sm font-medium text-foreground block mb-1.5">
            Data-alvo (prova, fim do rodízio...)
          </label>
          <input
            id="target-date"
            type="date"
            min={todayIso()}
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="daily-minutes" className="text-sm font-medium text-foreground block mb-1.5">
            Tempo de estudo disponível por dia (minutos)
          </label>
          <input
            id="daily-minutes"
            type="number"
            min={15}
            step={15}
            value={dailyMinutes}
            onChange={(e) => setDailyMinutes(Math.max(15, Number(e.target.value)))}
            className="input"
          />
        </div>

        <button type="button" disabled={selected.length === 0} className="btn-primary" onClick={handleGenerate}>
          Gerar cronograma
        </button>
      </div>
    </div>
  );
}

function ItemRow({ item, justificativa }: { item: PlanItem; justificativa?: string }) {
  const setWatchStatus = useStudyStore((s) => s.setWatchStatus);
  const setReadStatus = useStudyStore((s) => s.setReadStatus);
  const postponeItem = useScheduleStore((s) => s.postponeItem);

  function markDone() {
    if (!item.content) return;
    if (item.content.kind === "videoaula") setWatchStatus(item.content.fileId, "assistida");
    else setReadStatus(item.content.fileId, "estudado");
  }

  const href =
    item.kind === "conteudo"
      ? item.content?.kind === "videoaula"
        ? `/videoaulas/${item.content.fileId}`
        : `/materiais/${item.content?.fileId}`
      : `/questoes/estudo?disciplina=${item.questionSubjectSlug}`;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          <span>{item.subjectName}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1 font-metric">
            <Clock size={11} /> {item.estimatedMinutes} min
          </span>
          <PriorityBadge priority={item.priority} />
        </div>
        {justificativa && (
          <p className="mt-1 text-xs text-accent inline-flex items-center gap-1">
            <Sparkles size={11} className="shrink-0" /> {justificativa}
          </p>
        )}
      </div>
      <Link href={href} className="btn-outline btn-sm shrink-0">
        Abrir
      </Link>
      {item.kind === "conteudo" && (
        <button type="button" onClick={markDone} className="btn-ghost btn-sm shrink-0" aria-label="Marcar como feito">
          <Check size={14} />
        </button>
      )}
      <button
        type="button"
        onClick={() => postponeItem(item.key)}
        className="btn-ghost btn-sm shrink-0"
        aria-label="Adiar para amanhã"
        title="Adiar para amanhã"
      >
        <RotateCcw size={14} />
      </button>
    </div>
  );
}

interface AiPlannedDay {
  date: string;
  items: { item: PlanItem; justificativa?: string }[];
}

interface DayEntry {
  items: { item: PlanItem; justificativa?: string }[];
  budgetMinutes?: number;
  totalMinutes?: number;
}

function DayPanel({
  date,
  entry,
  onClose,
}: {
  date: string;
  entry: DayEntry | undefined;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const items = entry?.items ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="h-full w-full max-w-md bg-surface border-l border-border shadow-lift flex flex-col animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-5 border-b border-border/60">
          <div>
            <p className="text-xs text-muted-foreground">Dia de estudo</p>
            <h2 className="font-semibold text-foreground">{formatDayLabel(date)}</h2>
          </div>
          <div className="flex items-center gap-3">
            {entry?.budgetMinutes != null && (
              <span className="text-xs font-metric text-muted-foreground">
                {entry.totalMinutes} / {entry.budgetMinutes} min
              </span>
            )}
            <button type="button" onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="flex flex-col items-center text-center gap-3 py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Inbox size={22} />
              </div>
              <p className="text-sm text-muted-foreground">Nenhum item agendado para este dia.</p>
            </div>
          ) : (
            items.map(({ item, justificativa }) => <ItemRow key={item.key} item={item} justificativa={justificativa} />)
          )}
        </div>
      </div>
    </div>
  );
}

function WeekGrid({
  weekDates,
  daysByDate,
}: {
  weekDates: string[];
  daysByDate: Map<string, DayEntry>;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const today = todayIso();

  return (
    <>
      <div className="grid grid-cols-7 gap-2">
        {weekDates.map((date) => {
          const entry = daysByDate.get(date);
          const items = entry?.items ?? [];
          const isToday = date === today;
          const visible = items.slice(0, 3);
          const extra = items.length - visible.length;
          return (
            <button
              key={date}
              type="button"
              onClick={() => setSelectedDate(date)}
              className={cn(
                "flex flex-col gap-2 rounded-xl border p-2.5 text-left min-h-[140px] transition-colors hover:border-primary/50",
                isToday ? "border-primary/60 bg-primary-light/30" : "border-border bg-surface"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase text-muted-foreground font-medium">{formatWeekdayShort(date)}</span>
                <span className={cn("text-sm font-metric font-semibold", isToday ? "text-primary" : "text-foreground")}>
                  {formatDayNum(date)}
                </span>
              </div>

              {items.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground/50">
                  <Plus size={16} />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {visible.map(({ item }) => {
                    const subject = resolveSubject(item.subjectSlug);
                    return (
                      <div
                        key={item.key}
                        className="rounded-lg border-l-2 bg-muted px-2 py-1.5"
                        style={{ borderColor: `hsl(${subject.colorToken})` }}
                      >
                        <p className="text-[11px] font-medium text-foreground line-clamp-2 leading-tight">{item.title}</p>
                      </div>
                    );
                  })}
                  {extra > 0 && <p className="text-[11px] text-muted-foreground font-metric px-0.5">+{extra} mais</p>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <DayPanel date={selectedDate} entry={daysByDate.get(selectedDate)} onClose={() => setSelectedDate(null)} />
      )}
    </>
  );
}

function PlanView() {
  const content = useContent();
  const userStates = useStudyStore((s) => s.userStates);
  const questions = useQuestionStore((s) => s.questions);
  const questionProgress = useQuestionProgressStore((s) => s.progress);
  const config = useScheduleStore((s) => s.config);
  const postponed = useScheduleStore((s) => s.postponed);
  const deactivate = useScheduleStore((s) => s.deactivate);

  const plan = useMemo(
    () =>
      buildStudyPlan({
        selectedSubjects: config.selectedSubjects,
        targetDate: config.targetDate,
        dailyMinutes: config.dailyMinutes,
        content,
        contentProgress: userStates,
        questions,
        questionProgress,
        postponed,
      }),
    [content, userStates, questions, questionProgress, config, postponed]
  );

  const isAllDone = plan.totalPendingMinutes === 0;

  const [aiPlan, setAiPlan] = useState<AiPlannedDay[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeekIso(todayIso()));

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)), [weekStart]);

  const daysByDate = useMemo(() => {
    const map = new Map<string, DayEntry>();
    if (aiPlan) {
      for (const d of aiPlan) map.set(d.date, { items: d.items });
    } else {
      for (const d of plan.days) {
        map.set(d.date, { items: d.items.map((item) => ({ item })), budgetMinutes: d.budgetMinutes, totalMinutes: d.totalMinutes });
      }
    }
    return map;
  }, [aiPlan, plan.days]);

  async function handleRecalcularComIA() {
    setAiLoading(true);
    setAiError(null);
    try {
      const allItems = [...plan.days.flatMap((d) => d.items), ...plan.overflow];
      const itemByKey = new Map(allItems.map((i) => [i.key, i]));
      const temas = getRecommendedTemas(questions, questionProgress, 20);

      const res = await fetch("/api/ai/cronograma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itensPendentes: allItems.map((i) => ({
            key: i.key,
            title: i.title,
            subjectName: i.subjectName,
            estimatedMinutes: i.estimatedMinutes,
            priority: i.priority,
          })),
          desempenhoPorTema: temas.map((t) => ({ tema: t.tema, subjectName: t.subjectName, accuracyPercent: t.accuracyPercent })),
          dataAlvo: config.targetDate,
          disponibilidadeDiaria: config.dailyMinutes,
          itensConcluidos: Math.max(0, content.filter((c) => config.selectedSubjects.includes(c.subjectSlug)).length - allItems.length),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error ?? "Não foi possível recalcular com IA agora.");
        return;
      }

      const dias: { data: string; itens: { key: string; titulo: string; duracaoMin: number; justificativa?: string }[] }[] = data.dias;
      const mapped: AiPlannedDay[] = dias
        .map((d) => {
          const items: { item: PlanItem; justificativa?: string }[] = [];
          for (const it of d.itens) {
            const item = itemByKey.get(it.key);
            if (item) items.push({ item, justificativa: it.justificativa });
          }
          return { date: d.data, items };
        })
        .filter((d) => d.items.length > 0);

      if (mapped.length === 0) {
        setAiError("A IA retornou um plano, mas nenhum item pôde ser associado ao cronograma atual. Tente novamente.");
        return;
      }
      setAiPlan(mapped);
    } catch {
      setAiError("Não foi possível conectar à IA agora. O cronograma padrão continua disponível.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Cronograma</h1>
          <p className="text-muted-foreground mt-1">
            Meta: {new Date(`${config.targetDate}T00:00:00`).toLocaleDateString("pt-BR")} · {config.dailyMinutes}{" "}
            min/dia · {config.selectedSubjects.length} disciplinas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {aiPlan ? (
            <button type="button" className="btn-outline" onClick={() => setAiPlan(null)}>
              Voltar ao cronograma padrão
            </button>
          ) : (
            <button type="button" className="btn-outline" onClick={handleRecalcularComIA} disabled={aiLoading || isAllDone}>
              {aiLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {aiLoading ? "Recalculando..." : "Recalcular com IA"}
            </button>
          )}
          <button type="button" className="btn-outline" onClick={deactivate}>
            <Settings2 size={15} /> Reconfigurar
          </button>
        </div>
      </div>

      {aiError && <p className="text-sm text-danger">{aiError}</p>}

      {isAllDone ? (
        <EmptyState
          icon={PartyPopper}
          title="Tudo em dia!"
          description="Você concluiu todo o conteúdo e questões pendentes das disciplinas selecionadas para este cronograma."
        />
      ) : (
        <>
          {aiPlan && (
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Sparkles size={12} /> Plano reorganizado pela IA — ajustes manuais (marcar feito, adiar) não exigem nova chamada.
            </p>
          )}

          {!aiPlan && plan.overflow.length > 0 && (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
              <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">
                <strong>{plan.overflow.length} itens</strong> não couberam até a data-alvo com o tempo diário atual.
                Aumente os minutos por dia ou estenda a data-alvo em Reconfigurar.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setWeekStart((w) => addDaysIso(w, -7))}
                aria-label="Semana anterior"
                className="btn-ghost btn-sm"
              >
                <ChevronLeft size={16} />
              </button>
              <button type="button" onClick={() => setWeekStart(startOfWeekIso(todayIso()))} className="btn-outline btn-sm">
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setWeekStart((w) => addDaysIso(w, 7))}
                aria-label="Próxima semana"
                className="btn-ghost btn-sm"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <p className="text-sm font-medium text-foreground font-metric">
              {formatWeekRangeLabel(weekDates[0], weekDates[6])}
            </p>
          </div>

          <WeekGrid weekDates={weekDates} daysByDate={daysByDate} />
        </>
      )}
    </div>
  );
}

export default function CronogramaPage() {
  const active = useScheduleStore((s) => s.config.active);
  return active ? <PlanView /> : <SetupForm />;
}
