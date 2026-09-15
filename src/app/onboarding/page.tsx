"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { BookOpen, Check, ChevronRight, FolderSearch, GraduationCap, Info, Layers, Video } from "lucide-react";
import { FolderPicker } from "@/components/FolderPicker";
import { getDemoSyncSummary } from "@/lib/mockData";
import { useStudyStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, title: "Conecte seu Google Drive" },
  { id: 2, title: "Escolha sua pasta" },
  { id: 3, title: "Organize seus estudos" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const completeOnboarding = useStudyStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(1);
  const [driveConfigured, setDriveConfigured] = useState(false);
  const [connected, setConnected] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    fetch("/api/drive/status")
      .then((r) => r.json())
      .then((data) => setDriveConfigured(Boolean(data.configured)))
      .catch(() => setDriveConfigured(false));
  }, []);

  function handleConnect() {
    if (driveConfigured) {
      signIn("google", { callbackUrl: "/onboarding" });
      return;
    }
    // Modo demonstração: sem credenciais reais, simulamos a conexão.
    setConnected(true);
    setStep(2);
  }

  function handleSelectFolder(folder: { id: string; name: string }) {
    setSelectedFolder(folder);
    setScanning(true);
    window.setTimeout(() => {
      setScanning(false);
      setStep(3);
    }, 1400);
  }

  function handleFinish() {
    completeOnboarding(selectedFolder?.name ?? "MEDICINA", !driveConfigured);
    router.push("/dashboard");
  }

  const summary = getDemoSyncSummary();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-2.5 px-6 sm:px-10 h-16">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <GraduationCap size={20} />
        </div>
        <span className="font-semibold text-foreground">MedStudy Hub</span>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-lg">
          <div className="flex items-center justify-center gap-2 mb-8" aria-label="Progresso do onboarding">
            {STEPS.map((s, idx) => (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold border transition-colors",
                    step > s.id
                      ? "bg-success text-success-foreground border-success"
                      : step === s.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-surface text-muted-foreground border-border"
                  )}
                >
                  {step > s.id ? <Check size={14} /> : s.id}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={cn("h-px w-8 sm:w-12", step > s.id ? "bg-success" : "bg-border")} />
                )}
              </div>
            ))}
          </div>

          <div className="card p-7 sm:p-9 animate-fade-in" key={step}>
            {step === 1 && (
              <div className="flex flex-col items-center text-center gap-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary">
                  <FolderSearch size={26} />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-foreground">Conecte seu Google Drive</h1>
                  <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                    O MedStudy Hub lê apenas os arquivos e pastas que você autorizar — nunca baixamos nem
                    armazenamos seus arquivos em nossos servidores.
                  </p>
                </div>

                {!driveConfigured && (
                  <div className="flex items-start gap-2.5 rounded-xl bg-accent/10 text-left px-4 py-3 text-xs text-foreground">
                    <Info size={15} className="text-accent shrink-0 mt-0.5" />
                    <p>
                      Este ambiente está em <strong>modo demonstração</strong> (sem credenciais reais do Google
                      configuradas). Vamos usar dados fictícios de exemplo para você conhecer a plataforma. Veja{" "}
                      <code className="font-mono">.env.example</code> para conectar seu Drive real.
                    </p>
                  </div>
                )}

                <button type="button" onClick={handleConnect} className="btn-primary w-full">
                  {connected ? <Check size={16} /> : null}
                  {driveConfigured ? "Conectar Google Drive" : "Conectar Google Drive (demonstração)"}
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col gap-5">
                <div className="text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary mx-auto">
                    <Layers size={26} />
                  </div>
                  <h1 className="text-xl font-semibold text-foreground mt-4">
                    Escolha a pasta do Google Drive que contém seus materiais de Medicina.
                  </h1>
                  <p className="text-sm text-muted-foreground mt-2">
                    Vamos ler a estrutura de pastas e organizar tudo automaticamente.
                  </p>
                </div>

                {scanning ? (
                  <div className="flex flex-col items-center gap-3 py-10">
                    <div className="h-8 w-8 rounded-full border-2 border-border border-t-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Lendo estrutura de pastas...</p>
                  </div>
                ) : (
                  <FolderPicker onSelect={handleSelectFolder} />
                )}
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col items-center text-center gap-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 text-success">
                  <Check size={26} />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-foreground">Organize seus estudos</h1>
                  <p className="text-sm text-muted-foreground mt-2">
                    Encontramos tudo pronto para você começar a estudar.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 w-full">
                  <div className="rounded-xl bg-muted p-4">
                    <Video size={18} className="mx-auto text-primary" />
                    <p className="text-lg font-semibold mt-2">{summary.totalVideos}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">videoaulas encontradas</p>
                  </div>
                  <div className="rounded-xl bg-muted p-4">
                    <BookOpen size={18} className="mx-auto text-primary" />
                    <p className="text-lg font-semibold mt-2">{summary.totalMaterials}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">materiais encontrados</p>
                  </div>
                  <div className="rounded-xl bg-muted p-4">
                    <Layers size={18} className="mx-auto text-primary" />
                    <p className="text-lg font-semibold mt-2">{summary.totalSubjects}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">disciplinas identificadas</p>
                  </div>
                </div>

                <button type="button" onClick={handleFinish} className="btn-primary w-full">
                  Começar a estudar
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
