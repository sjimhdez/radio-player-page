import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import translationsEN_US from 'src/locales/en-US.json'
import translationsES from 'src/locales/es.json'
import translationsRU_RU from 'src/locales/ru-RU.json'

/**
 * Internationalization (i18n) configuration
 * Configures i18next with language detection and translation resources
 *
 * Supported languages:
 * - en-US (English - United States) - Default fallback
 * - es (Spanish)
 * - ru-RU (Russian - Russia)
 *
 * Language detection order:
 * 1. HTML lang attribute
 * 2. localStorage (if previously selected)
 * 3. Browser navigator language
 *
 * Selected language is cached in localStorage for persistence
 */
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'en-US': {
        translation: translationsEN_US,
      },
      'ru-RU': {
        translation: translationsRU_RU,
      },
      es: {
        translation: translationsES,
      },
    },
    fallbackLng: 'en-US',
    detection: {
      order: ['htmlTag', 'localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
