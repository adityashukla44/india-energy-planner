import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import bn from './bn.json';
import en from './en.json';
import hi from './hi.json';
import ta from './ta.json';

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'EN', ready: true },
  { code: 'hi', label: 'Hindi', native: 'हि', ready: true },
  { code: 'ta', label: 'Tamil', native: 'த', ready: true },
  { code: 'bn', label: 'Bengali', native: 'বা', ready: true },
] as const;

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi }, ta: { translation: ta }, bn: { translation: bn } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
