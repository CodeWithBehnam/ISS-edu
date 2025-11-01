

import { useState } from 'react';
import Image from 'next/image';

import type { MissionEpisode, MissionLessonSegment } from '@/lib/types/mission-academy';
import type { SupportedLocale } from '@/lib/i18n/locales';

interface MissionEpisodeDetailProps {
  episode: MissionEpisode;
  initialLocale?: SupportedLocale;
}

export function MissionEpisodeDetail({ episode, initialLocale = 'en' }: MissionEpisodeDetailProps) {
  const [locale, setLocale] = useState<SupportedLocale>(initialLocale);

  return (
    <article className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-sky-600">Episode</p>
          <h2 className="text-3xl font-semibold text-slate-900">{episode.title[locale]}</h2>
          <p className="max-w-2xl text-sm text-slate-600">{episode.summary[locale]}</p>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white/80 p-2 shadow">
          <LocaleToggle locale={locale} setLocale={setLocale} target="en" label="English" />
          <LocaleToggle locale={locale} setLocale={setLocale} target="es" label="Español" />
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-4 text-xs text-slate-500 md:grid-cols-4">
        <div>
          <dt className="uppercase tracking-wide">Duration</dt>
          <dd className="mt-1 text-slate-700">{episode.durationMinutes} minutes</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide">Difficulty</dt>
          <dd className="mt-1 capitalize text-slate-700">{episode.difficulty}</dd>
        </div>
        <div className="md:col-span-2">
          <dt className="uppercase tracking-wide">Standards</dt>
          <dd className="mt-1 text-slate-700">{episode.standards.join(', ')}</dd>
        </div>
      </dl>

      <section className="space-y-6">
        {episode.segments.map((segment, index) => (
          <MissionSegment key={segment.heading.en} segment={segment} locale={locale} index={index + 1} />
        ))}
      </section>

      <section className="space-y-3 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-sky-100/60">
        <h3 className="text-lg font-semibold text-slate-900">Resources</h3>
        <ul className="space-y-2 text-sm">
          {episode.resources.map((resource) => (
            <li key={resource.href}>
              <a
                href={resource.href}
                target="_blank"
                rel="noreferrer"
                className="text-sky-600 hover:text-sky-700"
              >
                {resource.label[locale]}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function LocaleToggle({
  locale,
  setLocale,
  target,
  label,
}: {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  target: SupportedLocale;
  label: string;
}) {
  const active = locale === target;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => setLocale(target)}
      className={`rounded-full px-3 py-1 text-xs transition-colors ${
        active ? 'bg-sky-500 text-white shadow hover:bg-sky-400' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {label}
    </button>
  );
}

function MissionSegment({
  segment,
  locale,
  index,
}: {
  segment: MissionLessonSegment;
  locale: SupportedLocale;
  index: number;
}) {
  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-sky-100/60">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">Segment {index}</p>
        <h3 className="text-2xl font-semibold text-slate-900">{segment.heading[locale]}</h3>
      </header>
      <p className="text-sm leading-relaxed text-slate-600">{segment.body[locale]}</p>

      {segment.media ? (
        <figure className="overflow-hidden rounded-3xl border border-slate-200 shadow">
          <Image
            src={segment.media.src}
            alt={segment.media.alt[locale]}
            width={800}
            height={600}
            className="h-full w-full object-cover"
          />
        </figure>
      ) : null}

      {segment.knowledgeCheck ? (
        <KnowledgeCheck locale={locale} {...segment.knowledgeCheck} />
      ) : null}
    </section>
  );
}

type KnowledgeCheckProps = NonNullable<MissionLessonSegment['knowledgeCheck']> & {
  locale: SupportedLocale;
};

function KnowledgeCheck({
  question,
  choices,
  rationale,
  locale,
}: KnowledgeCheckProps) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/80 p-4">
      <p className="text-sm font-semibold text-slate-800">{question[locale]}</p>
      <ul className="space-y-2 text-sm">
        {choices.map((choice) => (
          <li key={choice.id} className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
              {choice.id.toUpperCase()}
            </span>
            <span className="text-slate-600">{choice.text[locale]}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-sky-400"
        onClick={() => setRevealed((state) => !state)}
      >
        {revealed ? 'Hide rationale' : 'Reveal rationale'}
      </button>
      {revealed ? (
        <p className="text-xs text-slate-500">{rationale[locale]}</p>
      ) : null}
    </div>
  );
}
