import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures';
import { readSeed, type SeedUrlKey } from './seed';
import { stationInstant, type StationDay } from './support/clock';
import { buttonGaps, startPlayback } from './support/player';

/**
 * Spec 0016 (V1): screenshots of the player in each state at the reference
 * widths, attached to the Playwright report for a review by eye. No pixel
 * comparison: each state only checks that the h1 and the controls region are
 * there. Run it with the HTML reporter in a folder of its own:
 * `PLAYWRIGHT_HTML_REPORT=test-results/visual-<stage> npx playwright test
 * visual-baseline.spec.ts --reporter=list,html`.
 */

const VIEWPORTS = [
	{ width: 1440, height: 900 },
	{ width: 1024, height: 768 },
	{ width: 390, height: 844 },
	{ width: 360, height: 800 },
] as const;

interface State {
	/** Seeded station. */
	station: SeedUrlKey;
	/** Station day and time of the browser clock. */
	at: [ StationDay, string ];
	/** Starts playback before the screenshot. */
	play?: boolean;
}

/**
 * Opens `state` at each reference width and attaches a screenshot of each.
 *
 * @param page     Player page.
 * @param testInfo Test info, for the attachments.
 * @param name     State name, the prefix of the attachments.
 * @param state    What to open.
 */
async function capture(
	page: Page,
	testInfo: TestInfo,
	name: string,
	state: State
) {
	await page.clock.install( { time: stationInstant( ...state.at ) } );
	for ( const viewport of VIEWPORTS ) {
		await page.setViewportSize( viewport );
		await page.goto( readSeed().urls[ state.station ] );
		await expect(
			page.getByRole( 'heading', { level: 1 } )
		).toBeAttached();
		await expect(
			page.getByRole( 'region', { name: 'Player controls' } )
		).toBeVisible();
		if ( state.play ) {
			await startPlayback( page );
		}
		// Wait until the station info stops moving (K92); the playing dots of
		// WebKit are an endless CSS animation, not a transition.
		await expect
			.poll( () =>
				page.evaluate(
					() =>
						document
							.getAnimations()
							.filter( ( a ) => a instanceof CSSTransition )
							.length
				)
			)
			.toBe( 0 );
		await testInfo.attach(
			`${ name }-${ viewport.width }x${ viewport.height }`,
			{
				body: await page.screenshot(),
				contentType: 'image/png',
			}
		);
	}
}

test.describe( 'with the station clock', () => {
	// A browser timezone other than the station's, so the station clock shows.
	test.use( { timezoneId: 'UTC' } );

	test( 'idle, no program on air', async ( { page }, testInfo ) => {
		await capture( page, testInfo, 'idle', {
			station: 'layout',
			at: [ 'thursday', '12:00' ],
		} );
		await page.setViewportSize( VIEWPORTS[ 0 ] );
		await testInfo.attach( 'button-gaps-1440x900', {
			body: JSON.stringify( await buttonGaps( page ) ),
			contentType: 'application/json',
		} );
	} );

	test( 'playing with the visualizer', async ( { page }, testInfo ) => {
		// WebKit never visualizes (ADR 0033, K82): the playing dots instead.
		await capture( page, testInfo, 'playing', {
			station: 'layout',
			at: [ 'thursday', '12:00' ],
			play: true,
		} );
	} );

	test( 'a program on air, with the clock', async ( { page }, testInfo ) => {
		await capture( page, testInfo, 'clock', {
			station: 'layout',
			at: [ 'monday', '11:00' ],
		} );
	} );

	test( 'a program on air and the next one (tall)', async ( {
		page,
	}, testInfo ) => {
		await capture( page, testInfo, 'tall', {
			station: 'layout',
			at: [ 'monday', '09:55' ],
		} );
	} );

	test( 'hidden name', async ( { page }, testInfo ) => {
		await capture( page, testInfo, 'hidden-title', {
			station: 'hidden-title',
			at: [ 'thursday', '12:00' ],
		} );
	} );
} );

test.describe( 'without the station clock', () => {
	// The station's own timezone: no difference, no clock.
	test.use( { timezoneId: 'Asia/Kolkata' } );

	test( 'a program on air, without the clock', async ( {
		page,
	}, testInfo ) => {
		await capture( page, testInfo, 'no-clock', {
			station: 'layout',
			at: [ 'monday', '11:00' ],
		} );
	} );
} );

test.describe( 'each visualizer playing', () => {
	// Spec 0022 (A11): the four visualizers drawing, for the review by eye of
	// the polish. WebKit never visualizes (ADR 0033, K82).
	test.skip(
		( { browserName } ) => browserName === 'webkit',
		'WebKit never visualizes'
	);

	for ( const visualizer of [
		'oscilloscope',
		'bars',
		'particles',
		'waterfall',
	] as const ) {
		test( `playing with the ${ visualizer } visualizer`, async ( {
			page,
		}, testInfo ) => {
			for ( const viewport of [ VIEWPORTS[ 0 ], VIEWPORTS[ 2 ] ] ) {
				await page.setViewportSize( viewport );
				await page.goto(
					readSeed().urls[ `visualizer-${ visualizer }` ]
				);
				await startPlayback( page );
				await expect( page.locator( 'canvas' ) ).toBeVisible();
				// A couple of seconds of drawing: trails, peaks and the waterfall.
				await page.waitForTimeout( 2000 );
				await testInfo.attach(
					`${ visualizer }-${ viewport.width }x${ viewport.height }`,
					{
						body: await page.screenshot(),
						contentType: 'image/png',
					}
				);
			}
		} );
	}
} );
