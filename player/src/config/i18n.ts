import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import translationsEN_US from 'src/locales/en-US.json'
import translationsES from 'src/locales/es.json'
import translationsRU_RU from 'src/locales/ru-RU.json'
import translationsSV_SE from 'src/locales/sv-SE.json'
import translationsNL_NL from 'src/locales/nl-NL.json'
import translationsRO_RO from 'src/locales/ro-RO.json'
import translationsES_MX from 'src/locales/es-MX.json'
import translationsGL_ES from 'src/locales/gl-ES.json'
import translationsDA_DK from 'src/locales/da-DK.json'
import translationsDE_DE from 'src/locales/de-DE.json'
import translationsPT_BR from 'src/locales/pt-BR.json'
import translationsIT_IT from 'src/locales/it-IT.json'
import translationsCS from 'src/locales/cs.json'
import translationsHR from 'src/locales/hr.json'
import { fallbackLanguages } from 'src/core/i18n/fallback-languages'

const resources = {
  'en-US': {
    translation: translationsEN_US,
  },
  'ru-RU': {
    translation: translationsRU_RU,
  },
  es: {
    translation: translationsES,
  },
  'es-MX': {
    translation: translationsES_MX,
  },
  'sv-SE': {
    translation: translationsSV_SE,
  },
  'nl-NL': {
    translation: translationsNL_NL,
  },
  'ro-RO': {
    translation: translationsRO_RO,
  },
  'gl-ES': {
    translation: translationsGL_ES,
  },
  'da-DK': {
    translation: translationsDA_DK,
  },
  'de-DE': {
    translation: translationsDE_DE,
  },
  de_DE: {
    translation: translationsDE_DE,
  },
  'pt-BR': {
    translation: translationsPT_BR,
  },
  pt_BR: {
    translation: translationsPT_BR,
  },
  'it-IT': {
    translation: translationsIT_IT,
  },
  it_IT: {
    translation: translationsIT_IT,
  },
  cs: {
    translation: translationsCS,
  },
  hr: {
    translation: translationsHR,
  },
}

/**
 * Internationalization (i18n) configuration
 * Configures i18next with the page language and the translation resources
 *
 * Supported languages:
 * - en-US (English - United States) - Default fallback
 * - es (Spanish)
 * - es-MX (Spanish - Mexico)
 * - ru-RU (Russian - Russia)
 * - ro-RO (Romanian - Romania)
 * - nl-NL (Dutch - Netherlands)
 * - sv-SE (Swedish - Sweden)
 * - gl-ES (Galician - Spain)
 * - da-DK (Danish - Denmark)
 * - de-DE / de_DE (German - Germany)
 * - pt-BR / pt_BR (Portuguese - Brazil)
 * - it-IT / it_IT (Italian - Italy)
 * - cs (Czech)
 * - hr (Croatian)
 *
 * The language is the one of `<html lang>`, which the clean page prints from
 * the site locale (en-US if it is empty). Neither the browser language nor a
 * stored choice is read, and nothing is stored (ADR 0050)
 *
 * A regional variant without its own resources falls back to its base language
 * (`de-AT` → `de-DE`), then to en-US
 */
i18n.use(initReactI18next).init({
  resources,
  lng: document.documentElement.lang || 'en-US',
  fallbackLng: fallbackLanguages(Object.keys(resources), 'en-US'),
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
