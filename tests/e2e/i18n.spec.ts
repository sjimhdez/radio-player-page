import { expect, test } from './fixtures';
import { readSeed } from './seed';
import { wpCli } from './support/wp-cli';

/**
 * Scenario 9 (spec 0002 §4.4): the player's language. The clean page prints
 * the site locale in `<html lang>` and i18next detects `htmlTag` first, then
 * `localStorage`, then `navigator`, falling back to `en-US`.
 */

/**
 * Stores `WPLANG` as given. sanitize_option() would keep the old value for a
 * language that is not installed, and the test site has none (installing one
 * needs the internet): its filter gets the original value back.
 *
 * @param locale WordPress locale (`es_ES`).
 */
function setSiteLocale( locale: string ) {
	wpCli(
		'eval',
		"add_filter( 'sanitize_option_WPLANG', function ( $value, $option, $original ) { return $original; }, 10, 3 );" +
			`update_option( 'WPLANG', ${ JSON.stringify( locale ) } );`
	);
}

/**
 * Runs `body` with the site locale (`WPLANG`) set to `locale`, then puts the
 * option back as it was. get_locale() reads the option as is: no language
 * pack is needed.
 *
 * @param locale WordPress locale (`es_ES`).
 * @param body   Test body.
 */
async function withSiteLocale( locale: string, body: () => Promise< void > ) {
	let previous: string | null = null;
	try {
		previous = wpCli( 'option', 'get', 'WPLANG' );
	} catch {
		// The option does not exist: the site runs in en_US.
	}

	try {
		setSiteLocale( locale );
		await body();
	} finally {
		if ( previous === null ) {
			wpCli( 'option', 'delete', 'WPLANG' );
		} else {
			setSiteLocale( previous );
		}
	}
}

test( 'translates the player to the site language', async ( { page } ) => {
	await withSiteLocale( 'es_ES', async () => {
		await page.goto( readSeed().urls.mp3 );

		await expect( page.locator( 'html' ) ).toHaveAttribute(
			'lang',
			'es-ES'
		);
		// No es-ES resources: i18next falls back to `es`.
		await expect(
			page.getByRole( 'button', { name: 'Reproducir' } )
		).toBeVisible();
	} );
} );

test( 'falls back to English for a language without translation', async ( {
	page,
} ) => {
	await withSiteLocale( 'eu', async () => {
		await page.goto( readSeed().urls.mp3 );

		await expect( page.locator( 'html' ) ).toHaveAttribute( 'lang', 'eu' );
		await expect(
			page.getByRole( 'button', { name: 'Play' } )
		).toBeVisible();
	} );
} );

test( 'the page language wins over the one stored in localStorage', async ( {
	page,
} ) => {
	await page.addInitScript( () => {
		window.localStorage.setItem( 'i18nextLng', 'de-DE' );
	} );

	await withSiteLocale( 'es_ES', async () => {
		await page.goto( readSeed().urls.mp3 );

		await expect(
			page.getByRole( 'button', { name: 'Reproducir' } )
		).toBeVisible();
	} );
	// The detected language replaces the stored one (`caches: ['localStorage']`).
	expect(
		await page.evaluate( () => window.localStorage.getItem( 'i18nextLng' ) )
	).toBe( 'es-ES' );
} );
