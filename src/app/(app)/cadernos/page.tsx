"use client";

import { useState } from "react";
import Link from "next/link";
import { BookMarked, Plus, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { EmptyBoxIllustration } from "@/components/Illustrations";
import { useNotebookStore } from "@/lib/notebookStore";
import { formatRelativeDate } from "@/lib/utils";

export default function CadernosPage() {
  const notebooks = useNotebookStore((s) => s.notebooks);
  const entries = useNotebookStore((s) => s.entries);
  const createNotebook = useNotebookStore((s) => s.createNotebook);
  const deleteNotebook = useNotebookStore((s) => s.deleteNotebook);

  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");

  function handleCreate() {
    if (!name.trim()) return;
    createNotebook(name.trim());
    setName("");
    setShowNew(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground inline-flex items-center gap-2.5">
            <BookMarked size={22} className="text-accent" /> Meus Cadernos
          </h1>
          <p className="text-muted-foreground mt-1">Coleções pessoais de questões — organize do seu jeito, sem depender de disciplina ou tema.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowNew((v) => !v)}>
          <Plus size={15} /> Novo caderno
        </button>
      </div>

      {showNew && (
        <section className="card p-5 flex flex-col gap-3 animate-fade-in">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Nome do caderno (ex.: Revisão da véspera)"
              className="input flex-1 min-w-[220px]"
            />
            <button type="button" className="btn-primary" onClick={handleCreate} disabled={!name.trim()}>
              Criar
            </button>
          </div>
        </section>
      )}

      {notebooks.length === 0 ? (
        <EmptyState
          illustration={<EmptyBoxIllustration />}
          title="Nenhum caderno ainda."
          description="Crie um caderno e adicione questões a ele direto do Banco de Questões ou dos Quizzes."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {notebooks.map((n) => (
            <div key={n.id} className="card p-5 flex flex-col gap-3">
              <Link href={`/cadernos/${n.id}`} className="flex flex-col gap-1.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <BookMarked size={18} />
                </div>
                <h3 className="font-semibold text-foreground">{n.name}</h3>
                <p className="text-xs text-muted-foreground font-metric">
                  {(entries[n.id] ?? []).length} questões · criado {formatRelativeDate(n.createdAt)}
                </p>
              </Link>
              <button
                type="button"
                onClick={() => deleteNotebook(n.id)}
                className="text-xs text-muted-foreground hover:text-danger inline-flex items-center gap-1 self-start"
              >
                <Trash2 size={12} /> Excluir caderno
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
