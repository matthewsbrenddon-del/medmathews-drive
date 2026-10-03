"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  FileDown,
  Focus,
  ImageOff,
  Keyboard,
  Lightbulb,
  MessageSquareText,
  NotebookPen,
  PlayCircle,
  RotateCcw,
  Scissors,
  Settings2,
  Highlighter,
  Star,
  Target,
  Type,
  X,
} from "lucide-react";
import { FilePreviewModal } from "./FilePreviewModal";
import { COLOR_ORDER, HIGHLIGHT_HEX, HighlightableText, UNDERLINE_HEX } from "./HighlightableText";
import { CadernoDock } from "./CadernoDock";
import { LibraryFileRow } from "./LibraryFileRow";
import { NoteButton } from "./NoteButton";
import { NotebookPicker } from "./NotebookPicker";
import { PriorityBadge } from "./PriorityBadge";
import { Markdown } from "@/lib/markdown";
import { useCadernoStore } from "@/lib/cadernoStore";
import { useLibraryStore } from "@/lib/libraryStore";
import { useClassificationStore } from "@/lib/classificationStore";
import { classifyLibrary } from "@/lib/classification";
import { findRelatedLessons, fileName, fullPath, naturalCompare } from "@/lib/library";
import { FONT_SCALES, usePracticePrefsStore } from "@/lib/practicePrefsStore";
import { useQuestionProgressStore } from "@/lib/questionProgressStore";
import { useStudyStore } from "@/lib/store";
import { useStudyTimer } from "@/lib/useStudyTimer";
import { ApostilaExportModal } from "./ApostilaExportModal";
import { FocusTimerInline } from "./FocusTimer";
import { resolveSubject } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { reflowText } from "@/lib/reflowText";
import { useCadernoDockStore } from "@/lib/cadernoDockStore";
import type { LibraryFile, Question, StudySession } from "@/lib/types";

interface AnswerState {
  selected: string | null;
  submitted: boolean;
}

type ActionTab = "comentario" | "anotacoes" | "estatisticas" | "aulas";

function fmtClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
}

/** Trechos do Caderno anotados a partir desta questão (separados por "---"). */
function useQuestionNotes(questionId: string) {
  const cadernos = useCadernoStore((s) => s.cadernos);
  return useMemo(() => {
    const marker = `origem:questao:${questionId})`;
    const notes: { cadernoId: string; titulo: string; text: string }[] = [];
    for (const c of cadernos) {
      if (!c.conteudo.includes(marker)) continue;
      for (const block of c.conteudo.split(/\n-{3,}\n/)) {
        if (!block.includes(marker)) continue;
        const text = block.replace(/\[via [^\]]*\]\(origem:[^)]+\)\n?/g, "").trim();
        notes.push({ cadernoId: c.id, titulo: c.titulo, text });
      }
    }
    return notes;
  }, [cadernos, questionId]);
}

function RelatedLessons({ question, onOpen }: { question: Question; onOpen: (file: LibraryFile, playlist: LibraryFile[]) => void }) {
  const files = useLibraryStore((s) => s.files);
  const status = useLibraryStore((s) => s.status);
  const hydrate = useLibraryStore((s) => s.hydrate);
  const overrides = useClassificationStore((s) => s.overrides);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const related = useMemo(() => {
    if (files.length === 0) return [];
    return findRelatedLessons(classifyLibrary(files, overrides), question);
  }, [files, overrides, question]);

  if (status !== "ready") return <p className="text-sm text-muted-foreground">Procurando aulas no acervo…</p>;
  if (related.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma aula do acervo casou com o tema “{question.tema ?? question.subjectName}”.{" "}
        <Link href={`/disciplinas?area=${question.subjectSlug}`} className="text-primary font-medium">
          Explorar {question.subjectName} →
        </Link>
      </p>
    );

  function playlistFor(file: LibraryFile) {
    const folder = fullPath(file).slice(0, -1).join("›");
    return files.filter((f) => fullPath(f).slice(0, -1).join("›") === folder).sort((a, b) => naturalCompare(fileName(a), fileName(b)));
  }

  return (
    <div className="flex flex-col gap-1.5">
      {related.map((f) => (
        <LibraryFileRow key={f.id} file={f} subtitle={fullPath(f).slice(0, -1).join(" › ")} onOpen={() => onOpen(f, playlistFor(f))} />
      ))}
    </div>
  );
}

function QuestionItem({
  question,
  index,
  total,
  state,
  struck,
  fontScale,
  isCurrent,
  onSelect,
  onSubmit,
  onRetry,
  onToggleStrike,
  onOpenLesson,
  registerRef,
}: {
  question: Question;
  index: number;
  total: number;
  state: AnswerState;
  struck: string[];
  fontScale: number;
  isCurrent: boolean;
  onSelect: (letter: string) => void;
  onSubmit: () => void;
  onRetry: () => void;
  onToggleStrike: (letter: string) => void;
  onOpenLesson: (file: LibraryFile, playlist: LibraryFile[]) => void;
  registerRef: (el: HTMLElement | null) => void;
}) {
  const subject = resolveSubject(question.subjectName);
  const progress = useQuestionProgressStore((s) => s.progress[question.id]);
  const toggleFavorite = useQuestionProgressStore((s) => s.toggleFavorite);
  const toggleMarked = useQuestionProgressStore((s) => s.toggleMarked);
  const readComments = usePracticePrefsStore((s) => s.readComments);
  const markCommentRead = usePracticePrefsStore((s) => s.markCommentRead);
  const notes = useQuestionNotes(question.id);

  const [minimized, setMinimized] = useState(false);
  const [tab, setTab] = useState<ActionTab | null>(null);

  const { selected, submitted } = state;
  const hasComment = Boolean(question.comentario?.trim());
  const commentUnread = hasComment && !readComments[question.id];
  const history = progress?.history ?? [];
  const correctCount = history.filter((h) => h.correct).length;

  function openTab(next: ActionTab) {
    setTab((t) => (t === next ? null : next));
    if (next === "comentario" && hasComment) markCommentRead(question.id);
  }

  const origin = {
    tipo: "questao" as const,
    id: question.id,
    label: `Questão ${index + 1} — ${question.tema ?? question.subjectName}`,
  };
  const scissorsMode = usePracticePrefsStore((s) => s.scissorsMode);
  const enunciado = useMemo(() => reflowText(question.enunciado), [question.enunciado]);

  const origemLabel = question.banca
    ? [question.banca, question.ano].filter(Boolean).join(" ")
    : question.colecao?.startsWith("Coletânea")
      ? "Coletânea"
      : question.colecao;
  const breadcrumb = [
    { label: origemLabel, area: false },
    { label: question.subjectName, area: true },
    { label: question.especialidade && question.especialidade !== question.subjectName ? question.especialidade : undefined, area: false },
    { label: question.tema, area: false },
    { label: question.subtema, area: false },
  ].filter((p): p is { label: string; area: boolean } => Boolean(p.label && String(p.label).trim()));

  if (minimized) {
    return (
      <button
        ref={registerRef}
        type="button"
        data-question-index={index}
        onClick={() => setMinimized(false)}
        className="card w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-surface-hover transition-colors"
      >
        <span className="text-xs font-metric text-muted-foreground shrink-0">
          {index + 1}/{total}
        </span>
        {submitted && !question.anulada && (
          <span className={cn("h-2 w-2 rounded-full shrink-0", selected === question.gabarito ? "bg-success" : "bg-danger")} />
        )}
        <span className="text-sm text-foreground truncate flex-1">{question.enunciado}</span>
        <ChevronDown size={15} className="text-muted-foreground shrink-0" />
      </button>
    );
  }

  const actionTabs: { id: ActionTab; icon: typeof Lightbulb; label: string; badge?: React.ReactNode }[] = [
    {
      id: "comentario",
      icon: Lightbulb,
      label: "Gabarito comentado",
      badge: commentUnread ? <span className="h-2 w-2 rounded-full bg-primary" aria-label="não lido" /> : null,
    },
    {
      id: "anotacoes",
      icon: MessageSquareText,
      label: "Minhas anotações",
      badge: <span className="font-metric text-[10px] text-muted-foreground">{notes.length}</span>,
    },
    { id: "estatisticas", icon: BarChart3, label: "Estatísticas" },
    { id: "aulas", icon: PlayCircle, label: "Aulas relacionadas" },
  ];

  return (
    <article
      ref={registerRef}
      data-question-index={index}
      id={`q-${question.id}`}
      className={cn("card p-5 sm:p-6 flex flex-col gap-4 scroll-mt-24 transition-shadow", isCurrent && "ring-1 ring-primary/40")}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">
              Questão <span className="font-metric">{index + 1}</span>{" "}
              <span className="text-muted-foreground font-normal">de {total}</span>
            </span>
            {question.dificuldade > 0 && <PriorityBadge priority={question.dificuldade} />}
            {question.anulada && (
              <span className="rounded-full bg-warning/15 text-warning text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
                Anulada
              </span>
            )}
            {question.origem === "ia" && (
              <span className="rounded-full bg-accent/10 text-accent text-[10px] font-medium px-2 py-0.5">IA</span>
            )}
          </div>
          <nav aria-label="Origem da questão" className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
            {breadcrumb.map((part, i) => (
              <span key={i} className="inline-flex items-center gap-1 min-w-0">
                {i > 0 && <ChevronRight size={11} className="shrink-0 opacity-60" />}
                <span
                  className={cn("truncate max-w-[220px]", part.area && "font-medium")}
                  style={part.area ? { color: `hsl(${subject.colorToken})` } : undefined}
                  title={part.label}
                >
                  {part.label}
                </span>
              </span>
            ))}
          </nav>
          {question.secao && (
            <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-accent/80 line-clamp-1" title={question.secao}>
              § {question.secao}
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => toggleMarked(question.id)}
            aria-label={progress?.marked ? "Desmarcar revisão" : "Marcar para revisar"}
            title={progress?.marked ? "Marcada para revisar" : "Marcar para revisar"}
            className={cn(
              "inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-surface-hover",
              progress?.marked ? "text-accent" : "text-muted-foreground"
            )}
          >
            <Target size={16} />
          </button>
          <NotebookPicker questionId={question.id} />
          <button
            type="button"
            onClick={() => toggleFavorite(question.id)}
            aria-label={progress?.favorite ? "Remover dos favoritos" : "Favoritar"}
            className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-surface-hover"
          >
            <Star size={16} className={progress?.favorite ? "fill-warning text-warning" : "text-muted-foreground"} />
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
      </header>

      <div style={{ fontSize: `${fontScale}rem` }}>
        <HighlightableText
          questionId={question.id}
          field="enunciado"
          text={enunciado}
          origin={origin}
          className="text-foreground leading-[1.75] whitespace-pre-line select-text sm:text-justify hyphens-auto [text-wrap:pretty]"
        />
      </div>

      {question.hasImage && (
        <p className="text-xs text-warning bg-warning/10 rounded-lg px-3 py-2 inline-flex items-start gap-2">
          <ImageOff size={14} className="shrink-0 mt-0.5" />
          <span>
            Esta questão tem {question.imagemTipo && !question.imagemTipo.startsWith("Imagem/") ? question.imagemTipo.toLowerCase() : "imagem"} na prova
            original que ainda não está disponível na plataforma
            {question.prova ? ` — consulte “${question.prova}”` : ""}.
            {question.fonteUrl && (
              <>
                {" "}
                <a href={question.fonteUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium">
                  Abrir a fonte original
                </a>
              </>
            )}
          </span>
        </p>
      )}

      {question.anulada && (
        <p className="text-xs text-warning bg-warning/10 rounded-lg px-3 py-2">
          Questão anulada oficialmente pela banca — sem gabarito único divulgado. Não conta para suas estatísticas.
        </p>
      )}

      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Alternativas">
        {question.alternatives.map((alt) => {
          const isSelected = selected === alt.letter;
          const isCorrect = !question.anulada && alt.letter === question.gabarito;
          const isStruck = struck.includes(alt.letter);
          let circle = "border-border text-muted-foreground";
          let row = "border-transparent hover:bg-surface-hover";
          if (submitted) {
            if (isCorrect) {
              circle = "border-success bg-success text-white";
              row = "border-success/40 bg-success/10";
            } else if (isSelected) {
              circle = "border-danger bg-danger text-white";
              row = "border-danger/40 bg-danger/10";
            } else {
              row = "border-transparent opacity-60";
            }
          } else if (isSelected) {
            circle = "border-primary bg-primary text-primary-foreground";
            row = "border-primary/40 bg-primary-light";
          }
          return (
            <div
              key={alt.letter}
              role="radio"
              aria-checked={isSelected}
              tabIndex={submitted ? -1 : 0}
              aria-disabled={submitted}
              onClick={() => {
                if (submitted || window.getSelection()?.isCollapsed === false) return;
                if (scissorsMode) onToggleStrike(alt.letter);
                else onSelect(alt.letter);
              }}
              onContextMenu={(e) => {
                if (submitted) return;
                e.preventDefault();
                onToggleStrike(alt.letter);
              }}
              onKeyDown={(e) => {
                if (!submitted && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onSelect(alt.letter);
                }
              }}
              className={cn(
                "group/alt flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                submitted ? "cursor-default" : scissorsMode ? "cursor-cell" : "cursor-pointer",
                isStruck && !submitted && "opacity-55",
                row
              )}
              style={{ fontSize: `${fontScale * 0.9}rem` }}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                  circle
                )}
              >
                {submitted && isCorrect ? (
                  <Check size={14} strokeWidth={3} />
                ) : submitted && isSelected ? (
                  <X size={14} strokeWidth={3} />
                ) : isStruck ? (
                  <Scissors size={12} />
                ) : (
                  alt.letter
                )}
              </span>
              <HighlightableText
                questionId={question.id}
                field={alt.letter}
                text={reflowText(alt.text)}
                origin={origin}
                className={cn(
                  "flex-1 min-w-0 select-text pt-0.5 leading-relaxed [text-wrap:pretty]",
                  isStruck && "line-through decoration-2 decoration-danger/70 text-muted-foreground"
                )}
              />
              {!submitted && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleStrike(alt.letter);
                  }}
                  aria-label={isStruck ? `Restaurar alternativa ${alt.letter}` : `Eliminar alternativa ${alt.letter}`}
                  title={isStruck ? "Restaurar alternativa" : "Cortar alternativa (ou clique com o botão direito)"}
                  className={cn(
                    "shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-muted transition-all",
                    isStruck ? "text-danger bg-danger/10" : "text-muted-foreground/40 hover:text-foreground group-hover/alt:text-muted-foreground"
                  )}
                >
                  <Scissors size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {!submitted ? (
          <button
            type="button"
            disabled={!selected}
            className="btn bg-primary text-primary-foreground hover:opacity-90 px-6 disabled:opacity-40"
            onClick={onSubmit}
          >
            Responder
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-sm font-semibold",
                question.anulada ? "text-warning" : selected === question.gabarito ? "text-success" : "text-danger"
              )}
            >
              {question.anulada
                ? "Anulada — não pontua"
                : selected === question.gabarito
                  ? "Você acertou!"
                  : `Você errou — gabarito: ${question.gabarito}`}
            </span>
            <button type="button" onClick={onRetry} className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <RotateCcw size={12} /> Refazer
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1 border-t border-border/60 pt-3 -mx-1">
        {actionTabs.map(({ id, icon: Icon, label, badge }) => (
          <button
            key={id}
            type="button"
            onClick={() => openTab(id)}
            aria-expanded={tab === id}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
              tab === id ? "bg-primary-light text-primary" : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            )}
          >
            <Icon size={14} /> {label} {badge}
          </button>
        ))}
      </div>

      {tab === "comentario" && (
        <div className="rounded-xl bg-muted/60 p-4 text-sm animate-fade-in">
          {!submitted && hasComment && (
            <p className="text-[11px] text-warning mb-2">Atenção: o comentário revela o gabarito.</p>
          )}
          {hasComment ? (
            <p className="text-foreground whitespace-pre-line leading-relaxed">{reflowText(question.comentario ?? "")}</p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground">Explicação ainda não adicionada para esta questão.</p>
              <NoteButton origin={origin} label="Escrever minha explicação" />
            </div>
          )}
        </div>
      )}

      {tab === "anotacoes" && (
        <div className="rounded-xl bg-muted/60 p-4 flex flex-col gap-3 animate-fade-in">
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Você ainda não anotou nada sobre esta questão.</p>
          ) : (
            notes.map((n, i) => (
              <div key={i} className="rounded-lg bg-surface border border-border p-3">
                <Link href={`/caderno?id=${n.cadernoId}`} className="text-[11px] font-medium text-accent inline-flex items-center gap-1 mb-1.5">
                  <NotebookPen size={11} /> {n.titulo}
                </Link>
                {n.text ? <Markdown source={n.text} /> : <p className="text-xs text-muted-foreground">(só a referência)</p>}
              </div>
            ))
          )}
          <NoteButton origin={origin} label="Nova anotação" className="btn-outline btn-sm self-start" />
        </div>
      )}

      {tab === "estatisticas" && (
        <div className="rounded-xl bg-muted/60 p-4 text-sm animate-fade-in flex flex-col gap-2">
          {history.length === 0 ? (
            <p className="text-muted-foreground">Primeira vez nesta questão — responda para começar o histórico.</p>
          ) : (
            <>
              <p className="text-foreground">
                <strong className="font-metric">{Math.round((correctCount / history.length) * 100)}%</strong> de acerto em{" "}
                <span className="font-metric">{history.length}</span> tentativa{history.length === 1 ? "" : "s"} suas
              </p>
              <div className="flex flex-wrap gap-1">
                {history.slice(-12).map((h, i) => (
                  <span
                    key={i}
                    title={`${new Date(h.answeredAt).toLocaleDateString("pt-BR")} — marcou ${h.selected}`}
                    className={cn(
                      "h-6 min-w-6 px-1.5 inline-flex items-center justify-center rounded-md text-[10px] font-bold",
                      h.correct ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                    )}
                  >
                    {h.selected}
                  </span>
                ))}
              </div>
            </>
          )}
          <p className="text-[11px] text-muted-foreground">
            Percentual geral entre alunos: indisponível no uso individual — aparece quando houver mais usuários.
          </p>
        </div>
      )}

      {tab === "aulas" && (
        <div className="rounded-xl bg-muted/60 p-4 animate-fade-in">
          <RelatedLessons question={question} onOpen={onOpenLesson} />
        </div>
      )}
    </article>
  );
}

/** Bateria de questões: feed contínuo (padrão) ou modo Foco (uma por vez),
 * com barra de ferramentas flutuante, atalhos de teclado e posição salva. */
const RENDER_BATCH = 25;

export function QuestionBattery({
  questions,
  kind,
  listKey,
  exportTitle,
  exportSubtitle,
}: {
  questions: Question[];
  kind: StudySession["kind"];
  /** Identifica a lista (ex.: filtros da URL) para retomar de onde parou. */
  listKey?: string;
  /** Título/subtítulo da capa da apostila em PDF. */
  exportTitle?: string;
  exportSubtitle?: string;
}) {
  const answerQuestion = useQuestionProgressStore((s) => s.answerQuestion);
  const recordStudyToday = useStudyStore((s) => s.recordStudyToday);
  const streak = useStudyStore((s) => s.currentStreak());

  const fontScaleIndex = usePracticePrefsStore((s) => s.fontScaleIndex);
  const setFontScaleIndex = usePracticePrefsStore((s) => s.setFontScaleIndex);
  const answerOnClick = usePracticePrefsStore((s) => s.answerOnClick);
  const setAnswerOnClick = usePracticePrefsStore((s) => s.setAnswerOnClick);
  const autoAdvance = usePracticePrefsStore((s) => s.autoAdvance);
  const setAutoAdvance = usePracticePrefsStore((s) => s.setAutoAdvance);
  const showTimer = usePracticePrefsStore((s) => s.showTimer);
  const setShowTimer = usePracticePrefsStore((s) => s.setShowTimer);
  const savedPositionId = usePracticePrefsStore((s) => (listKey ? s.positions[listKey] : undefined));
  const savePosition = usePracticePrefsStore((s) => s.savePosition);
  const markTool = usePracticePrefsStore((s) => s.markTool);
  const setMarkTool = usePracticePrefsStore((s) => s.setMarkTool);
  const scissorsMode = usePracticePrefsStore((s) => s.scissorsMode);
  const setScissorsMode = usePracticePrefsStore((s) => s.setScissorsMode);
  const dockOpen = useCadernoDockStore((s) => s.open);
  const toggleDock = useCadernoDockStore((s) => s.toggleDock);
  const setDockContext = useCadernoDockStore((s) => s.setContext);

  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [struck, setStruck] = useState<Record<string, string[]>>({});
  const [focusMode, setFocusMode] = useState(false);
  const [current, setCurrent] = useState(0);
  const [panel, setPanel] = useState<"stats" | "font" | "config" | "keys" | "mark" | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [preview, setPreview] = useState<{ file: LibraryFile; playlist: LibraryFile[] } | null>(null);
  const [resumeIndex] = useState(() => {
    if (!savedPositionId) return -1;
    const i = questions.findIndex((q) => q.id === savedPositionId);
    return i > 0 ? i : -1;
  });
  const [resumeDismissed, setResumeDismissed] = useState(false);
  // Sessões grandes (centenas de questões) renderizam em lotes conforme a rolagem.
  const [renderCount, setRenderCount] = useState(RENDER_BATCH);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [now, setNow] = useState(() => Date.now());
  const sessionStartRef = useRef(Date.now());
  const questionStartRef = useRef(Date.now());
  const refs = useRef<(HTMLElement | null)[]>([]);
  const scrollingToRef = useRef<number | null>(null);

  useStudyTimer(kind);

  useEffect(() => {
    if (!showTimer) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [showTimer]);

  useEffect(() => {
    const q = questions[current];
    if (q) setDockContext({ tipo: "questao", id: q.id, label: `Questão ${current + 1} — ${q.tema ?? q.subjectName}` });
  }, [current, questions, setDockContext]);

  useEffect(() => () => setDockContext(null), [setDockContext]);

  useEffect(() => {
    questionStartRef.current = Date.now();
    if (listKey && questions[current]) savePosition(listKey, questions[current].id);
  }, [current, listKey, questions, savePosition]);

  // Feed: a questão "atual" é a que está mais perto do topo da tela.
  useEffect(() => {
    if (focusMode) return;
    let frame = 0;
    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (scrollingToRef.current !== null) return;
        const anchor = 140;
        let best = 0;
        let bestDist = Infinity;
        refs.current.forEach((el, i) => {
          if (!el) return;
          const rect = el.getBoundingClientRect();
          if (rect.bottom < anchor) return;
          const dist = Math.abs(rect.top - anchor);
          if (dist < bestDist) {
            bestDist = dist;
            best = i;
          }
        });
        setCurrent(best);
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [focusMode, questions.length]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || focusMode) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setRenderCount((n) => Math.min(questions.length, n + RENDER_BATCH));
      },
      { rootMargin: "1200px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [focusMode, questions.length, renderCount]);

  const goTo = useCallback(
    (index: number) => {
      const target = Math.max(0, Math.min(questions.length - 1, index));
      setCurrent(target);
      if (!focusMode) {
        scrollingToRef.current = target;
        const scroll = () => refs.current[target]?.scrollIntoView({ behavior: "smooth", block: "start" });
        if (target >= renderCount) {
          setRenderCount(Math.min(questions.length, target + RENDER_BATCH));
          requestAnimationFrame(() => requestAnimationFrame(scroll));
        } else scroll();
        setTimeout(() => (scrollingToRef.current = null), 900);
      }
    },
    [focusMode, questions.length, renderCount]
  );

  const submit = useCallback(
    (question: Question, letter?: string) => {
      const selected = letter ?? answers[question.id]?.selected;
      if (!selected) return;
      setAnswers((a) => ({ ...a, [question.id]: { selected, submitted: true } }));
      if (!question.anulada) answerQuestion(question.id, selected, question.gabarito);
      recordStudyToday();
      if (autoAdvance) {
        const idx = questions.findIndex((q) => q.id === question.id);
        if (idx < questions.length - 1) setTimeout(() => goTo(idx + 1), 1100);
      }
    },
    [answers, answerQuestion, recordStudyToday, autoAdvance, questions, goTo]
  );

  const select = useCallback(
    (question: Question, letter: string) => {
      if (answers[question.id]?.submitted) return;
      if (answerOnClick) {
        submit(question, letter);
        return;
      }
      setAnswers((a) => ({ ...a, [question.id]: { selected: letter, submitted: false } }));
    },
    [answers, answerOnClick, submit]
  );

  // Atalhos: A–E / 1–5 escolhem, Enter responde, → ou espaço avança, ← volta.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"]')) return;
      const question = questions[current];
      if (!question) return;
      const key = e.key.toLowerCase();
      const letters = question.alternatives.map((a) => a.letter.toLowerCase());
      const byNumber = /^[1-5]$/.test(key) ? letters[Number(key) - 1] : undefined;
      const letter = letters.includes(key) ? key : byNumber;
      if (letter) {
        e.preventDefault();
        select(question, letter.toUpperCase());
      } else if (e.key === "Enter") {
        e.preventDefault();
        submit(question);
      } else if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goTo(current + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(current - 1);
      } else if (key === "?") {
        setPanel((p) => (p === "keys" ? null : "keys"));
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [questions, current, select, submit, goTo]);

  const sessionStats = useMemo(() => {
    let answered = 0,
      correct = 0;
    for (const q of questions) {
      const a = answers[q.id];
      if (!a?.submitted || q.anulada) continue;
      answered++;
      if (a.selected === q.gabarito) correct++;
    }
    return { answered, correct, wrong: answered - correct };
  }, [answers, questions]);

  if (questions.length === 0) return null;

  const fontScale = FONT_SCALES[fontScaleIndex];
  const sessionSeconds = Math.max(0, Math.floor((now - sessionStartRef.current) / 1000));
  const questionSeconds = Math.max(0, Math.floor((now - questionStartRef.current) / 1000));

  function renderItem(q: Question, i: number) {
    return (
      <QuestionItem
        key={q.id}
        question={q}
        index={i}
        total={questions.length}
        state={answers[q.id] ?? { selected: null, submitted: false }}
        struck={struck[q.id] ?? []}
        fontScale={fontScale}
        isCurrent={!focusMode && i === current}
        onSelect={(l) => {
          setCurrent(i);
          select(q, l);
        }}
        onSubmit={() => submit(q)}
        onRetry={() => setAnswers((a) => ({ ...a, [q.id]: { selected: null, submitted: false } }))}
        onToggleStrike={(l) =>
          setStruck((s) => {
            const list = s[q.id] ?? [];
            return { ...s, [q.id]: list.includes(l) ? list.filter((x) => x !== l) : [...list, l] };
          })
        }
        onOpenLesson={(file, playlist) => setPreview({ file, playlist })}
        registerRef={(el) => {
          refs.current[i] = el;
        }}
      />
    );
  }

  const toolbarBtn = (active: boolean) =>
    cn(
      "h-10 w-10 inline-flex items-center justify-center rounded-xl transition-colors",
      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
    );

  return (
    <div className={cn("flex flex-col gap-4 pb-28 lg:pr-16 transition-[padding]", dockOpen && "lg:pr-[400px]")}>
      <div className="max-w-3xl mx-auto w-full flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5">
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-metric">
          <span>
            <strong className="text-foreground">{sessionStats.answered}</strong> respondidas ·{" "}
            <span className="text-success">{sessionStats.correct} certas</span> ·{" "}
            <span className="text-danger">{sessionStats.wrong} erradas</span>
          </span>
          {streak > 0 && <span className="text-warning">🔥 {streak}d</span>}
        </div>
        <div className="flex items-center gap-2">
        <FocusTimerInline label={kind === "simulado" ? "Simulado" : "Resolvendo questões"} />
        <button type="button" className="btn-outline btn-sm" onClick={() => setExportOpen(true)} title="Apostila em PDF com estas questões">
          <FileDown size={13} /> Apostila PDF ({questions.length})
        </button>
        </div>
      </div>

      <ApostilaExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        questions={questions}
        title={exportTitle}
        subtitle={exportSubtitle}
      />

      {resumeIndex > 0 && !resumeDismissed && (
        <div className="max-w-3xl mx-auto w-full rounded-xl border border-primary/40 bg-primary-light px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-foreground">
            Você parou na <strong>questão {resumeIndex + 1}</strong> de {questions.length} desta lista.
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setResumeDismissed(true)}>
              Recomeçar
            </button>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => {
                setResumeDismissed(true);
                goTo(resumeIndex);
              }}
            >
              Continuar de onde parei
            </button>
          </div>
        </div>
      )}

      {focusMode ? (
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-4">
          {renderItem(questions[current], current)}
          <div className="flex items-center justify-between gap-3">
            <button type="button" className="btn-outline" disabled={current === 0} onClick={() => goTo(current - 1)}>
              <ChevronLeft size={16} /> Anterior
            </button>
            <span className="text-xs text-muted-foreground font-metric">
              {current + 1} / {questions.length}
            </span>
            <button type="button" className="btn-primary" disabled={current === questions.length - 1} onClick={() => goTo(current + 1)}>
              Próxima <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-4">
          {questions.slice(0, renderCount).map((q, i) => renderItem(q, i))}
          {renderCount < questions.length && (
            <div ref={sentinelRef} className="card p-4 text-center text-xs text-muted-foreground font-metric">
              Carregando mais questões… ({renderCount} de {questions.length})
            </div>
          )}
        </div>
      )}

      {/* Barra de ferramentas flutuante: vertical à direita no desktop, horizontal no celular. */}
      <div
        className={cn(
          "fixed z-30 right-3 bottom-20 lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 flex lg:flex-col items-center gap-1 rounded-2xl border border-border bg-surface/95 backdrop-blur p-1.5 shadow-lift transition-[right]",
          dockOpen && "bottom-[calc(55vh+0.75rem)] lg:right-[392px]"
        )}
      >
        {showTimer && (
          <div className="hidden lg:flex flex-col items-center px-1 pb-1 mb-0.5 border-b border-border/60" title="Tempo da sessão / desta questão">
            <span className="font-metric text-[11px] text-foreground">{fmtClock(sessionSeconds)}</span>
            <span className="font-metric text-[10px] text-muted-foreground">{fmtClock(questionSeconds)}</span>
          </div>
        )}
        <button type="button" onClick={() => setFocusMode((v) => !v)} className={toolbarBtn(focusMode)} title={focusMode ? "Sair do foco" : "Modo foco (uma por vez)"}>
          <Focus size={17} />
        </button>
        <button
          type="button"
          onClick={() => setPanel((p) => (p === "mark" ? null : "mark"))}
          className={cn(toolbarBtn(Boolean(markTool) || panel === "mark"), "relative")}
          title="Marca-texto"
        >
          <Highlighter size={17} />
          {markTool && (
            <span
              className="absolute bottom-1 right-1 h-2 w-2 rounded-full border border-white/60"
              style={{ backgroundColor: markTool.style === "marca" ? HIGHLIGHT_HEX[markTool.color] : UNDERLINE_HEX[markTool.color] }}
            />
          )}
        </button>
        <button
          type="button"
          onClick={() => setScissorsMode(!scissorsMode)}
          className={toolbarBtn(scissorsMode)}
          title={scissorsMode ? "Sair do modo tesoura" : "Modo tesoura: clique nas alternativas para cortá-las"}
        >
          <Scissors size={17} />
        </button>
        <button type="button" onClick={toggleDock} className={toolbarBtn(dockOpen)} title={dockOpen ? "Fechar Caderno" : "Abrir Caderno ao lado"}>
          <NotebookPen size={17} />
        </button>
        <span className="hidden lg:block h-px w-6 bg-border my-0.5" />
        <button type="button" onClick={() => setPanel((p) => (p === "stats" ? null : "stats"))} className={toolbarBtn(panel === "stats")} title="Desempenho da sessão">
          <BarChart3 size={17} />
        </button>
        <button type="button" onClick={() => setShowTimer(!showTimer)} className={toolbarBtn(showTimer)} title={showTimer ? "Ocultar cronômetro" : "Mostrar cronômetro"}>
          <Clock size={17} />
        </button>
        <button type="button" onClick={() => setPanel((p) => (p === "font" ? null : "font"))} className={toolbarBtn(panel === "font")} title="Tamanho do texto">
          <Type size={17} />
        </button>
        <button type="button" onClick={() => setPanel((p) => (p === "config" ? null : "config"))} className={toolbarBtn(panel === "config")} title="Preferências da sessão">
          <Settings2 size={17} />
        </button>
        <button type="button" onClick={() => setPanel((p) => (p === "keys" ? null : "keys"))} className={cn(toolbarBtn(panel === "keys"), "hidden lg:inline-flex")} title="Atalhos de teclado (?)">
          <Keyboard size={17} />
        </button>
      </div>

      {panel && (
        <div
          className={cn(
            "fixed z-30 right-3 bottom-36 lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:right-20 w-72 rounded-2xl border border-border bg-surface shadow-lift p-4 animate-fade-in",
            dockOpen && "lg:right-[460px]"
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">
              {panel === "stats" && "Desempenho nesta sessão"}
              {panel === "font" && "Tamanho do texto"}
              {panel === "config" && "Preferências"}
              {panel === "keys" && "Atalhos de teclado"}
              {panel === "mark" && "Marca-texto"}
            </p>
            <button type="button" onClick={() => setPanel(null)} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
              <X size={15} />
            </button>
          </div>

          {panel === "stats" && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/60 py-2">
                  <p className="font-metric text-lg text-foreground">{sessionStats.answered}</p>
                  <p className="text-[10px] text-muted-foreground">respondidas</p>
                </div>
                <div className="rounded-lg bg-success/10 py-2">
                  <p className="font-metric text-lg text-success">{sessionStats.correct}</p>
                  <p className="text-[10px] text-muted-foreground">certas</p>
                </div>
                <div className="rounded-lg bg-danger/10 py-2">
                  <p className="font-metric text-lg text-danger">{sessionStats.wrong}</p>
                  <p className="text-[10px] text-muted-foreground">erradas</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Aproveitamento:{" "}
                <strong className="text-foreground font-metric">
                  {sessionStats.answered > 0 ? Math.round((sessionStats.correct / sessionStats.answered) * 100) : 0}%
                </strong>{" "}
                · tempo: <span className="font-metric">{fmtClock(sessionSeconds)}</span>
              </p>
              <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
                {questions.map((q, i) => {
                  const a = answers[q.id];
                  const tone = !a?.submitted
                    ? "bg-muted text-muted-foreground"
                    : q.anulada
                      ? "bg-warning/15 text-warning"
                      : a.selected === q.gabarito
                        ? "bg-success/15 text-success"
                        : "bg-danger/15 text-danger";
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => goTo(i)}
                      className={cn("h-7 w-7 rounded-md text-[10px] font-metric font-semibold", tone, i === current && "ring-1 ring-primary")}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {panel === "font" && (
            <div className="flex items-center gap-2">
              {FONT_SCALES.map((scale, i) => (
                <button
                  key={scale}
                  type="button"
                  onClick={() => setFontScaleIndex(i)}
                  className={cn(
                    "flex-1 rounded-lg border py-2 font-semibold transition-colors",
                    i === fontScaleIndex ? "border-primary bg-primary-light text-primary" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                  style={{ fontSize: `${scale * 0.85}rem` }}
                >
                  Aa
                </button>
              ))}
            </div>
          )}

          {panel === "config" && (
            <div className="flex flex-col gap-3 text-sm">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={answerOnClick} onChange={(e) => setAnswerOnClick(e.target.checked)} className="mt-1 accent-[hsl(var(--primary))]" />
                <span>
                  <span className="text-foreground">Revelar gabarito ao clicar</span>
                  <span className="block text-xs text-muted-foreground">Responde direto ao escolher a alternativa, sem o botão Responder.</span>
                </span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)} className="mt-1 accent-[hsl(var(--primary))]" />
                <span>
                  <span className="text-foreground">Avançar automaticamente</span>
                  <span className="block text-xs text-muted-foreground">Vai para a próxima questão logo depois de responder.</span>
                </span>
              </label>
            </div>
          )}

          {panel === "mark" && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                Com uma ferramenta ativa, é só selecionar o texto com o mouse. Sem ferramenta, a seleção abre as opções.
              </p>
              {(["marca", "sublinhado"] as const).map((style) => (
                <div key={style} className="flex items-center gap-2">
                  <span className="w-16 text-[11px] font-medium text-muted-foreground">{style === "marca" ? "Marcar" : "Sublinhar"}</span>
                  {COLOR_ORDER.map((color) => {
                    const active = markTool?.style === style && markTool.color === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setMarkTool(active ? null : { style, color })}
                        aria-pressed={active}
                        title={`${style === "marca" ? "Marcar" : "Sublinhar"} (${color})`}
                        className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center transition-all",
                          active ? "ring-2 ring-primary ring-offset-2 ring-offset-surface" : "hover:scale-105"
                        )}
                        style={style === "marca" ? { backgroundColor: HIGHLIGHT_HEX[color] } : undefined}
                      >
                        {style === "sublinhado" && (
                          <span className="text-sm font-bold text-foreground" style={{ borderBottom: `3px solid ${UNDERLINE_HEX[color]}`, lineHeight: 1 }}>
                            U
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
              <button type="button" onClick={() => setMarkTool(null)} disabled={!markTool} className="btn-outline btn-sm self-start">
                Desligar marca-texto
              </button>
            </div>
          )}

          {panel === "keys" && (
            <ul className="flex flex-col gap-2 text-xs text-muted-foreground">
              {[
                ["A–E ou 1–5", "escolher alternativa"],
                ["Enter", "responder"],
                ["→ ou Espaço", "próxima questão"],
                ["←", "questão anterior"],
                ["?", "mostrar/ocultar atalhos"],
                ["Botão direito", "cortar alternativa"],
              ].map(([k, v]) => (
                <li key={k} className="flex items-center justify-between gap-3">
                  <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-metric text-[11px] text-foreground">{k}</kbd>
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <CadernoDock variant="fixed" />

      <FilePreviewModal
        file={preview?.file ?? null}
        playlist={preview?.playlist}
        onNavigate={(f) => setPreview((p) => (p ? { ...p, file: f } : p))}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
