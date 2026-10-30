import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { ADMIN_STATE, seededId } from './seed';
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
		// No notice from the plugin. The only other visible notice allowed is
		// core's "WordPress X is available!" (core also prints hidden ones, such
		// as the lost connection).
		await expect(
			page.locator( '.notice:not(#message):not(.update-nag):visible' )
		).toHaveCount( 0 );
		// C13: the mixed content notice is only for an https site; this
		// environment is http, so it stays hidden (the https case is in
		// AdminScreensTest and station-fields.test.js).
		await expect(
			page.locator( '#radplapag_station_stream_url_notice' )
		).toBeHidden();
		await expect(
			page.locator( '#radplapag_station_stream_url' )
		).not.toHaveAttribute( 'aria-describedby' );

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

	test( 'the hide title checkbox sits right of Welcome Audio, below its heading, and keeps its state after saving (H2)', async ( {
		page,
	} ) => {
		const hideTitleRows = () =>
			wpCli(
				'post',
				'meta',
				'list',
				stationId,
				'--keys=radplapag_station_hide_title',
				'--format=count'
			);
		const save = async () => {
			await page.locator( '#publish' ).click();
			await page.waitForURL( /post\.php\?post=\d+&action=edit/ );
		};

		await page.goto( `/wp-admin/post.php?post=${ stationId }&action=edit` );
		const checkbox = page.getByRole( 'checkbox', {
			name: 'Hide station name in the player',
		} );
		await expect( checkbox ).not.toBeChecked();

		// Last row, to the right of Welcome Audio; its "Player Display" heading
		// is level with Welcome Audio, and the checkbox goes below it (ADR 0067,
		// ADR 0073).
		const welcome = await boxOf(
			page,
			'.radplapag-form-row:has(.radplapag-station-audio-wrapper) > .radplapag-field-wrap'
		);
		const welcomeHeading = await boxOf(
			page,
			'.radplapag-form-row:has(.radplapag-station-audio-wrapper) > .radplapag-field-wrap > label strong'
		);
		const heading = await boxOf(
			page,
			'#radplapag_station_display_title strong'
		);
		const hideTitle = await boxOf( page, '[data-field="hide_title"]' );
		expect( heading.x ).toBeGreaterThanOrEqual( welcome.x + welcome.width );
		expect( Math.abs( heading.y - welcomeHeading.y ) ).toBeLessThanOrEqual(
			1
		);
		expect( Math.abs( hideTitle.x - heading.x ) ).toBeLessThanOrEqual( 1 );
		expect( hideTitle.y ).toBeGreaterThanOrEqual(
			heading.y + heading.height - 1
		);

		// The heading names the group of both checkboxes (ADR 0073).
		const group = page.getByRole( 'group', { name: 'Player Display' } );
		await expect( group.getByRole( 'checkbox' ) ).toHaveCount( 2 );
		await expect(
			group.getByRole( 'checkbox', {
				name: 'Hide station name in the player',
			} )
		).toBeVisible();
		await expect(
			group.getByRole( 'checkbox', { name: 'Show current song' } )
		).toBeVisible();

		await checkbox.check();
		await save();
		await expect( checkbox ).toBeChecked();
		expect( meta( stationId, 'radplapag_station_hide_title' ) ).toBe( '1' );

		await checkbox.uncheck();
		await save();
		await expect( checkbox ).not.toBeChecked();
		expect( hideTitleRows() ).toBe( '0' );
	} );

	test( 'the show song checkbox sits below the hide title one and keeps its state after saving (ADR 0068)', async ( {
		page,
		browserName,
	} ) => {
		const showSongRows = () =>
			wpCli(
				'post',
				'meta',
				'list',
				stationId,
				'--keys=radplapag_station_show_song',
				'--format=count'
			);
		const save = async () => {
			await page.locator( '#publish' ).click();
			await page.waitForURL( /post\.php\?post=\d+&action=edit/ );
		};

		await page.goto( `/wp-admin/post.php?post=${ stationId }&action=edit` );
		const checkbox = page.getByRole( 'checkbox', {
			name: 'Show current song',
		} );
		await expect( checkbox ).not.toBeChecked();
		await expect( checkbox ).toHaveAccessibleDescription(
			/if your streaming server provides it/
		);

		// Below the hide title checkbox, in its column (ADR 0068).
		const hideTitle = await boxOf( page, '[data-field="hide_title"]' );
		const showSong = await boxOf( page, '[data-field="show_song"]' );
		expect( Math.abs( showSong.x - hideTitle.x ) ).toBeLessThanOrEqual( 1 );
		expect( showSong.y ).toBeGreaterThanOrEqual(
			hideTitle.y + hideTitle.height - 1
		);

		// WebKit only tabs to checkboxes with Alt (Safari default).
		const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
		await page.locator( '#radplapag_station_hide_title' ).focus();
		await page.keyboard.press( tab );
		await expect( checkbox ).toBeFocused();

		await checkbox.check();
		await save();
		await expect( checkbox ).toBeChecked();
		expect( meta( stationId, 'radplapag_station_show_song' ) ).toBe( '1' );

		await checkbox.uncheck();
		await save();
		await expect( checkbox ).not.toBeChecked();
		expect( showSongRows() ).toBe( '0' );
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
 * index (the highest index of the day + 1), because leaving a row sorts
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

		test.describe( 'with the schedule box collapsed', () => {
			test.afterEach( () => {
				// WordPress saves the collapsed state per user over AJAX.
				try {
					wpCli(
						'user',
						'meta',
						'delete',
						'admin',
						'closedpostboxes_radplapag_station'
					);
				} catch {
					// Not saved yet: nothing to clean up.
				}
			} );

			test( 'opens the schedule box to show the error that blocks the submit (K89)', async ( {
				page,
			} ) => {
				const row = await addMondaySlot( page, 3 );
				await row
					.locator( '.radplapag-program-id' )
					.selectOption( programId );
				await row.locator( '.radplapag-program-start' ).fill( '10:30' );
				await row.locator( '.radplapag-program-end' ).fill( '11:30' );
				const box = page.locator( '#radplapag_station_schedule' );
				await box.locator( '.handlediv' ).click();
				await expect( box ).toHaveClass( /\bclosed\b/ );
				await watchSubmit( page );

				await page.locator( '#publish' ).click();

				const message = row.locator(
					'.radplapag-program-error-message.show'
				);
				await expect( message ).toHaveText(
					`This time slot overlaps with: ${ VALIDATION.program } (Monday, 10:00 - 11:00)`
				);
				expect( await submitOutcome( page ) ).toBe( 'blocked' );
				await expect( box ).not.toHaveClass( /\bclosed\b/ );
				await expect( box.locator( '.handlediv' ) ).toHaveAttribute(
					'aria-expanded',
					'true'
				);
				await expect( message ).toBeVisible();
				// The saved 10:00 slot overlaps too and comes first.
				const focused = box.locator( '.radplapag-program-id:focus' );
				await expect( focused ).toHaveCount( 1 );
				await expect( focused ).toHaveAttribute(
					'aria-invalid',
					'true'
				);
			} );
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
			// With an error the redirect has no `&message=` (D9): wait for the
			// edit screen that the POST redirects to, and its load.
			const redirected = page.waitForResponse(
				( response ) =>
					response.request().method() === 'GET' &&
					/post\.php\?post=\d+&action=edit/.test( response.url() ) &&
					response.request().redirectedFrom()?.method() === 'POST'
			);
			await page.locator( '#publish' ).click();
			await redirected;
			await page.waitForLoadState( 'load' );
			return page.locator( '.notice-error:visible' );
		}

		test( 'shows the server notice without core\'s "Post published."', async ( {
			page,
		} ) => {
			await page.locator( '#radplapag_station_stream_url' ).fill( '' );

			const notices = await save( page );

			await expect( notices ).toHaveText( [
				'Some fields were not saved: Streaming URL is required.',
			] );
			expect( page.url() ).not.toContain( 'message=' );
			await expect( page.locator( '#message' ) ).toHaveCount( 0 );
		} );

		test( 'an empty stream URL shows its notice once and keeps the saved URL', async ( {
			page,
		} ) => {
			await page.locator( '#radplapag_station_stream_url' ).fill( '' );

			const notices = await save( page );

			await expect( notices ).toHaveText( [
				'Some fields were not saved: Streaming URL is required.',
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
				`The Weekly Schedule was not saved: Radio show "${ VALIDATION.program }" on Monday: Time slot overlaps with "${ VALIDATION.program }".`,
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
				'The Weekly Schedule was not saved: Radio show on Monday: All fields (radio show, start time, end time) are required. ' +
					`Radio show "${ VALIDATION.program }" on Monday: Time slot overlaps with "${ VALIDATION.program }".`,
			] );
			expect( schedule() ).toEqual( savedSchedule );
		} );
	} );

	// `new URL()` and the browser's `type="url"` take `host:port/path` as a URL
	// with the scheme `radio.example.com`; esc_url_raw() returns '' for it.
	test( 'blocks a stream URL without a scheme with its message (K42)', async ( {
		page,
	} ) => {
		// The browser's `type="url"` reads `radio.example.com` as the scheme.
		await page
			.locator( '#radplapag_station_stream_url' )
			.fill( 'radio.example.com:8000/stream' );
		await watchSubmit( page );

		await page.locator( '#publish' ).click();

		await expect(
			page.locator(
				'[data-field="stream_url"] .radplapag-field-error-message'
			)
		).toHaveText(
			'Please enter a URL that starts with http:// or https://.'
		);
		expect( await submitOutcome( page ) ).toBe( 'blocked' );
		expect( meta( stationId, 'radplapag_station_stream_url' ) ).toBe(
			VALIDATION_STREAM
		);
	} );

	test( 'keeps every slot after removing a middle row and adding one (K15)', async ( {
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
		await middle.getByRole( 'link', { name: 'Remove Time Slot' } ).click();
		// Two rows left (indexes 0 and 2): the new one gets index 3.
		const row = await addMondaySlot( page, 3 );
		await expect( row ).toHaveCount( 1 );
		await row.locator( '.radplapag-program-id' ).selectOption( programId );
		await row.locator( '.radplapag-program-start' ).fill( '14:00' );
		await row.locator( '.radplapag-program-end' ).fill( '15:00' );

		await page.locator( '#publish' ).click();
		await page.waitForURL( /post\.php\?post=\d+&action=edit&message=/ );

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
					start: '12:00',
					end: '13:00',
					is_rerun: true,
				},
				{
					program_id: Number( programId ),
					start: '14:00',
					end: '15:00',
					is_rerun: false,
				},
			],
		} );
	} );
} );

test.describe( 'admin: menu', () => {
	test.use( { storageState: ADMIN_STATE } );

	// The menu links to the stations list; only a bookmark or a typed URL
	// reaches the page callback, which runs after the admin header is sent.
	test( 'currently does not redirect admin.php?page=radplapag to the stations list (K40)', async ( {
		page,
	} ) => {
		const response = await page.goto(
			'/wp-admin/admin.php?page=radplapag'
		);

		expect( response?.status() ).toBe( 200 );
		await expect( page ).toHaveURL( /admin\.php\?page=radplapag$/ );
		await expect( page.locator( '#adminmenu' ) ).toBeVisible();
		await expect( page.locator( '.wp-list-table' ) ).toHaveCount( 0 );
	} );
} );

/**
 * Opens the edit screen of the seeded MP3 station.
 *
 * @param page Admin page.
 */
async function openSeededStation( page: Page ) {
	await page.goto(
		`/wp-admin/post.php?post=${ seededId( 'station-mp3' ) }&action=edit`
	);
	await expect( page.locator( '#radplapag_station_details' ) ).toBeVisible();
}

/**
 * Bounding box of an element that must be rendered.
 *
 * @param page     Admin page.
 * @param selector CSS selector.
 */
async function boxOf( page: Page, selector: string ) {
	const found = await page.locator( selector ).first().boundingBox();
	expect( found, selector ).not.toBeNull();
	return found!;
}

// Spec 0019 (ADR 0067): the details box of the station, measured with 1 px
// of tolerance.
test.describe( 'admin: station meta box layout', () => {
	test.use( { storageState: ADMIN_STATE } );

	test( 'leaves room between the stream field and Test Stream (K110)', async ( {
		page,
	} ) => {
		await openSeededStation( page );

		const field = await boxOf( page, '#radplapag_station_stream_url' );
		const button = await boxOf( page, '.radplapag-stream-test' );
		expect( button.y ).toBeGreaterThanOrEqual(
			field.y + field.height + 6 - 1
		);
	} );

	test( 'gives each field half of its row, or the whole row when two do not fit (K109)', async ( {
		page,
	} ) => {
		/**
		 * Widths of the children of each row and of the row itself.
		 */
		const measureRows = () =>
			page
				.locator( '#radplapag_station_details .radplapag-form-row' )
				.evaluateAll( ( rows ) =>
					rows.map( ( row ) => ( {
						row: row.getBoundingClientRect().width,
						children: Array.from( row.children ).map(
							( child ) => child.getBoundingClientRect().width
						),
					} ) )
				);

		await openSeededStation( page );
		const desktop = await measureRows();
		expect( desktop.length ).toBe( 4 );
		for ( const { row, children } of desktop ) {
			if ( children.length === 1 ) {
				expect( children[ 0 ] ).toBeCloseTo( row, 0 );
				continue;
			}
			expect( children ).toHaveLength( 2 );
			expect(
				Math.abs( children[ 0 ] - children[ 1 ] )
			).toBeLessThanOrEqual( 1 );
			expect(
				Math.abs( children[ 0 ] + children[ 1 ] + 24 - row )
			).toBeLessThanOrEqual( 1 );
		}

		await page.setViewportSize( { width: 390, height: 844 } );
		const mobile = await measureRows();
		for ( const { row, children } of mobile ) {
			for ( const width of children ) {
				expect( Math.abs( width - row ) ).toBeLessThanOrEqual( 1 );
			}
		}
		expect(
			await page.evaluate(
				() =>
					document.documentElement.scrollWidth <=
					document.documentElement.clientWidth
			)
		).toBe( true );
	} );

	test( 'describes Player Page with its help, right below the select (ADR 0073)', async ( {
		page,
	} ) => {
		await openSeededStation( page );

		const select = page.getByRole( 'combobox', { name: 'Player Page' } );
		await expect( select ).toHaveAccessibleDescription(
			'The player replaces this whole page, so an empty page works best. Each page can be used by only one radio station.'
		);
		const box = await boxOf( page, '#radplapag_station_player_page' );
		const help = await boxOf(
			page,
			'#radplapag_station_player_page_description'
		);
		expect( Math.abs( help.x - box.x ) ).toBeLessThanOrEqual( 1 );
		expect( help.y ).toBeGreaterThanOrEqual( box.y + box.height - 1 );
	} );

	test( 'puts Streaming URL first and Player Page to its right, in the DOM order too (K111)', async ( {
		page,
		browserName,
	} ) => {
		await openSeededStation( page );

		const stream = await boxOf( page, '[data-field="stream_url"]' );
		const playerPage = await boxOf( page, '[data-field="player_page"]' );
		expect( stream.x + stream.width ).toBeLessThanOrEqual( playerPage.x );
		expect( Math.abs( stream.y - playerPage.y ) ).toBeLessThanOrEqual( 1 );

		// The result and the help stay below the field, in its column.
		for ( const selector of [
			'#radplapag_stream_test_result',
			'.radplapag-stream-help',
		] ) {
			const below = await boxOf( page, selector );
			expect( Math.abs( below.x - stream.x ) ).toBeLessThanOrEqual( 1 );
			expect( below.y ).toBeGreaterThanOrEqual(
				stream.y + stream.height - 1
			);
			expect( below.x + below.width ).toBeLessThanOrEqual( playerPage.x );
		}

		// WebKit only tabs to buttons and summaries with Alt (Safari default).
		const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
		await page.locator( '#radplapag_station_stream_url' ).focus();
		await page.keyboard.press( tab );
		await expect( page.locator( '.radplapag-stream-test' ) ).toBeFocused();
		await page.keyboard.press( tab );
		await expect(
			page.locator( '.radplapag-stream-help summary' )
		).toBeFocused();
		await page.keyboard.press( tab );
		await expect(
			page.locator( '#radplapag_station_player_page' )
		).toBeFocused();
	} );

	test( 'puts the hide title checkbox to the right of Welcome Audio, at half the row (K112)', async ( {
		page,
	} ) => {
		await openSeededStation( page );

		const lastRow = page
			.locator( '#radplapag_station_details .radplapag-form-row' )
			.last();
		// First after the heading of the cell it shares with the show song
		// checkbox (ADR 0068, ADR 0073).
		await expect(
			lastRow.locator(
				':scope > [role="group"] > #radplapag_station_display_title:first-child + [data-field="hide_title"]'
			)
		).toHaveCount( 1 );
		const row = await lastRow.boundingBox();
		const welcome = await lastRow
			.locator( ':scope > .radplapag-field-wrap' )
			.first()
			.boundingBox();
		// The bold text of both headings, since the label boxes differ by
		// browser (WebKit).
		const welcomeHeading = await boxOf(
			page,
			'.radplapag-form-row:has(.radplapag-station-audio-wrapper) > .radplapag-field-wrap > label strong'
		);
		const heading = await boxOf(
			page,
			'#radplapag_station_display_title strong'
		);
		// The cell, not the paragraph, is the flex item of the row.
		const cell = await lastRow
			.locator( '[data-field="hide_title"]' )
			.locator( '..' )
			.boundingBox();
		expect( row ).not.toBeNull();
		expect( welcome ).not.toBeNull();
		expect( cell ).not.toBeNull();
		expect( welcome!.x + welcome!.width ).toBeLessThanOrEqual( heading.x );
		expect( Math.abs( heading.y - welcomeHeading.y ) ).toBeLessThanOrEqual(
			1
		);
		expect(
			Math.abs( cell!.width - ( row!.width - 24 ) / 2 )
		).toBeLessThanOrEqual( 1 );
	} );
} );
