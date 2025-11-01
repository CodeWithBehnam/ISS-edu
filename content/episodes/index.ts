import episode001 from './episode-001.json';

import type { MissionEpisode } from '@/lib/types/mission-academy';

export const missionEpisodes: MissionEpisode[] = [episode001 as MissionEpisode];

export function getEpisode(slug: string): MissionEpisode | undefined {
  return missionEpisodes.find((episode) => episode.slug === slug);
}

