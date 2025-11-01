export interface LocalisedString {
  en: string;
  es: string;
}

export interface MissionLessonSegment {
  heading: LocalisedString;
  body: LocalisedString;
  media?: {
    type: 'image' | 'video' | 'animation';
    src: string;
    alt: LocalisedString;
  };
  knowledgeCheck?: {
    question: LocalisedString;
    choices: Array<{ id: string; text: LocalisedString; correct: boolean }>;
    rationale: LocalisedString;
  };
}

export interface MissionEpisode {
  slug: string;
  title: LocalisedString;
  summary: LocalisedString;
  durationMinutes: number;
  difficulty: 'introductory' | 'intermediate' | 'advanced';
  standards: string[];
  segments: MissionLessonSegment[];
  resources: Array<{
    label: LocalisedString;
    href: string;
  }>;
}

