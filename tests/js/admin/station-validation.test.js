/**
 * External dependencies
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * Internal dependencies
 */
import {
	DAYS,
	MARKER_STRINGS,
	adminData,
	mountStationScreen,
	rowErrorCode,
} from './support/mount-station-screen';

const VECTORS = JSON.parse(
	readFileSync(
		resolve( __dirname, '../../fixtures/schedule-vectors.json' ),
		'utf8'
	)
);

// One program per vector key; a key missing from "programs" is a program that
// does not exist (it gets an option in the select, but is not in the list).
const PROGRAM_IDS = Object.fromEntries(
	VECTORS.programs.map( ( key, i ) => [ key, String( 501 + i ) ] )
);
const MISSING_PROGRAM_ID = '999';

/**
 * Mounts the screen with the vector programs and fills the schedule.
 *
 * @param {Object|string} schedule Day → slots, or the name of a grid.
 * @return {Promise<Object>} The mounted screen.
 */
async function mountSchedule( schedule ) {
	const screen = await mountStationScreen(
		adminData( {
			programs: VECTORS.programs.map( ( key ) => ( {
				id: Number( PROGRAM_IDS[ key ] ),
				name: key,
			} ) ),
		} )
	);
	const days =
		typeof schedule === 'string' ? VECTORS.grids[ schedule ] : schedule;
	screen.clearSchedule();
	DAYS.forEach( ( day ) => {
		( days[ day ] || [] ).forEach( ( slot ) =>
			screen.addSlot( day, {
				programId: PROGRAM_IDS[ slot.program ] || MISSING_PROGRAM_ID,
				programLabel: slot.program,
				start: slot.start,
				end: slot.end,
			} )
		);
	} );
	return screen;
}

describe( 'station-admin.js: validation vectors', () => {
	const vectors = VECTORS.validation.map( ( vector ) => [
		vector.admin && vector.admin.currently
			? `currently ${ vector.id } (${ vector.admin.issue })`
			: vector.id,
		vector,
	] );

	it.each( vectors )( '%s', async ( _title, vector ) => {
		// Every vector needs a result for this layer (spec 0002, A5).
		expect( vector.admin ).toBeDefined();
		const screen = await mountSchedule( vector.schedule );

		const { blocked, firstError } = screen.submit();

		const error = vector.admin.valid ? null : vector.admin.error;
		expect( {
			blocked,
			// The row scrolled into view and the first row showing an error.
			firstError: firstError && rowErrorCode( firstError ),
			firstRowWithError:
				screen
					.rows()
					.map( rowErrorCode )
					.find( ( code ) => code !== null ) || null,
			rowMarked:
				!! firstError &&
				firstError.matches( '.radplapag-program-row.radplapag-error' ),
		} ).toEqual( {
			blocked: ! vector.admin.valid,
			firstError: error,
			firstRowWithError: error,
			rowMarked: ! vector.admin.valid,
		} );
	} );
} );

describe( 'station-admin.js: rows and submit', () => {
	it( 'marks the row, its fields and its message on error', async () => {
		const screen = await mountSchedule( {
			monday: [
				{ program: 'A', start: '06:00', end: '10:00' },
				{ program: 'B', start: '09:00', end: '11:00' },
			],
		} );

		screen.submit();

		const row = screen.rows( 'monday' )[ 1 ];
		expect( row.classList ).toContain( 'radplapag-error' );
		[
			'.radplapag-program-id',
			'.radplapag-program-start',
			'.radplapag-program-end',
		].forEach( ( selector ) =>
			expect( row.querySelector( selector ).classList ).toContain(
				'radplapag-error'
			)
		);
		const messages = row.querySelectorAll(
			'.radplapag-program-error-message'
		);
		expect( messages ).toHaveLength( 1 );
		expect( messages[ 0 ].textContent ).toBe(
			'[overlap] A (Monday, 06:00 - 10:00)'
		);
	} );

	it( 'reports both rows of a same-day overlap', async () => {
		const screen = await mountSchedule( {
			monday: [
				{ program: 'A', start: '06:00', end: '10:00' },
				{ program: 'B', start: '09:00', end: '11:00' },
			],
		} );

		const { firstError } = screen.submit();

		expect( screen.rows( 'monday' ).map( rowErrorCode ) ).toEqual( [
			'overlap',
			'overlap',
		] );
		expect( firstError ).toBe( screen.rows( 'monday' )[ 0 ] );
	} );

	it( 'marks the slot of the next day when one crosses midnight into it', async () => {
		const screen = await mountSchedule( {
			monday: [ { program: 'C', start: '22:00', end: '02:00' } ],
			tuesday: [ { program: 'D', start: '01:00', end: '03:00' } ],
		} );

		screen.submit();

		const [ tuesday ] = screen.rows( 'tuesday' );
		expect( rowErrorCode( tuesday ) ).toBe( 'cross_midnight_overlap' );
		expect(
			tuesday.querySelector( '.radplapag-program-error-message' )
				.textContent
		).toBe( '[overlap] C (Monday, 22:00 - 02:00)' );
	} );

	it( 'leaves a row without program, start or end unvalidated', async () => {
		const screen = await mountSchedule( {} );
		screen.addSlot( 'monday', { programId: '', start: '', end: '' } );

		const { blocked } = screen.submit();

		expect( blocked ).toBe( false );
		expect( rowErrorCode( screen.rows( 'monday' )[ 0 ] ) ).toBeNull();
	} );

	it( 'asks for a program when a row has times but none', async () => {
		const screen = await mountSchedule( {} );
		screen.addSlot( 'monday', {
			programId: '',
			start: '06:00',
			end: '10:00',
		} );

		expect( screen.submit().blocked ).toBe( true );
		expect( rowErrorCode( screen.rows( 'monday' )[ 0 ] ) ).toBe(
			'invalid_program'
		);
	} );

	it( 'does not validate a hidden row', async () => {
		const screen = await mountSchedule( {
			monday: [ { program: 'A', start: '06:00', end: '' } ],
		} );
		screen.rows( 'monday' )[ 0 ].style.display = 'none';

		expect( screen.submit().blocked ).toBe( false );
	} );

	it( 'does not validate the schedule while a station field is invalid', async () => {
		const screen = await mountSchedule( {
			monday: [ { program: 'A', start: '06:00', end: '' } ],
		} );
		screen.form.querySelector( '#radplapag_station_stream_url' ).value = '';

		const { blocked, firstError } = screen.submit();

		expect( blocked ).toBe( true );
		expect( firstError.getAttribute( 'data-field' ) ).toBe( 'stream_url' );
		expect( rowErrorCode( screen.rows( 'monday' )[ 0 ] ) ).toBeNull();
	} );

	it( 'replaces the previous message of a row on a new submit', async () => {
		const screen = await mountSchedule( {
			monday: [ { program: 'A', start: '06:00', end: '' } ],
		} );
		screen.submit();
		const [ row ] = screen.rows( 'monday' );
		row.querySelector( '.radplapag-program-end' ).value = '06:00';
		row.querySelector( '.radplapag-program-id' ).value = '';

		screen.submit();

		expect(
			row.querySelectorAll( '.radplapag-program-error-message' )
		).toHaveLength( 1 );
		expect( rowErrorCode( row ) ).toBe( 'invalid_program' );
	} );

	it( 'clears the error of a row once it is valid', async () => {
		const screen = await mountSchedule( {
			monday: [ { program: 'A', start: '06:00', end: '' } ],
		} );
		screen.submit();
		const [ row ] = screen.rows( 'monday' );
		row.querySelector( '.radplapag-program-end' ).value = '10:00';

		expect( screen.submit().blocked ).toBe( false );
		expect( row.classList ).not.toContain( 'radplapag-error' );
		expect( row.querySelectorAll( '.radplapag-error' ) ).toHaveLength( 0 );
		expect(
			row.querySelector( '.radplapag-program-error-message' )
		).toBeNull();
	} );

	it( 'uses its built-in English messages without radplapagAdmin', async () => {
		const screen = await mountStationScreen( null );
		screen.clearSchedule();
		const row = screen.addSlot( 'monday', {
			programId: '201',
			start: '06:00',
			end: '',
		} );

		expect( screen.submit().blocked ).toBe( true );
		// No programs are localized, so any program is "not valid".
		expect(
			row.querySelector( '.radplapag-program-error-message' ).textContent
		).toBe( 'Please select a valid program.' );
	} );

	// docs/known-issues.md C3: like the server, start == end is a 24 h slot.
	it( 'accepts a slot whose start equals its end as a 24 h slot', async () => {
		const screen = await mountSchedule( {
			tuesday: [ { program: 'F', start: '08:00', end: '08:00' } ],
		} );

		const { blocked } = screen.submit();

		expect( blocked ).toBe( false );
		expect( rowErrorCode( screen.rows( 'tuesday' )[ 0 ] ) ).toBeNull();
	} );

	it( 'keeps `$$` in the program name of an overlap message (K44)', async () => {
		const screen = await mountStationScreen(
			adminData( {
				programs: [
					{ id: 201, name: 'Money $$ Talk' },
					{ id: 202, name: 'Night Owl' },
				],
			} )
		);
		screen.clearSchedule();
		screen.addSlot( 'monday', {
			programId: '201',
			programLabel: 'Money $$ Talk',
			start: '06:00',
			end: '10:00',
		} );
		const second = screen.addSlot( 'monday', {
			programId: '202',
			programLabel: 'Night Owl',
			start: '09:00',
			end: '11:00',
		} );

		screen.submit();

		expect(
			second.querySelector( '.radplapag-program-error-message' )
				.textContent
		).toBe( '[overlap] Money $$ Talk (Monday, 06:00 - 10:00)' );
	} );

	// docs/known-issues.md K45: the message is tied to the slot's fields
	// (WCAG 3.3.1, 1.3.1); axe does not see it.
	it( 'ties a slot error to its fields (K45)', async () => {
		const screen = await mountSchedule( {
			monday: [
				{ program: 'A', start: '06:00', end: '10:00' },
				{ program: 'B', start: '09:00', end: '11:00' },
			],
		} );

		screen.submit();

		const row = screen.rows( 'monday' )[ 1 ];
		const index = row.getAttribute( 'data-program-index' );
		const id = `radplapag-slot-monday-${ index }-error`;
		const message = row.querySelector( '.radplapag-program-error-message' );
		expect( message.textContent ).not.toBe( '' );
		expect( message.id ).toBe( id );
		const controls = row.querySelectorAll(
			'.radplapag-program-id, .radplapag-program-start, .radplapag-program-end'
		);
		expect( controls ).toHaveLength( 3 );
		controls.forEach( ( control ) => {
			expect( control.getAttribute( 'aria-invalid' ) ).toBe( 'true' );
			expect( control.getAttribute( 'aria-describedby' ) ).toBe( id );
		} );
	} );

	it( 'removes the ARIA when the error clears (K45)', async () => {
		const screen = await mountSchedule( {
			monday: [
				{ program: 'A', start: '06:00', end: '10:00' },
				{ program: 'B', start: '09:00', end: '11:00' },
			],
		} );
		screen.submit();
		const row = screen.rows( 'monday' )[ 1 ];
		row.querySelector( '.radplapag-program-start' ).value = '10:00';

		screen.submit();

		expect(
			row.querySelector( '.radplapag-program-error-message' )
		).toBeNull();
		row.querySelectorAll( 'select, input' ).forEach( ( control ) => {
			expect( control.hasAttribute( 'aria-invalid' ) ).toBe( false );
			expect( control.hasAttribute( 'aria-describedby' ) ).toBe( false );
		} );
	} );

	it( 'focuses the first field with an error on submit (K45)', async () => {
		const screen = await mountSchedule( {
			monday: [ { program: 'A', start: '06:00', end: '10:00' } ],
			tuesday: [
				{ program: 'A', start: '06:00', end: '10:00' },
				{ program: 'B', start: '09:00', end: '11:00' },
			],
		} );
		const focus = vi.spyOn( window.HTMLElement.prototype, 'focus' );

		const { firstError } = screen.submit();

		expect( screen.rows( 'tuesday' ) ).toContain( firstError );
		expect( document.activeElement ).toBe(
			firstError.querySelector( '.radplapag-program-id' )
		);
		expect( focus ).toHaveBeenCalledWith( { preventScroll: true } );
		focus.mockRestore();
	} );

	it( 'focuses the control of a station field with an error on submit (K45)', async () => {
		const screen = await mountSchedule( {} );
		const playerPage = screen.form.querySelector(
			'#radplapag_station_player_page'
		);
		playerPage.value = '';

		const { firstError } = screen.submit();

		expect( firstError ).toBe(
			screen.form.querySelector( '[data-field="player_page"]' )
		);
		expect( document.activeElement ).toBe( playerPage );
	} );
} );

/**
 * Mounts the screen with `strings` and the given slots, in order. A slot whose
 * `label` is set shows that text on its selected option.
 *
 * @param {Object} strings `radplapagAdmin.strings`.
 * @param {Object} days    Day → slots (`programId`, `start`, `end`, `label`).
 * @return {Promise<Object>} The mounted screen.
 */
async function mountSlots( strings, days ) {
	const screen = await mountStationScreen(
		adminData( {
			programs: [
				{ id: 201, name: 'Morning Show' },
				{ id: 202, name: 'Night Owl' },
				// A program with an empty title still gets its option from PHP.
				{ id: 203, name: '' },
			],
			strings,
		} )
	);
	screen.clearSchedule();
	DAYS.forEach( ( day ) => {
		( days[ day ] || [] ).forEach( ( { label, hidden, ...slot } ) => {
			const row = screen.addSlot( day, slot );
			if ( label !== undefined ) {
				row.querySelector(
					'.radplapag-program-id'
				).selectedOptions[ 0 ].textContent = label;
			}
			if ( hidden ) {
				row.style.display = 'none';
			}
		} );
	} );
	return screen;
}

/**
 * Message a row shows, or `null`.
 *
 * @param {HTMLElement} row Program row.
 * @return {string|null} Message text.
 */
function rowMessage( row ) {
	const message = row.querySelector( '.radplapag-program-error-message' );
	return message ? message.textContent : null;
}

describe( 'station-admin.js: built-in English messages', () => {
	it.each( [
		[
			'a time that is not HH:MM',
			// <input type="time"> keeps seconds; nothing else gets past it.
			{ programId: '201', start: '08:00:30', end: '10:00' },
			'Invalid time format. Times must be in HH:MM format.',
		],
		[
			'an end time that is not HH:MM',
			{ programId: '201', start: '08:00', end: '10:00:30' },
			'Invalid time format. Times must be in HH:MM format.',
		],
		[
			'a missing time',
			{ programId: '201', start: '08:00', end: '' },
			'All fields are required.',
		],
		[
			'times without a program',
			{ programId: '', start: '08:00', end: '10:00' },
			'Please select a program.',
		],
	] )( 'for %s', async ( _title, slot, message ) => {
		const screen = await mountSlots( {}, { monday: [ slot ] } );

		expect( screen.submit().blocked ).toBe( true );
		expect( rowMessage( screen.rows( 'monday' )[ 0 ] ) ).toBe( message );
	} );

	it( 'for an overlap on the same day, with the English day label', async () => {
		const screen = await mountSlots(
			{},
			{
				wednesday: [
					{ programId: '201', start: '06:00', end: '10:00' },
					{ programId: '202', start: '09:00', end: '11:00' },
				],
			}
		);

		screen.submit();

		expect( screen.rows( 'wednesday' ).map( rowMessage ) ).toEqual( [
			'This time slot overlaps with: Night Owl (Wednesday, 09:00 - 11:00)',
			'This time slot overlaps with: Morning Show (Wednesday, 06:00 - 10:00)',
		] );
	} );

	// On submit the later day's check writes last: the previous-day check for
	// Monday → Tuesday, the next-day check for Sunday → Monday.
	it.each( [
		[
			'monday',
			'tuesday',
			[
				'This time slot overlaps with: Morning Show (Tuesday, 01:00 - 03:00)',
				'This time slot overlaps with: Night Owl (Monday, 22:00 - 02:00)',
			],
		],
		[
			'sunday',
			'monday',
			[
				'This time slot overlaps with: Night Owl (Sunday, 22:00 - 02:00)',
				'This time slot overlaps with: Morning Show (Monday, 01:00 - 03:00)',
			],
		],
	] )(
		'for an overlap across days, %s into %s',
		async ( from, to, messages ) => {
			const screen = await mountSlots(
				{},
				{
					[ from ]: [
						{ programId: '202', start: '22:00', end: '02:00' },
					],
					[ to ]: [
						{ programId: '201', start: '01:00', end: '03:00' },
					],
				}
			);

			screen.submit();

			expect( screen.rows().map( rowMessage ) ).toEqual( messages );
		}
	);

	it( 'names a program without a name "Unnamed program" on the same day', async () => {
		const screen = await mountSlots(
			{},
			{
				monday: [
					{
						programId: '203',
						start: '06:00',
						end: '10:00',
						label: '',
					},
					{ programId: '202', start: '09:00', end: '11:00' },
				],
			}
		);

		screen.submit();

		expect( rowMessage( screen.rows( 'monday' )[ 1 ] ) ).toBe(
			'This time slot overlaps with: Unnamed program (Monday, 06:00 - 10:00)'
		);
	} );

	it( 'uses the translated day labels and unnamed program', async () => {
		const screen = await mountSlots(
			{
				timeSlotOverlapsWithMessage: '[overlap] %s',
				tuesday: 'Martes',
				unnamedProgram: 'Sin nombre',
			},
			{
				tuesday: [
					{
						programId: '203',
						start: '06:00',
						end: '10:00',
						label: '',
					},
					{ programId: '202', start: '09:00', end: '11:00' },
				],
			}
		);

		screen.submit();

		expect( screen.rows( 'tuesday' ).map( rowMessage ) ).toEqual( [
			'[overlap] Night Owl (Martes, 09:00 - 11:00)',
			'[overlap] Sin nombre (Martes, 06:00 - 10:00)',
		] );
	} );
} );

describe( 'station-admin.js: rows left out of the overlap checks', () => {
	it( 'ignores a hidden row of the same day', async () => {
		const screen = await mountSlots(
			{},
			{
				monday: [
					{ programId: '201', start: '06:00', end: '10:00' },
					{
						programId: '202',
						start: '09:00',
						end: '11:00',
						hidden: true,
					},
				],
			}
		);

		expect( screen.submit().blocked ).toBe( false );
	} );

	it( 'skips the row itself by its position among all rows, hidden ones included', async () => {
		const screen = await mountSlots(
			{},
			{
				monday: [
					{
						programId: '202',
						start: '12:00',
						end: '13:00',
						hidden: true,
					},
					{ programId: '201', start: '06:00', end: '10:00' },
				],
			}
		);

		expect( screen.submit().blocked ).toBe( false );
	} );

	it( 'ignores a hidden row of the next day', async () => {
		const screen = await mountSlots(
			{},
			{
				monday: [ { programId: '202', start: '22:00', end: '02:00' } ],
				tuesday: [
					{
						programId: '201',
						start: '01:00',
						end: '03:00',
						hidden: true,
					},
				],
			}
		);

		expect( screen.submit().blocked ).toBe( false );
	} );

	it( 'ignores a hidden row of the previous day', async () => {
		const screen = await mountSlots(
			{},
			{
				monday: [
					{
						programId: '202',
						start: '22:00',
						end: '02:00',
						hidden: true,
					},
				],
				tuesday: [ { programId: '201', start: '01:00', end: '03:00' } ],
			}
		);

		expect( screen.submit().blocked ).toBe( false );
	} );

	it( 'ignores a next-day row without a program', async () => {
		const screen = await mountSlots(
			{},
			{
				monday: [ { programId: '202', start: '22:00', end: '02:00' } ],
				tuesday: [ { programId: '', start: '01:00', end: '03:00' } ],
			}
		);

		screen.submit();

		expect( screen.rows().map( rowMessage ) ).toEqual( [
			null,
			'Please select a program.',
		] );
	} );

	it( 'ignores a previous-day row without a program', async () => {
		const screen = await mountSlots(
			{},
			{
				monday: [ { programId: '', start: '22:00', end: '02:00' } ],
				tuesday: [ { programId: '201', start: '01:00', end: '03:00' } ],
			}
		);

		screen.submit();

		expect( screen.rows().map( rowMessage ) ).toEqual( [
			'Please select a program.',
			null,
		] );
	} );
} );

describe( 'station-admin.js: overlaps across days', () => {
	it( 'marks the other row before its own, in both directions', async () => {
		const screen = await mountSlots( MARKER_STRINGS, {
			monday: [ { programId: '202', start: '22:00', end: '02:00' } ],
			tuesday: [ { programId: '201', start: '01:00', end: '03:00' } ],
		} );
		const observer = new window.MutationObserver( () => {} );
		observer.observe( screen.container, {
			childList: true,
			subtree: true,
		} );

		screen.submit();

		const writes = observer
			.takeRecords()
			.filter( ( record ) =>
				Array.from( record.addedNodes ).some(
					( node ) =>
						node.classList &&
						node.classList.contains(
							'radplapag-program-error-message'
						)
				)
			)
			.map( ( record ) =>
				record.target
					.closest( '.radplapag-schedule-day' )
					.getAttribute( 'data-day' )
			);
		observer.disconnect();
		// Monday's check writes Tuesday, then Monday; Tuesday's, Monday, then
		// Tuesday.
		expect( writes ).toEqual( [
			'tuesday',
			'monday',
			'monday',
			'tuesday',
		] );
	} );

	// docs/known-issues.md K74: the checks across days fall back to "Unnamed
	// program", like the same-day check.
	it.each( [
		[
			'monday',
			'tuesday',
			'the crossing slot',
			[
				'[overlap] Morning Show (Tuesday, 01:00 - 03:00)',
				'[overlap] Unnamed program (Monday, 22:00 - 02:00)',
			],
		],
		[
			'monday',
			'tuesday',
			'the next-day slot',
			[
				'[overlap] Unnamed program (Tuesday, 01:00 - 03:00)',
				'[overlap] Night Owl (Monday, 22:00 - 02:00)',
			],
		],
		[
			'sunday',
			'monday',
			'the crossing slot',
			[
				'[overlap] Unnamed program (Sunday, 22:00 - 02:00)',
				'[overlap] Morning Show (Monday, 01:00 - 03:00)',
			],
		],
		[
			'sunday',
			'monday',
			'the next-day slot',
			[
				'[overlap] Night Owl (Sunday, 22:00 - 02:00)',
				'[overlap] Unnamed program (Monday, 01:00 - 03:00)',
			],
		],
	] )(
		'names an untitled program in an overlap from %s into %s, unnamed %s (K74)',
		async ( from, to, unnamed, messages ) => {
			const crossing = { programId: '202', start: '22:00', end: '02:00' };
			const next = { programId: '201', start: '01:00', end: '03:00' };
			const nameless = { programId: '203', label: '' };
			const screen = await mountSlots( MARKER_STRINGS, {
				[ from ]: [
					unnamed === 'the crossing slot'
						? { ...crossing, ...nameless }
						: crossing,
				],
				[ to ]: [
					unnamed === 'the next-day slot'
						? { ...next, ...nameless }
						: next,
				],
			} );

			screen.submit();

			expect( screen.rows().map( rowMessage ) ).toEqual( messages );
		}
	);

	// docs/known-issues.md K75: the same-day check skips a row without a
	// program, which only shows its own error.
	it( 'ignores a row without a program in a same-day overlap (K75)', async () => {
		const screen = await mountSlots( MARKER_STRINGS, {
			monday: [
				{ programId: '', start: '06:00', end: '10:00' },
				{ programId: '202', start: '09:00', end: '11:00' },
			],
		} );

		screen.submit();

		expect( screen.rows( 'monday' ).map( rowMessage ) ).toEqual( [
			'[invalid_program]',
			null,
		] );
	} );
} );

// docs/known-issues.md C10 and K41 (spec 0009, ADR 0045): a slot may keep a
// program that is not public; the screen says so and the station still saves.
describe( 'station-admin.js: programs that are not public', () => {
	const NOTICE =
		'This program is not published; this time slot is not shown on the site.';

	/**
	 * Notice text a row shows, or `null`.
	 *
	 * @param {HTMLElement} row Program row.
	 * @return {string|null} Notice text.
	 */
	function rowNotice( row ) {
		const notices = row.querySelectorAll( '.radplapag-program-notice' );
		expect( notices.length ).toBeLessThanOrEqual( 1 );
		return notices.length ? notices[ 0 ].textContent : null;
	}

	/**
	 * Selects a program in a row as the user does.
	 *
	 * @param {HTMLElement} row       Program row.
	 * @param {string}      programId Option value.
	 */
	function choose( row, programId ) {
		const select = row.querySelector( '.radplapag-program-id' );
		select.value = programId;
		select.dispatchEvent( new window.Event( 'change', { bubbles: true } ) );
	}

	it( 'lists each program of a new row by its label', async () => {
		const screen = await mountStationScreen();

		screen
			.dayWrapper( 'sunday' )
			.querySelector( '.radplapag-add-program' )
			.click();

		const select = screen
			.rows( 'sunday' )
			.pop()
			.querySelector( '.radplapag-program-id' );
		expect(
			Array.from( select.options ).map( ( o ) => [ o.value, o.text ] )
		).toEqual( [
			[ '', 'Select Radio Show' ],
			[ '203', 'Draft Show (Draft)' ],
			[ '201', 'Morning Show' ],
			[ '202', 'Night Owl' ],
		] );
	} );

	it( 'shows the notice when a program that is not public is chosen, and removes it for a public one', async () => {
		const screen = await mountStationScreen(
			adminData( {
				strings: {
					...MARKER_STRINGS,
					programNotPublished: '[not_public]',
				},
			} )
		);
		const row = screen.rows( 'monday' )[ 0 ];
		expect( rowNotice( row ) ).toBeNull();

		choose( row, '203' );
		expect( rowNotice( row ) ).toBe( '[not_public]' );

		choose( row, '203' );
		expect( rowNotice( row ) ).toBe( '[not_public]' );

		choose( row, '202' );
		expect( rowNotice( row ) ).toBeNull();
	} );

	it( 'shows the notice in a new row, as text', async () => {
		const screen = await mountStationScreen(
			adminData( {
				strings: {
					...MARKER_STRINGS,
					programNotPublished: '<b>Not</b> &amp; public',
				},
			} )
		);
		const row = screen.addSlot( 'sunday', {
			programId: '',
			start: '',
			end: '',
		} );

		choose( row, '203' );

		// Entities decoded and tags dropped, as with the other translations.
		expect( rowNotice( row ) ).toBe( 'Not & public' );
		expect( row.querySelector( '.radplapag-program-notice b' ) ).toBeNull();
	} );

	it( 'uses its built-in English notice without a translation', async () => {
		const screen = await mountStationScreen();
		const row = screen.rows( 'monday' )[ 0 ];

		choose( row, '203' );

		expect( rowNotice( row ) ).toBe( NOTICE );
	} );

	it( 'removes the notice the meta box printed when a public program is chosen', async () => {
		const screen = await mountStationScreen();
		const row = screen.rows( 'monday' )[ 0 ];
		const printed = document.createElement( 'div' );
		printed.className = 'radplapag-program-notice';
		printed.textContent = NOTICE;
		row.appendChild( printed );

		choose( row, '201' );

		expect( rowNotice( row ) ).toBeNull();
	} );

	it( 'treats a program without `public` as public', async () => {
		const screen = await mountStationScreen(
			adminData( { programs: [ { id: 201, name: 'Morning Show' } ] } )
		);
		const row = screen.rows( 'monday' )[ 0 ];

		choose( row, '201' );

		expect( rowNotice( row ) ).toBeNull();
	} );

	it( 'saves a slot whose program is not public', async () => {
		const screen = await mountStationScreen();
		screen.clearSchedule();
		const row = screen.addSlot( 'monday', {
			programId: '203',
			start: '06:00',
			end: '10:00',
		} );

		const { blocked } = screen.submit();

		expect( blocked ).toBe( false );
		expect( rowErrorCode( row ) ).toBeNull();
	} );
} );
