'use client';

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
          <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Episode</p>
          <h2 className="text-3xl font-semibold text-slate-50">{episode.title[locale]}</h2>
          <p className="max-w-2xl text-sm text-slate-300">{episode.summary[locale]}</p>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-slate-700 bg-slate-800/70 p-2">
          <LocaleToggle locale={locale} setLocale={setLocale} target="en" label="English" />
          <LocaleToggle locale={locale} setLocale={setLocale} target="es" label="Español" />
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-4 text-xs text-slate-400 md:grid-cols-4">
        <div>
          <dt className="uppercase tracking-wide">Duration</dt>
          <dd className="mt-1 text-slate-200">{episode.durationMinutes} minutes</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide">Difficulty</dt>
          <dd className="mt-1 capitalize text-slate-200">{episode.difficulty}</dd>
        </div>
        <div className="md:col-span-2">
          <dt className="uppercase tracking-wide">Standards</dt>
          <dd className="mt-1 text-slate-200">{episode.standards.join(', ')}</dd>
        </div>
      </dl>

      <section className="space-y-6">
        {episode.segments.map((segment, index) => (
          <MissionSegment key={segment.heading.en} segment={segment} locale={locale} index={index + 1} />
        ))}
      </section>

      <section className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
        <h3 className="text-lg font-semibold text-slate-100">Resources</h3>
        <ul className="space-y-2 text-sm">
          {episode.resources.map((resource) => (
            <li key={resource.href}>
              <a
                href={resource.href}
                target="_blank"
                rel="noreferrer"
                className="text-sky-300 hover:text-sky-200"
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
        active ? 'bg-sky-500 text-slate-950' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
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
    <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">Segment {index}</p>
        <h3 className="text-2xl font-semibold text-slate-50">{segment.heading[locale]}</h3>
      </header>
      <p className="text-sm leading-relaxed text-slate-200">{segment.body[locale]}</p>

      {segment.media ? (
        <figure className="overflow-hidden rounded-3xl border border-slate-800">
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
    <div className="space-y-3 rounded-2xl border border-sky-400/40 bg-slate-900/80 p-4">
      <p className="text-sm font-semibold text-slate-100">{question[locale]}</p>
      <ul className="space-y-2 text-sm">
        {choices.map((choice) => (
          <li key={choice.id} className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs text-slate-300">
              {choice.id.toUpperCase()}
            </span>
            <span className="text-slate-200">{choice.text[locale]}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-sky-400"
        onClick={() => setRevealed((state) => !state)}
      >
        {revealed ? 'Hide rationale' : 'Reveal rationale'}
      </button>
      {revealed ? (
        <p className="text-xs text-slate-300">{rationale[locale]}</p>
      ) : null}
    </div>
  );
}

