"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ClipboardList, PartyPopper, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { useLibraryStore } from "@/lib/libraryStore";
import { useClassificationStore, type ManualClassification } from "@/lib/classificationStore";
import { classifyLibrary, suggestClassificationFromFileName, type ClassifiedFile } from "@/lib/classification";
import { fileName } from "@/lib/library";
import { KNOWN_SUBJECTS } from "@/lib/subjects";

export default function ClassificarPage() {
  const files = useLibraryStore((s) => s.files);
  const status = useLibraryStore((s) => s.status);
  const hydrate = useLibraryStore((s) => s.hydrate);
  const overrides = useClassificationStore((s) => s.overrides);
  const setOverridesBulk = useClassificationStore((s) => s.setOverridesBulk);
  const setOverride = useClassificationStore((s) => s.setOverride);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const unclassified = useMemo(
    () => classifyLibrary(files, overrides).filter((f) => !f.subjectSlug),
    [files, overrides]
  );

  const groups = useMemo(() => {
    const map = new Map<string, ClassifiedFile[]>();
    for (const item of unclassified) {
      const key = `${item.curso} › ${item.area}`;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [unclassified]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkDisciplina, setBulkDisciplina] = useState("");

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(items: ClassifiedFile[]) {
    setSelected((s) => {
      const next = new Set(s);
      const allSelected = items.every((i) => next.has(i.id));
      for (const item of items) {
        if (allSelected) next.delete(item.id);
        else next.add(item.id);
      }
      return next;
    });
  }

  function applyBulk() {
    if (!bulkSubject || selected.size === 0) return;
    const entry: ManualClassification = { subjectSlug: bulkSubject, disciplina: bulkDisciplina || undefined, source: "manual" };
    const entries: Record<string, ManualClassification> = {};
    for (const id of selected) entries[id] = entry;
    setOverridesBulk(entries);
    setSelected(new Set());
    setBulkDisciplina("");
  }

  function acceptSuggestion(item: ClassifiedFile) {
    const suggestion = suggestClassificationFromFileName(item);
    if (!suggestion) return;
    setOverride(item.id, { subjectSlug: suggestion.subjectSlug, disciplina: suggestion.disciplina, source: "manual" });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/disciplinas" className="text-sm font-medium text-primary inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Voltar para Disciplinas
        </Link>
        <h1 className="text-2xl font-semibold text-foreground mt-3 inline-flex items-center gap-2.5">
          <ClipboardList size={22} className="text-accent" /> Classificar itens
        </h1>
        <p className="text-muted-foreground mt-1">
          Itens sem correspondência confiável de grande área — normalmente provas/bancos de questões com conteúdo
          misto. Selecione vários e atribua de uma vez, ou aceite uma sugestão individual quando houver uma.
        </p>
      </div>

      {status === "loading" || status === "idle" ? (
        <LoadingState label="Carregando o acervo completo..." />
      ) : unclassified.length === 0 ? (
        <EmptyState icon={PartyPopper} title="Tudo classificado!" description="Não há itens aguardando classificação no momento." />
      ) : (
        <>
          <div className="card p-4 flex flex-wrap items-center gap-2.5 sticky top-0 z-10 shadow-lift">
            <p className="text-sm font-medium text-foreground font-metric">{selected.size} selecionado(s)</p>
            <select value={bulkSubject} onChange={(e) => setBulkSubject(e.target.value)} className="input w-auto">
              <option value="">Escolha a grande área...</option>
              {KNOWN_SUBJECTS.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={bulkDisciplina}
              onChange={(e) => setBulkDisciplina(e.target.value)}
              placeholder="Disciplina/sub-especialidade (opcional)"
              className="input w-auto min-w-[220px]"
            />
            <button type="button" className="btn-primary" onClick={applyBulk} disabled={!bulkSubject || selected.size === 0}>
              <Check size={15} /> Aplicar aos selecionados
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {groups.map(([groupKey, items]) => {
              const allSelected = items.every((i) => selected.has(i.id));
              return (
                <section key={groupKey} className="card p-4">
                  <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-border/60">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{groupKey}</p>
                      <p className="text-xs text-muted-foreground font-metric">{items.length} itens</p>
                    </div>
                    <button type="button" className="btn-outline btn-sm shrink-0" onClick={() => toggleGroup(items)}>
                      {allSelected ? "Desmarcar todos" : "Selecionar todos"}
                    </button>
                  </div>
                  <div className="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1">
                    {items.map((item) => {
                      const suggestion = suggestClassificationFromFileName(item);
                      return (
                        <label key={item.id} className="flex items-center gap-2.5 py-1.5 text-sm cursor-pointer hover:bg-surface-hover rounded-lg px-1.5">
                          <input
                            type="checkbox"
                            checked={selected.has(item.id)}
                            onChange={() => toggle(item.id)}
                            className="accent-[hsl(var(--primary))]"
                          />
                          <span className="flex-1 min-w-0 truncate text-foreground">{fileName(item)}</span>
                          {suggestion && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                acceptSuggestion(item);
                              }}
                              className="text-xs text-accent inline-flex items-center gap-1 shrink-0 hover:underline"
                            >
                              <Sparkles size={11} /> {suggestion.subjectName} — aceitar
                            </button>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
