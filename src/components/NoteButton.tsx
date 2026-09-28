"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CornerDownLeft, NotebookPen, Plus, X } from "lucide-react";
import { useCadernoStore } from "@/lib/cadernoStore";
import { Markdown } from "@/lib/markdown";
import type { NoteOrigin } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEFAULT_TITLE = "Minhas anotações";

/** Painel lateral "Adicionar ao caderno" — escreve sem sair do contexto
 * (questão, aula ou material), com o último caderno usado já aberto. */
export function NotePanel({ origin, onClose }: { origin?: NoteOrigin; onClose: () => void }) {
  const cadernos = useCadernoStore((s) => s.cadernos);
  const lastUsedId = useCadernoStore((s) => s.lastUsedId);
  const createCaderno = useCadernoStore((s) => s.createCaderno);
  const appendEntry = useCadernoStore((s) => s.appendEntry);

  const [selectedId, setSelectedId] = useState<string>(() => lastUsedId ?? cadernos[0]?.id ?? "novo");
  const [newTitle, setNewTitle] = useState("");
  const [texto, setTexto] = useState("");
  const [withRef, setWithRef] = useState(Boolean(origin));
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const selected = cadernos.find((c) => c.id === selectedId);

  function save() {
    if (!texto.trim() && !(withRef && origin)) return;
    let targetId = selected?.id;
    if (!targetId) targetId = createCaderno(newTitle.trim() || DEFAULT_TITLE).id;
    appendEntry(targetId, texto, withRef ? origin : undefined);
    setSelectedId(targetId);
    setTexto("");
    setNewTitle("");
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-foreground/20" />
      <aside
        className="relative h-full w-full max-w-md bg-surface border-l border-border shadow-lift flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Adicionar ao caderno"
      >
        <div className="flex items-center justify-between gap-3 px-5 h-14 border-b border-border shrink-0">
          <p className="font-semibold text-foreground inline-flex items-center gap-2">
            <NotebookPen size={17} className="text-accent" /> Adicionar ao caderno
          </p>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-5 border-b border-border shrink-0">
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="input py-2 text-sm" aria-label="Caderno">
            {cadernos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
            <option value="novo">+ Novo caderno…</option>
          </select>
          {!selected && (
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={`Nome do novo caderno (ex.: ${DEFAULT_TITLE})`}
              className="input py-2 text-sm"
            />
          )}

          {origin && withRef && (
            <span className="self-start inline-flex items-center gap-1.5 rounded-full bg-accent/10 text-accent text-[11px] font-medium pl-2 pr-1 py-0.5">
              <CornerDownLeft size={10} /> via {origin.label}
              <button
                type="button"
                onClick={() => setWithRef(false)}
                aria-label="Remover referência"
                className="h-4 w-4 inline-flex items-center justify-center rounded-full hover:bg-accent/20"
              >
                <X size={10} />
              </button>
            </span>
          )}

          <textarea
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") save();
            }}
            rows={6}
            placeholder="Escreva sua anotação (markdown: **negrito**, - listas, ==grifo==)…  Ctrl+Enter salva"
            className="input text-sm leading-relaxed resize-none"
          />
          <div className="flex items-center justify-between gap-2">
            <span className={cn("text-xs text-success transition-opacity", savedFlash ? "opacity-100" : "opacity-0")}>Anotação salva ✓</span>
            <button type="button" onClick={save} className="btn-primary btn-sm" disabled={!texto.trim() && !(withRef && origin)}>
              <Plus size={14} /> Adicionar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {selected ? (
            <>
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{selected.titulo}</p>
                <Link href={`/caderno?id=${selected.id}`} className="text-xs font-medium text-primary">
                  Abrir completo →
                </Link>
              </div>
              {selected.conteudo.trim() ? (
                <Markdown source={selected.conteudo} />
              ) : (
                <p className="text-sm text-muted-foreground">Este caderno ainda está vazio.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">A anotação cria um caderno novo ao ser salva.</p>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
}

export function NoteButton({ origin, className, label = "Anotar" }: { origin?: NoteOrigin; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "btn-outline btn-sm"} title="Adicionar ao caderno">
        <NotebookPen size={14} /> {label}
      </button>
      {open && <NotePanel origin={origin} onClose={() => setOpen(false)} />}
    </>
  );
}
