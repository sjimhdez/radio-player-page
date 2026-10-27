import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@playwright/test';

export const SEED_FILE = join( __dirname, '../../test-results/e2e-seed.json' );

/** Admin session (admin/password) saved by global-setup, for `storageState`. */
export const ADMIN_STATE = join(
	__dirname,
	'../../playwright/.auth/admin.json'
);

/** Variants created by tests/e2e/fixtures/seed-e2e.php, by key. */
export type SeedUrlKey =
	| 'mp3'
	| 'live'
	| 'cut'
	| 'hls'
	| 'dash'
	| 'ogg'
	| 'nocors-mp3'
	| 'nocors-hls'
	| 'nocors-dash'
	| 'nocors-intro'
	| 'broken-mp3'
	| 'intro'
	| 'broken-intro'
	| 'minimal'
	| 'entities'
	| 'always'
	| 'hidden-title'
	| 'layout'
	| 'visualizer-oscilloscope'
	| 'visualizer-bars'
	| 'visualizer-particles'
	| 'visualizer-waterfall'
	| 'draft'
	| 'password'
	| 'not-a-page'
	| 'no-station'
	| 'blocks'
	| 'blocks-always-on'
	| 'blocks-legacy';

export interface Seed {
	/** The dev station of scripts/fixtures/seed.php. */
	playerPageUrl: string;
	/** Permalink of each e2e variant. */
	urls: Record< SeedUrlKey, string >;
	/** Post ID → stable name (`station-mp3`, `program-A`, …), for snapshots. */
	ids: Record< string, string >;
}

export function readSeed(): Seed {
	return JSON.parse( readFileSync( SEED_FILE, 'utf8' ) ) as Seed;
}

/**
 * Returns the ID the seeder gave a stable name.
 *
 * @param name Stable name (`station-minimal`, `attachment-artwork`…).
 */
export function seededId( name: string ) {
	const entry = Object.entries( readSeed().ids ).find(
		( [ , value ] ) => value === name
	);
	expect( entry, name ).toBeDefined();
	return ( entry as [ string, string ] )[ 0 ];
}
