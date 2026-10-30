import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { readSeed } from './seed';
import { audioState, startPlayback, waitForPlayback } from './support/player';

/**
 * Visualizer or static animation (spec 0007, tasks 1.4 and 1.8; K82, ADR 0031
 * and 0033). The audio controller decides from the source in progress: only the
 * live stream with CORS is visualized, never the welcome audio, and WebKit never
 * visualizes. No pixels are read: written while the drawing was a frozen zone
 * (ADR 0018), lifted by ADR 0071; the drawing is tested in the player core.
 */

const INTRO = /\/intro(-\d+)?\.mp3$/;

/**
 * Reads the computed opacity of the visualizer canvas.
 *
 * @param page Player page.
 */
function canvasOpacity( page: Page ) {
	// Decorative, without a role (ADR 0072)
	return page
		.locator( 'canvas[aria-hidden="true"]' )
		.evaluate( ( canvas ) => getComputedStyle( canvas ).opacity );
}

/**
 * Rendered height of the `Collapse` that holds the animated dots shown while
 * playing without a visualizer, or 0 when it is not mounted (K60). While it
 * opens, its dots keep a box and `visibility: visible`, so `toBeVisible()`
 * cannot tell.
 *
 * @param page Player page.
 */
async function staticAnimationHeight( page: Page ) {
	const collapse = page.locator( '.MuiCollapse-root', {
		has: page.locator( '.loader' ),
	} );
	if ( ( await collapse.count() ) === 0 ) {
		return 0;
	}
	return collapse.evaluate(
		( element ) => element.getBoundingClientRect().height
	);
}

test( 'shows the visualizer in Chromium and never in WebKit, with CORS (K82)', async ( {
	page,
	browserName,
} ) => {
	await page.goto( readSeed().urls.live );
	await startPlayback( page );

	if ( browserName === 'webkit' ) {
		expect( await canvasOpacity( page ) ).toBe( '0' );
		await expect
			.poll( () => staticAnimationHeight( page ) )
			.toBeGreaterThan( 0 );
	} else {
		await expect.poll( () => canvasOpacity( page ) ).toBe( '1' );
		expect( await staticAnimationHeight( page ) ).toBe( 0 );
	}
} );

test( 'shows the static animation for a stream without CORS, and the audio advances (K82)', async ( {
	page,
} ) => {
	await page.goto( readSeed().urls[ 'nocors-mp3' ] );
	await startPlayback( page );

	expect( await canvasOpacity( page ) ).toBe( '0' );
	await expect
		.poll( () => staticAnimationHeight( page ) )
		.toBeGreaterThan( 0 );
	const { currentTime } = await audioState( page );
	await expect
		.poll( async () => ( await audioState( page ) ).currentTime )
		.toBeGreaterThan( currentTime );
} );

test( 'shows the static animation during the welcome audio (K82)', async ( {
	page,
} ) => {
	await page.goto( readSeed().urls.intro );
	const introPlaying = waitForPlayback( page, 0.2 );
	await page.getByRole( 'button', { name: 'Play' } ).click();
	await introPlaying;

	expect( ( await audioState( page ) ).src ).toMatch( INTRO );
	expect( await canvasOpacity( page ) ).toBe( '0' );
	await expect
		.poll( () => staticAnimationHeight( page ) )
		.toBeGreaterThan( 0 );
} );

test.describe( 'on a high-density screen', () => {
	test.use( { deviceScaleFactor: 2 } );

	test( 'draws the visualizer at twice its CSS size (K117)', async ( {
		page,
		browserName,
	} ) => {
		test.skip( browserName === 'webkit', 'WebKit never visualizes' );
		await page.goto( readSeed().urls.live );
		await startPlayback( page );
		await expect.poll( () => canvasOpacity( page ) ).toBe( '1' );

		const sizes = await page.locator( 'canvas' ).evaluate( ( canvas ) => {
			const box = canvas.getBoundingClientRect();
			const element = canvas as HTMLCanvasElement;
			return {
				css: [ Math.round( box.width ), Math.round( box.height ) ],
				device: [ element.width, element.height ],
			};
		} );
		expect( sizes.device ).toEqual( [
			sizes.css[ 0 ] * 2,
			sizes.css[ 1 ] * 2,
		] );
	} );
} );

test( 'shows the static animation under "reduce motion", also when it changes while playing (K124)', async ( {
	page,
	browserName,
} ) => {
	test.skip( browserName === 'webkit', 'WebKit never visualizes' );
	await page.emulateMedia( { reducedMotion: 'reduce' } );
	await page.goto( readSeed().urls.live );
	await startPlayback( page );

	expect( await canvasOpacity( page ) ).toBe( '0' );
	await expect
		.poll( () => staticAnimationHeight( page ) )
		.toBeGreaterThan( 0 );

	await page.emulateMedia( { reducedMotion: 'no-preference' } );
	await expect.poll( () => canvasOpacity( page ) ).toBe( '1' );
	await expect.poll( () => staticAnimationHeight( page ) ).toBe( 0 );

	await page.emulateMedia( { reducedMotion: 'reduce' } );
	await expect.poll( () => canvasOpacity( page ) ).toBe( '0' );
} );
