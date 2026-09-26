"use client";

import { useState } from "react";
import { BookmarkPlus, Check, Plus } from "lucide-react";
import { useNotebookStore } from "@/lib/notebookStore";
import { cn } from "@/lib/utils";

/** Popover simples para adicionar/remover uma questão de um ou mais cadernos —
 * cria um caderno novo na hora, se preciso. */
export function NotebookPicker({ questionId }: { questionId: string }) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const notebooks = useNotebookStore((s) => s.notebooks);
  const entries = useNotebookStore((s) => s.entries);
  const createNotebook = useNotebookStore((s) => s.createNotebook);
  const addQuestion = useNotebookStore((s) => s.addQuestion);
  const removeQuestion = useNotebookStore((s) => s.removeQuestion);

  const inAnyNotebook = notebooks.some((n) => (entries[n.id] ?? []).includes(questionId));

  function toggle(notebookId: string) {
    const has = (entries[notebookId] ?? []).includes(questionId);
    if (has) removeQuestion(notebookId, questionId);
    else addQuestion(notebookId, questionId);
  }

  function handleCreate() {
    if (!newName.trim()) return;
    const notebook = createNotebook(newName.trim());
    addQuestion(notebook.id, questionId);
    setNewName("");
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Adicionar a um caderno"
        title="Adicionar a um caderno"
        className={cn("inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-surface-hover", inAnyNotebook ? "text-accent" : "text-muted-foreground")}
      >
        <BookmarkPlus size={16} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-xl border border-border bg-surface shadow-lift p-2 animate-fade-in">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1">Adicionar a um caderno</p>
            <div className="max-h-40 overflow-y-auto flex flex-col">
              {notebooks.map((n) => {
                const checked = (entries[n.id] ?? []).includes(questionId);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => toggle(n.id)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-hover text-left text-sm"
                  >
                    <span className={cn("flex h-4 w-4 items-center justify-center rounded border shrink-0", checked ? "bg-primary border-primary text-primary-foreground" : "border-border")}>
                      {checked && <Check size={11} />}
                    </span>
                    <span className="truncate">{n.name}</span>
                  </button>
                );
              })}
              {notebooks.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1.5">Nenhum caderno ainda.</p>}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-border/60">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Novo caderno..."
                className="input text-xs py-1.5 flex-1"
              />
              <button type="button" onClick={handleCreate} disabled={!newName.trim()} className="btn-primary btn-sm shrink-0">
                <Plus size={13} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
