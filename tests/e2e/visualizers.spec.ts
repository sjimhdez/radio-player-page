import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { readSeed, seededId, type SeedUrlKey } from './seed';
import { startPlayback } from './support/player';
import { wpCli } from './support/wp-cli';

/**
 * Scenario 8 (spec 0002 §4.4): smoke test of each visualizer on the endless
 * live MP3. No pixels are read, only that the page plays, draws on a canvas and
 * logs no errors: written while the drawing was a frozen zone (ADR 0018), lifted
 * by ADR 0071; the drawing itself is tested in player/src/core/visualizers/.
 */

const VISUALIZERS = [ 'oscilloscope', 'bars', 'particles', 'waterfall' ];

/**
 * Collects console errors and uncaught exceptions of the page.
 *
 * @param page Player page.
 */
function recordErrors( page: Page ) {
	const errors: string[] = [];
	page.on( 'console', ( message ) => {
		if ( message.type() === 'error' ) {
			errors.push( message.text() );
		}
	} );
	page.on( 'pageerror', ( error ) => errors.push( error.message ) );
	return errors;
}

/**
 * Opens a station, plays it and checks the visualizer it ends up with.
 *
 * @param page       Player page.
 * @param key        Seeded variant.
 * @param visualizer Visualizer the page must receive.
 */
async function expectVisualizer(
	page: Page,
	key: SeedUrlKey,
	visualizer: string
) {
	const errors = recordErrors( page );
	await page.goto( readSeed().urls[ key ] );

	expect(
		await page.evaluate(
			() =>
				(
					window as unknown as {
						RADPLAPAG_CONFIG: { visualizer: string };
					}
				 ).RADPLAPAG_CONFIG.visualizer
		)
	).toBe( visualizer );
	await startPlayback( page );
	await expect( page.locator( 'canvas' ) ).toBeVisible();
	expect( errors ).toEqual( [] );
}

for ( const visualizer of VISUALIZERS ) {
	test( `plays with the ${ visualizer } visualizer`, async ( { page } ) => {
		await expectVisualizer(
			page,
			`visualizer-${ visualizer }` as SeedUrlKey,
			visualizer
		);
	} );
}

test( 'an unknown visualizer falls back to the oscilloscope', async ( {
	page,
} ) => {
	const station = seededId( 'station-visualizer-bars' );

	try {
		wpCli(
			'post',
			'meta',
			'update',
			station,
			'radplapag_station_visualizer',
			'not-a-visualizer'
		);
		await expectVisualizer( page, 'visualizer-bars', 'oscilloscope' );
	} finally {
		wpCli(
			'post',
			'meta',
			'update',
			station,
			'radplapag_station_visualizer',
			'bars'
		);
	}
} );
