import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { ADMIN_STATE, seededId } from './seed';
import { wpCli } from './support/wp-cli';

/**
 * "Test Stream" in the station screen (spec 0018, A9): the server probe and
 * the browser test against the local media servers (media-server.mjs). The
 * server reaches them through the e2e mu-plugin, which needs its header on
 * the AJAX request only (spike R5).
 */

const MEDIA = 'http://localhost:8901';
const MEDIA_NOCORS = 'http://localhost:8902';

// The server probe can take up to 15 s and the browser test 8 s; the media
// servers answer in well under a second.
const VERDICT_TIMEOUT = 15_000;

/**
 * Opens the MP3 station with the media header on admin-ajax.php.
 *
 * @param page Admin page.
 */
async function openStation( page: Page ) {
	await page.route( '**/wp-admin/admin-ajax.php', ( route ) =>
		route.fallback( {
			headers: {
				...route.request().headers(),
				'x-radplapag-e2e-media': '1',
			},
		} )
	);
	await page.goto(
		`/wp-admin/post.php?post=${ seededId( 'station-mp3' ) }&action=edit`
	);
	await expect( page.locator( '#radplapag_station_details' ) ).toBeVisible();
}

/**
 * Writes a URL in the field and presses "Test Stream".
 *
 * @param page Station screen.
 * @param url  Stream URL.
 */
async function testStream( page: Page, url: string ) {
	await page.locator( '#radplapag_station_stream_url' ).fill( url );
	await page.getByRole( 'button', { name: 'Test Stream' } ).click();
}

/**
 * The result region of "Test Stream".
 *
 * @param page Station screen.
 */
function result( page: Page ) {
	return page.locator( '#radplapag_stream_test_result' );
}

test.describe( 'admin: Test Stream', () => {
	test.use( { storageState: ADMIN_STATE } );

	test( 'says a live stream with CORS plays and allows the visualizer', async ( {
		page,
	} ) => {
		await openStation( page );
		await testStream( page, `${ MEDIA }/live.mp3` );

		await expect( result( page ) ).toHaveText(
			'The stream works: it plays in this browser, and its server allows the visualizer. Safari and all browsers on iPhone and iPad show the static animation instead.',
			{ timeout: VERDICT_TIMEOUT }
		);
		await expect(
			page.getByRole( 'button', { name: 'Test Stream' } )
		).toBeEnabled();
	} );

	test( 'says a live stream without CORS plays with the static animation', async ( {
		page,
	} ) => {
		await openStation( page );
		await testStream( page, `${ MEDIA_NOCORS }/live.mp3` );

		await expect( result( page ) ).toContainText(
			'The stream plays with the static animation instead of the visualizer',
			{ timeout: VERDICT_TIMEOUT }
		);
	} );

	test( 'says a web page is not a stream', async ( { page } ) => {
		await openStation( page );
		await testStream( page, `${ MEDIA }/page.html` );

		await expect( result( page ) ).toContainText(
			'This address is a web page, not an audio stream.',
			{ timeout: VERDICT_TIMEOUT }
		);
		await expect( result( page ).getByRole( 'button' ) ).toHaveCount( 0 );
	} );

	for ( const { name, path, verdict, choose, filled, note } of [
		{
			name: 'a .pls playlist',
			path: '/listen.pls',
			verdict: 'This is a playlist, not the stream.',
			choose: 0,
			filled: 'http://stream.example.test/live.mp3',
			note: null,
		},
		{
			name: 'a .m3u playlist with a private entry',
			path: '/listen.m3u',
			verdict: 'This is a playlist, not the stream.',
			choose: 0,
			filled: 'http://stream.example.test/hq.mp3',
			note: 'The playlist also lists an address on a private network',
		},
		{
			name: 'an Icecast page',
			path: '/icecast/',
			verdict: 'This is the page of an Icecast server',
			choose: 0,
			filled: `${ MEDIA }/live.mp3`,
			note: null,
		},
		{
			name: 'a Shoutcast v1 page',
			path: '/shoutcast/',
			verdict: 'This is a Shoutcast server',
			choose: 0,
			filled: `${ MEDIA }/;`,
			note: null,
		},
	] ) {
		test( `proposes the stream of ${ name } and "Use This URL" fills the field without saving`, async ( {
			page,
		} ) => {
			const id = seededId( 'station-mp3' );
			const saved = wpCli(
				'post',
				'meta',
				'get',
				id,
				'radplapag_station_stream_url'
			);
			await openStation( page );
			await testStream( page, `${ MEDIA }${ path }` );

			await expect( result( page ) ).toContainText( verdict, {
				timeout: VERDICT_TIMEOUT,
			} );
			if ( note ) {
				await expect( result( page ) ).toContainText( note );
			}
			await result( page )
				.getByRole( 'button', { name: 'Use This URL' } )
				.nth( choose )
				.click();

			const input = page.locator( '#radplapag_station_stream_url' );
			await expect( input ).toHaveValue( filled );
			await expect( input ).toBeFocused();
			expect(
				wpCli(
					'post',
					'meta',
					'get',
					id,
					'radplapag_station_stream_url'
				)
			).toBe( saved );
		} );
	}

	test( 'works with the keyboard alone', async ( { page, browserName } ) => {
		// WebKit on macOS, like Safari by default, tabs to buttons with Alt.
		const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
		await openStation( page );
		const input = page.locator( '#radplapag_station_stream_url' );
		await input.fill( `${ MEDIA }/listen.pls` );

		await page.keyboard.press( tab );
		await expect(
			page.getByRole( 'button', { name: 'Test Stream' } )
		).toBeFocused();
		await page.keyboard.press( 'Enter' );
		await expect( result( page ) ).toContainText(
			'This is a playlist, not the stream.',
			{ timeout: VERDICT_TIMEOUT }
		);
		// The test does not take the focus from the button (K130).
		await expect(
			page.getByRole( 'button', { name: 'Test Stream' } )
		).toBeFocused();

		await page.keyboard.press( tab );
		await expect(
			result( page ).getByRole( 'button', { name: 'Use This URL' } )
		).toBeFocused();
		await page.keyboard.press( 'Enter' );

		await expect( input ).toHaveValue(
			'http://stream.example.test/live.mp3'
		);
		await expect( input ).toBeFocused();
	} );
} );
