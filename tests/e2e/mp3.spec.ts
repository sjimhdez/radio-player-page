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
// Session handlers are kept on `window` and the test calls the `pause` one.
test( 'currently shows the play error when the system pauses the loading MP3 (K81)', async ( {
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
	await expect( page.getByRole( 'progressbar' ) ).toBeVisible();
	await page.evaluate( () => {
		const { mediaSessionHandlers } = window as unknown as {
			mediaSessionHandlers: Partial<
				Record< MediaSessionAction, MediaSessionActionHandler >
			>;
		};
		mediaSessionHandlers.pause?.( { action: 'pause' } );
	} );
	respond();

	// play() rejects with AbortError and the player reports it as a failure.
	await expect( page.getByRole( 'alert' ) ).toHaveText(
		'Unable to play the stream. Try again later.'
	);
	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeVisible();
	expect( ( await audioState( page ) ).paused ).toBe( true );
} );

test( 'currently resumes the live MP3 from the buffer after Pause and Play (C7)', async ( {
	page,
	browserName,
} ) => {
	test.skip(
		browserName === 'webkit' && ! GSTREAMER,
		"Safari's WebKit freezes instead (K18)"
	);
	await page.goto( readSeed().urls.live );
	await startPlayback( page );
	const requests = await mediaRequests();

	await page.getByRole( 'button', { name: 'Pause' } ).click();
	const paused = await audioState( page );
	const resumed = waitForPlayback( page, paused.currentTime + 1 );
	await page.getByRole( 'button', { name: 'Play' } ).click();
	await resumed;

	// No new request: the same connection keeps feeding the buffer, and the
	// position goes on from where it paused (behind the live edge).
	expect( await mediaRequests() ).toEqual( requests );
	const state = await audioState( page );
	expect( state.src ).toBe( paused.src );
	expect( state.currentTime ).toBeGreaterThan( paused.currentTime );
	// GStreamer reports no buffered ranges for a live stream.
	if ( browserName === 'chromium' ) {
		expect( state.buffered[ 0 ]?.[ 0 ] ).toBe( 0 );
	}
} );

test( "currently freezes the live MP3 after Pause and Play in Safari's WebKit (K18)", async ( {
	page,
	browserName,
} ) => {
	test.skip(
		browserName !== 'webkit' || GSTREAMER,
		'Chromium and WebKitGTK resume from the buffer (C7)'
	);
	await page.goto( readSeed().urls.live );
	await startPlayback( page );
	const requests = await mediaRequests();

	await page.getByRole( 'button', { name: 'Pause' } ).click();
	const paused = await audioState( page );
	await page.getByRole( 'button', { name: 'Play' } ).click();
	await page.waitForTimeout( QUIET_MS );

	// Not paused, no error and no new request, but the buffer is gone: after a
	// fraction of a second the position stops (less than 1 s in QUIET_MS),
	// silence while the UI shows Pause.
	expect( await mediaRequests() ).toEqual( requests );
	const state = await audioState( page );
	expect( state ).toMatchObject( {
		src: paused.src,
		paused: false,
		errorCode: null,
		buffered: [],
	} );
	expect( state.currentTime ).toBeLessThan( paused.currentTime + 1 );
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

	// The UI: Chromium fires `waiting` and shows the spinner; WebKit only
	// fires `stalled` and keeps the Pause button.
	if ( browserName === 'webkit' ) {
		await expect(
			page.getByRole( 'button', { name: 'Pause' } )
		).toBeVisible();
	} else {
		await expect( page.getByRole( 'progressbar' ) ).toBeVisible();
		await expect(
			page.getByRole( 'button', { name: /^(Play|Pause)$/ } )
		).toHaveCount( 0 );
	}
} );

test( 'currently stops with a network error and no message when the stream is cut in WebKitGTK (C8)', async ( {
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
	// element ends (`pause` + `ended`) back at 0 and the player shows Play,
	// with no "Unable to play the stream" (the `pause` replaces the error
	// state, as in K1).
	expect( ranges.slice( requestsAtError ) ).toEqual( [] );
	expect( await audioState( page ) ).toMatchObject( {
		paused: true,
		errorCode: 2,
		currentTime: 0,
	} );
	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeVisible();
	await expect( page.getByRole( 'alert' ) ).toHaveCount( 0 );
} );
