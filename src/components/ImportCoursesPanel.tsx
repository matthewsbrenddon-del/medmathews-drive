"use client";

import { AlertTriangle, BookOpen, CheckCircle2, FileSpreadsheet, Upload, Video } from "lucide-react";
import { useRef, useState } from "react";
import { useContentStore } from "@/lib/contentStore";
import { getSubjectsFromItems } from "@/lib/subjects";
import type { ImportRowError, StudyContent } from "@/lib/types";
import { cn } from "@/lib/utils";

type Stage = "idle" | "loading" | "preview" | "error" | "done";

interface ParsedResult {
  items: StudyContent[];
  errors: ImportRowError[];
  summary: { fileName: string; totalRows: number; imported: number; skipped: number };
}

export function ImportCoursesPanel({ onImported }: { onImported?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<ParsedResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const importItems = useContentStore((s) => s.importItems);

  async function handleFile(file: File) {
    setStage("loading");
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import/courses", { method: "POST", body: formData });
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
    importItems(result.items, {
      fileName: result.summary.fileName,
      importedAt: new Date().toISOString(),
      totalRows: result.summary.totalRows,
      imported: result.summary.imported,
      skipped: result.summary.skipped,
    });
    setStage("done");
    onImported?.();
  }

  function reset() {
    setStage("idle");
    setResult(null);
    setErrorMessage(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const subjectCount = result ? getSubjectsFromItems(result.items).length : 0;
  const videoCount = result ? result.items.filter((i) => i.kind === "videoaula").length : 0;
  const materialCount = result ? result.items.length - videoCount : 0;

  return (
    <div className="card p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary shrink-0">
          <FileSpreadsheet size={19} />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Importar planilha de cursos</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Envie um .xlsx com as colunas Disciplina, Módulo, Nº da Aula, Título, Tema, Tipo, Link do Drive, ID do
            Arquivo, Duração (min), Ordem, Prioridade (1-5) e Observações.
          </p>
        </div>
      </div>

      {stage === "idle" && (
        <label
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-10 cursor-pointer hover:bg-surface-hover transition-colors"
          )}
        >
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
            <strong>{videoCount}</strong> videoaulas e <strong>{materialCount}</strong> materiais identificados em{" "}
            <strong>{subjectCount}</strong> disciplinas — confirmar importação?
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-muted p-3 text-center">
              <Video size={16} className="mx-auto text-primary" />
              <p className="text-lg font-semibold mt-1">{videoCount}</p>
              <p className="text-[11px] text-muted-foreground">videoaulas</p>
            </div>
            <div className="rounded-xl bg-muted p-3 text-center">
              <BookOpen size={16} className="mx-auto text-primary" />
              <p className="text-lg font-semibold mt-1">{materialCount}</p>
              <p className="text-[11px] text-muted-foreground">materiais</p>
            </div>
            <div className="rounded-xl bg-muted p-3 text-center">
              <FileSpreadsheet size={16} className="mx-auto text-primary" />
              <p className="text-lg font-semibold mt-1">{subjectCount}</p>
              <p className="text-[11px] text-muted-foreground">disciplinas</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-3">
              <p className="text-xs font-medium text-warning mb-2 inline-flex items-center gap-1.5">
                <AlertTriangle size={13} /> {result.errors.length} linha(s) com problema — não foram importadas
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
            <button type="button" className="btn-primary" onClick={handleConfirm}>
              Confirmar importação
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
          <p className="text-sm font-medium text-foreground">Biblioteca importada com sucesso!</p>
          <button type="button" className="btn-outline" onClick={reset}>
            Importar outra planilha
          </button>
        </div>
      )}
    </div>
  );
}
