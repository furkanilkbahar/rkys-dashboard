import type { ReactNode } from "react";

export function LegalPage({ title, notice, children }: { title: string; notice: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="rounded-md border border-border bg-accent/30 p-3 text-sm text-muted-foreground">{notice}</p>
      <div className="flex flex-col gap-3 text-sm leading-relaxed">{children}</div>
    </main>
  );
}
