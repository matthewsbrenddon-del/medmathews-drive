import { Header } from "@/components/Header";
import { MobileNav } from "@/components/MobileNav";
import { Sidebar } from "@/components/Sidebar";
import { OnboardingGuard } from "@/components/OnboardingGuard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingGuard>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <Header />
        <div className="lg:pl-64">
          <main className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 pb-24 lg:pb-10 max-w-7xl mx-auto">{children}</main>
        </div>
        <MobileNav />
      </div>
    </OnboardingGuard>
  );
}
