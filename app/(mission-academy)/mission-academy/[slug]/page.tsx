import { notFound } from 'next/navigation';

import { getEpisode, missionEpisodes } from '@/content/episodes';
import { MissionEpisodeDetail } from '@/components/mission/MissionEpisodeDetail';

interface MissionEpisodePageProps {
  params: {
    slug: string;
  };
}

export default function MissionEpisodePage({ params }: MissionEpisodePageProps) {
  const episode = getEpisode(params.slug);

  if (!episode) {
    notFound();
  }

  return (
    <MissionEpisodeDetail episode={episode} initialLocale="en" />
  );
}

export function generateStaticParams() {
  return missionEpisodes.map((episode) => ({ slug: episode.slug }));
}

