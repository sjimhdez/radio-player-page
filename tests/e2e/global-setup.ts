import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium, type FullConfig } from '@playwright/test';
import { ADMIN_STATE, SEED_FILE, type Seed } from './seed';
import { wpCli } from './support/wp-cli';

const PLUGIN_DIR = 'wp-content/plugins/radio-player-page';

/**
 * Logs in as admin and saves the session to ADMIN_STATE.
 *
 * @param baseURL Origin of the test site.
 */
async function saveAdminState( baseURL: string ) {
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage( { baseURL } );
		await page.goto( '/wp-login.php' );
		await page.locator( '#user_login' ).fill( 'admin' );
		await page.locator( '#user_pass' ).fill( 'password' );
		await page.locator( '#wp-submit' ).click();
		await page.waitForURL( '**/wp-admin/**' );
		mkdirSync( dirname( ADMIN_STATE ), { recursive: true } );
		await page.context().storageState( { path: ADMIN_STATE } );
	} finally {
		await browser.close();
	}
}

/**
 * Seeds the e2e site (the wp_ tables of the test environment): the dev station
 * of scripts/fixtures/seed.php and the e2e variants of
 * tests/e2e/fixtures/seed-e2e.php, both of which remove the previous run's
 * posts first. Saves the admin session and starts the media servers (:8901
 * with CORS, :8902 without). Returns the teardown that stops them.
 *
 * @param config Playwright config (for the site's baseURL).
 */
export default async function globalSetup( config: FullConfig ) {
	// Dynamic import: Playwright compiles static imports to require(), which
	// breaks import.meta in the ES module.
	const { MEDIA_NOCORS_PORT, MEDIA_PORT, startMediaServers } =
		await import( './media-server.mjs' );

	// env:start:min and env:start:latest share the database. Going up, the
	// admin asks for "Database Update Required"; going down, WP 6.6 cannot read
	// the `$wp$` password hash of WP 6.8+ and the login fails ("Cookies are
	// blocked due to unexpected output"). Both are no-ops on a fresh site.
	wpCli( 'core', 'update-db' );
	wpCli( 'user', 'update', 'admin', '--user_pass=password' );
	wpCli( 'plugin', 'activate', 'radio-player-page' );
	wpCli( 'eval-file', `${ PLUGIN_DIR }/scripts/fixtures/seed.php` );

	const pageId = wpCli(
		'post',
		'list',
		'--post_type=page',
		'--title=Fixture Radio Station',
		'--field=ID'
	);

	// --user: titles keep their markup characters (no kses on save).
	const e2e = JSON.parse(
		wpCli(
			'eval-file',
			`${ PLUGIN_DIR }/tests/e2e/fixtures/seed-e2e.php`,
			`http://localhost:${ MEDIA_PORT }`,
			`http://localhost:${ MEDIA_NOCORS_PORT }`,
			'--user=admin'
		)
	) as Pick< Seed, 'urls' | 'ids' >;

	const seed: Seed = {
		playerPageUrl: wpCli( 'post', 'url', pageId.split( '\n' )[ 0 ] ),
		...e2e,
	};

	mkdirSync( dirname( SEED_FILE ), { recursive: true } );
	writeFileSync( SEED_FILE, JSON.stringify( seed, null, '\t' ) );

	await saveAdminState( config.projects[ 0 ].use.baseURL ?? '' );

	// Started last, so a failed seed leaves no server running.
	const media = await startMediaServers();
	return () => media.close();
}
