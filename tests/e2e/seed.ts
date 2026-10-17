import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
	| 'nocors-mp3'
	| 'nocors-hls'
	| 'intro'
	| 'broken-intro'
	| 'minimal'
	| 'visualizer-oscilloscope'
	| 'visualizer-bars'
	| 'visualizer-particles'
	| 'visualizer-waterfall'
	| 'draft'
	| 'password'
	| 'not-a-page'
	| 'no-station'
	| 'blocks';

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
