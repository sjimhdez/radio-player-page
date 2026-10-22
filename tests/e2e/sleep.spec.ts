import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { readSeed } from './seed';
import { audioState, startPlayback } from './support/player';

/**
 * Scenario 7 (spec 0002 §4.4): the sleep timer, driven by `page.clock` on the
 * endless live MP3 so the stream never ends on its own.
 */

// About 1800 page round trips per case: 1–1.6 min in WebKit CI, past the 90 s
// of `test.slow()`.
test.describe.configure( { timeout: 3 * 60 * 1000 } );

// The shortest option, "30 mins": the timer pauses on its 1800th tick.
const SHORTEST_SECONDS = 30 * 60;

/**
 * Advances the fake clock one second at a time. `runFor()` over minutes hangs:
 * it also runs every `requestAnimationFrame` of the visualizer.
 * `fastForward()` fires each due timer at most once, so one call per second
 * gives the countdown interval one tick each.
 *
 * Each tick re-renders and the countdown effect replaces its interval. If that
 * render lands inside the next `fastForward()` (it awaits between timers), the
 * due interval is cleared and the tick is lost (seen in WebKit). After each
 * second the page drains React's queue: a few `MessageChannel` round trips,
 * which the fake clock does not control and React's scheduler uses.
 *
 * @param page    Player page.
 * @param seconds Seconds to advance.
 */
async function tick( page: Page, seconds: number ) {
	for ( let i = 0; i < seconds; i++ ) {
		await page.clock.fastForward( 1000 );
		await page.evaluate( async () => {
			for ( let round = 0; round < 3; round++ ) {
				await new Promise< void >( ( done ) => {
					const channel = new MessageChannel();
					channel.port1.onmessage = () => done();
					channel.port2.postMessage( null );
				} );
			}
		} );
	}
}

/**
 * Opens the live station with a fake clock, starts playback and stops the
 * clock: an installed clock keeps running in real time, which would add ticks
 * while an assertion retries.
 *
 * @param page Player page.
 */
async function openPlaying( page: Page ) {
	await page.clock.install();
	await page.goto( readSeed().urls.live );
	await startPlayback( page );
	await page.clock.pauseAt(
		( await page.evaluate( () => Date.now() ) ) + 1000
	);
}

/**
 * Sets the sleep timer to its shortest option.
 *
 * @param page Player page.
 */
async function setShortestTimer( page: Page ) {
	await page.getByRole( 'button', { name: 'Sleep mode' } ).click();
	await page.getByRole( 'menuitem', { name: '30 mins' } ).click();
	await expect( page.getByText( '30:00', { exact: true } ) ).toBeVisible();
}

/**
 * Checks that the stream is still playing.
 *
 * @param page Player page.
 */
async function expectPlaying( page: Page ) {
	await expect( page.getByRole( 'button', { name: 'Pause' } ) ).toBeVisible();
	expect( ( await audioState( page ) ).paused ).toBe( false );
}

test( 'counts down and pauses when the shortest option runs out', async ( {
	page,
} ) => {
	await openPlaying( page );
	await setShortestTimer( page );

	await tick( page, 1 );
	await expect( page.getByText( '29:59', { exact: true } ) ).toBeVisible();
	await tick( page, SHORTEST_SECONDS - 1 );

	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeVisible();
	expect( ( await audioState( page ) ).paused ).toBe( true );
	await expect(
		page.getByRole( 'button', { name: 'Cancel sleep mode' } )
	).toHaveCount( 0 );
} );

test( 'a manual pause cancels the timer', async ( { page } ) => {
	await openPlaying( page );
	await setShortestTimer( page );
	await tick( page, 60 );
	await expect( page.getByText( '29:00', { exact: true } ) ).toBeVisible();

	await page.getByRole( 'button', { name: 'Pause' } ).click();
	await expect(
		page.getByRole( 'button', { name: 'Cancel sleep mode' } )
	).toHaveCount( 0 );
	await startPlayback( page );
	await tick( page, SHORTEST_SECONDS );

	await expectPlaying( page );
	await expect(
		page.getByRole( 'button', { name: 'Cancel sleep mode' } )
	).toHaveCount( 0 );
} );

test( 'the cancel button stops the timer', async ( { page } ) => {
	await openPlaying( page );
	await setShortestTimer( page );
	await tick( page, 60 );
	await expect( page.getByText( '29:00', { exact: true } ) ).toBeVisible();

	await page.getByRole( 'button', { name: 'Cancel sleep mode' } ).click();
	await expect( page.getByText( '29:00', { exact: true } ) ).toBeHidden();
	await tick( page, SHORTEST_SECONDS );

	await expectPlaying( page );
} );

test( 'disables sleep mode during the welcome audio and keeps the timer set on the live stream (K65)', async ( {
	page,
} ) => {
	await page.goto( readSeed().urls.intro );
	await page.getByRole( 'button', { name: 'Play' } ).click();
	await page.waitForFunction( () => {
		const audio = document.querySelector( 'audio' );
		return !! audio && /intro/.test( audio.src ) && audio.currentTime > 0.2;
	} );
	// Read in one go: a retried `toBeDisabled()` would also pass once the
	// handover goes through `paused`.
	expect(
		await page.evaluate( () => ( {
			intro: /intro/.test( document.querySelector( 'audio' )?.src ?? '' ),
			disabled:
				document.querySelector< HTMLButtonElement >(
					'button[aria-label="Sleep mode"]'
				)?.disabled ?? null,
		} ) )
	).toEqual( { intro: true, disabled: true } );

	// The end of the welcome audio fires `pause` before `ended`: the status
	// goes through `paused`, which would cancel a running timer.
	await page.waitForFunction( () => {
		const audio = document.querySelector( 'audio' );
		return (
			!! audio &&
			/\/live\.mp3$/.test( audio.src ) &&
			audio.currentTime > 1
		);
	} );
	await page.getByRole( 'button', { name: 'Sleep mode' } ).click();
	await page.getByRole( 'menuitem', { name: '30 mins' } ).click();
	await expect(
		page.getByRole( 'button', { name: 'Cancel sleep mode' } )
	).toBeVisible();

	// Real time: the timer is still set a few seconds into the live stream.
	await page.waitForTimeout( 3000 );
	await expect(
		page.getByRole( 'button', { name: 'Cancel sleep mode' } )
	).toBeVisible();
	await expectPlaying( page );
} );
