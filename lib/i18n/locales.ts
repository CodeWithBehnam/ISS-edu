import enCommon from '@/content/i18n/en/common.json';
import esCommon from '@/content/i18n/es/common.json';

export type SupportedLocale = 'en' | 'es';

const dictionaries = {
  en: enCommon,
  es: esCommon,
};

export function getDictionary(locale: SupportedLocale) {
  return dictionaries[locale];
}

