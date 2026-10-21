import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { readSeed } from './seed';
import { audioState, startPlayback, waitForPlayback } from './support/player';

/**
 * Spec 0006, task 3.2: what the player hands to the Media Session API (lock
 * screen, notification, headphones), on the MP3 station, which has a logo.
 * Playwright cannot reach the system controls: the handlers the player sets
 * are kept on `window` and the tests call them.
 */

/** The action handlers the player set, by action (the last one set). */
type Handlers = Partial<
	Record< MediaSessionAction, MediaSessionActionHandler | null >
>;

/**
 * Keeps on `window.mediaSessionHandlers` every action handler the page sets.
 *
 * @param page Player page, before `goto()`.
 */
async function captureHandlers( page: Page ) {
	await page.addInitScript( () => {
		const handlers: Handlers = {};
		// On the prototype: WebKit ignores an own property on navigator.mediaSession.
		const { setActionHandler } = MediaSession.prototype;
		MediaSession.prototype.setActionHandler = function ( action, handler ) {
			handlers[ action ] = handler;
			setActionHandler.call( this, action, handler );
		};
		Object.assign( window, { mediaSessionHandlers: handlers } );
	} );
}

/**
 * Calls the captured handler of `action`, as the system controls would.
 *
 * @param page   Player page.
 * @param action `play` or `pause`.
 */
function runHandler( page: Page, action: 'play' | 'pause' ) {
	return page.evaluate( ( name ) => {
		const { mediaSessionHandlers } = window as unknown as {
			mediaSessionHandlers: Handlers;
		};
		const handler = mediaSessionHandlers[ name ];
		if ( ! handler ) {
			throw new Error( `no ${ name } handler` );
		}
		handler( { action: name } );
	}, action );
}

/**
 * Reads `navigator.mediaSession.playbackState`.
 *
 * @param page Player page.
 */
function playbackState( page: Page ) {
	return page.evaluate( () => navigator.mediaSession.playbackState );
}

test.beforeEach( async ( { page } ) => {
	await captureHandlers( page );
	await page.goto( readSeed().urls.mp3 );
} );

test( 'sends the station name and its logo in six sizes as metadata', async ( {
	page,
} ) => {
	const { config, metadata } = await page.evaluate( () => {
		const { siteTitle, logoImage } = (
			window as unknown as {
				RADPLAPAG_CONFIG: { siteTitle: string; logoImage: string };
			}
		 ).RADPLAPAG_CONFIG;
		const current = navigator.mediaSession.metadata;
		return {
			config: { siteTitle, logoImage },
			metadata: current && {
				title: current.title,
				artwork: current.artwork.map( ( { src, sizes, type } ) => ( {
					src,
					sizes,
					type,
				} ) ),
			},
		};
	} );

	expect( config.siteTitle ).toBe( 'E2E MP3' );
	expect( config.logoImage ).toMatch( /\.jpg$/ );
	expect( metadata?.title ).toBe( 'E2E MP3' );
	expect( metadata?.artwork ).toEqual(
		[ '96x96', '128x128', '192x192', '256x256', '384x384', '512x512' ].map(
			( sizes ) => ( {
				src: config.logoImage,
				sizes,
				type: 'image/jpeg',
			} )
		)
	);
} );

test( 'follows the player in playbackState: paused, playing, paused', async ( {
	page,
} ) => {
	expect( await playbackState( page ) ).toBe( 'paused' );

	await startPlayback( page );
	await expect.poll( () => playbackState( page ) ).toBe( 'playing' );

	await page.getByRole( 'button', { name: 'Pause' } ).click();
	await expect.poll( () => playbackState( page ) ).toBe( 'paused' );
} );

test( 'sets play and pause, and clears the seek and track actions', async ( {
	page,
} ) => {
	const handlers = await page.evaluate( () => {
		const { mediaSessionHandlers } = window as unknown as {
			mediaSessionHandlers: Handlers;
		};
		return Object.fromEntries(
			Object.entries( mediaSessionHandlers ).map(
				( [ name, handler ] ) => [ name, typeof handler ]
			)
		);
	} );

	// typeof null is 'object': set to null, not left unset.
	expect( handlers ).toEqual( {
		play: 'function',
		pause: 'function',
		seekbackward: 'object',
		seekforward: 'object',
		seekto: 'object',
		previoustrack: 'object',
		nexttrack: 'object',
	} );
} );

test( 'plays and pauses from the play and pause handlers', async ( {
	page,
} ) => {
	const playback = waitForPlayback( page, 1 );
	await runHandler( page, 'play' );
	await playback;
	await expect( page.getByRole( 'button', { name: 'Pause' } ) ).toBeVisible();

	await runHandler( page, 'pause' );
	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeVisible();
	expect( ( await audioState( page ) ).paused ).toBe( true );
} );
