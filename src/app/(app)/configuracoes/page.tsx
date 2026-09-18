"use client";

import { useState } from "react";
import { RefreshCcw, Info, Moon, Database } from "lucide-react";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { ImportCoursesPanel } from "@/components/ImportCoursesPanel";
import { ImportQuestionsPanel } from "@/components/ImportQuestionsPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useContentStore } from "@/lib/contentStore";
import { useQuestionStore } from "@/lib/questionStore";
import { formatRelativeDate } from "@/lib/utils";

export default function ConfiguracoesPage() {
  const hasImported = useContentStore((s) => s.hasImported);
  const lastImport = useContentStore((s) => s.lastImport);
  const resetToDemo = useContentStore((s) => s.resetToDemo);
  const lastQuestionImport = useQuestionStore((s) => s.lastImport);
  const resetQuestions = useQuestionStore((s) => s.resetToDemo);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleReset() {
    resetToDemo();
    resetQuestions();
    setConfirmOpen(false);
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1">Importe sua biblioteca de estudos e ajuste preferências.</p>
      </div>

      {!hasImported && (
        <section className="rounded-2xl border border-accent/20 bg-accent/5 p-5 flex gap-3">
          <Info size={18} className="text-accent shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Mostrando dados de exemplo</p>
            <p className="text-sm text-muted-foreground mt-1">
              Você ainda não importou uma planilha própria — a plataforma está usando conteúdo fictício para você
              conhecer a experiência. Importe sua planilha de cursos abaixo para substituí-lo.
            </p>
          </div>
        </section>
      )}

      {lastImport && (
        <section className="card p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent shrink-0">
            <RefreshCcw size={19} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{lastImport.fileName}</p>
            <p className="text-sm text-muted-foreground">
              {lastImport.imported} itens importados{lastImport.skipped > 0 ? `, ${lastImport.skipped} ignorados` : ""} ·{" "}
              {formatRelativeDate(lastImport.importedAt)}
            </p>
          </div>
        </section>
      )}

      <ImportCoursesPanel />

      <ImportQuestionsPanel />

      {lastQuestionImport && (
        <section className="card p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent shrink-0">
            <Database size={19} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{lastQuestionImport.fileName}</p>
            <p className="text-sm text-muted-foreground">
              {lastQuestionImport.imported} questões importadas
              {lastQuestionImport.skipped > 0 ? `, ${lastQuestionImport.skipped} ignoradas` : ""} ·{" "}
              {formatRelativeDate(lastQuestionImport.importedAt)}
            </p>
          </div>
        </section>
      )}

      <section className="card p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-foreground shrink-0">
            <Moon size={20} />
          </div>
          <div>
            <p className="font-medium text-foreground">Aparência</p>
            <p className="text-sm text-muted-foreground">Alterne entre modo claro e escuro.</p>
          </div>
        </div>
        <ThemeToggle />
      </section>

      <section className="card p-5 flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-foreground">Restaurar dados de exemplo</p>
          <p className="text-sm text-muted-foreground mt-1">
            Remove a biblioteca e o banco de questões importados neste dispositivo e volta aos dados fictícios.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="btn-outline text-danger border-danger/30 hover:bg-danger/5 shrink-0"
        >
          Restaurar
        </button>
      </section>

      <ConfirmationModal
        open={confirmOpen}
        title="Restaurar dados de exemplo?"
        description="Sua biblioteca e banco de questões importados neste dispositivo serão substituídos pelos dados fictícios de demonstração."
        confirmLabel="Restaurar"
        danger
        onConfirm={handleReset}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
