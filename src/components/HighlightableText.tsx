"use client";

import { useMemo, useRef, useState } from "react";
import { Copy, Eraser, NotebookPen } from "lucide-react";
import { useHighlightStore } from "@/lib/highlightStore";
import { usePracticePrefsStore } from "@/lib/practicePrefsStore";
import { sendToCaderno } from "@/lib/cadernoDockStore";
import type { Highlight, HighlightColor, HighlightStyle, NoteOrigin } from "@/lib/types";

/** Fundo das marcações (tons claros, com texto escuro por cima — legíveis nos dois temas). */
export const HIGHLIGHT_HEX: Record<HighlightColor, string> = {
  amarelo: "#fde047",
  rosa: "#f9a8d4",
  verde: "#86efac",
  ciano: "#67e8f9",
};

/** Traço do sublinhado (tons mais fortes — visíveis sobre fundo claro e escuro). */
export const UNDERLINE_HEX: Record<HighlightColor, string> = {
  amarelo: "#eab308",
  rosa: "#ec4899",
  verde: "#22c55e",
  ciano: "#06b6d4",
};

export const COLOR_ORDER: HighlightColor[] = ["amarelo", "rosa", "verde", "ciano"];

/** Soma o texto de todos os nós de texto dentro de `root` até alcançar `node`,
 * convertendo uma posição de Selection (nó + offset) num offset sobre o texto puro. */
function textOffset(root: HTMLElement, node: Node, offset: number): number {
  let total = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    if (current === node) return total + offset;
    total += current.textContent?.length ?? 0;
    current = walker.nextNode();
  }
  return total;
}

interface PendingSelection {
  start: number;
  end: number;
  x: number;
  y: number;
}

/**
 * Texto marcável com o mouse: selecione um trecho e escolha marcar (fundo) ou
 * sublinhar em 4 cores, apagar marcações, copiar ou enviar ao Caderno. Com o
 * marca-texto da barra de ferramentas ativo, a seleção já é marcada direto.
 */
export function HighlightableText({
  questionId,
  field,
  text,
  className,
  origin,
}: {
  questionId: string;
  field: Highlight["field"];
  text: string;
  className?: string;
  origin?: NoteOrigin;
}) {
  const allHighlights = useHighlightStore((s) => s.highlights);
  const addHighlight = useHighlightStore((s) => s.addHighlight);
  const removeHighlight = useHighlightStore((s) => s.removeHighlight);
  const clearRange = useHighlightStore((s) => s.clearRange);
  const markTool = usePracticePrefsStore((s) => s.markTool);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<PendingSelection | null>(null);

  const highlights = useMemo(
    () => allHighlights.filter((h) => h.questionId === questionId && h.field === field).sort((a, b) => a.start - b.start),
    [allHighlights, questionId, field]
  );

  const segments = useMemo(() => {
    const result: { text: string; highlight?: Highlight }[] = [];
    let cursor = 0;
    for (const h of highlights) {
      const start = Math.max(cursor, Math.min(h.start, text.length));
      const end = Math.max(start, Math.min(h.end, text.length));
      if (start > cursor) result.push({ text: text.slice(cursor, start) });
      if (end > start) result.push({ text: text.slice(start, end), highlight: h });
      cursor = Math.max(cursor, end);
    }
    if (cursor < text.length) result.push({ text: text.slice(cursor) });
    return result;
  }, [text, highlights]);

  function apply(start: number, end: number, color: HighlightColor, style: HighlightStyle) {
    clearRange(questionId, field, start, end);
    addHighlight(questionId, field, start, end, color, style);
    window.getSelection()?.removeAllRanges();
    setPending(null);
  }

  function handleMouseUp(e: React.MouseEvent) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !containerRef.current) {
      setPending(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) return;
    const a = textOffset(containerRef.current, range.startContainer, range.startOffset);
    const b = textOffset(containerRef.current, range.endContainer, range.endOffset);
    if (a === b) return;
    const start = Math.min(a, b);
    const end = Math.max(a, b);
    e.stopPropagation();
    if (markTool) {
      apply(start, end, markTool.color, markTool.style);
      return;
    }
    const rect = range.getBoundingClientRect();
    setPending({ start, end, x: rect.left + rect.width / 2, y: rect.top });
  }

  const overlapsExisting = pending ? highlights.some((h) => h.start < pending.end && h.end > pending.start) : false;
  const selectedText = pending ? text.slice(pending.start, pending.end) : "";

  return (
    <div ref={containerRef} onMouseUp={handleMouseUp} className={className}>
      {segments.map((seg, i) => {
        if (!seg.highlight) return <span key={i}>{seg.text}</span>;
        const h = seg.highlight;
        const remove = (ev: React.MouseEvent) => {
          if (window.getSelection()?.isCollapsed === false) return;
          ev.stopPropagation();
          removeHighlight(h.id);
        };
        return h.style === "sublinhado" ? (
          <span
            key={i}
            onClick={remove}
            title="Clique para remover o sublinhado"
            className="cursor-pointer"
            style={{
              textDecorationLine: "underline",
              textDecorationColor: UNDERLINE_HEX[h.color],
              textDecorationThickness: "3px",
              textUnderlineOffset: "4px",
              textDecorationSkipInk: "none",
            }}
          >
            {seg.text}
          </span>
        ) : (
          <mark
            key={i}
            onClick={remove}
            title="Clique para remover a marcação"
            style={{ backgroundColor: HIGHLIGHT_HEX[h.color], color: "#1a1a1a" }}
            className="rounded-[3px] px-[1px] cursor-pointer [box-decoration-break:clone]"
          >
            {seg.text}
          </mark>
        );
      })}

      {pending && (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full flex flex-col gap-1.5 rounded-2xl border border-border bg-surface shadow-lift p-2 animate-fade-in"
          style={{ left: pending.x, top: pending.y - 10 }}
          onMouseDown={(e) => e.preventDefault()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          role="toolbar"
          aria-label="Marcar texto"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-14 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Marcar</span>
            {COLOR_ORDER.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => apply(pending.start, pending.end, color, "marca")}
                aria-label={`Marcar de ${color}`}
                title={`Marcar (${color})`}
                className="h-6 w-6 rounded-full border border-black/10 hover:scale-110 transition-transform"
                style={{ backgroundColor: HIGHLIGHT_HEX[color] }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-14 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sublinhar</span>
            {COLOR_ORDER.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => apply(pending.start, pending.end, color, "sublinhado")}
                aria-label={`Sublinhar de ${color}`}
                title={`Sublinhar (${color})`}
                className="h-6 w-6 rounded-md hover:bg-muted flex items-end justify-center pb-1 text-[11px] font-bold text-foreground transition-colors"
              >
                <span style={{ borderBottom: `3px solid ${UNDERLINE_HEX[color]}`, lineHeight: 1 }}>U</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 border-t border-border/60 pt-1.5">
            {overlapsExisting && (
              <button
                type="button"
                onClick={() => {
                  clearRange(questionId, field, pending.start, pending.end);
                  window.getSelection()?.removeAllRanges();
                  setPending(null);
                }}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-danger hover:bg-muted"
              >
                <Eraser size={12} /> Apagar
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(selectedText).catch(() => {});
                setPending(null);
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Copy size={12} /> Copiar
            </button>
            <button
              type="button"
              onClick={() => {
                sendToCaderno(`> ${selectedText.replace(/\s+/g, " ").trim()}\n`, origin);
                window.getSelection()?.removeAllRanges();
                setPending(null);
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-accent hover:bg-accent/10"
            >
              <NotebookPen size={12} /> Enviar ao Caderno
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
