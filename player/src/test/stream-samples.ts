// The stream samples of tests/fixtures/streams/ (origin in its README.md), read as the
// unit tests of the current song need them. Vite denies ?raw imports
// outside player/, so they are read from disk.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** The folder of the samples, from this file */
const SAMPLES_DIR = resolve(import.meta.dirname, '../../../tests/fixtures/streams')

/**
 * The body of a sample, as text
 *
 * @param name - The sample name, without .body
 */
export function readSampleBody(name: string): string {
  return readFileSync(resolve(SAMPLES_DIR, `${name}.body`), 'utf8')
}
