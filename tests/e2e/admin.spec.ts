import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { ADMIN_STATE } from './seed';
import { wpCli } from './support/wp-cli';

/**
 * Scenario 10 (spec 0002 §4.4), part (a): a program and a station created and
 * saved from the admin. Covers the save path integration cannot reach
 * (`filter_input()` is `null` in CLI) and C13.
 *
 * The titles do not start with `E2E ` so a leftover never shifts the counts of
 * smoke.spec.ts; every run removes them before and after.
 */

const PAGE_TITLE = 'Admin Test Page';
const PROGRAM_TITLE = 'Admin Test Show';
const PROGRAM_DESCRIPTION = 'Created from the admin.';
const STATION_TITLE = 'Admin Test Station';

/**
 * IDs of the posts of a type with an exact title.
 *
 * @param type  Post type.
 * @param title Exact title.
 */
function idsByTitle( type: string, title: string ) {
	return wpCli(
		'post',
		'list',
		`--post_type=${ type }`,
		'--post_status=any',
		`--title=${ title }`,
		'--field=ID'
	)
		.split( '\n' )
		.filter( Boolean );
}

/** Removes everything this file creates. */
function removeCreated() {
	const ids = [
		...idsByTitle( 'radplapag_station', STATION_TITLE ),
		...idsByTitle( 'radplapag_program', PROGRAM_TITLE ),
		...idsByTitle( 'page', PAGE_TITLE ),
	];
	if ( ids.length ) {
		wpCli( 'post', 'delete', ...ids, '--force' );
	}
}

/**
 * Reads a meta value of a post.
 *
 * @param id  Post ID.
 * @param key Meta key.
 */
function meta( id: string, key: string ) {
	return wpCli( 'post', 'meta', 'get', id, key );
}

/**
 * Post ID of the classic edit screen the page is on.
 *
 * @param page Admin page.
 */
function editedPostId( page: Page ) {
	return new URL( page.url() ).searchParams.get( 'post' ) ?? '';
}

/**
 * Types the title of a new post and waits for the autosave WordPress starts
 * when the title loses focus: until it answers, the submit buttons carry the
 * `disabled` class and a click on Publish is silently ignored.
 *
 * @param page  Classic edit screen of a new post.
 * @param title Post title.
 */
async function fillNewTitle( page: Page, title: string ) {
	await page.locator( '#title' ).fill( title );
	await page.locator( '#title' ).blur();
	await expect( page.locator( '#auto_draft' ) ).toHaveValue( '' );
}

test.describe( 'admin: create and save', () => {
	test.describe.configure( { mode: 'serial' } );
	test.use( { storageState: ADMIN_STATE } );

	let pageId = '';
	let programId = '';
	let stationId = '';

	test.beforeAll( () => {
		removeCreated();
		pageId = wpCli(
			'post',
			'create',
			'--post_type=page',
			'--post_status=publish',
			`--post_title=${ PAGE_TITLE }`,
			'--porcelain'
		);
	} );

	test.afterAll( () => {
		removeCreated();
	} );

	test( 'creates a program with a description', async ( { page } ) => {
		await page.goto( '/wp-admin/post-new.php?post_type=radplapag_program' );
		await fillNewTitle( page, PROGRAM_TITLE );
		await page
			.locator( '#radplapag_program_description' )
			.fill( PROGRAM_DESCRIPTION );

		await page.locator( '#publish' ).click();
		await page.waitForURL( /post\.php\?post=\d+&action=edit/ );
		programId = editedPostId( page );

		expect( meta( programId, 'radplapag_program_description' ) ).toBe(
			PROGRAM_DESCRIPTION
		);
	} );

	test( 'creates a station with an http stream, page, theme, visualizer and a slot, without any notice (C13)', async ( {
		page,
	} ) => {
		await page.goto( '/wp-admin/post-new.php?post_type=radplapag_station' );
		await fillNewTitle( page, STATION_TITLE );
		await page
			.locator( '#radplapag_station_stream_url' )
			.fill( 'http://localhost:8901/tone.mp3' );
		await page
			.locator( '#radplapag_station_player_page' )
			.selectOption( pageId );
		await page
			.locator( '#radplapag_station_theme_color' )
			.selectOption( 'green' );
		await page
			.locator( '#radplapag_station_visualizer' )
			.selectOption( 'waterfall' );

		const monday = page.locator(
			'.radplapag-schedule-day[data-day="monday"]'
		);
		await monday.getByRole( 'button', { name: 'Add Time Slot' } ).click();
		const row = monday.locator( '.radplapag-program-row' );
		await row.locator( '.radplapag-program-id' ).selectOption( programId );
		await row.locator( '.radplapag-program-start' ).fill( '10:00' );
		await row.locator( '.radplapag-program-end' ).fill( '11:00' );

		await page.locator( '#publish' ).click();
		await page.waitForURL( /post\.php\?post=\d+&action=edit/ );
		stationId = editedPostId( page );

		await expect( page.locator( '#message' ) ).toContainText(
			'Post published.'
		);
		// C13: the save never compares the stream scheme with the site's. The
		// only other visible notice allowed is core's "WordPress X is
		// available!" (core also prints hidden ones, such as the lost connection).
		await expect(
			page.locator( '.notice:not(#message):not(.update-nag):visible' )
		).toHaveCount( 0 );

		expect( meta( stationId, 'radplapag_station_stream_url' ) ).toBe(
			'http://localhost:8901/tone.mp3'
		);
		expect( meta( stationId, 'radplapag_station_player_page' ) ).toBe(
			pageId
		);
		expect( meta( stationId, 'radplapag_station_theme_color' ) ).toBe(
			'green'
		);
		expect( meta( stationId, 'radplapag_station_visualizer' ) ).toBe(
			'waterfall'
		);
		expect(
			JSON.parse( meta( stationId, 'radplapag_station_schedule' ) )
		).toEqual( {
			monday: [
				{
					program_id: Number( programId ),
					start: '10:00',
					end: '11:00',
					is_rerun: false,
				},
			],
		} );
	} );

	test( 'the player page reflects the saved station', async ( { page } ) => {
		await page.goto( wpCli( 'post', 'url', pageId ) );

		await expect( page ).toHaveTitle( STATION_TITLE );
		const globals = await page.evaluate( () => {
			const w = window as unknown as {
				RADPLAPAG_CONFIG: Record< string, unknown >;
				RADPLAPAG_PROGRAMS: Array< Record< string, unknown > >;
			};
			return {
				config: w.RADPLAPAG_CONFIG,
				programs: w.RADPLAPAG_PROGRAMS,
			};
		} );
		expect( globals.config ).toMatchObject( {
			streamUrl: 'http://localhost:8901/tone.mp3',
			siteTitle: STATION_TITLE,
			themeColor: 'green',
			visualizer: 'waterfall',
		} );
		expect( globals.programs ).toMatchObject( [
			{
				id: programId,
				name: PROGRAM_TITLE,
				description: PROGRAM_DESCRIPTION,
			},
		] );

		await page.getByRole( 'button', { name: 'Radio Shows' } ).click();
		await expect(
			page
				.getByRole( 'dialog' )
				.getByText( PROGRAM_TITLE, { exact: true } )
		).toBeVisible();
	} );

	test( 'the assigned page is disabled in another station', async ( {
		page,
	} ) => {
		await page.goto( '/wp-admin/post-new.php?post_type=radplapag_station' );

		const select = page.locator( '#radplapag_station_player_page' );
		await expect(
			select.locator( `option[value="${ pageId }"]` )
		).toBeDisabled();
		// The station that owns it can still choose it.
		await page.goto( `/wp-admin/post.php?post=${ stationId }&action=edit` );
		await expect(
			select.locator( `option[value="${ pageId }"]` )
		).toBeEnabled();
	} );
} );
