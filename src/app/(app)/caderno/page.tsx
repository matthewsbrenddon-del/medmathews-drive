"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NotebookPen, Plus, Search, Trash2 } from "lucide-react";
import { CadernoEditor } from "@/components/CadernoEditor";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { EmptyState } from "@/components/EmptyState";
import { EmptyBoxIllustration } from "@/components/Illustrations";
import { LoadingState } from "@/components/LoadingState";
import { useCadernoStore } from "@/lib/cadernoStore";
import { markdownToPlain } from "@/lib/markdown";
import { cn, formatRelativeDate, normalizeText } from "@/lib/utils";

const SUGGESTIONS = ["Cardiologia — pontos-chave", "Erros recorrentes", "Revisão pré-prova", "Mnemônicos"];

function CadernoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cadernos = useCadernoStore((s) => s.cadernos);
  const lastUsedId = useCadernoStore((s) => s.lastUsedId);
  const createCaderno = useCadernoStore((s) => s.createCaderno);
  const deleteCaderno = useCadernoStore((s) => s.deleteCaderno);
  const touch = useCadernoStore((s) => s.touch);

  const [query, setQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const requestedId = searchParams.get("id");
  const [selectedId, setSelectedId] = useState<string | null>(requestedId ?? lastUsedId ?? null);

  useEffect(() => {
    if (requestedId) setSelectedId(requestedId);
  }, [requestedId]);

  const sorted = useMemo(() => [...cadernos].sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)), [cadernos]);
  const filtered = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return sorted;
    return sorted.filter((c) => normalizeText(`${c.titulo} ${markdownToPlain(c.conteudo)}`).includes(q));
  }, [sorted, query]);

  const selected = cadernos.find((c) => c.id === selectedId) ?? sorted[0];

  function select(id: string) {
    setSelectedId(id);
    touch(id);
    router.replace(`/caderno?id=${id}`, { scroll: false });
  }

  function create(titulo: string) {
    const c = createCaderno(titulo);
    select(c.id);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground inline-flex items-center gap-2.5">
            <NotebookPen size={22} className="text-accent" /> Caderno
          </h1>
          <p className="text-muted-foreground mt-1">
            Seu bloco de notas livre — resumos, dúvidas, mnemônicos. Anote também direto de uma questão, aula ou material pelo
            botão <strong className="text-foreground">Anotar</strong>.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => create("Novo caderno")}>
          <Plus size={15} /> Novo caderno
        </button>
      </div>

      {cadernos.length === 0 ? (
        <EmptyState
          illustration={<EmptyBoxIllustration />}
          title="Nenhum caderno ainda."
          description="Crie o primeiro — ou comece por uma sugestão:"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="btn-outline btn-sm" onClick={() => create(s)}>
                  <Plus size={13} /> {s}
                </button>
              ))}
            </div>
          }
        />
      ) : (
        <div className="grid lg:grid-cols-[280px_1fr] gap-5 items-start">
          <aside className="card p-3 flex flex-col gap-2 lg:sticky lg:top-6">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar título ou conteúdo…"
                className="input pl-9 py-2 text-sm"
                aria-label="Buscar nos cadernos"
              />
            </div>
            <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
              {filtered.map((c) => {
                const preview = markdownToPlain(c.conteudo).slice(0, 80);
                const active = selected?.id === c.id;
                return (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => select(c.id)}
                    onKeyDown={(e) => e.key === "Enter" && select(c.id)}
                    className={cn(
                      "group rounded-xl px-3 py-2.5 cursor-pointer transition-colors",
                      active ? "bg-primary-light" : "hover:bg-surface-hover"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("text-sm font-medium truncate", active ? "text-primary" : "text-foreground")}>{c.titulo}</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(c.id);
                        }}
                        aria-label={`Excluir ${c.titulo}`}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-danger"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{preview || "Vazio"}</p>
                    <p className="text-[10px] text-muted-foreground/70 font-metric mt-1">{formatRelativeDate(c.atualizadoEm)}</p>
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="text-xs text-muted-foreground px-2 py-3">Nada encontrado para “{query}”.</p>}
            </div>
          </aside>

          <section className="card p-5 flex flex-col min-h-[520px]">
            {selected ? <CadernoEditor key={selected.id} cadernoId={selected.id} /> : null}
          </section>
        </div>
      )}

      <ConfirmationModal
        open={confirmDelete !== null}
        title="Excluir este caderno?"
        description="Todo o texto dele será apagado deste dispositivo. Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        danger
        onConfirm={() => {
          if (confirmDelete) deleteCaderno(confirmDelete);
          if (confirmDelete === selected?.id) setSelectedId(null);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

export default function CadernoPage() {
  return (
    <Suspense fallback={<LoadingState label="Abrindo o caderno..." />}>
      <CadernoContent />
    </Suspense>
  );
}
