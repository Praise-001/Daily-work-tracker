import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function AppShell({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen w-full bg-background text-foreground pb-24">
      <div className="mx-auto max-w-[460px] px-5 pt-8">
        <header className="mb-6 animate-fade">
          {eyebrow && (
            <p className="font-mono text-[10px] text-primary uppercase tracking-[0.22em]">
              {eyebrow}
            </p>
          )}
          <h1 className="font-serif text-3xl italic text-foreground leading-tight">
            {title}
          </h1>
          <div className="mt-3 h-px w-10 bg-primary/60 animate-line" />
        </header>
        <div className="animate-step-in">{children}</div>
      </div>
      <BottomNav />
    </main>
  );
}
