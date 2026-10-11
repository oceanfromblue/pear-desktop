import i18next, { init, t as i18t, changeLanguage } from 'i18next';
import { loadLanguageResource } from 'virtual:i18n';

export const APPLICATION_NAME =
  '\u0059\u006f\u0075\u0054\u0075\u0062\u0065\u0020\u004d\u0075\u0073\u0069\u0063';

const FALLBACK_LANGUAGE = 'en';

// Every process (main, preload, renderer) used to load all translations,
// so only the languages that are actually needed are loaded now
const loadLanguage = async (language: string) => {
  if (i18next.hasResourceBundle(language, 'translation')) return;

  const resource = await loadLanguageResource(language);
  if (resource) {
    i18next.addResourceBundle(language, 'translation', resource, true, true);
  }
};

// Mirrors the i18next fallback chain (e.g. 'be-Latn' -> 'be' -> 'en')
const getLanguageHierarchy = (language: string) => [
  ...new Set([language, language.split('-')[0], FALLBACK_LANGUAGE]),
];

export const loadI18n = async () => {
  const fallbackResource = await loadLanguageResource(FALLBACK_LANGUAGE);

  return await init({
    resources: fallbackResource
      ? { [FALLBACK_LANGUAGE]: { translation: fallbackResource } }
      : {},
    lng: FALLBACK_LANGUAGE,
    fallbackLng: FALLBACK_LANGUAGE,
    interpolation: {
      escapeValue: false,
    },
  });
};

export const setLanguage = async (language: string) => {
  await Promise.all(getLanguageHierarchy(language).map(loadLanguage));

  return await changeLanguage(language);
};

export const t = i18t.bind(i18next);
