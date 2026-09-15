"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { useStudyStore } from "@/lib/store";

export default function RootPage() {
  const router = useRouter();
  const onboarded = useStudyStore((s) => s.onboarded);

  useEffect(() => {
    router.replace(onboarded ? "/dashboard" : "/onboarding");
  }, [onboarded, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground animate-pulse">
        <GraduationCap size={24} />
      </div>
      <p className="text-sm text-muted-foreground">Carregando o MedStudy Hub...</p>
    </div>
  );
}
