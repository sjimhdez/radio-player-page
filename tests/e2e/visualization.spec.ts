import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { readSeed } from './seed';
import { audioState, startPlayback, waitForPlayback } from './support/player';

/**
 * Visualizer or static animation (spec 0007, task 1.4). Characterization of
 * `useCanVisualize()`: the choice is taken on mount from the user agent, before
 * any source is loaded (K82). Chromium always shows the canvas, also during the
 * welcome audio; WebKit never does, even with a CORS-enabled stream, and shows
 * the static animation instead. No pixels are read (frozen zone, ADR 0018).
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

test( 'currently shows the visualizer in Chromium and never in WebKit, with CORS (K82)', async ( {
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
		expect( await canvasOpacity( page ) ).toBe( '1' );
		expect( await staticAnimationHeight( page ) ).toBe( 0 );
	}
} );

test( 'currently shows the visualizer in Chromium during the welcome audio (K82)', async ( {
	page,
	browserName,
} ) => {
	test.skip(
		browserName === 'webkit',
		'WebKit never shows the visualizer (previous test)'
	);
	await page.goto( readSeed().urls.intro );
	const introPlaying = waitForPlayback( page, 0.2 );
	await page.getByRole( 'button', { name: 'Play' } ).click();
	await introPlaying;

	expect( ( await audioState( page ) ).src ).toMatch( INTRO );
	expect( await canvasOpacity( page ) ).toBe( '1' );
	expect( await staticAnimationHeight( page ) ).toBe( 0 );
} );
