import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { ADMIN_STATE } from './seed';
import { wpCli } from './support/wp-cli';

/**
 * Scenario 10 (spec 0002 §4.4). Part (a): a program and a station created and
 * saved from the admin. Covers the save path integration cannot reach
 * (`filter_input()` is `null` in CLI) and C13. Part (b): client validation,
 * the notices after a save the server rejects, and K15.
 *
 * The titles do not start with `E2E ` so a leftover never shifts the counts of
 * smoke.spec.ts; every run removes them before and after.
 */

const PAGE_TITLE = 'Admin Test Page';
const PROGRAM_TITLE = 'Admin Test Show';
const PROGRAM_DESCRIPTION = 'Created from the admin.';
const STATION_TITLE = 'Admin Test Station';
const CREATED = {
	station: STATION_TITLE,
	program: PROGRAM_TITLE,
	page: PAGE_TITLE,
};

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

/**
 * Removes the station, program and page with these titles.
 *
 * @param titles         Exact titles.
 * @param titles.station Station title.
 * @param titles.program Program title.
 * @param titles.page    Page title.
 */
function removeCreated( titles: {
	station: string;
	program: string;
	page: string;
} ) {
	const ids = [
		...idsByTitle( 'radplapag_station', titles.station ),
		...idsByTitle( 'radplapag_program', titles.program ),
		...idsByTitle( 'page', titles.page ),
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
		removeCreated( CREATED );
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
		removeCreated( CREATED );
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

const VALIDATION = {
	station: 'Admin Validation Station',
	program: 'Admin Validation Show',
	page: 'Admin Validation Page',
};
const VALIDATION_STREAM = 'http://localhost:8901/tone.mp3';

/**
 * Adds a Monday slot from the schedule meta box. The new row is found by its
 * index (the number of rows before the click), because leaving a row sorts
 * the day by start time.
 *
 * @param page  Station edit screen.
 * @param index Index the new row gets.
 */
async function addMondaySlot( page: Page, index: number ) {
	const monday = page.locator( '.radplapag-schedule-day[data-day="monday"]' );
	await monday.getByRole( 'button', { name: 'Add Time Slot' } ).click();
	return monday.locator(
		`.radplapag-program-row[data-program-index="${ index }"]`
	);
}

/**
 * Records whether the next submit of the edit form reaches the server: the
 * listener runs after the plugin's, so `defaultPrevented` is its decision.
 *
 * @param page Station edit screen.
 */
async function watchSubmit( page: Page ) {
	await page.evaluate( () => {
		document
			.getElementById( 'post' )
			?.addEventListener( 'submit', ( e ) => {
				(
					window as unknown as { radplapagE2eSubmit: string }
				 ).radplapagE2eSubmit = e.defaultPrevented ? 'blocked' : 'sent';
			} );
	} );
}

/**
 * What the watched submit did.
 *
 * @param page Station edit screen.
 */
function submitOutcome( page: Page ) {
	return page.evaluate(
		() =>
			( window as unknown as { radplapagE2eSubmit?: string } )
				.radplapagE2eSubmit
	);
}

test.describe( 'admin: validation and notices', () => {
	test.describe.configure( { mode: 'serial' } );
	test.use( { storageState: ADMIN_STATE } );

	let pageId = '';
	let programId = '';
	let stationId = '';
	let savedSchedule: unknown;

	test.beforeAll( () => {
		removeCreated( VALIDATION );
		pageId = wpCli(
			'post',
			'create',
			'--post_type=page',
			'--post_status=publish',
			`--post_title=${ VALIDATION.page }`,
			'--porcelain'
		);
		programId = wpCli(
			'post',
			'create',
			'--post_type=radplapag_program',
			'--post_status=publish',
			`--post_title=${ VALIDATION.program }`,
			'--porcelain'
		);
		const slot = ( start: string, end: string, isRerun: boolean ) => ( {
			program_id: Number( programId ),
			start,
			end,
			is_rerun: isRerun,
		} );
		savedSchedule = {
			monday: [
				slot( '08:00', '09:00', false ),
				slot( '10:00', '11:00', false ),
				slot( '12:00', '13:00', true ),
			],
		};
		stationId = wpCli(
			'post',
			'create',
			'--post_type=radplapag_station',
			'--post_status=publish',
			`--post_title=${ VALIDATION.station }`,
			`--meta_input=${ JSON.stringify( {
				radplapag_station_stream_url: VALIDATION_STREAM,
				radplapag_station_player_page: Number( pageId ),
				radplapag_station_schedule: JSON.stringify( savedSchedule ),
			} ) }`,
			'--porcelain'
		);
	} );

	test.afterAll( () => {
		removeCreated( VALIDATION );
	} );

	test.beforeEach( async ( { page } ) => {
		await page.goto( `/wp-admin/post.php?post=${ stationId }&action=edit` );
	} );

	/** The schedule meta, parsed. */
	const schedule = () =>
		JSON.parse( meta( stationId, 'radplapag_station_schedule' ) );

	test.describe( 'client', () => {
		test( 'an overlapping slot shows its error and blocks the submit', async ( {
			page,
		} ) => {
			const row = await addMondaySlot( page, 3 );
			await row
				.locator( '.radplapag-program-id' )
				.selectOption( programId );
			await row.locator( '.radplapag-program-start' ).fill( '10:30' );
			await row.locator( '.radplapag-program-end' ).fill( '11:30' );
			await watchSubmit( page );

			await page.locator( '#publish' ).click();

			await expect(
				row.locator( '.radplapag-program-error-message.show' )
			).toHaveText(
				`This time slot overlaps with: ${ VALIDATION.program } (Monday, 10:00 - 11:00)`
			);
			expect( await submitOutcome( page ) ).toBe( 'blocked' );
		} );

		test( 'a time with seconds shows the format error when the focus leaves the slot (K19)', async ( {
			page,
		} ) => {
			const row = await addMondaySlot( page, 3 );
			await row
				.locator( '.radplapag-program-id' )
				.selectOption( programId );
			// A time input only holds valid times; seconds are the one way a
			// browser value misses `HH:MM`.
			await row.locator( '.radplapag-program-start' ).fill( '14:00:30' );
			await row.locator( '.radplapag-program-end' ).fill( '15:00' );

			// The row validates on focusout, after a 10 ms timeout, if the
			// focus is still outside it.
			await page.locator( '#title' ).focus();

			await expect(
				row.locator( '.radplapag-program-error-message.show' )
			).toHaveText(
				'Invalid time format. Times must be in HH:MM format.'
			);
		} );

		test( 'currently a time with seconds is blocked by the browser before the submit event (K19)', async ( {
			page,
		} ) => {
			const row = await addMondaySlot( page, 3 );
			await row
				.locator( '.radplapag-program-id' )
				.selectOption( programId );
			const start = row.locator( '.radplapag-program-start' );
			await start.fill( '14:00:30' );
			await row.locator( '.radplapag-program-end' ).fill( '15:00' );
			await watchSubmit( page );

			await page.locator( '#publish' ).click();

			// The default `step` (60 s) makes the value invalid, so the
			// browser's constraint validation stops the submit: the event
			// never fires. Whether the row's own message shows depends on a
			// race (the click blurs the row, the browser focuses the invalid
			// field back), so it is not checked here.
			expect(
				await start.evaluate(
					( el: HTMLInputElement ) => el.validity.stepMismatch
				)
			).toBe( true );
			await expect( page ).toHaveURL( /action=edit$/ );
			expect( await submitOutcome( page ) ).toBeUndefined();
		} );

		test( 'an incomplete slot shows its error and blocks the submit', async ( {
			page,
		} ) => {
			const row = await addMondaySlot( page, 3 );
			await row
				.locator( '.radplapag-program-id' )
				.selectOption( programId );
			await row.locator( '.radplapag-program-start' ).fill( '14:00' );
			await watchSubmit( page );

			await page.locator( '#publish' ).click();

			await expect(
				row.locator( '.radplapag-program-error-message.show' )
			).toHaveText( 'All fields are required.' );
			expect( await submitOutcome( page ) ).toBe( 'blocked' );
		} );
	} );

	test.describe( 'server, without the client validation', () => {
		// Without JavaScript the form posts as is: only the server validates.
		test.use( { javaScriptEnabled: false } );

		/**
		 * Saves the form and returns the visible error notices of the
		 * redirect.
		 *
		 * @param page Station edit screen.
		 */
		async function save( page: Page ) {
			await page.locator( '#publish' ).click();
			await page.waitForURL( /post\.php\?post=\d+&action=edit&message=/ );
			return page.locator( '.notice-error:visible' );
		}

		test( 'an empty stream URL shows its notice once and keeps the saved URL', async ( {
			page,
		} ) => {
			await page.locator( '#radplapag_station_stream_url' ).fill( '' );

			const notices = await save( page );

			await expect( notices ).toHaveText( [
				'Validation failed: Streaming URL is required.',
			] );
			expect( meta( stationId, 'radplapag_station_stream_url' ) ).toBe(
				VALIDATION_STREAM
			);
			// The notice reads and deletes its transient.
			await page.reload();
			await expect( page.locator( '.notice-error:visible' ) ).toHaveCount(
				0
			);
		} );

		test( 'an overlap shows the schedule notice and keeps the saved schedule', async ( {
			page,
		} ) => {
			const second = page.locator(
				'.radplapag-schedule-day[data-day="monday"] .radplapag-program-row[data-program-index="1"]'
			);
			await second.locator( '.radplapag-program-start' ).fill( '08:30' );

			const notices = await save( page );

			await expect( notices ).toHaveText( [
				`Radio Schedule validation failed: Radio show "${ VALIDATION.program }" on Monday: Time slot overlaps with "${ VALIDATION.program }".`,
			] );
			expect( schedule() ).toEqual( savedSchedule );
		} );

		test( 'an incomplete slot and an overlap join their messages in one notice', async ( {
			page,
		} ) => {
			// A time with seconds cannot reach the server: the browser's own
			// validation stops the submit even without JavaScript (K19).
			const rows = page.locator(
				'.radplapag-schedule-day[data-day="monday"] .radplapag-program-row'
			);
			await rows
				.nth( 0 )
				.locator( '.radplapag-program-id' )
				.selectOption( '' );
			await rows
				.nth( 2 )
				.locator( '.radplapag-program-start' )
				.fill( '10:30' );

			const notices = await save( page );

			await expect( notices ).toHaveText( [
				'Radio Schedule validation failed: Radio show on Monday: All fields (radio show, start time, end time) are required. ' +
					`Radio show "${ VALIDATION.program }" on Monday: Time slot overlaps with "${ VALIDATION.program }".`,
			] );
			expect( schedule() ).toEqual( savedSchedule );
		} );
	} );

	test( 'currently loses a slot and mixes another after removing a middle row and adding one (K15)', async ( {
		page,
	} ) => {
		const monday = page.locator(
			'.radplapag-schedule-day[data-day="monday"]'
		);
		const middle = monday.locator(
			'.radplapag-program-row[data-program-index="1"]'
		);
		// The link only takes the pointer while its row is hovered.
		await middle.hover();
		await middle.getByText( 'Remove Time Slot' ).click();
		// Two rows left (indexes 0 and 2): the new one gets index 2 again.
		const added = await addMondaySlot( page, 2 );
		await expect( added ).toHaveCount( 2 );
		const row = added.last();
		await row.locator( '.radplapag-program-id' ).selectOption( programId );
		await row.locator( '.radplapag-program-start' ).fill( '14:00' );
		await row.locator( '.radplapag-program-end' ).fill( '15:00' );

		await page.locator( '#publish' ).click();
		await page.waitForURL( /post\.php\?post=\d+&action=edit&message=/ );

		// 12:00–13:00 is gone without a notice, and 14:00–15:00 keeps the
		// rerun flag of the row whose names it reused.
		await expect( page.locator( '.notice-error:visible' ) ).toHaveCount(
			0
		);
		expect( schedule() ).toEqual( {
			monday: [
				{
					program_id: Number( programId ),
					start: '08:00',
					end: '09:00',
					is_rerun: false,
				},
				{
					program_id: Number( programId ),
					start: '14:00',
					end: '15:00',
					is_rerun: true,
				},
			],
		} );
	} );
} );
