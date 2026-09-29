"use client";

import { Check, Lightbulb, Sparkles, X } from "lucide-react";
import { correlacaoOrder } from "@/lib/quizBuilder";
import { QUIZ_TIPOS, scoreQuestion, type QuizAnswer, type QuizQuestion } from "@/lib/quizStore";
import { cn } from "@/lib/utils";

const LETTERS = "ABCDEFGH";

/**
 * Uma questão de quiz, em qualquer um dos 5 tipos. `revealed` mostra a
 * correção automática (certo/errado por item + comentário).
 */
export function QuizQuestionView({
  question,
  answer,
  onAnswer,
  revealed,
  number,
}: {
  question: QuizQuestion;
  answer: QuizAnswer | undefined;
  onAnswer?: (value: QuizAnswer) => void;
  revealed: boolean;
  number?: number;
}) {
  const tipo = QUIZ_TIPOS.find((t) => t.id === question.tipo);
  const score = revealed ? scoreQuestion(question, answer) : 0;
  const readOnly = revealed || !onAnswer;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {number !== undefined && <span className="font-metric text-muted-foreground">#{number}</span>}
        <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 font-medium">{tipo?.label}</span>
        {question.tema && <span className="text-muted-foreground truncate">{question.tema}</span>}
      </div>

      <p className="text-[1.02rem] leading-[1.75] text-foreground whitespace-pre-line sm:text-justify hyphens-auto">{question.enunciado}</p>

      {(question.tipo === "multipla" || question.tipo === "vinheta" || question.tipo === "enamed") && (
        <div className="flex flex-col gap-2.5">
          {(question.alternatives ?? []).map((alt) => {
            const selected = answer === alt.letter;
            const correct = revealed && alt.letter === question.gabarito;
            const wrong = revealed && selected && !correct;
            return (
              <button
                key={alt.letter}
                type="button"
                disabled={readOnly}
                onClick={() => onAnswer?.(alt.letter)}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
                  correct
                    ? "border-success/60 bg-success/10"
                    : wrong
                      ? "border-danger/60 bg-danger/10"
                      : selected
                        ? "border-primary bg-primary/10 shadow-card"
                        : "border-border hover:border-primary/40 hover:bg-surface-hover",
                  readOnly && !correct && !wrong && !selected && "opacity-80"
                )}
              >
                <span
                  className={cn(
                    "h-7 w-7 shrink-0 rounded-full border-2 inline-flex items-center justify-center text-xs font-bold",
                    correct ? "border-success bg-success text-white" : wrong ? "border-danger bg-danger text-white" : selected ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
                  )}
                >
                  {correct ? <Check size={14} /> : wrong ? <X size={14} /> : alt.letter}
                </span>
                <span className="pt-0.5 text-sm leading-relaxed text-foreground">{alt.text}</span>
              </button>
            );
          })}
        </div>
      )}

      {question.tipo === "vf" && (
        <div className="flex flex-col gap-2.5">
          {(question.afirmacoes ?? []).map((af, i) => {
            const given = (answer as boolean[] | undefined)?.[i];
            const ok = revealed && given === af.verdadeira;
            const bad = revealed && given !== af.verdadeira;
            return (
              <div
                key={i}
                className={cn(
                  "flex flex-wrap sm:flex-nowrap items-center gap-3 rounded-2xl border px-4 py-3",
                  ok ? "border-success/50 bg-success/5" : bad ? "border-danger/50 bg-danger/5" : "border-border"
                )}
              >
                <span className="font-metric text-xs text-muted-foreground w-5">{i + 1}.</span>
                <span className="flex-1 text-sm leading-relaxed text-foreground">{af.texto}</span>
                <div className="flex gap-1.5 shrink-0">
                  {[true, false].map((v) => {
                    const active = given === v;
                    return (
                      <button
                        key={String(v)}
                        type="button"
                        disabled={readOnly}
                        onClick={() => {
                          const next = [...((answer as boolean[] | undefined) ?? Array((question.afirmacoes ?? []).length).fill(undefined))];
                          next[i] = v;
                          onAnswer?.(next as boolean[]);
                        }}
                        className={cn(
                          "h-9 w-9 rounded-xl border text-sm font-bold transition-colors",
                          active ? (v ? "border-success bg-success text-white" : "border-danger bg-danger text-white") : "border-border text-muted-foreground hover:border-primary/50",
                          revealed && af.verdadeira === v && !active && "ring-2 ring-success/60"
                        )}
                        aria-label={v ? "Verdadeiro" : "Falso"}
                      >
                        {v ? "V" : "F"}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {question.tipo === "correlacao" && <Correlacao question={question} answer={answer as number[] | undefined} onAnswer={onAnswer} revealed={revealed} readOnly={readOnly} />}

      {revealed && (
        <div className="flex flex-col gap-3 animate-fade-in">
          <div
            className={cn(
              "rounded-2xl px-4 py-3 text-sm font-medium inline-flex items-center gap-2",
              score >= 0.999 ? "bg-success/10 text-success" : score > 0 ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"
            )}
          >
            {score >= 0.999 ? <Check size={16} /> : <X size={16} />}
            {score >= 0.999
              ? "Correto!"
              : score > 0
                ? `Parcialmente correto — ${Math.round(score * 100)}% dos itens`
                : question.gabarito
                  ? `Resposta correta: ${question.gabarito}`
                  : "Não foi desta vez"}
          </div>
          {question.comentario && (
            <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5 mb-1">
                <Lightbulb size={13} className="text-warning" /> Comentário
              </p>
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">{question.comentario}</p>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
            <Sparkles size={12} className="text-accent" /> Correção comentada com IA para o seu raciocínio — em breve.
          </p>
        </div>
      )}
    </div>
  );
}

function Correlacao({
  question,
  answer,
  onAnswer,
  revealed,
  readOnly,
}: {
  question: QuizQuestion;
  answer: number[] | undefined;
  onAnswer?: (value: QuizAnswer) => void;
  revealed: boolean;
  readOnly: boolean;
}) {
  const pares = question.pares ?? [];
  const order = correlacaoOrder(question); // posição exibida -> índice real
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coluna A</p>
        {pares.map((p, i) => {
          const given = answer?.[i];
          const ok = revealed && given === i;
          return (
            <div key={i} className={cn("rounded-2xl border px-3 py-2.5 flex items-center gap-3", revealed ? (ok ? "border-success/50 bg-success/5" : "border-danger/50 bg-danger/5") : "border-border")}>
              <span className="font-metric text-xs text-muted-foreground w-4">{i + 1}</span>
              <span className="flex-1 text-sm text-foreground">{p.esquerda}</span>
              <select
                disabled={readOnly}
                value={given === undefined ? "" : String(order.indexOf(given))}
                onChange={(e) => {
                  const next = [...(answer ?? Array(pares.length).fill(-1))];
                  next[i] = e.target.value === "" ? -1 : order[Number(e.target.value)];
                  onAnswer?.(next);
                }}
                className="input w-20 py-1.5 text-sm font-semibold"
                aria-label={`Correspondência do item ${i + 1}`}
              >
                <option value="">—</option>
                {order.map((_, pos) => (
                  <option key={pos} value={pos}>
                    {LETTERS[pos]}
                  </option>
                ))}
              </select>
              {revealed && !ok && <span className="text-xs font-bold text-success">{LETTERS[order.indexOf(i)]}</span>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coluna B</p>
        {order.map((real, pos) => (
          <div key={pos} className="rounded-2xl border border-border bg-muted/30 px-3 py-2.5 flex items-center gap-3">
            <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold inline-flex items-center justify-center">{LETTERS[pos]}</span>
            <span className="text-sm text-foreground">{pares[real]?.direita}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A questão já tem resposta suficiente para "Confirmar"? */
export function isAnswered(question: QuizQuestion, answer: QuizAnswer | undefined): boolean {
  if (answer === undefined) return false;
  if (question.tipo === "vf") {
    const a = answer as (boolean | undefined)[];
    return (question.afirmacoes ?? []).every((_, i) => typeof a[i] === "boolean");
  }
  if (question.tipo === "correlacao") {
    const a = answer as number[];
    return (question.pares ?? []).every((_, i) => typeof a[i] === "number" && a[i] >= 0);
  }
  return typeof answer === "string" && answer.length > 0;
}
