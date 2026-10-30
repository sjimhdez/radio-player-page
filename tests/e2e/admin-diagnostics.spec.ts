import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { ADMIN_STATE, readSeed, seededId } from './seed';

/**
 * A14 of spec 0018 (ADR 0065): with an administrator session, the error alert
 * adds the reason and a link to the edit screen of the station, and the page
 * is sent without cache; a listener sees the message of always.
 */

const PLAY_ERROR = 'Unable to play the stream. Try again later.';
const TEST_LINK = 'Test Stream';

/**
 * Opens a player page, presses Play and waits for the error alert.
 *
 * @param page Player page.
 * @param url  Permalink of the station page.
 * @return The response of the page.
 */
async function failToPlay( page: Page, url: string ) {
	const response = await page.goto( url );
	await page.getByRole( 'button', { name: 'Play' } ).click();
	await expect( page.getByRole( 'alert' ) ).toContainText( PLAY_ERROR );
	return response;
}

test.describe( 'administrator', () => {
	test.use( { storageState: ADMIN_STATE } );

	test( 'a broken MP3 shows the reason and the link to test the stream', async ( {
		page,
	} ) => {
		const response = await failToPlay(
			page,
			readSeed().urls[ 'broken-mp3' ]
		);

		// A 404 of a direct source cannot be told from a file that is not audio (R3).
		await expect( page.getByRole( 'alert' ) ).toContainText(
			'The browser cannot play this URL'
		);
		const link = page.getByRole( 'link', { name: TEST_LINK } );
		await expect( link ).toHaveAttribute(
			'href',
			new RegExp(
				`/wp-admin/post\\.php\\?post=${ seededId(
					'station-broken-mp3'
				) }&action=edit$`
			)
		);
		// End to end: WP::send_headers() already sends it to any logged-in user;
		// CleanPageAdminDiagnosticsTest pins the plugin's own nocache_headers().
		expect( response?.headers()[ 'cache-control' ] ).toContain(
			'no-store'
		);
	} );

	test( 'a broken HLS stream shows the HTTP status', async ( { page } ) => {
		await failToPlay( page, readSeed().urls[ 'broken-hls' ] );

		await expect( page.getByRole( 'alert' ) ).toContainText( 'HTTP 404' );
		await expect(
			page.getByRole( 'link', { name: TEST_LINK } )
		).toBeVisible();
	} );
} );

test.describe( 'listener', () => {
	test( 'a broken MP3 shows only the message of always', async ( {
		page,
	} ) => {
		const response = await failToPlay(
			page,
			readSeed().urls[ 'broken-mp3' ]
		);

		await expect( page.getByRole( 'alert' ) ).toHaveText( PLAY_ERROR );
		await expect(
			page.getByRole( 'link', { name: TEST_LINK } )
		).toHaveCount( 0 );
		expect( response?.headers()[ 'cache-control' ] ?? '' ).not.toContain(
			'no-store'
		);
	} );
} );
