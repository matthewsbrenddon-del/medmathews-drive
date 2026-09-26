"use client";

import { useMemo, useRef, useState } from "react";
import { useHighlightStore } from "@/lib/highlightStore";
import type { Highlight, HighlightColor } from "@/lib/types";

const HIGHLIGHT_HEX: Record<HighlightColor, string> = {
  amarelo: "#fde047",
  rosa: "#f9a8d4",
  verde: "#86efac",
  ciano: "#67e8f9",
};

const COLOR_ORDER: HighlightColor[] = ["amarelo", "rosa", "verde", "ciano"];

/** Soma o texto de todos os nós de texto dentro de `root` até alcançar `node`,
 * para converter uma posição de Selection (nó + offset) em um offset de
 * caractere sobre o texto puro do container — funciona mesmo com o texto já
 * quebrado em vários <mark>/<span> por causa de grifos existentes. */
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

/** Texto marcável com o mouse — seleciona um trecho e escolhe uma das 4 cores
 * fixas (amarelo/rosa/verde/ciano) num popover; clicar num trecho já grifado
 * remove o grifo. Os grifos são persistidos por questão+campo. */
export function HighlightableText({
  questionId,
  field,
  text,
  className,
}: {
  questionId: string;
  field: Highlight["field"];
  text: string;
  className?: string;
}) {
  const allHighlights = useHighlightStore((s) => s.highlights);
  const addHighlight = useHighlightStore((s) => s.addHighlight);
  const removeHighlight = useHighlightStore((s) => s.removeHighlight);
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

  function handleMouseUp() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !containerRef.current) {
      setPending(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) return;

    const start = textOffset(containerRef.current, range.startContainer, range.startOffset);
    const end = textOffset(containerRef.current, range.endContainer, range.endOffset);
    if (start === end) return;

    const rect = range.getBoundingClientRect();
    setPending({ start: Math.min(start, end), end: Math.max(start, end), x: rect.left + rect.width / 2, y: rect.top });
  }

  function applyColor(color: HighlightColor) {
    if (!pending) return;
    for (const h of highlights) {
      if (h.start < pending.end && h.end > pending.start) removeHighlight(h.id);
    }
    addHighlight(questionId, field, pending.start, pending.end, color);
    window.getSelection()?.removeAllRanges();
    setPending(null);
  }

  return (
    <div ref={containerRef} onMouseUp={handleMouseUp} className={className}>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark
            key={i}
            onClick={() => removeHighlight(seg.highlight!.id)}
            title="Clique para remover o grifo"
            style={{ backgroundColor: HIGHLIGHT_HEX[seg.highlight.color], color: "#1a1a1a" }}
            className="rounded-[2px] cursor-pointer"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}

      {pending && (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full flex items-center gap-1.5 rounded-full border border-border bg-surface shadow-lift px-2 py-1.5 animate-fade-in"
          style={{ left: pending.x, top: pending.y - 8 }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {COLOR_ORDER.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => applyColor(color)}
              aria-label={`Grifar de ${color}`}
              title={color}
              className="h-5 w-5 rounded-full border border-black/10 hover:scale-110 transition-transform"
              style={{ backgroundColor: HIGHLIGHT_HEX[color] }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
