// Temporary: JSON imports disabled until content files are moved to src/
// import enCommon from '@/content/i18n/en/common.json';
// import esCommon from '@/content/i18n/es/common.json';

const enCommon = {
  navigation: {
    orbitalPanorama: 'Orbital Panorama',
    missionAcademy: 'Mission Academy',
    crewCapsule: 'Crew Capsule',
    educators: 'Educator Portal',
  },
  cta: {
    startLesson: 'Start lesson',
    downloadWorksheet: 'Download worksheet',
    switchToSpanish: 'Switch to Spanish',
  },
};

const esCommon = {
  navigation: {
    orbitalPanorama: 'Panorama Orbital',
    missionAcademy: 'Academia de Misiones',
    crewCapsule: 'Cápsula de Tripulación',
    educators: 'Portal de Educadores',
  },
  cta: {
    startLesson: 'Iniciar lección',
    downloadWorksheet: 'Descargar hoja de trabajo',
    switchToSpanish: 'Cambiar a español',
  },
};

export type SupportedLocale = 'en' | 'es';

const dictionaries = {
  en: enCommon,
  es: esCommon,
};

export function getDictionary(locale: SupportedLocale) {
  return dictionaries[locale];
}

