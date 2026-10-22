import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { readSeed } from './seed';
import {
	audioState,
	mediaRequests,
	resetMediaRequests,
	startPlayback,
	waitForPlayback,
} from './support/player';

/**
 * Scenario 4 (spec 0002 §4.4): `crossOrigin` and streams without CORS.
 *
 * Every source assigned straight to `audio.src` gets `crossOrigin =
 * 'anonymous'` and the MSE paths (`hls.js`, `dashjs`) do not (ADR 0004). No
 * browser here takes native HLS: desktop WebKit goes through `hls.js` too
 * (see hls-dash.spec.ts), so that branch is only covered by the player's unit
 * tests. C1 (spec 0007, ADR 0033): a direct source that fails with
 * `crossOrigin` is retried once without it, so an MP3 without CORS plays; the
 * MSE paths have no retry and show the error. K1 is how a source that fails
 * on both attempts (a 404) is (not) reported.
 */

const PLAY_ERROR = 'Unable to play the stream. Try again later.';

declare global {
	interface Window {
		/** `error` and `pause` events of the `<audio>` element, in order. */
		e2eAudioEvents: string[];
		/** Text of every `role="alert"` element ever added to the page. */
		e2eAlerts: string[];
	}
}

/**
 * Reads `audio.crossOrigin`.
 *
 * @param page Player page.
 */
function crossOrigin( page: Page ) {
	return page.evaluate( () => {
		const audio = document.querySelector( 'audio' );
		if ( ! audio ) {
			throw new Error( 'no <audio> element' );
		}
		return audio.crossOrigin;
	} );
}

/**
 * Starts logging the `error` and `pause` events of the `<audio>` element and
 * every alert that shows up, even for a moment.
 *
 * @param page Player page, already loaded.
 */
async function recordFailure( page: Page ) {
	await page.evaluate( () => {
		const audio = document.querySelector( 'audio' );
		if ( ! audio ) {
			throw new Error( 'no <audio> element' );
		}
		window.e2eAudioEvents = [];
		for ( const name of [ 'error', 'pause' ] ) {
			audio.addEventListener( name, () =>
				window.e2eAudioEvents.push( name )
			);
		}
		window.e2eAlerts = [];
		new MutationObserver( () => {
			for ( const alert of document.querySelectorAll(
				'[role="alert"]'
			) ) {
				window.e2eAlerts.push( alert.textContent ?? '' );
			}
		} ).observe( document.body, { childList: true, subtree: true } );
	} );
}

test( 'sets crossOrigin anonymous on a direct MP3 source', async ( {
	page,
} ) => {
	await page.goto( readSeed().urls.mp3 );

	await startPlayback( page );

	expect( ( await audioState( page ) ).src ).toMatch( /\/tone\.mp3$/ );
	expect( await crossOrigin( page ) ).toBe( 'anonymous' );
} );

test( 'sets crossOrigin anonymous on the welcome audio and on the live stream after it', async ( {
	page,
} ) => {
	await page.goto( readSeed().urls.intro );

	const introPlaying = waitForPlayback( page, 0.5 );
	await page.getByRole( 'button', { name: 'Play' } ).click();
	await introPlaying;
	expect( ( await audioState( page ) ).src ).toMatch(
		/\/intro(-\d+)?\.mp3$/
	);
	expect( await crossOrigin( page ) ).toBe( 'anonymous' );

	await expect
		.poll( async () => ( await audioState( page ) ).src )
		.toMatch( /\/live\.mp3$/ );
	expect( await crossOrigin( page ) ).toBe( 'anonymous' );
} );

for ( const key of [ 'hls', 'dash' ] as const ) {
	test( `leaves crossOrigin unset on the MSE path (${ key })`, async ( {
		page,
	} ) => {
		await page.goto( readSeed().urls[ key ] );

		await startPlayback( page );

		expect( await crossOrigin( page ) ).toBeNull();
	} );
}

test( 'plays an MP3 without CORS by retrying without crossOrigin (C1)', async ( {
	page,
} ) => {
	await resetMediaRequests( 'nocors' );
	await page.goto( readSeed().urls[ 'nocors-mp3' ] );
	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeVisible();
	await recordFailure( page );

	await startPlayback( page );

	// The first attempt, with crossOrigin, fails; the retry without it plays.
	expect(
		( await mediaRequests( 'nocors' ) )[ '/tone.mp3' ]
	).toBeGreaterThan( 1 );
	expect( await crossOrigin( page ) ).toBeNull();
	expect( ( await audioState( page ) ).errorCode ).toBeNull();
	await expect( page.getByRole( 'button', { name: 'Pause' } ) ).toBeVisible();
	expect( await page.evaluate( () => window.e2eAlerts ) ).toEqual( [] );
} );

test( 'plays the welcome audio and the live stream without CORS (C1)', async ( {
	page,
} ) => {
	await resetMediaRequests( 'nocors' );
	await page.goto( readSeed().urls[ 'nocors-intro' ] );
	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeVisible();
	await recordFailure( page );

	const introPlaying = waitForPlayback( page, 0.5 );
	await page.getByRole( 'button', { name: 'Play' } ).click();
	await introPlaying;
	expect( ( await audioState( page ) ).src ).toMatch( /\/intro\.mp3$/ );
	expect( await crossOrigin( page ) ).toBeNull();

	await expect
		.poll( async () => ( await audioState( page ) ).src, {
			timeout: 15_000,
		} )
		.toMatch( /\/live\.mp3$/ );
	await waitForPlayback( page, 1 );
	expect( await crossOrigin( page ) ).toBeNull();
	const requests = await mediaRequests( 'nocors' );
	expect( requests[ '/intro.mp3' ] ).toBeGreaterThan( 1 );
	expect( requests[ '/live.mp3' ] ).toBeGreaterThan( 1 );
	expect( await page.evaluate( () => window.e2eAlerts ) ).toEqual( [] );
} );

test( 'currently shows no error for a broken MP3 in Chromium (K1)', async ( {
	page,
	browserName,
} ) => {
	await resetMediaRequests();
	await page.goto( readSeed().urls[ 'broken-mp3' ] );
	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeVisible();
	await recordFailure( page );

	await page.getByRole( 'button', { name: 'Play' } ).click();

	// A 404 cannot be told apart from a stream without CORS: both attempts fail.
	await expect
		.poll( async () => ( await mediaRequests() )[ '/missing.mp3' ] )
		.toBeGreaterThan( 1 );
	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeEnabled();
	expect( await crossOrigin( page ) ).toBeNull();

	if ( browserName === 'chromium' ) {
		// K1: each attempt fires `error`, and the `pause` that follows the
		// second overwrites the `error` status with `paused`, so the alert
		// never shows: silence and a Play button.
		await expect
			.poll( () => page.evaluate( () => window.e2eAudioEvents ) )
			.toEqual( [ 'error', 'error', 'pause' ] );
		expect( await audioState( page ) ).toMatchObject( {
			currentTime: 0,
			paused: true,
			errorCode: 4,
			buffered: [],
		} );
		expect( await page.evaluate( () => window.e2eAlerts ) ).toEqual( [] );
	} else {
		// WebKit fires no `pause` (the element is not even paused), so the
		// `error` status stays and the alert shows. On macOS the `load()` of the
		// retry drops the `error` of the first attempt; WebKitGTK on Linux (the
		// CI) fires both.
		await expect( page.getByRole( 'alert' ) ).toHaveText( PLAY_ERROR );
		const events = await page.evaluate( () => window.e2eAudioEvents );
		expect( events.length === 1 || events.length === 2 ).toBe( true );
		expect( events.every( ( event ) => event === 'error' ) ).toBe( true );
		expect( await audioState( page ) ).toMatchObject( {
			currentTime: 0,
			paused: false,
			errorCode: 4,
			buffered: [],
		} );
	}
} );

test( 'does not play HLS without CORS and shows the error (C1)', async ( {
	page,
} ) => {
	await resetMediaRequests( 'nocors' );
	await page.goto( readSeed().urls[ 'nocors-hls' ] );
	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeVisible();
	await recordFailure( page );

	await page.getByRole( 'button', { name: 'Play' } ).click();

	// hls.js reads the playlist with a request that CORS blocks: a fatal
	// hls.js error, not a media error, and the alert in both browsers.
	await expect( page.getByRole( 'alert' ) ).toHaveText( PLAY_ERROR );
	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeEnabled();
	expect( await audioState( page ) ).toMatchObject( {
		currentTime: 0,
		paused: true,
		errorCode: null,
		buffered: [],
	} );
	expect( await page.evaluate( () => window.e2eAudioEvents ) ).toEqual( [] );

	// The playlist is requested; no segment ever is.
	const requests = await mediaRequests( 'nocors' );
	expect( requests[ '/hls/index.m3u8' ] ).toBeGreaterThan( 0 );
	expect( Object.keys( requests ) ).toEqual( [ '/hls/index.m3u8' ] );
} );

test( 'does not play DASH without CORS and shows the error (C1)', async ( {
	page,
} ) => {
	await resetMediaRequests( 'nocors' );
	await page.goto( readSeed().urls[ 'nocors-dash' ] );
	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeVisible();
	await recordFailure( page );

	await page.getByRole( 'button', { name: 'Play' } ).click();

	// Like hls.js: dashjs reads the manifest with a request that CORS blocks
	// (it retries it), and the alert shows in both browsers.
	await expect( page.getByRole( 'alert' ) ).toHaveText( PLAY_ERROR );
	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeEnabled();
	expect( await audioState( page ) ).toMatchObject( {
		currentTime: 0,
		paused: true,
		errorCode: null,
		buffered: [],
	} );
	expect( await page.evaluate( () => window.e2eAudioEvents ) ).toEqual( [] );

	// The manifest is requested; no segment ever is.
	const requests = await mediaRequests( 'nocors' );
	expect( requests[ '/dash/manifest.mpd' ] ).toBeGreaterThan( 0 );
	expect( Object.keys( requests ) ).toEqual( [ '/dash/manifest.mpd' ] );
} );
