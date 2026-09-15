"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Folder, Info, LogOut, Moon, User } from "lucide-react";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { DriveSyncButton } from "@/components/DriveSyncButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useStudyStore } from "@/lib/store";

export default function ConfiguracoesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const demoMode = useStudyStore((s) => s.demoMode);
  const connectedFolderName = useStudyStore((s) => s.connectedFolderName);
  const resetConnection = useStudyStore((s) => s.resetConnection);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleDisconnect() {
    resetConnection();
    if (session) signOut({ redirect: false });
    setConfirmOpen(false);
    router.push("/onboarding");
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie sua conta, conexão com o Drive e preferências.</p>
      </div>

      <section className="card p-5 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-light text-primary shrink-0">
          <User size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">{session?.user?.name ?? "Estudante (modo demonstração)"}</p>
          <p className="text-sm text-muted-foreground truncate">{session?.user?.email ?? "Nenhuma conta Google conectada"}</p>
        </div>
      </section>

      <section className="card p-5 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent shrink-0">
          <Folder size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground">Pasta conectada</p>
          <p className="text-sm text-muted-foreground truncate">{connectedFolderName ?? "Nenhuma pasta conectada"}</p>
        </div>
        <DriveSyncButton />
      </section>

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

      {demoMode && (
        <section className="rounded-2xl border border-accent/20 bg-accent/5 p-5 flex gap-3">
          <Info size={18} className="text-accent shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Modo demonstração ativo</p>
            <p className="text-sm text-muted-foreground mt-1">
              Este ambiente está usando dados fictícios de exemplo, pois nenhuma credencial real do Google foi
              configurada. Para conectar um Google Drive real, defina{" "}
              <code className="font-mono text-xs">GOOGLE_CLIENT_ID</code>,{" "}
              <code className="font-mono text-xs">GOOGLE_CLIENT_SECRET</code> e{" "}
              <code className="font-mono text-xs">DATABASE_URL</code> — veja o arquivo{" "}
              <code className="font-mono text-xs">.env.example</code> na raiz do projeto.
            </p>
          </div>
        </section>
      )}

      <section className="card p-5 flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-foreground">Desconectar Google Drive</p>
          <p className="text-sm text-muted-foreground mt-1">Isso removerá a conexão e todo o seu progresso salvo neste dispositivo.</p>
        </div>
        <button type="button" onClick={() => setConfirmOpen(true)} className="btn-outline text-danger border-danger/30 hover:bg-danger/5">
          <LogOut size={15} /> Desconectar
        </button>
      </section>

      <ConfirmationModal
        open={confirmOpen}
        title="Desconectar Google Drive?"
        description="Você precisará selecionar a pasta novamente. Seu progresso salvo neste dispositivo será apagado."
        confirmLabel="Desconectar"
        danger
        onConfirm={handleDisconnect}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
