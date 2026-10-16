import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { SEED_FILE, type Seed } from './seed';

const PLUGIN_DIR = 'wp-content/plugins/radio-player-page';

function wpCli( ...args: string[] ): string {
	return execFileSync(
		'npx',
		[
			'wp-env',
			'--config',
			'.wp-env.tests.json',
			'run',
			'cli',
			'--',
			'wp',
			...args,
		],
		{ encoding: 'utf8', stdio: [ 'ignore', 'pipe', 'pipe' ] }
	).trim();
}

/**
 * Seeds the e2e site (the wp_ tables of the test environment) with
 * scripts/fixtures/seed.php, which removes the previous run's fixtures first.
 */
export default function globalSetup() {
	wpCli( 'plugin', 'activate', 'radio-player-page' );
	wpCli( 'eval-file', `${ PLUGIN_DIR }/scripts/fixtures/seed.php` );

	const pageId = wpCli(
		'post',
		'list',
		'--post_type=page',
		'--title=Fixture Radio Station',
		'--field=ID'
	);
	const seed: Seed = {
		playerPageUrl: wpCli( 'post', 'url', pageId.split( '\n' )[ 0 ] ),
	};

	mkdirSync( dirname( SEED_FILE ), { recursive: true } );
	writeFileSync( SEED_FILE, JSON.stringify( seed, null, '\t' ) );
}
