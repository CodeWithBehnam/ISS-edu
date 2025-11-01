import type { ReactNode } from 'react';

export default function MissionAcademyLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-sky-300">Mission Academy</p>
          <h1 className="text-4xl font-semibold">Curated orbital learning journeys</h1>
          <p className="max-w-2xl text-sm text-slate-300">
            Episodes combine live telemetry, cross-disciplinary context, and ready-to-teach resources aligned with international curricula.
          </p>
        </header>
        {children}
      </div>
    </div>
  );
}

