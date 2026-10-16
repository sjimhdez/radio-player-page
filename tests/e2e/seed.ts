import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const SEED_FILE = join( __dirname, '../../test-results/e2e-seed.json' );

export interface Seed {
	playerPageUrl: string;
}

export function readSeed(): Seed {
	return JSON.parse( readFileSync( SEED_FILE, 'utf8' ) ) as Seed;
}
