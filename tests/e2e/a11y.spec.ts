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

	await expectNoNewViolations( page, testInfo, 'blocks page', [
		'.wp-block-radplapag-now-playing',
		'.wp-block-radplapag-schedule',
		'.wp-block-radplapag-programs-list',
	] );
} );

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
