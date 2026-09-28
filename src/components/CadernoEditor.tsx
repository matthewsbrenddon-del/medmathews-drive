"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold,
  CheckCircle2,
  Columns2,
  Eye,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  PenLine,
  Quote,
} from "lucide-react";
import { useCadernoStore } from "@/lib/cadernoStore";
import { Markdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

type Mode = "escrever" | "visualizar" | "dividido";

const SAVE_DELAY_MS = 1200;

/** Editor de um caderno: markdown leve + barra de formatação + autosave. */
export function CadernoEditor({ cadernoId, compact = false }: { cadernoId: string; compact?: boolean }) {
  const caderno = useCadernoStore((s) => s.cadernos.find((c) => c.id === cadernoId));
  const updateConteudo = useCadernoStore((s) => s.updateConteudo);
  const renameCaderno = useCadernoStore((s) => s.renameCaderno);

  const [draft, setDraft] = useState(caderno?.conteudo ?? "");
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<Mode>(compact ? "escrever" : "dividido");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<string | null>(null);

  // Troca de caderno (ou conteúdo alterado por fora, ex.: "Adicionar ao caderno"
  // em outro lugar): recarrega o rascunho só se não houver edição pendente.
  useEffect(() => {
    if (pendingRef.current === null) setDraft(caderno?.conteudo ?? "");
  }, [cadernoId, caderno?.conteudo]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pendingRef.current !== null) updateConteudo(cadernoId, pendingRef.current);
    };
  }, [cadernoId, updateConteudo]);

  if (!caderno) return null;

  function scheduleSave(value: string) {
    pendingRef.current = value;
    setSaving(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (pendingRef.current !== null) updateConteudo(cadernoId, pendingRef.current);
      pendingRef.current = null;
      setSaving(false);
    }, SAVE_DELAY_MS);
  }

  function change(value: string) {
    setDraft(value);
    scheduleSave(value);
  }

  function wrap(marker: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const selected = draft.slice(a, b) || "texto";
    const value = draft.slice(0, a) + marker + selected + marker + draft.slice(b);
    change(value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + marker.length, a + marker.length + selected.length);
    });
  }

  function prefixLines(prefix: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const lineStart = draft.lastIndexOf("\n", a - 1) + 1;
    const block = draft.slice(lineStart, b);
    const updated = block
      .split("\n")
      .map((line, i) => (prefix === "1. " ? `${i + 1}. ` : prefix) + line.replace(/^(#{1,3}\s|[-*]\s(\[[ xX]\]\s)?|\d+[.)]\s|>\s?)/, ""))
      .join("\n");
    change(draft.slice(0, lineStart) + updated + draft.slice(b));
    requestAnimationFrame(() => el.focus());
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      wrap("**");
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
      e.preventDefault();
      wrap("*");
    }
  }

  const tools = [
    { icon: Bold, label: "Negrito (Ctrl+B)", run: () => wrap("**") },
    { icon: Italic, label: "Itálico (Ctrl+I)", run: () => wrap("*") },
    { icon: Highlighter, label: "Grifar", run: () => wrap("==") },
    { icon: Heading1, label: "Título", run: () => prefixLines("# ") },
    { icon: Heading2, label: "Subtítulo", run: () => prefixLines("## ") },
    { icon: List, label: "Lista", run: () => prefixLines("- ") },
    { icon: ListOrdered, label: "Lista numerada", run: () => prefixLines("1. ") },
    { icon: ListChecks, label: "Checklist", run: () => prefixLines("- [ ] ") },
    { icon: Quote, label: "Citação", run: () => prefixLines("> ") },
  ];

  const showEditor = mode !== "visualizar";
  const showPreview = mode !== "escrever";

  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1">
      <div className="flex items-center justify-between gap-3">
        <input
          key={caderno.id}
          defaultValue={caderno.titulo}
          onBlur={(e) => e.target.value.trim() !== caderno.titulo && renameCaderno(caderno.id, e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          aria-label="Título do caderno"
          className={cn(
            "bg-transparent font-semibold text-foreground outline-none min-w-0 flex-1 rounded-lg px-1 -mx-1 focus:bg-muted",
            compact ? "text-base" : "text-xl"
          )}
        />
        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 shrink-0 font-metric" aria-live="polite">
          {saving ? (
            <>
              <Loader2 size={11} className="animate-spin" /> Salvando…
            </>
          ) : (
            <>
              <CheckCircle2 size={11} className="text-success" /> Salvo
            </>
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-border bg-muted/50 p-0.5">
          {tools.map(({ icon: Icon, label, run }) => (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={run}
              disabled={!showEditor}
              className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface disabled:opacity-40"
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
        {!compact && (
          <div className="flex rounded-xl border border-border p-0.5 bg-muted/50">
            {(
              [
                ["escrever", PenLine, "Escrever"],
                ["dividido", Columns2, "Lado a lado"],
                ["visualizar", Eye, "Visualizar"],
              ] as const
            ).map(([id, Icon, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors",
                  mode === id ? "bg-surface shadow-card text-foreground" : "text-muted-foreground"
                )}
              >
                <Icon size={13} /> <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={cn("grid gap-3 min-h-0 flex-1", showEditor && showPreview ? "lg:grid-cols-2" : "grid-cols-1")}>
        {showEditor && (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => change(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={"Escreva livremente: resumos, dúvidas, mnemônicos...\n\n# Título\n- tópico\n**negrito**, *itálico*, ==grifo=="}
            className={cn("input font-mono text-[13px] leading-relaxed resize-none", compact ? "min-h-[220px]" : "min-h-[420px]")}
            aria-label="Conteúdo do caderno"
          />
        )}
        {showPreview && (
          <div className={cn("rounded-xl border border-border bg-surface p-4 overflow-y-auto", compact ? "max-h-[260px]" : "min-h-[420px]")}>
            {draft.trim() ? <Markdown source={draft} /> : <p className="text-sm text-muted-foreground">Nada escrito ainda.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
