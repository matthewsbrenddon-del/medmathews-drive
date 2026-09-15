import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Compass size={24} />
      </div>
      <h1 className="text-xl font-semibold text-foreground">Página não encontrada</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        O conteúdo que você procura não existe ou foi movido.
      </p>
      <Link href="/dashboard" className="btn-primary">
        Voltar ao Dashboard
      </Link>
    </div>
  );
}
