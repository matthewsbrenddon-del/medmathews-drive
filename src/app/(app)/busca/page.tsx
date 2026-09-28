"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Brain, NotebookPen, Search as SearchIcon } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { EmptySearchIllustration } from "@/components/Illustrations";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { LibraryFileRow } from "@/components/LibraryFileRow";
import { LoadingState } from "@/components/LoadingState";
import { useLibraryStore } from "@/lib/libraryStore";
import { useQuestionStore } from "@/lib/questionStore";
import { useCadernoStore } from "@/lib/cadernoStore";
import { fileKind, fullPath, searchFiles } from "@/lib/library";
import { markdownToPlain } from "@/lib/markdown";
import { resolveSubject } from "@/lib/subjects";
import type { LibraryFile } from "@/lib/types";
import { cn, normalizeText } from "@/lib/utils";

type Tab = "tudo" | "aulas" | "materiais" | "questoes" | "caderno";

function snippet(text: string, q: string, radius = 70): string {
  const plain = text.replace(/\s+/g, " ");
  const idx = normalizeText(plain).indexOf(q);
  if (idx < 0) return plain.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  return `${start > 0 ? "…" : ""}${plain.slice(start, idx + q.length + radius)}…`;
}

function BuscaContent() {
  const searchParams = useSearchParams();
  const files = useLibraryStore((s) => s.files);
  const status = useLibraryStore((s) => s.status);
  const hydrate = useLibraryStore((s) => s.hydrate);
  const questions = useQuestionStore((s) => s.questions);
  const cadernos = useCadernoStore((s) => s.cadernos);

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [tab, setTab] = useState<Tab>("tudo");
  const [preview, setPreview] = useState<{ file: LibraryFile; playlist: LibraryFile[] } | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const q = normalizeText(query.trim());

  const libraryResults = useMemo(() => (q ? searchFiles(files, query, 400).map((n) => n.file) : []), [files, query, q]);
  const aulas = libraryResults.filter((f) => fileKind(f) === "video");
  const materiais = libraryResults.filter((f) => fileKind(f) !== "video");
  const questoes = useMemo(
    () =>
      q
        ? questions
            .filter((qq) => normalizeText(`${qq.enunciado} ${qq.tema ?? ""} ${qq.subjectName} ${qq.banca ?? ""}`).includes(q))
            .slice(0, 100)
        : [],
    [questions, q]
  );
  const notas = useMemo(
    () => (q ? cadernos.filter((c) => normalizeText(`${c.titulo} ${markdownToPlain(c.conteudo)}`).includes(q)) : []),
    [cadernos, q]
  );

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "tudo", label: "Tudo", count: aulas.length + materiais.length + questoes.length + notas.length },
    { id: "aulas", label: "Aulas", count: aulas.length },
    { id: "materiais", label: "Materiais", count: materiais.length },
    { id: "questoes", label: "Questões", count: questoes.length },
    { id: "caderno", label: "Caderno", count: notas.length },
  ];

  const show = (t: Tab) => tab === "tudo" || tab === t;
  const cap = tab === "tudo" ? 6 : 200;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Busca</h1>
        <p className="text-muted-foreground mt-1">Aulas e materiais do acervo, questões e suas anotações — num lugar só.</p>
      </div>

      <div className="relative">
        <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex.: arritmias, pré-eclâmpsia, MedCel, hiponatremia…"
          className="input pl-11 py-3 text-base"
          aria-label="Buscar"
        />
      </div>

      {q && (
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label} <span className="font-metric opacity-80">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {!q ? (
        <EmptyState illustration={<EmptySearchIllustration />} title="O que você quer estudar?" description="Digite um tema, curso ou palavra-chave." />
      ) : status !== "ready" ? (
        <LoadingState label="Carregando o acervo..." />
      ) : tabs[0].count === 0 ? (
        <EmptyState illustration={<EmptySearchIllustration />} title={`Nada encontrado para “${query}”.`} description="Tente outro termo." />
      ) : (
        <div className="flex flex-col gap-7">
          {show("aulas") && aulas.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h2 className="text-sm font-semibold text-foreground mb-1">Aulas ({aulas.length})</h2>
              {aulas.slice(0, cap).map((f) => (
                <LibraryFileRow key={f.id} file={f} subtitle={fullPath(f).slice(0, -1).join(" › ")} onOpen={() => setPreview({ file: f, playlist: aulas })} />
              ))}
              {aulas.length > cap && (
                <button type="button" className="text-xs font-medium text-primary self-start mt-1" onClick={() => setTab("aulas")}>
                  Ver todas as {aulas.length} aulas →
                </button>
              )}
            </section>
          )}
          {show("materiais") && materiais.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h2 className="text-sm font-semibold text-foreground mb-1">Materiais ({materiais.length})</h2>
              {materiais.slice(0, cap).map((f) => (
                <LibraryFileRow
                  key={f.id}
                  file={f}
                  subtitle={fullPath(f).slice(0, -1).join(" › ")}
                  onOpen={() => setPreview({ file: f, playlist: materiais })}
                />
              ))}
              {materiais.length > cap && (
                <button type="button" className="text-xs font-medium text-primary self-start mt-1" onClick={() => setTab("materiais")}>
                  Ver todos os {materiais.length} materiais →
                </button>
              )}
            </section>
          )}
          {show("questoes") && questoes.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h2 className="text-sm font-semibold text-foreground mb-1">Questões ({questoes.length})</h2>
              {questoes.slice(0, cap).map((qq) => {
                const subject = resolveSubject(qq.subjectName);
                return (
                  <Link
                    key={qq.id}
                    href={`/questoes/estudo?start=${qq.id}`}
                    className="rounded-xl border border-border bg-surface px-3.5 py-2.5 flex items-start gap-3 hover:shadow-card hover:border-primary/40 transition-all"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <Brain size={16} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-foreground line-clamp-2">{snippet(qq.enunciado, q)}</span>
                      <span className="block text-[11px] mt-0.5" style={{ color: `hsl(${subject.colorToken})` }}>
                        {subject.name}
                        {qq.tema ? ` · ${qq.tema}` : ""} · {qq.banca} {qq.ano}
                      </span>
                    </span>
                  </Link>
                );
              })}
              {questoes.length > cap && (
                <button type="button" className="text-xs font-medium text-primary self-start mt-1" onClick={() => setTab("questoes")}>
                  Ver todas as {questoes.length} questões →
                </button>
              )}
            </section>
          )}
          {show("caderno") && notas.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h2 className="text-sm font-semibold text-foreground mb-1">No seu Caderno ({notas.length})</h2>
              {notas.map((c) => (
                <Link
                  key={c.id}
                  href={`/caderno?id=${c.id}`}
                  className="rounded-xl border border-border bg-surface px-3.5 py-2.5 flex items-start gap-3 hover:shadow-card hover:border-primary/40 transition-all"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent shrink-0">
                    <NotebookPen size={16} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-foreground">{c.titulo}</span>
                    <span className="block text-xs text-muted-foreground line-clamp-2">{snippet(markdownToPlain(c.conteudo), q)}</span>
                  </span>
                </Link>
              ))}
            </section>
          )}
        </div>
      )}

      <FilePreviewModal
        file={preview?.file ?? null}
        playlist={preview?.playlist}
        onNavigate={(f) => setPreview((p) => (p ? { ...p, file: f } : p))}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}

export default function BuscaPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando busca..." />}>
      <BuscaContent />
    </Suspense>
  );
}
