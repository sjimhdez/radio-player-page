import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium, expect, type FullConfig } from '@playwright/test';
import { ADMIN_STATE, SEED_FILE, type Seed } from './seed';
import { wpCli } from './support/wp-cli';

const PLUGIN_DIR = 'wp-content/plugins/radio-player-page';

// Outside test-results/e2e, which Playwright empties when the tests start.
const DIAGNOSTICS_DIR = 'test-results/global-setup';

/**
 * Logs in as admin and saves the session to ADMIN_STATE.
 *
 * @param baseURL Origin of the test site.
 */
async function saveAdminState( baseURL: string ) {
	const browser = await chromium.launch();
	const page = await browser.newPage( { baseURL } );
	const documents: string[] = [];
	page.on( 'response', ( response ) => {
		if ( response.request().resourceType() === 'document' ) {
			documents.push(
				`${ Date.now() } ${ response.status() } ${ response.url() }`
			);
		}
	} );
	page.on( 'requestfailed', ( request ) =>
		documents.push(
			`${ Date.now() } FAILED ${ request.url() } ${
				request.failure()?.errorText
			}`
		)
	);
	try {
		await page.goto( '/wp-login.php' );
		// wp_attempt_focus() focuses and selects #user_login 200 ms after the
		// page loads. If it fires while the password is being typed, the
		// password replaces the user name and the form is never sent.
		const user = page.locator( '#user_login' );
		const password = page.locator( '#user_pass' );
		await expect( user ).toBeFocused();
		await user.fill( 'admin' );
		await password.fill( 'password' );
		await expect( user ).toHaveValue( 'admin' );
		await expect( password ).toHaveValue( 'password' );
		documents.push( `${ Date.now() } submit` );
		await page.locator( '#wp-submit' ).click();
		await page.waitForURL( '**/wp-admin/**' );
		mkdirSync( dirname( ADMIN_STATE ), { recursive: true } );
		await page.context().storageState( { path: ADMIN_STATE } );
	} catch ( error ) {
		mkdirSync( DIAGNOSTICS_DIR, { recursive: true } );
		await page
			.screenshot( { path: `${ DIAGNOSTICS_DIR }/login.png` } )
			.catch( () => undefined );
		writeFileSync(
			`${ DIAGNOSTICS_DIR }/login.txt`,
			[
				`url: ${ page.url() }`,
				`cookies: ${ ( await page.context().cookies() )
					.map( ( cookie ) => cookie.name )
					.join( ', ' ) }`,
				...documents,
			].join( '\n' )
		);
		throw error;
	} finally {
		await browser.close();
	}
}

/**
 * Seeds the e2e site (the wp_ tables of the test environment): the dev station
 * of scripts/fixtures/seed.php and the e2e variants of
 * tests/e2e/fixtures/seed-e2e.php, both of which remove the previous run's
 * posts first. Saves the admin session and starts the media servers (:8901
 * with CORS, :8902 without, :8903 with readable ICY and :8904 like a
 * Shoutcast; spec 0020). Returns the teardown that stops them.
 *
 * @param config Playwright config (for the site's baseURL).
 */
export default async function globalSetup( config: FullConfig ) {
	// Dynamic import: Playwright compiles static imports to require(), which
	// breaks import.meta in the ES module.
	const {
		MEDIA_ICY_PORT,
		MEDIA_NOCORS_PORT,
		MEDIA_PORT,
		MEDIA_SHOUTCAST_PORT,
		startMediaServers,
	} = await import( './media-server.mjs' );

	// env:start:min and env:start:latest share the database. Going up, the
	// admin asks for "Database Update Required"; going down, WP 6.6 cannot read
	// the `$wp$` password hash of WP 6.8+ and the login fails ("Cookies are
	// blocked due to unexpected output"). Both are no-ops on a fresh site.
	wpCli( 'core', 'update-db' );
	wpCli( 'user', 'update', 'admin', '--user_pass=password' );
	// The editor's welcome guide loads an image from s.w.org as soon as it
	// renders, before a test can close it: the preference is stored up front.
	wpCli(
		'user',
		'meta',
		'update',
		'admin',
		'wp_persisted_preferences',
		JSON.stringify( {
			'core/edit-post': { welcomeGuide: false },
			_modified: new Date().toISOString(),
		} ),
		'--format=json'
	);
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
			`http://localhost:${ MEDIA_ICY_PORT }`,
			`http://localhost:${ MEDIA_SHOUTCAST_PORT }`,
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
