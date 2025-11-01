import Link from 'next/link';

import { missionEpisodes } from '@/content/episodes';

export default function MissionAcademyIndex() {
  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {missionEpisodes.map((episode) => (
        <article
          key={episode.slug}
          className="group flex flex-col justify-between rounded-3xl border border-slate-800 bg-slate-900/60 p-6 transition-transform hover:-translate-y-1 hover:border-sky-400/60"
        >
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-slate-50 group-hover:text-sky-200">
              {episode.title.en}
            </h2>
            <p className="text-sm text-slate-300">{episode.summary.en}</p>
            <ul className="flex flex-wrap gap-3 text-xs text-slate-400">
              <li>{episode.durationMinutes} minutes</li>
              <li className="capitalize">{episode.difficulty}</li>
              <li>Standards: {episode.standards.join(', ')}</li>
            </ul>
          </div>
          <footer className="mt-6">
            <Link
              href={`/mission-academy/${episode.slug}`}
              className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-sky-400"
            >
              Start lesson
              <span aria-hidden>→</span>
            </Link>
          </footer>
        </article>
      ))}
    </section>
  );
}

