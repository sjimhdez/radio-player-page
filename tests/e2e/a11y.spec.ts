import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures';
import { ADMIN_STATE, readSeed, seededId } from './seed';
import { stationInstant } from './support/clock';
import { startPlayback } from './support/player';

/**
 * Scenario 12 (spec 0002 §4.4): axe on the player page, the blocks page and
 * the plugin's meta boxes (their containers only, not core's admin). The
 * criterion is "no new violation", not "zero" (ADR 0023): a violation outside
 * tests/e2e/a11y-baseline.json fails, one that no longer appears is reported
 * as a warning. RADPLAPAG_UPDATE_A11Y_BASELINE=1 rewrites the page's entries.
 */

const BASELINE_FILE = join( __dirname, 'a11y-baseline.json' );
const UPDATE = process.env.RADPLAPAG_UPDATE_A11Y_BASELINE === '1';

/** One baseline entry: what axe says about the violation. */
interface BaselineEntry {
	impact: string | null;
	help: string;
	/** Browsers where axe reports it. */
	browsers: string[];
}

type Baseline = Record< string, BaselineEntry >;

function readBaseline(): Baseline {
	try {
		return JSON.parse( readFileSync( BASELINE_FILE, 'utf8' ) ) as Baseline;
	} catch {
		return {};
	}
}

/**
 * Writes the baseline with its keys sorted, so diffs stay small.
 *
 * @param baseline Baseline.
 */
function writeBaseline( baseline: Baseline ) {
	const sorted: Baseline = {};
	for ( const key of Object.keys( baseline ).sort() ) {
		sorted[ key ] = baseline[ key ];
	}
	writeFileSync( BASELINE_FILE, JSON.stringify( sorted, null, '\t' ) + '\n' );
}

/**
 * axe's selector without what changes from one build to the next: Emotion's
 * hashed classes (`.css-1wcuyrh`) and React's `useId()` ids (`#_r_b_`).
 * Nodes that only differed by them share one key.
 *
 * @param selector Selector axe reports.
 */
function stableSelector( selector: string ) {
	return selector
		.replace( /\.css-[0-9a-z]+/g, '.css-*' )
		.replace( /#_r_[0-9a-z]+_/g, '#_r_*_' );
}

/**
 * Runs axe and compares its violations with the baseline of `name`. The key
 * is `page · rule · selector`; the entry records the browsers that report it.
 *
 * @param page     Page under test.
 * @param testInfo Running test, for the browser and the warnings.
 * @param name     Stable page name (`player · stopped`).
 * @param include  Selectors of the containers to analyse (default: the page).
 */
async function expectNoNewViolations(
	page: Page,
	testInfo: TestInfo,
	name: string,
	include: string[] = []
) {
	let builder = new AxeBuilder( { page } );
	for ( const selector of include ) {
		builder = builder.include( selector );
	}
	const { violations } = await builder.analyze();

	const browser = testInfo.project.name;
	const found: Baseline = {};
	for ( const violation of violations ) {
		for ( const node of violation.nodes ) {
			const key = `${ name } · ${ violation.id } · ${ stableSelector(
				node.target.join( ' ' )
			) }`;
			found[ key ] = {
				impact: violation.impact ?? null,
				help: violation.help,
				browsers: [ browser ],
			};
		}
	}

	const baseline = readBaseline();
	const prefix = `${ name } · `;
	const known = Object.keys( baseline ).filter(
		( key ) =>
			key.startsWith( prefix ) &&
			baseline[ key ].browsers.includes( browser )
	);

	if ( UPDATE ) {
		for ( const key of known ) {
			const others = baseline[ key ].browsers.filter(
				( other ) => other !== browser
			);
			if ( others.length ) {
				baseline[ key ].browsers = others;
			} else {
				delete baseline[ key ];
			}
		}
		for ( const [ key, entry ] of Object.entries( found ) ) {
			baseline[ key ] = baseline[ key ]
				? {
						...entry,
						browsers: [
							...baseline[ key ].browsers,
							browser,
						].sort(),
					}
				: entry;
		}
		writeBaseline( baseline );
		return;
	}

	const gone = known.filter( ( key ) => ! ( key in found ) );
	for ( const key of gone ) {
		testInfo.annotations.push( {
			type: 'warning',
			description: `a11y baseline entry no longer found: ${ key }`,
		} );
		// eslint-disable-next-line no-console
		console.warn( `[${ browser }] a11y baseline entry gone: ${ key }` );
	}

	const fresh = Object.keys( found ).filter(
		( key ) => ! known.includes( key )
	);
	expect( fresh, 'violations outside tests/e2e/a11y-baseline.json' ).toEqual(
		[]
	);
}

/**
 * Opens the MP3 station on Monday 06:00, with Program A on air.
 *
 * @param page Player page.
 */
async function openPlayer( page: Page ) {
	await page.clock.install( { time: stationInstant( 'monday', '06:00' ) } );
	await page.goto( readSeed().urls.mp3 );
	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeVisible();
}

test.describe( 'a11y: player', () => {
	test( 'stopped', async ( { page }, testInfo ) => {
		await openPlayer( page );

		await expectNoNewViolations( page, testInfo, 'player · stopped' );
	} );

	test( 'playing', async ( { page }, testInfo ) => {
		await openPlayer( page );
		await startPlayback( page );

		await expectNoNewViolations( page, testInfo, 'player · playing' );
	} );

	test( 'schedule modal', async ( { page }, testInfo ) => {
		await openPlayer( page );
		await page.getByRole( 'button', { name: 'Radio Schedule' } ).click();
		await expect( page.getByRole( 'dialog' ) ).toBeVisible();

		await expectNoNewViolations(
			page,
			testInfo,
			'player · schedule modal'
		);
	} );

	test( 'all-programs modal', async ( { page }, testInfo ) => {
		await openPlayer( page );
		await page.getByRole( 'button', { name: 'Radio Shows' } ).click();
		await expect( page.getByRole( 'dialog' ) ).toBeVisible();

		await expectNoNewViolations(
			page,
			testInfo,
			'player · all-programs modal'
		);
	} );

	// axe does not judge whether an `alt` is meaningful or translated.
	test( 'currently uses literal, untranslated alt texts and a broken one on the program avatar (C15)', async ( {
		page,
	} ) => {
		await openPlayer( page );

		const alts = await page
			.locator( 'img' )
			.evaluateAll( ( images ) =>
				images.map( ( image ) => image.getAttribute( 'alt' ) )
			);
		expect( alts ).toEqual(
			expect.arrayContaining( [
				'Background',
				'Logo',
				'{currentProgram.programName}',
			] )
		);
	} );
} );

test( 'a11y: blocks page', async ( { page }, testInfo ) => {
	await page.goto( readSeed().urls.blocks );
	await expect(
		page.locator( '.wp-block-radplapag-schedule' )
	).toBeVisible();

	// The front end renders now-playing only while a program of the seeded
	// grid is on air by the real server clock (no time seam, spec 0002 §4.3),
	// and axe skips an include that matches nothing: say so instead.
	if (
		( await page.locator( '.wp-block-radplapag-now-playing' ).count() ) ===
		0
	) {
		testInfo.annotations.push( {
			type: 'warning',
			description:
				'now-playing not rendered (nothing on air): not scanned by axe',
		} );
	}

	await expectNoNewViolations( page, testInfo, 'blocks page', [
		'.wp-block-radplapag-now-playing',
		'.wp-block-radplapag-schedule',
		'.wp-block-radplapag-programs-list',
	] );
} );

// Gap of ADR 0023 (audit 4.5): a station with a 24-hour slot on each day, so
// now-playing and the `is-live` branches of the other two always render.
test( 'a11y: blocks page with a program always on air', async ( {
	page,
}, testInfo ) => {
	await page.goto( readSeed().urls[ 'blocks-always-on' ] );
	await expect(
		page.locator( '.wp-block-radplapag-now-playing article' )
	).toHaveCount( 1 );
	await expect(
		page.locator( '.wp-block-radplapag-schedule li.is-live' )
	).not.toHaveCount( 0 );
	await expect(
		page.locator( '.wp-block-radplapag-programs-list li.is-live' )
	).not.toHaveCount( 0 );

	await expectNoNewViolations(
		page,
		testInfo,
		'blocks page · always on air',
		[
			'.wp-block-radplapag-now-playing',
			'.wp-block-radplapag-schedule',
			'.wp-block-radplapag-programs-list',
		]
	);
} );

/**
 * Opens the edit screen of the MP3 station.
 *
 * @param page Admin page.
 */
async function openStation( page: Page ) {
	await page.goto(
		`/wp-admin/post.php?post=${ seededId( 'station-mp3' ) }&action=edit`
	);
	await expect( page.locator( '#radplapag_station_schedule' ) ).toBeVisible();
}

test.describe( 'a11y: meta boxes', () => {
	test.use( { storageState: ADMIN_STATE } );

	test( 'station', async ( { page }, testInfo ) => {
		await page.goto(
			`/wp-admin/post.php?post=${ seededId( 'station-mp3' ) }&action=edit`
		);
		await expect(
			page.locator( '#radplapag_station_schedule' )
		).toBeVisible();

		await expectNoNewViolations( page, testInfo, 'station meta boxes', [
			'#radplapag_station_details',
			'#radplapag_station_schedule',
		] );
	} );

	// axe does not check focus visibility (WCAG 2.4.7).
	test( 'currently keeps "Remove Time Slot" invisible when it has the keyboard focus (K20)', async ( {
		page,
	} ) => {
		await page.goto(
			`/wp-admin/post.php?post=${ seededId( 'station-mp3' ) }&action=edit`
		);
		const remove = page
			.locator( '#radplapag_station_schedule .radplapag-remove-program' )
			.first();

		await remove.focus();

		await expect( remove ).toBeFocused();
		await expect(
			page
				.locator(
					'#radplapag_station_schedule .radplapag-schedule-remove-cell'
				)
				.first()
		).toHaveCSS( 'opacity', '0' );
	} );

	// ADR 0023 gap: rows added by JS. The day has no slots, so the row is new.
	test( 'station with an added slot', async ( { page }, testInfo ) => {
		await openStation( page );
		const thursday = page.locator(
			'.radplapag-schedule-day[data-day="thursday"]'
		);
		await thursday.getByRole( 'button', { name: 'Add Time Slot' } ).click();
		await expect(
			thursday.locator( '.radplapag-program-row' )
		).toHaveCount( 1 );
		// The pointer stays on the new row after the click, and its :hover fades
		// "Remove Time Slot" in: axe could measure it mid-fade (WebKit). The
		// scenario is the row at rest; hover is out of axe's reach (AX5).
		await page.mouse.move( 0, 0 );
		await expect(
			thursday.locator( '.radplapag-schedule-remove-cell' )
		).toHaveCSS( 'opacity', '0' );

		await expectNoNewViolations(
			page,
			testInfo,
			'station meta boxes · added slot',
			[ '#radplapag_station_details', '#radplapag_station_schedule' ]
		);
	} );

	// ADR 0023 gap: validation errors on view. The slot error shows when the
	// focus leaves its row; the submit then reports the empty stream URL and
	// is blocked before the schedule is validated again.
	test( 'station with validation errors', async ( { page }, testInfo ) => {
		await openStation( page );
		const monday = page.locator(
			'.radplapag-schedule-day[data-day="monday"]'
		);
		await monday.getByRole( 'button', { name: 'Add Time Slot' } ).click();
		const row = monday.locator( '.radplapag-program-row' ).last();
		await row
			.locator( '.radplapag-program-id' )
			.selectOption( { index: 1 } );
		await row.locator( '.radplapag-program-start' ).fill( '07:00' );
		await row.locator( '.radplapag-program-end' ).fill( '08:00' );
		await page.locator( '#radplapag_station_stream_url' ).focus();
		// Leaving the row sorts the day: the new row moves to the top, and the
		// overlapped one reports the overlap as well.
		await expect(
			monday.locator( '.radplapag-program-error-message.show' ).first()
		).toBeVisible();
		await page.locator( '#radplapag_station_stream_url' ).fill( '' );
		await page.locator( '#publish' ).click();
		await expect(
			page.locator(
				'[data-field="stream_url"] .radplapag-field-error-message'
			)
		).toHaveText( 'This field is required.' );

		await expectNoNewViolations(
			page,
			testInfo,
			'station meta boxes · validation errors',
			[ '#radplapag_station_details', '#radplapag_station_schedule' ]
		);
	} );

	// axe does not analyse :hover (WCAG 1.4.3).
	test( 'uses the darker red for "Remove Time Slot" on hover over a row with an error (AX5)', async ( {
		page,
	} ) => {
		await openStation( page );
		const monday = page.locator(
			'.radplapag-schedule-day[data-day="monday"]'
		);
		await monday.getByRole( 'button', { name: 'Add Time Slot' } ).click();
		const row = monday.locator( '.radplapag-program-row' ).last();
		await row
			.locator( '.radplapag-program-id' )
			.selectOption( { index: 1 } );
		await row.locator( '.radplapag-program-start' ).fill( '07:00' );
		await row.locator( '.radplapag-program-end' ).fill( '08:00' );
		await page.locator( '#radplapag_station_stream_url' ).focus();
		const errorRow = monday
			.locator( '.radplapag-program-row.radplapag-error' )
			.first();
		await expect(
			errorRow.locator( '.radplapag-program-error-message.show' )
		).toBeVisible();
		const remove = errorRow.locator( '.radplapag-remove-program' );

		await remove.hover();

		await expect( remove ).toHaveCSS( 'color', 'rgb(179, 45, 46)' );
	} );

	// axe does not follow the keyboard focus (WCAG 2.4.3).
	test( 'keeps the keyboard focus when tabbing into the next slot of the day (K39)', async ( {
		page,
	} ) => {
		await openStation( page );
		const rows = page.locator(
			'.radplapag-schedule-day[data-day="monday"] .radplapag-program-row'
		);
		const next = rows.nth( 1 ).locator( '.radplapag-program-id' );
		await rows.nth( 0 ).locator( '.radplapag-remove-program' ).focus();

		await page.keyboard.press( 'Tab' );
		await expect( next ).toBeFocused();

		// Leaving the first row re-sorts the day 10 ms later with appendChild;
		// wait past that timer before checking the focus again.
		await page.evaluate(
			() => new Promise( ( resolve ) => setTimeout( resolve, 100 ) )
		);
		await expect( next ).toBeFocused();
	} );

	test( 'moves the focus to the next slot when a slot is removed (K39)', async ( {
		page,
	} ) => {
		await openStation( page );
		const rows = page.locator(
			'.radplapag-schedule-day[data-day="monday"] .radplapag-program-row'
		);
		const nextIndex = await rows
			.nth( 1 )
			.getAttribute( 'data-program-index' );
		await rows.nth( 0 ).locator( '.radplapag-remove-program' ).focus();

		await page.keyboard.press( 'Enter' );

		await expect( rows ).toHaveCount( 2 );
		await expect(
			page.locator(
				`.radplapag-schedule-day[data-day="monday"] .radplapag-program-row[data-program-index="${ nextIndex }"] .radplapag-program-id`
			)
		).toBeFocused();
	} );

	// axe does not follow the keyboard focus (WCAG 3.3.1, 2.4.3).
	test( 'moves the focus to the first slot with an error on submit (K45)', async ( {
		page,
	} ) => {
		await openStation( page );
		const monday = page.locator(
			'.radplapag-schedule-day[data-day="monday"]'
		);
		await monday.getByRole( 'button', { name: 'Add Time Slot' } ).click();
		const row = monday.locator( '.radplapag-program-row' ).last();
		await row
			.locator( '.radplapag-program-id' )
			.selectOption( { index: 1 } );
		await row.locator( '.radplapag-program-start' ).fill( '07:00' );
		await row.locator( '.radplapag-program-end' ).fill( '08:00' );

		await page.locator( '#publish' ).click();

		const focused = page.locator( '.radplapag-program-id:focus' );
		await expect( focused ).toHaveCount( 1 );
		await expect( focused ).toHaveAttribute( 'aria-invalid', 'true' );
		const errorId = await focused.getAttribute( 'aria-describedby' );
		await expect( page.locator( `[id="${ errorId }"]` ) ).toBeVisible();
	} );

	test( 'program', async ( { page }, testInfo ) => {
		await page.goto(
			`/wp-admin/post.php?post=${ seededId( 'program-A' ) }&action=edit`
		);
		await expect(
			page.locator( '#radplapag_program_details' )
		).toBeVisible();

		await expectNoNewViolations( page, testInfo, 'program meta box', [
			'#radplapag_program_details',
		] );
	} );
} );
