"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Calendar, Check, Clock, Loader2, PartyPopper, RotateCcw, Settings2, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PriorityBadge } from "@/components/PriorityBadge";
import { useContent } from "@/lib/content";
import { useStudyStore } from "@/lib/store";
import { useQuestionStore } from "@/lib/questionStore";
import { useQuestionProgressStore } from "@/lib/questionProgressStore";
import { useScheduleStore } from "@/lib/scheduleStore";
import { getSubjectsFromContentAndQuestions } from "@/lib/subjects";
import { getRecommendedTemas } from "@/lib/questionStats";
import { buildStudyPlan, type PlanItem } from "@/lib/studyPlan";
import { formatDayLabel, todayIso } from "@/lib/dateUtil";
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

  const daysWithItems = plan.days.filter((d) => d.items.length > 0);
  const isAllDone = plan.totalPendingMinutes === 0;

  const [aiPlan, setAiPlan] = useState<AiPlannedDay[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

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
      ) : aiPlan ? (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Sparkles size={12} /> Plano reorganizado pela IA — ajustes manuais (marcar feito, adiar) não exigem nova chamada.
          </p>
          {aiPlan.map((day) => (
            <div key={day.date} className="card p-5">
              <h2 className="font-semibold text-foreground mb-2">{formatDayLabel(day.date)}</h2>
              <div>
                {day.items.map(({ item, justificativa }) => (
                  <ItemRow key={item.key} item={item} justificativa={justificativa} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {plan.overflow.length > 0 && (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
              <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">
                <strong>{plan.overflow.length} itens</strong> não couberam até a data-alvo com o tempo diário atual.
                Aumente os minutos por dia ou estenda a data-alvo em Reconfigurar.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {daysWithItems.slice(0, 30).map((day) => (
              <div key={day.date} className="card p-5">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold text-foreground">{formatDayLabel(day.date)}</h2>
                  <span className="text-xs font-metric text-muted-foreground">
                    {day.totalMinutes} / {day.budgetMinutes} min
                  </span>
                </div>
                <div>
                  {day.items.map((item) => (
                    <ItemRow key={item.key} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function CronogramaPage() {
  const active = useScheduleStore((s) => s.config.active);
  return active ? <PlanView /> : <SetupForm />;
}
