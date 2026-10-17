import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { readSeed } from './seed';
import {
	audioState,
	waitForAudioEvent,
	waitForPlayback,
} from './support/player';

/**
 * Scenario 3 (spec 0002 §4.4): the welcome audio plays once before the live
 * stream, cannot be paused, and a broken one falls through to the live stream
 * without an error.
 */

const INTRO = /\/intro(-\d+)?\.mp3$/;
const LIVE = /\/live\.mp3$/;

declare global {
	interface Window {
		/** `<event> <audio.src>` for each `loadstart` and `ended`, in order. */
		e2eMediaLog: string[];
		/** Text of every `role="alert"` element ever added to the page. */
		e2eAlerts: string[];
	}
}

/**
 * Starts logging the sources the `<audio>` element loads and ends, and every
 * alert that shows up, so the test can read the whole sequence afterwards.
 *
 * @param page Player page, already loaded.
 */
async function recordPlayer( page: Page ) {
	await page.evaluate( () => {
		const audio = document.querySelector( 'audio' );
		if ( ! audio ) {
			throw new Error( 'no <audio> element' );
		}
		window.e2eMediaLog = [];
		// Captured on `window`, so it runs before the player's own `ended`
		// listener swaps `audio.src` to the live stream.
		for ( const name of [ 'loadstart', 'ended' ] ) {
			window.addEventListener(
				name,
				( event ) => {
					if ( event.target === audio ) {
						window.e2eMediaLog.push( `${ name } ${ audio.src }` );
					}
				},
				true
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

/**
 * The log of recordPlayer() with each URL reduced to its file name.
 *
 * @param page Player page.
 */
async function mediaLog( page: Page ) {
	const log = await page.evaluate( () => window.e2eMediaLog );
	return log.map( ( entry ) =>
		entry
			.replace( /\S+\/(intro)(-\d+)?\.mp3$/, '$1' )
			.replace( /\S+\/(live|broken-intro)\.mp3$/, '$1' )
	);
}

test( 'plays the welcome audio once, unpausable, then the live stream', async ( {
	page,
} ) => {
	await page.goto( readSeed().urls.intro );
	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeVisible();
	await recordPlayer( page );

	const introPlaying = waitForPlayback( page, 0.5 );
	await page.getByRole( 'button', { name: 'Play' } ).click();
	await introPlaying;

	// While the welcome audio plays, the button shows Pause but is disabled.
	expect( ( await audioState( page ) ).src ).toMatch( INTRO );
	await expect(
		page.getByRole( 'button', { name: 'Pause' } )
	).toBeDisabled();

	// When it ends, the live stream takes over and the button works again.
	await expect
		.poll( async () => ( await audioState( page ) ).src )
		.toMatch( LIVE );
	await waitForPlayback( page, 1 );
	await expect( page.getByRole( 'button', { name: 'Pause' } ) ).toBeEnabled();

	// Pause + Play resumes the live stream; the welcome audio does not return.
	// (WebKit then freezes, K18, so this waits for `play`, not for playback.)
	await page.getByRole( 'button', { name: 'Pause' } ).click();
	const resumed = waitForAudioEvent( page, 'play' );
	await page.getByRole( 'button', { name: 'Play' } ).click();
	await resumed;

	expect( ( await audioState( page ) ).src ).toMatch( LIVE );
	expect( await mediaLog( page ) ).toEqual( [
		'loadstart intro',
		'ended intro',
		'loadstart live',
	] );
	expect( await page.evaluate( () => window.e2eAlerts ) ).toEqual( [] );
} );

test( 'falls through to the live stream without an error when the welcome audio is broken', async ( {
	page,
} ) => {
	await page.goto( readSeed().urls[ 'broken-intro' ] );
	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeVisible();
	await recordPlayer( page );

	const playing = waitForPlayback( page, 1 );
	await page.getByRole( 'button', { name: 'Play' } ).click();
	await playing;

	// The 404 never ends: the live stream replaces it, with no alert at any
	// point and a working Pause button.
	const state = await audioState( page );
	expect( state ).toMatchObject( { paused: false, errorCode: null } );
	expect( state.src ).toMatch( LIVE );
	expect( await mediaLog( page ) ).toEqual( [
		'loadstart broken-intro',
		'loadstart live',
	] );
	expect( await page.evaluate( () => window.e2eAlerts ) ).toEqual( [] );
	await expect( page.getByRole( 'button', { name: 'Pause' } ) ).toBeEnabled();
} );
