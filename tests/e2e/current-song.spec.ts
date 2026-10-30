import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { readSeed, type SeedUrlKey } from './seed';
import {
	mediaPort,
	mediaRequests,
	resetMediaRequests,
	startPlayback,
	type MediaOrigin,
} from './support/player';

/**
 * Spec 0020 (A12, ADR 0068): the current song below the station name, from
 * the status-json.xsl of an Icecast (M1), the ICY in the stream (M3) or the
 * ID3 of an HLS (M4), against the origins of media-server.mjs. Where the
 * server does not give it, the player looks as before and writes nothing in
 * the console; the network errors the browser itself writes for a request
 * blocked by CORS do not count.
 */

const FIRST = 'E2E Artist - First Song';
const SECOND = 'E2E Artist - Second Song';

/** What the browser writes for a request blocked by CORS or a failed load. */
const NETWORK_ERROR =
	/Access-Control|CORS|Failed to load resource|Fetch API cannot load|net::ERR_/;

/**
 * Sets the song of a media origin (none: the default, FIRST).
 *
 * @param origin Media origin.
 * @param title  Song.
 */
async function setSong( origin: MediaOrigin, title?: string ) {
	const query = title ? `?title=${ encodeURIComponent( title ) }` : '';
	await fetch(
		`http://localhost:${ await mediaPort( origin ) }/__song${ query }`,
		{
			method: 'POST',
		}
	);
}

/**
 * Collects what the page writes in the console, and its uncaught errors,
 * except the network errors of the browser.
 *
 * @param page Player page.
 */
function recordConsole( page: Page ) {
	const messages: string[] = [];
	page.on( 'console', ( message ) => {
		if ( ! NETWORK_ERROR.test( message.text() ) ) {
			messages.push( `${ message.type() }: ${ message.text() }` );
		}
	} );
	// WebKit also reports a fetch blocked by CORS as a page error, even when
	// the promise is caught.
	page.on( 'pageerror', ( error ) => {
		const text = `${ error.name }: ${ error.message }`;
		if ( ! NETWORK_ERROR.test( text ) ) {
			messages.push( text );
		}
	} );
	return messages;
}

/**
 * Opens a station with the clock installed, plays it and pauses the clock,
 * so that the intervals of the poller only run on `fastForward()` (an
 * installed clock flows at real speed until paused).
 *
 * @param page Player page.
 * @param key  Seeded variant.
 */
async function play( page: Page, key: SeedUrlKey ) {
	await page.clock.install();
	await page.goto( readSeed().urls[ key ] );
	await startPlayback( page );
	const now = await page.evaluate( () => Date.now() );
	await page.clock.pauseAt( now + 1000 );
}

/**
 * The line of the song: a paragraph with the hidden prefix.
 *
 * @param page Player page.
 */
const songLine = ( page: Page ) =>
	page.locator( 'p', { has: page.getByText( 'Now playing:' ) } );

test.afterEach( async () => {
	await setSong( 'cors' );
	await setSong( 'icy' );
} );

test( 'shows the song of an Icecast status-json.xsl and follows it every 20 s', async ( {
	page,
} ) => {
	const messages = recordConsole( page );
	await play( page, 'song-icecast' );

	await expect( songLine( page ) ).toHaveText( `Now playing: ${ FIRST }` );
	// Below the name, as plain text without a live region (ADR 0068 §11).
	const name = page.getByRole( 'heading', { level: 1 } );
	expect( ( await songLine( page ).boundingBox() )!.y ).toBeGreaterThan(
		( await name.boundingBox() )!.y
	);
	await expect( songLine( page ) ).not.toHaveAttribute( 'aria-live' );
	await expect( page.getByText( 'Now playing:' ) ).toHaveCSS(
		'position',
		'absolute'
	);

	await setSong( 'cors', SECOND );
	await page.clock.fastForward( 20000 );
	await expect( songLine( page ) ).toHaveText( `Now playing: ${ SECOND }` );
	expect( messages ).toEqual( [] );
} );

test( 'clears the song on a pause and asks nothing while paused', async ( {
	page,
} ) => {
	await play( page, 'song-icecast' );
	await expect( songLine( page ) ).toBeVisible();

	await page.getByRole( 'button', { name: 'Pause' } ).click();
	await expect( songLine( page ) ).toHaveCount( 0 );
	await resetMediaRequests();
	await page.clock.fastForward( 20000 );
	await page.clock.fastForward( 20000 );
	expect( ( await mediaRequests() )[ '/status-json.xsl' ] ).toBeUndefined();
} );

test( 'falls back to the ICY in the stream when there is no status-json.xsl, every 30 s', async ( {
	page,
} ) => {
	const messages = recordConsole( page );
	await resetMediaRequests( 'icy' );
	await play( page, 'song-icy' );

	await expect( songLine( page ) ).toHaveText( `Now playing: ${ FIRST }` );
	expect( await mediaRequests( 'icy' ) ).toMatchObject( {
		'/live.mp3 (Icy-MetaData)': 1,
	} );

	await setSong( 'icy', SECOND );
	await page.clock.fastForward( 30000 );
	await expect( songLine( page ) ).toHaveText( `Now playing: ${ SECOND }` );
	expect( messages ).toEqual( [] );
} );

test( 'shows nothing for a Shoutcast, whose status-json.xsl is its audio, and closes it', async ( {
	page,
} ) => {
	const messages = recordConsole( page );
	await resetMediaRequests( 'shoutcast' );
	await play( page, 'song-shoutcast' );

	await expect
		.poll(
			async () =>
				( await mediaRequests( 'shoutcast' ) )[ '/status-json.xsl' ]
		)
		.toBe( 1 );
	await expect
		.poll( async () => {
			const response = await fetch(
				`http://localhost:${ await mediaPort( 'shoutcast' ) }/__open`
			);
			return ( await response.json() )[ '/status-json.xsl' ];
		} )
		.toBe( 0 );
	await page.clock.fastForward( 30000 );
	await expect( songLine( page ) ).toHaveCount( 0 );
	expect( ( await mediaRequests( 'shoutcast' ) )[ '/status-json.xsl' ] ).toBe(
		1
	);
	expect( messages ).toEqual( [] );
} );

test( 'shows nothing for a server without CORS', async ( { page } ) => {
	const messages = recordConsole( page );
	await resetMediaRequests( 'nocors' );
	await play( page, 'song-nocors' );

	await expect
		.poll(
			async () =>
				( await mediaRequests( 'nocors' ) )[ '/status-json.xsl' ]
		)
		.toBe( 1 );
	await page.clock.fastForward( 30000 );
	await expect( songLine( page ) ).toHaveCount( 0 );
	expect( ( await mediaRequests( 'nocors' ) )[ '/status-json.xsl' ] ).toBe(
		1
	);
	expect( messages ).toEqual( [] );
} );

test( 'asks the server nothing when the station does not show the song', async ( {
	page,
} ) => {
	await resetMediaRequests( 'icy' );
	await play( page, 'song-off' );
	await page.clock.fastForward( 30000 );
	await page.clock.fastForward( 30000 );

	await expect( songLine( page ) ).toHaveCount( 0 );
	// Only the player's loads of the stream (WebKit makes two).
	expect( Object.keys( await mediaRequests( 'icy' ) ) ).toEqual( [
		'/live.mp3',
	] );
} );

test( 'shows the song of the ID3 tags of an HLS stream', async ( { page } ) => {
	// No fake clock: hls.js loads the segments on its own timers.
	const messages = recordConsole( page );
	await page.goto( readSeed().urls[ 'song-hls' ] );
	await startPlayback( page );

	await expect( songLine( page ) ).toHaveText( `Now playing: ${ FIRST }` );
	await expect( songLine( page ) ).toHaveText( `Now playing: ${ SECOND }`, {
		timeout: 10000,
	} );
	expect( messages ).toEqual( [] );
} );
