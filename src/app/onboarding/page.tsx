"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { ImportCoursesPanel } from "@/components/ImportCoursesPanel";
import { Logo } from "@/components/Logo";
import { useStudyStore } from "@/lib/store";

export default function OnboardingPage() {
  const router = useRouter();
  const completeOnboarding = useStudyStore((s) => s.completeOnboarding);
  const [showImport, setShowImport] = useState(false);

  function finish() {
    completeOnboarding();
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-2.5 px-6 sm:px-10 h-16">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Logo size={19} />
        </div>
        <span className="font-semibold text-foreground">MedStudy Hub</span>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-lg flex flex-col gap-6">
          <div className="text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary mx-auto">
              <Sparkles size={26} />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground mt-4">Bem-vindo ao MedStudy Hub</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Organize videoaulas, apostilas e questões de residência em um só lugar. Importe sua planilha de cursos
              agora, ou explore primeiro com dados de exemplo.
            </p>
          </div>

          {showImport ? (
            <div className="flex flex-col gap-4 animate-fade-in">
              <ImportCoursesPanel onImported={finish} />
              <button type="button" onClick={() => setShowImport(false)} className="text-sm text-muted-foreground self-center">
                ← Voltar
              </button>
            </div>
          ) : (
            <div className="card p-7 flex flex-col gap-3 animate-fade-in">
              <button type="button" onClick={() => setShowImport(true)} className="btn-primary w-full">
                Importar planilha de cursos
              </button>
              <button type="button" onClick={finish} className="btn-outline w-full">
                Explorar com dados de exemplo
              </button>
              <p className="text-xs text-muted-foreground text-center mt-1">
                Você pode importar sua planilha depois, a qualquer momento, em Configurações.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
