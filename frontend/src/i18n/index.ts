import en from './en.json';
import vi from './vi.json';
import { create } from 'zustand';

export type Language = 'en' | 'vi';

const translations: Record<Language, any> = {
  en,
  vi,
};

interface I18nState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
}

const getSavedLanguage = (): Language => {
  const saved = localStorage.getItem('pterodesk_language');
  if (saved === 'vi' || saved === 'en') return saved;
  // Default to Vietnamese if system browser is vi, else en
  return navigator.language.startsWith('vi') ? 'vi' : 'vi';
};

export const useI18n = create<I18nState>((set, get) => ({
  language: getSavedLanguage(),
  setLanguage: (lang: Language) => {
    localStorage.setItem('pterodesk_language', lang);
    set({ language: lang });
  },
  t: (path: string, params?: Record<string, string | number>) => {
    const lang = get().language;
    const dict = translations[lang] || translations.en;
    const parts = path.split('.');
    let cur: any = dict;

    for (const part of parts) {
      if (cur && typeof cur === 'object' && part in cur) {
        cur = cur[part];
      } else {
        // Fallback to English if missing in current language
        let fallback: any = translations.en;
        for (const fbPart of parts) {
          if (fallback && typeof fallback === 'object' && fbPart in fallback) {
            fallback = fallback[fbPart];
          } else {
            return path;
          }
        }
        cur = fallback;
        break;
      }
    }

    if (typeof cur !== 'string') return path;

    if (params) {
      return Object.entries(params).reduce((str, [key, val]) => {
        return str.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
      }, cur);
    }

    return cur;
  },
}));

/**
 * Convenient standalone translation helper
 */
export const t = (path: string, params?: Record<string, string | number>) => {
  return useI18n.getState().t(path, params);
};

export const useTranslation = useI18n;

