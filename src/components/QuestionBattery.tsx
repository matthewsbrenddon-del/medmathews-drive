"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileDown,
  Focus,
  Star,
  X,
} from "lucide-react";
import { HighlightableText } from "./HighlightableText";
import { NotebookPicker } from "./NotebookPicker";
import { PriorityBadge } from "./PriorityBadge";
import { useQuestionProgressStore } from "@/lib/questionProgressStore";
import { useStudyStore } from "@/lib/store";
import { useStudyTimer } from "@/lib/useStudyTimer";
import { exportQuestionsToPdf, PDF_EXPORT_MAX } from "@/lib/pdfExport";
import { resolveSubject } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import type { Question, StudySession } from "@/lib/types";

function QuestionCardFull({ question, index }: { question: Question; index: number }) {
  const subject = resolveSubject(question.subjectName);
  const progress = useQuestionProgressStore((s) => s.getProgress(question.id));
  const answerQuestion = useQuestionProgressStore((s) => s.answerQuestion);
  const toggleFavorite = useQuestionProgressStore((s) => s.toggleFavorite);
  const recordStudyToday = useStudyStore((s) => s.recordStudyToday);

  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [minimized, setMinimized] = useState(false);

  function handleSubmit() {
    if (!selected) return;
    setSubmitted(true);
    if (!question.anulada) answerQuestion(question.id, selected, question.gabarito);
    recordStudyToday();
  }

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="card w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-surface-hover transition-colors"
      >
        <span className="text-xs font-metric text-muted-foreground shrink-0">#{index + 1}</span>
        <span className="text-sm text-foreground truncate flex-1">{question.enunciado}</span>
        <ChevronDown size={15} className="text-muted-foreground shrink-0" />
      </button>
    );
  }

  return (
    <div className="card p-6 flex flex-col gap-4" id={`q-${question.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-metric text-muted-foreground">#{index + 1}</span>
          <span className="text-xs font-medium" style={{ color: `hsl(${subject.colorToken})` }}>
            {subject.name}
          </span>
          {question.banca && <span className="text-xs text-muted-foreground">· {question.banca}</span>}
          {question.ano && <span className="text-xs text-muted-foreground">· {question.ano}</span>}
          <PriorityBadge priority={question.dificuldade} />
          {question.origem === "ia" && (
            <span className="rounded-full bg-accent/10 text-accent text-[10px] font-medium px-2 py-0.5">IA</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <NotebookPicker questionId={question.id} />
          <button
            type="button"
            onClick={() => toggleFavorite(question.id)}
            aria-label={progress.favorite ? "Remover dos favoritos" : "Favoritar"}
            className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-surface-hover"
          >
            <Star size={16} className={progress.favorite ? "fill-warning text-warning" : "text-muted-foreground"} />
          </button>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            aria-label="Minimizar questão"
            className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-surface-hover text-muted-foreground"
          >
            <ChevronUp size={16} />
          </button>
        </div>
      </div>

      <HighlightableText
        questionId={question.id}
        field="enunciado"
        text={question.enunciado}
        className="text-foreground leading-relaxed whitespace-pre-line select-text"
      />

      {question.anulada && (
        <p className="text-xs text-warning bg-warning/10 rounded-lg px-3 py-2">
          Questão anulada oficialmente pela banca — sem gabarito único divulgado. Não conta para suas estatísticas.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {question.alternatives.map((alt) => {
          const isSelected = selected === alt.letter;
          const isCorrect = !question.anulada && alt.letter === question.gabarito;
          let style = "border-border hover:bg-surface-hover";
          if (submitted) {
            if (isCorrect) style = "border-success bg-success/10";
            else if (isSelected) style = "border-danger bg-danger/10";
          } else if (isSelected) {
            style = "border-primary bg-primary-light";
          }
          return (
            <div
              key={alt.letter}
              role="button"
              tabIndex={submitted ? -1 : 0}
              aria-disabled={submitted}
              onClick={() => !submitted && setSelected(alt.letter)}
              onKeyDown={(e) => {
                if (!submitted && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  setSelected(alt.letter);
                }
              }}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                submitted ? "cursor-default" : "cursor-pointer",
                style
              )}
            >
              <span className="font-semibold shrink-0">{alt.letter})</span>
              <HighlightableText questionId={question.id} field={alt.letter} text={alt.text} className="flex-1 select-text" />
              {submitted && isCorrect && <Check size={16} className="text-success shrink-0" />}
              {submitted && isSelected && !isCorrect && <X size={16} className="text-danger shrink-0" />}
            </div>
          );
        })}
      </div>

      {submitted && question.comentario && (
        <div className="rounded-xl bg-muted p-4">
          <p className="text-xs font-medium text-foreground mb-1">Comentário</p>
          <p className="text-sm text-muted-foreground">{question.comentario}</p>
        </div>
      )}

      {!submitted ? (
        <button type="button" disabled={!selected} className="btn-primary self-start" onClick={handleSubmit}>
          Responder
        </button>
      ) : (
        <p className="text-xs text-muted-foreground font-metric">
          {question.anulada ? "Anulada — não pontua" : selected === question.gabarito ? "Você acertou" : "Você errou"}
        </p>
      )}
    </div>
  );
}

/** Bateria de questões: por padrão, um feed contínuo rolável com todas as
 * questões abertas; o botão flutuante "Foco" alterna para um modo carrossel
 * (uma questão por vez). Cronometra a sessão automaticamente. */
export function QuestionBattery({ questions, kind }: { questions: Question[]; kind: StudySession["kind"] }) {
  const [focusMode, setFocusMode] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [exportStart, setExportStart] = useState(1);
  const studentName = useStudyStore((s) => s.studentName);

  useStudyTimer(kind);

  useEffect(() => {
    if (focusMode) setExportStart(focusIndex + 1);
  }, [focusMode, focusIndex]);

  if (questions.length === 0) return null;

  const clampedStart = Math.min(Math.max(exportStart, 1), questions.length);
  const exportCount = Math.min(PDF_EXPORT_MAX, questions.length - (clampedStart - 1));
  const exportRangeEnd = clampedStart - 1 + exportCount;

  function handleExportPdf() {
    const startIdx = clampedStart - 1;
    exportQuestionsToPdf(questions.slice(startIdx), { studentName, offset: startIdx });
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div className="max-w-2xl mx-auto w-full flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <p className="text-xs text-muted-foreground font-metric">
          Exportação em PDF: no máximo {PDF_EXPORT_MAX} questões por vez.
        </p>
        <div className="flex items-center gap-2">
          {questions.length > PDF_EXPORT_MAX && (
            <label className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              A partir da questão
              <input
                type="number"
                min={1}
                max={questions.length}
                value={exportStart}
                onChange={(e) => setExportStart(Number(e.target.value) || 1)}
                className="input w-16 py-1 text-xs"
                aria-label="Exportar a partir da questão número"
              />
            </label>
          )}
          <button type="button" className="btn-outline btn-sm" onClick={handleExportPdf}>
            <FileDown size={13} /> Exportar PDF ({clampedStart}–{exportRangeEnd})
          </button>
        </div>
      </div>

      {focusMode ? (
        <div className="max-w-2xl mx-auto w-full flex flex-col gap-4">
          <p className="text-sm text-muted-foreground text-center font-metric">
            {focusIndex + 1} de {questions.length}
          </p>
          <QuestionCardFull key={questions[focusIndex].id} question={questions[focusIndex]} index={focusIndex} />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="btn-outline"
              disabled={focusIndex === 0}
              onClick={() => setFocusIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft size={16} /> Anterior
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={focusIndex === questions.length - 1}
              onClick={() => setFocusIndex((i) => Math.min(questions.length - 1, i + 1))}
            >
              Próxima <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto w-full flex flex-col gap-4">
          {questions.map((q, i) => (
            <QuestionCardFull key={q.id} question={q} index={i} />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setFocusMode((v) => !v)}
        className={cn(
          "fixed bottom-20 lg:bottom-8 right-6 z-30 inline-flex items-center gap-2 rounded-full px-4 py-3 shadow-lift font-medium text-sm transition-colors",
          focusMode ? "bg-surface border border-border text-foreground" : "bg-primary text-primary-foreground"
        )}
      >
        {focusMode ? <X size={16} /> : <Focus size={16} />}
        {focusMode ? "Sair do foco" : "Foco"}
      </button>
    </div>
  );
}
