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

test( 'shows a regional variant without resources in its base language (K68)', async ( {
	page,
} ) => {
	await withSiteLocale( 'de_AT', async () => {
		await page.goto( readSeed().urls.mp3 );

		await expect( page.locator( 'html' ) ).toHaveAttribute(
			'lang',
			'de-AT'
		);
		// No de-AT or de resources: i18next falls back to `de-DE`.
		await expect(
			page.getByRole( 'button', { name: 'Abspielen' } )
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

test( 'currently never uses the browser language: the page language is always detected first (K55)', async ( {
	browser,
} ) => {
	const context = await browser.newContext( { locale: 'de-DE' } );
	const page = await context.newPage();
	try {
		// Not even with a page language that has no translation: `htmlTag`
		// detects `eu`, i18next falls back to `en-US`, and `navigator`
		// (German) is never read.
		await withSiteLocale( 'eu', async () => {
			await page.goto( readSeed().urls.mp3 );

			expect( await page.evaluate( () => navigator.language ) ).toBe(
				'de-DE'
			);
			await expect(
				page.getByRole( 'button', { name: 'Play' } )
			).toBeVisible();
			await expect(
				page.getByRole( 'button', { name: 'Abspielen' } )
			).toHaveCount( 0 );
		} );
	} finally {
		await context.close();
	}
} );

test( 'currently leaves the English fallback marked with the page language (K62)', async ( {
	page,
} ) => {
	await withSiteLocale( 'eu', async () => {
		await page.goto( readSeed().urls.mp3 );

		await expect(
			page.getByRole( 'button', { name: 'Play' } )
		).toBeVisible();
		// The interface is English, but nothing says so: the only `lang` on
		// the page is the site's.
		expect(
			await page.evaluate( () =>
				[ ...document.querySelectorAll( '[lang]' ) ].map( ( element ) =>
					element.getAttribute( 'lang' )
				)
			)
		).toEqual( [ 'eu' ] );
	} );
} );

// K71: 3.4.2 printed the Locize notice; i18next 26 no longer has it (spec 0003, 1.1).
test( 'does not print the i18next support notice in the console (K71)', async ( {
	page,
} ) => {
	const messages: string[] = [];
	page.on( 'console', ( message ) => messages.push( message.text() ) );

	await page.goto( readSeed().urls.mp3 );
	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeVisible();

	expect(
		messages.some( ( text ) =>
			text.includes(
				'i18next is made possible by our own product, Locize'
			)
		)
	).toBe( false );
} );
