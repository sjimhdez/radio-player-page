import { afterEach, describe, expect, it } from 'vitest'
import i18n from 'src/config/i18n'

type Messages = { [key: string]: string | Messages }

const files = import.meta.glob<Messages>('../locales/*.json', {
  eager: true,
  import: 'default',
})

const locales: Record<string, Messages> = Object.fromEntries(
  Object.entries(files).map(([path, messages]) => [
    path.replace(/^.*\/(.+)\.json$/, '$1'),
    messages,
  ]),
)

const REFERENCE = 'en-US'

function flatten(messages: Messages, prefix = ''): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(messages).flatMap(([key, value]) =>
      value !== null && typeof value === 'object'
        ? Object.entries(flatten(value, `${prefix}${key}.`))
        : [[`${prefix}${key}`, value]],
    ),
  )
}

function withoutPluralSuffix(keys: string[]): string[] {
  return [...new Set(keys.map((key) => key.replace(/_(zero|one|two|few|many|other)$/, '')))].sort()
}

function placeholders(message: unknown): string[] {
  return (String(message).match(/\{\{[^}]+\}\}/g) ?? []).sort()
}

const reference = flatten(locales[REFERENCE])
const others = Object.keys(locales).filter((locale) => locale !== REFERENCE)

describe('locale files', () => {
  it('ships the 14 locales', () => {
    expect(Object.keys(locales).sort()).toEqual([
      'cs',
      'da-DK',
      'de-DE',
      'en-US',
      'es',
      'es-MX',
      'gl-ES',
      'hr',
      'it-IT',
      'nl-NL',
      'pt-BR',
      'ro-RO',
      'ru-RU',
      'sv-SE',
    ])
  })

  it('has only string messages in the reference locale', () => {
    for (const message of Object.values(reference)) {
      expect(typeof message).toBe('string')
    }
  })

  it.each(others)('%s has exactly the keys of en-US', (locale) => {
    const messages = flatten(locales[locale])

    expect(withoutPluralSuffix(Object.keys(messages))).toEqual(
      withoutPluralSuffix(Object.keys(reference)),
    )
  })

  it.each(Object.keys(locales))(
    '%s has exactly the plural forms of its language in upcomingInMinutes',
    (locale) => {
      const messages = flatten(locales[locale])
      const prefix = 'playerPage.upcomingInMinutes_'
      const forms = Object.keys(messages)
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length))

      expect(forms.sort()).toEqual(
        [...new Intl.PluralRules(locale).resolvedOptions().pluralCategories].sort(),
      )
      for (const form of forms) {
        expect(placeholders(messages[`${prefix}${form}`]), form).toEqual(['{{count}}'])
      }
    },
  )

  it.each(others)('%s has only non-empty string messages', (locale) => {
    for (const [key, message] of Object.entries(flatten(locales[locale]))) {
      expect(typeof message, key).toBe('string')
      expect(message, key).not.toBe('')
    }
  })

  it.each(others)('%s translates the station logo alt (C15)', (locale) => {
    expect(flatten(locales[locale])['playerPage.stationLogo']).not.toBe(
      reference['playerPage.stationLogo'],
    )
  })

  it.each(others.filter((locale) => !locale.startsWith('en-')))(
    '%s translates the player controls region name (AX1)',
    (locale) => {
      expect(flatten(locales[locale])['playerPage.playerControls']).not.toBe(
        reference['playerPage.playerControls'],
      )
    },
  )

  it.each(others)('%s keeps the {{…}} placeholders of en-US', (locale) => {
    const messages = flatten(locales[locale])

    for (const [key, message] of Object.entries(reference)) {
      expect(placeholders(messages[key]), key).toEqual(placeholders(message))
    }
  })
})

describe('i18n resources', () => {
  it('registers every locale file with its messages', () => {
    for (const [locale, messages] of Object.entries(locales)) {
      expect(i18n.getResourceBundle(locale, 'translation'), locale).toEqual(messages)
    }
  })

  it('registers the underscore aliases of de-DE, pt-BR and it-IT', () => {
    expect(Object.keys(i18n.options.resources ?? {}).sort()).toEqual(
      [...Object.keys(locales), 'de_DE', 'it_IT', 'pt_BR'].sort(),
    )
    expect(i18n.getResourceBundle('de_DE', 'translation')).toEqual(locales['de-DE'])
    expect(i18n.getResourceBundle('pt_BR', 'translation')).toEqual(locales['pt-BR'])
    expect(i18n.getResourceBundle('it_IT', 'translation')).toEqual(locales['it-IT'])
  })

  it('falls back to en-US', async () => {
    expect((i18n.options.fallbackLng as Record<string, string[]>).default).toEqual(['en-US'])

    await i18n.changeLanguage('eu')

    expect(i18n.t('playerPage.play')).toBe('Play')

    await i18n.changeLanguage('en-US')
  })
})

// Found by the audit of the player.
describe('language resolution (K68, K69)', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en-US')
  })

  it.each([
    ['de-AT', 'de-DE'],
    ['de-CH', 'de-DE'],
    ['pt-PT', 'pt-BR'],
    ['nl-BE', 'nl-NL'],
    ['sv', 'sv-SE'],
    ['ru', 'ru-RU'],
  ])('shows %s in its base language through the %s resources (K68)', async (language, resource) => {
    await i18n.changeLanguage(language)

    expect(i18n.t('playerPage.play')).toBe(flatten(locales[resource])['playerPage.play'])
    expect(i18n.resolvedLanguage).toBe(resource)
  })

  it('still finds Spanish for es-AR through the base es resources', async () => {
    await i18n.changeLanguage('es-AR')

    expect(i18n.t('playerPage.play')).toBe('Reproducir')
  })

  it('says "1 minute" with the plural forms of the language (K69)', () => {
    expect(i18n.t('playerPage.upcomingInMinutes', { count: 1 })).toBe('(in 1 minute)')
    expect(i18n.t('playerPage.upcomingInMinutes', { count: 5 })).toBe('(in 5 minutes)')
  })
})
