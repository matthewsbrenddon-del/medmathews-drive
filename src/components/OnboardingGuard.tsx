"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStudyStore } from "@/lib/store";
import { LoadingState } from "./LoadingState";

/** Garante que apenas usuários que concluíram o onboarding vejam o app principal. */
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const onboarded = useStudyStore((s) => s.onboarded);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !onboarded) {
      router.replace("/onboarding");
    }
  }, [hydrated, onboarded, router]);

  if (!hydrated || !onboarded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState label="Preparando sua biblioteca de estudos..." />
      </div>
    );
  }

  return <>{children}</>;
}
