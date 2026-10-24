import type { Page, Request } from '@playwright/test';
import { expect, test } from './fixtures';
import { readSeed } from './seed';
import {
	audioState,
	mediaRequests,
	resetMediaRequests,
	startPlayback,
	waitForAudioEvent,
	waitForPlayback,
} from './support/player';

/**
 * Scenario 1 (spec 0002 §4.4): direct MP3 and OGG streams, Pause + Play (C7)
 * and a stream cut by the server (C8).
 */

// Checking that nothing happens needs a quiet window: how long to watch a
// stalled or resumed stream before reading it again.
const QUIET_MS = 3000;

// Playwright's WebKit is WebKitGTK on Linux (GStreamer media stack, the CI)
// and Safari's on macOS (AVFoundation). They handle a live MP3 differently
// (K18, C8); Safari's is the one users have.
const GSTREAMER = process.platform === 'linux';

/**
 * Collects the `Range` header of every request the page makes to `path`.
 *
 * @param page Player page.
 * @param path Media path (`/cut.mp3`).
 */
function recordRanges( page: Page, path: string ) {
	const ranges: Array< string | null > = [];
	page.on( 'request', ( request: Request ) => {
		if ( new URL( request.url() ).pathname === path ) {
			ranges.push( request.headers().range ?? null );
		}
	} );
	return ranges;
}

test.beforeEach( async () => {
	await resetMediaRequests();
} );

test( 'plays the finite MP3', async ( { page } ) => {
	await page.goto( readSeed().urls.mp3 );

	await startPlayback( page );

	expect( ( await audioState( page ) ).src ).toMatch( /\/tone\.mp3$/ );
	await expect( page.getByRole( 'button', { name: 'Pause' } ) ).toBeVisible();
} );

test( 'plays the endless live MP3', async ( { page } ) => {
	await page.goto( readSeed().urls.live );

	await startPlayback( page );

	expect( ( await audioState( page ) ).src ).toMatch( /\/live\.mp3$/ );
	await expect( page.getByRole( 'button', { name: 'Pause' } ) ).toBeVisible();
} );

test( 'plays the OGG stream as a direct source', async ( { page } ) => {
	await page.goto( readSeed().urls.ogg );

	await startPlayback( page );

	expect( ( await audioState( page ) ).src ).toMatch( /\/tone\.ogg$/ );
	expect(
		await page.evaluate(
			() => document.querySelector( 'audio' )?.crossOrigin
		)
	).toBe( 'anonymous' );
	await expect( page.getByRole( 'button', { name: 'Pause' } ) ).toBeVisible();
} );

// Spec 0006, task 2.1: nothing else drives the volume slider in a browser.
test( 'applies the volume slider to the audio element, before and after Play', async ( {
	page,
} ) => {
	await page.goto( readSeed().urls.mp3 );
	const slider = page.getByRole( 'slider', { name: 'Volume' } );
	const volume = () =>
		page.evaluate( () => document.querySelector( 'audio' )?.volume );

	expect( await volume() ).toBe( 1 );
	await slider.focus();
	await page.keyboard.press( 'Home' );
	await page.keyboard.press( 'ArrowRight' );
	await expect( slider ).toHaveAttribute( 'aria-valuenow', '0.01' );
	expect( await volume() ).toBe( 0.01 );

	await startPlayback( page );

	// WebKitGTK (the CI's WebKit) reads the volume back from GStreamer as a
	// float32 once it plays: 0.009999999776482582.
	expect( await volume() ).toBeCloseTo( 0.01, 5 );
	await expect( slider ).toHaveAttribute( 'aria-valuenow', '0.01' );
} );

// Spec 0006, task 2.2 (K81): the system pause (lock screen, headphones) while the
// live MP3 loads. Playwright cannot reach the lock screen: the player's Media
// Session handlers are kept on `window` and the test calls the `pause` one. Spec
// 0007 (ADR 0034 D3): the pause cancels the load and its AbortError is ignored.
test( 'stays paused without an error when the system pauses the loading MP3 (K81)', async ( {
	page,
} ) => {
	await page.addInitScript( () => {
		const handlers: Partial<
			Record< MediaSessionAction, MediaSessionActionHandler | null >
		> = {};
		// On the prototype: WebKit ignores an own property on navigator.mediaSession.
		const { setActionHandler } = MediaSession.prototype;
		MediaSession.prototype.setActionHandler = function ( action, handler ) {
			handlers[ action ] = handler;
			setActionHandler.call( this, action, handler );
		};
		Object.assign( window, { mediaSessionHandlers: handlers } );
	} );
	// The stream answers only after the pause, so play() is still pending.
	let respond!: () => void;
	const paused = new Promise< void >( ( resolve ) => ( respond = resolve ) );
	await page.route( '**/live.mp3', async ( route ) => {
		await paused;
		await route.continue();
	} );
	await page.goto( readSeed().urls.live );

	await page.getByRole( 'button', { name: 'Play' } ).click();
	await expect(
		page.getByRole( 'button', { name: 'Pause' } )
	).toHaveAttribute( 'aria-busy', 'true' );
	await page.evaluate( () => {
		const { mediaSessionHandlers } = window as unknown as {
			mediaSessionHandlers: Partial<
				Record< MediaSessionAction, MediaSessionActionHandler >
			>;
		};
		mediaSessionHandlers.pause?.( { action: 'pause' } );
	} );
	respond();

	// pause() rejects the pending play() with AbortError; nothing reports it.
	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeVisible();
	await expect( page.getByRole( 'alert' ) ).toHaveCount( 0 );
	expect( ( await audioState( page ) ).paused ).toBe( true );
} );

// C7 (spec 0007, ADR 0032): Play after a pause reloads the live stream, so it
// plays from the live edge instead of the buffer.
test( 'reloads the live MP3 after Pause and Play (C7)', async ( { page } ) => {
	await page.goto( readSeed().urls.live );
	await startPlayback( page );
	await waitForPlayback( page, 3 );
	const requests = await mediaRequests();

	await page.getByRole( 'button', { name: 'Pause' } ).click();
	const paused = await audioState( page );
	const reloaded = waitForAudioEvent( page, 'playing' );
	await page.getByRole( 'button', { name: 'Play' } ).click();
	await reloaded;
	await waitForPlayback( page, 0.5 );

	// New requests (WebKit makes two per load), and the position starts again
	// near 0 (the live edge).
	expect( ( await mediaRequests() )[ '/live.mp3' ] ).toBeGreaterThan(
		requests[ '/live.mp3' ]
	);
	const state = await audioState( page );
	expect( state.src ).toBe( paused.src );
	expect( state.currentTime ).toBeLessThan( paused.currentTime );
	await expect( page.getByRole( 'button', { name: 'Pause' } ) ).toBeVisible();
} );

test( "does not freeze the live MP3 after Pause and Play in Safari's WebKit (K18)", async ( {
	page,
	browserName,
} ) => {
	test.skip(
		browserName !== 'webkit' || GSTREAMER,
		"Only Safari's WebKit froze, on the fixture's Info frame (K18)"
	);
	await page.goto( readSeed().urls.live );
	await startPlayback( page );

	await page.getByRole( 'button', { name: 'Pause' } ).click();
	const paused = await audioState( page );
	const resumed = waitForPlayback( page, paused.currentTime + 1 );
	await page.getByRole( 'button', { name: 'Play' } ).click();
	await resumed;
	await page.waitForTimeout( QUIET_MS );

	// The position keeps going: past the 1.76 s that the Info frame of a
	// whole tone.mp3 declared, where this WebKit used to stop.
	const state = await audioState( page );
	expect( state ).toMatchObject( { paused: false, errorCode: null } );
	expect( state.currentTime ).toBeGreaterThan( paused.currentTime + 2 );
	await expect( page.getByRole( 'button', { name: 'Pause' } ) ).toBeVisible();
	await expect( page.getByRole( 'alert' ) ).toHaveCount( 0 );
} );

test( 'currently stays stalled without reconnecting when the stream is cut (C8)', async ( {
	page,
	browserName,
} ) => {
	test.skip(
		browserName === 'webkit' && GSTREAMER,
		'WebKitGTK fails with a network error instead (C8, next test)'
	);
	const ranges = recordRanges( page, '/cut.mp3' );
	await page.goto( readSeed().urls.cut );
	await startPlayback( page );

	await waitForAudioEvent( page, 'stalled' );
	const stalled = await audioState( page );
	const requestsAtStall = ranges.length;
	await page.waitForTimeout( QUIET_MS );

	// The player never reloads the stream. Chromium's media stack retries on
	// its own from the byte where it stopped (`Range: bytes=N-`, N > 0), which
	// a live stream does not honour; WebKit does not retry at all.
	const retries = ranges.slice( requestsAtStall );
	if ( browserName === 'webkit' ) {
		expect( retries ).toEqual( [] );
	}
	for ( const range of retries ) {
		expect( range ).toMatch( /^bytes=[1-9]\d*-$/ );
	}

	// Stuck at the end of what arrived before the cut, with no error. WebKit
	// fires `stalled` when the data stops and plays on to the buffer's end.
	const state = await audioState( page );
	const bufferedEnd = state.buffered.at( -1 )?.[ 1 ] ?? 0;
	expect( state ).toMatchObject( {
		src: stalled.src,
		paused: false,
		errorCode: null,
	} );
	expect( bufferedEnd ).toBeGreaterThan( 1 );
	expect( state.currentTime ).toBeGreaterThan( bufferedEnd - 0.1 );
	await expect( page.getByRole( 'alert' ) ).toHaveCount( 0 );

	// The UI: Chromium fires `waiting` and marks the Pause button busy; WebKit
	// only fires `stalled` and keeps it idle.
	await expect(
		page.getByRole( 'button', { name: 'Pause' } )
	).toHaveAttribute(
		'aria-busy',
		browserName === 'webkit' ? 'false' : 'true'
	);
} );

test( 'currently stops with a network error and the play error, without reconnecting, when the stream is cut in WebKitGTK (C8)', async ( {
	page,
	browserName,
} ) => {
	test.skip(
		browserName !== 'webkit' || ! GSTREAMER,
		"Chromium and Safari's WebKit stall instead (previous test)"
	);
	const ranges = recordRanges( page, '/cut.mp3' );
	await page.goto( readSeed().urls.cut );
	await startPlayback( page );

	await waitForAudioEvent( page, 'error' );
	const requestsAtError = ranges.length;
	await page.waitForTimeout( QUIET_MS );

	// No reconnection, neither from the player nor from the media stack. The
	// element ends (`pause` + `ended`) back at 0 and the player shows Play
	// with "Unable to play the stream" (the `pause` keeps the error state,
	// as in K1).
	expect( ranges.slice( requestsAtError ) ).toEqual( [] );
	expect( await audioState( page ) ).toMatchObject( {
		paused: true,
		errorCode: 2,
		currentTime: 0,
	} );
	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeVisible();
	await expect( page.getByRole( 'alert' ) ).toHaveText(
		'Unable to play the stream. Try again later.'
	);
} );
