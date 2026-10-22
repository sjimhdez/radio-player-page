import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { readSeed } from './seed';
import { audioState, startPlayback, waitForPlayback } from './support/player';

/**
 * Visualizer or static animation (spec 0007, tasks 1.4 and 1.8; K82, ADR 0031
 * and 0033). The audio controller decides from the source in progress: only the
 * live stream with CORS is visualized, never the welcome audio, and WebKit never
 * visualizes. No pixels are read (frozen zone, ADR 0018).
 */

const INTRO = /\/intro(-\d+)?\.mp3$/;

/**
 * Reads the computed opacity of the visualizer canvas.
 *
 * @param page Player page.
 */
function canvasOpacity( page: Page ) {
	return page
		.getByRole( 'img', { name: 'Audio visualizer' } )
		.evaluate( ( canvas ) => getComputedStyle( canvas ).opacity );
}

/**
 * Rendered height of the `Collapse` that holds the animated dots shown while
 * playing without a visualizer. Collapsed, it is 0 px tall but its dots keep a
 * box and `visibility: visible`, so `toBeVisible()` cannot tell.
 *
 * @param page Player page.
 */
function staticAnimationHeight( page: Page ) {
	return page
		.locator( '.MuiCollapse-root', { has: page.locator( '.loader' ) } )
		.evaluate( ( collapse ) => collapse.getBoundingClientRect().height );
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
