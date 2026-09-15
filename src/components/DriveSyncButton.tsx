"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useStudyStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function DriveSyncButton({ className }: { className?: string }) {
  const [syncing, setSyncing] = useState(false);
  const demoMode = useStudyStore((s) => s.demoMode);

  async function handleSync() {
    setSyncing(true);
    // Modo demonstração: sem credenciais reais, simulamos a varredura do
    // Drive. Em produção isso chamaria POST /api/drive/sync (ver
    // src/app/api/drive/sync/route.ts), que usa fetchRealDriveTree().
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setSyncing(false);
  }

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={syncing}
      className={cn("btn-outline", className)}
      title={demoMode ? "Em modo demonstração, a sincronização é simulada" : undefined}
    >
      <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
      {syncing ? "Sincronizando..." : "Sincronizar Google Drive"}
    </button>
  );
}
