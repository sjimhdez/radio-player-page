import { describe, expect, it } from 'vitest'
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

    expect(Object.keys(messages).sort()).toEqual(Object.keys(reference).sort())
  })

  it.each(others)('%s has only non-empty string messages', (locale) => {
    for (const [key, message] of Object.entries(flatten(locales[locale]))) {
      expect(typeof message, key).toBe('string')
      expect(message, key).not.toBe('')
    }
  })

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

  it('falls back to en-US', () => {
    expect(i18n.options.fallbackLng).toEqual(['en-US'])
  })
})
