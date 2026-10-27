/**
 * Fallback languages per base language, in the shape of i18next's `fallbackLng`.
 */
export type FallbackLanguages = Record<string, string[]> & { default: string[] }

/**
 * Derives the fallback list of each base language from the resource keys (ADR 0050).
 *
 * A regional variant without its own resource (`de-AT`) falls back to the first resource of
 * its base language (`de-DE`), then to the default. Keys with an underscore are aliases and
 * are ignored, and so are the languages whose base is already a resource (`es`).
 *
 * @param resourceKeys - Language codes of the loaded resources
 * @param defaultLanguage - Language used when nothing else matches
 * @returns The `fallbackLng` map, with `default: [defaultLanguage]`
 */
export function fallbackLanguages(
  resourceKeys: readonly string[],
  defaultLanguage: string,
): FallbackLanguages {
  const fallbacks: FallbackLanguages = { default: [defaultLanguage] }
  const regional = resourceKeys.filter((key) => !key.includes('_') && key.includes('-')).sort()

  for (const key of regional) {
    const base = key.split('-')[0]
    if (base in fallbacks || resourceKeys.includes(base)) {
      continue
    }
    fallbacks[base] = key === defaultLanguage ? [key] : [key, defaultLanguage]
  }

  return fallbacks
}
