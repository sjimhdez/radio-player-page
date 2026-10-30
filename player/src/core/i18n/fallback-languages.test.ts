// fallbackLanguages derives i18next's fallbackLng from the resource keys (ADR 0050): a
// regional variant without its own resource falls back to the first resource of its
// base language, then to the default.
import { describe, expect, it } from 'vitest'
import { fallbackLanguages } from 'src/core/i18n/fallback-languages'

// The player's resource keys, aliases included (src/config/i18n.ts).
const PLAYER_RESOURCES = [
  'en-US',
  'ru-RU',
  'es',
  'es-MX',
  'sv-SE',
  'nl-NL',
  'ro-RO',
  'gl-ES',
  'da-DK',
  'de-DE',
  'de_DE',
  'pt-BR',
  'pt_BR',
  'it-IT',
  'it_IT',
  'cs',
  'hr',
]

describe('fallbackLanguages', () => {
  it('maps each base language without a resource to its regional resource, then the default', () => {
    expect(fallbackLanguages(PLAYER_RESOURCES, 'en-US')).toEqual({
      da: ['da-DK', 'en-US'],
      de: ['de-DE', 'en-US'],
      en: ['en-US'],
      gl: ['gl-ES', 'en-US'],
      it: ['it-IT', 'en-US'],
      nl: ['nl-NL', 'en-US'],
      pt: ['pt-BR', 'en-US'],
      ro: ['ro-RO', 'en-US'],
      ru: ['ru-RU', 'en-US'],
      sv: ['sv-SE', 'en-US'],
      default: ['en-US'],
    })
  })

  it('leaves out the languages whose base is already a resource', () => {
    const fallbacks = fallbackLanguages(['es', 'es-MX', 'cs', 'hr', 'en-US'], 'en-US')

    expect(fallbacks).not.toHaveProperty('es')
    expect(fallbacks).not.toHaveProperty('cs')
    expect(fallbacks).not.toHaveProperty('hr')
  })

  it('ignores the keys with an underscore', () => {
    expect(fallbackLanguages(['de_DE', 'pt_BR'], 'en-US')).toEqual({ default: ['en-US'] })
  })

  it('picks the alphabetically first variant when a base has several and no resource', () => {
    expect(fallbackLanguages(['pt-PT', 'pt-BR', 'en-US'], 'en-US').pt).toEqual(['pt-BR', 'en-US'])
    expect(fallbackLanguages(['pt-BR', 'pt-PT', 'en-US'], 'en-US').pt).toEqual(['pt-BR', 'en-US'])
  })

  it('falls back to the default alone with no resources', () => {
    expect(fallbackLanguages([], 'en-US')).toEqual({ default: ['en-US'] })
  })
})
