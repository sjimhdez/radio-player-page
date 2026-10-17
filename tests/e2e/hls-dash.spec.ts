import type { Page, Request } from '@playwright/test';
import { expect, test } from './fixtures';
import { readSeed } from './seed';
import { audioState, startPlayback } from './support/player';

/**
 * Scenario 2 (spec 0002 §4.4): HLS and DASH play, and which path each browser
 * takes. With MSE (`hls.js`, `dashjs`) `audio.src` is a `blob:` URL; with
 * native playback it is the stream URL. The two libraries are lazy chunks of
 * player/dist/ and are only requested when the protocol needs them.
 */

const CHUNKS = {
	hls: /-hls\.min\.js$/,
	dash: /-dash-all-min\.min\.js$/,
};

/**
 * Where the `<audio>` element gets its media from: its `src`, the resolved
 * `currentSrc` and the `src` of its `<source>` children.
 *
 * @param page Player page.
 */
function mediaSource( page: Page ) {
	return page.evaluate( () => {
		const audio = document.querySelector( 'audio' );
		if ( ! audio ) {
			throw new Error( 'no <audio> element' );
		}
		return {
			src: audio.src,
			currentSrc: audio.currentSrc,
			sources: [ ...audio.querySelectorAll( 'source' ) ].map(
				( source ) => source.src
			),
		};
	} );
}

/**
 * Collects which of the `hls.js` and `dashjs` chunks the page requests.
 *
 * @param page Player page.
 */
function recordChunks( page: Page ) {
	const requested = new Set< keyof typeof CHUNKS >();
	page.on( 'request', ( request: Request ) => {
		const { pathname } = new URL( request.url() );
		for ( const [ name, pattern ] of Object.entries( CHUNKS ) ) {
			if ( pattern.test( pathname ) ) {
				requested.add( name as keyof typeof CHUNKS );
			}
		}
	} );
	return requested;
}

test( 'plays HLS with hls.js (MSE)', async ( { page, browserName } ) => {
	const chunks = recordChunks( page );
	await page.goto( readSeed().urls.hls );

	await startPlayback( page );

	// Desktop WebKit is not iOS for the player, so it takes hls.js too. There
	// hls.js uses ManagedMediaSource, which it attaches through a `<source>`
	// child: `audio.src` stays empty and the blob is only in `currentSrc`.
	const media = await mediaSource( page );
	expect( media.currentSrc ).toMatch( /^blob:/ );
	if ( browserName === 'webkit' ) {
		expect( media ).toEqual( {
			src: '',
			currentSrc: media.currentSrc,
			sources: [ media.currentSrc ],
		} );
	} else {
		expect( media ).toEqual( {
			src: media.currentSrc,
			currentSrc: media.currentSrc,
			sources: [],
		} );
	}
	expect( [ ...chunks ] ).toEqual( [ 'hls' ] );
	await expect( page.getByRole( 'button', { name: 'Pause' } ) ).toBeVisible();
} );

test( 'plays DASH with dashjs (MSE)', async ( { page } ) => {
	const chunks = recordChunks( page );
	await page.goto( readSeed().urls.dash );

	await startPlayback( page );

	const media = await mediaSource( page );
	expect( media.src ).toMatch( /^blob:/ );
	expect( media.sources ).toEqual( [] );
	expect( [ ...chunks ] ).toEqual( [ 'dash' ] );
	await expect( page.getByRole( 'button', { name: 'Pause' } ) ).toBeVisible();
} );

test( 'requests neither hls.js nor dashjs for MP3', async ( { page } ) => {
	const chunks = recordChunks( page );
	await page.goto( readSeed().urls.mp3 );

	await startPlayback( page );

	expect( ( await audioState( page ) ).src ).toMatch( /\/tone\.mp3$/ );
	expect( [ ...chunks ] ).toEqual( [] );
} );
