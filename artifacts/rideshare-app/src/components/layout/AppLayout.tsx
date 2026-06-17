import { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { BottomNav } from "./BottomNav";
import { FloatingBackground } from "./FloatingBackground";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-[100dvh] flex flex-col text-foreground overflow-hidden">
      <FloatingBackground />
      <div className="relative z-10 flex flex-col h-full">
        <Navbar />
        <main className="flex-1 flex flex-col pb-[env(safe-area-inset-bottom)]">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
