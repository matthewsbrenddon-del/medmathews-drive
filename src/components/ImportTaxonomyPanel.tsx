"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useClassificationStore, type ManualClassification } from "@/lib/classificationStore";
import { resolveSubject } from "@/lib/subjects";
import type { ImportRowError } from "@/lib/types";
import { cn } from "@/lib/utils";

type Stage = "idle" | "loading" | "preview" | "error" | "done";

interface TaxonomyEntry {
  fileId: string;
  subjectSlug: string;
  disciplina?: string;
  subtema?: string;
}

interface ParsedResult {
  entries: TaxonomyEntry[];
  errors: ImportRowError[];
  summary: { fileName: string; totalRows: number; imported: number; skipped: number };
}

export function ImportTaxonomyPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<ParsedResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const setOverridesBulk = useClassificationStore((s) => s.setOverridesBulk);

  async function handleFile(file: File) {
    setStage("loading");
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import/taxonomy", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error ?? "Não foi possível importar a planilha.");
        setStage("error");
        return;
      }
      setResult(data as ParsedResult);
      setStage("preview");
    } catch {
      setErrorMessage("Falha de rede ao enviar a planilha. Tente novamente.");
      setStage("error");
    }
  }

  function handleConfirm() {
    if (!result) return;
    const entries: Record<string, ManualClassification> = {};
    for (const e of result.entries) {
      entries[e.fileId] = { subjectSlug: e.subjectSlug, disciplina: e.disciplina, subtema: e.subtema, source: "planilha" };
    }
    setOverridesBulk(entries);
    setStage("done");
  }

  function reset() {
    setStage("idle");
    setResult(null);
    setErrorMessage(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const bySubject = result
    ? Array.from(new Set(result.entries.map((e) => e.subjectSlug))).map((slug) => ({
        name: resolveSubject(slug).name,
        count: result.entries.filter((e) => e.subjectSlug === slug).length,
      }))
    : [];

  return (
    <div className="card p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary shrink-0">
          <FileSpreadsheet size={19} />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Importar planilha de taxonomia</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Classifica em lote os itens da Biblioteca por grande área. Envie um .xlsx com as colunas ID do Arquivo
            (Drive) — ou Curso + Conteúdo — Grande Área, Disciplina e Subtema.
          </p>
        </div>
      </div>

      {stage === "idle" && (
        <label className={cn("flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-10 cursor-pointer hover:bg-surface-hover transition-colors")}>
          <Upload size={22} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Clique para selecionar o arquivo .xlsx</span>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>
      )}

      {stage === "loading" && (
        <div className="flex flex-col items-center gap-3 py-10">
          <div className="h-8 w-8 rounded-full border-2 border-border border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Lendo e validando a planilha...</p>
        </div>
      )}

      {stage === "error" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2.5 rounded-xl bg-danger/10 text-danger px-4 py-3 text-sm">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <p>{errorMessage}</p>
          </div>
          <button type="button" className="btn-outline self-start" onClick={reset}>
            Tentar novamente
          </button>
        </div>
      )}

      {stage === "preview" && result && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-foreground">
            <strong>{result.summary.imported}</strong> itens classificados
            {bySubject.length > 0 ? ` (${bySubject.map((s) => `${s.count} ${s.name}`).join(", ")})` : ""} — confirmar
            importação?
          </p>

          {result.errors.length > 0 && (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-3">
              <p className="text-xs font-medium text-warning mb-2 inline-flex items-center gap-1.5">
                <AlertTriangle size={13} /> {result.errors.length} linha(s) com problema — não foram aplicadas
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 max-h-36 overflow-y-auto pr-1">
                {result.errors.map((err, idx) => (
                  <li key={idx}>
                    Linha {err.row}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={handleConfirm} disabled={result.entries.length === 0}>
              Confirmar classificação
            </button>
            <button type="button" className="btn-outline" onClick={reset}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 size={22} />
          </div>
          <p className="text-sm font-medium text-foreground">Classificação aplicada com sucesso!</p>
          <button type="button" className="btn-outline" onClick={reset}>
            Importar outra planilha
          </button>
        </div>
      )}
    </div>
  );
}
