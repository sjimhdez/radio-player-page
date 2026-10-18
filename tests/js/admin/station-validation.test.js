/**
 * External dependencies
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import {
	DAYS,
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

	const currentlyVectors = VECTORS.validation
		.filter( ( vector ) => vector.admin && vector.admin.currently )
		.map( ( vector ) => [
			`${ vector.id } (${ vector.admin.issue })`,
			vector,
		] );

	it.each( currentlyVectors )(
		'currently differs from the correct result in %s',
		( _title, vector ) => {
			expect( vector.admin.correct ).toBeDefined();
			expect( {
				valid: vector.admin.valid,
				error: vector.admin.valid ? null : vector.admin.error,
			} ).not.toEqual( {
				valid: vector.admin.correct.valid,
				error: vector.admin.correct.valid
					? null
					: vector.admin.correct.error,
			} );
		}
	);
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

		screen.submit();

		expect(
			row.querySelectorAll( '.radplapag-program-error-message' )
		).toHaveLength( 1 );
		expect( rowErrorCode( row ) ).toBe( 'start_equals_end' );
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

	// docs/known-issues.md C3: the server keeps start == end as a 24 h slot.
	it( 'currently rejects a slot whose start equals its end (C3)', async () => {
		const screen = await mountSchedule( {
			tuesday: [ { program: 'F', start: '08:00', end: '08:00' } ],
		} );

		const { blocked } = screen.submit();

		expect( blocked ).toBe( true );
		expect( rowErrorCode( screen.rows( 'tuesday' )[ 0 ] ) ).toBe(
			'start_equals_end'
		);
	} );

	// docs/known-issues.md K44: String.prototype.replace() reads `$` patterns
	// in the replacement, so `$$` in a program name prints as `$`.
	it( 'currently collapses `$$` in the program name of an overlap message (K44)', async () => {
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
		).toBe( '[overlap] Money $ Talk (Monday, 06:00 - 10:00)' );
	} );

	// docs/known-issues.md K45: nothing ties the message to its fields or
	// announces it (WCAG 3.3.1, 4.1.3); axe does not see it.
	it( 'currently shows a slot error without any ARIA (K45)', async () => {
		const screen = await mountSchedule( {
			monday: [
				{ program: 'A', start: '06:00', end: '10:00' },
				{ program: 'B', start: '09:00', end: '11:00' },
			],
		} );

		screen.submit();

		const row = screen.rows( 'monday' )[ 1 ];
		const message = row.querySelector( '.radplapag-program-error-message' );
		expect( message.textContent ).not.toBe( '' );
		[ 'id', 'role', 'aria-live' ].forEach( ( attribute ) =>
			expect( message.hasAttribute( attribute ) ).toBe( false )
		);
		row.querySelectorAll( 'select, input' ).forEach( ( control ) => {
			expect( control.hasAttribute( 'aria-invalid' ) ).toBe( false );
			expect( control.hasAttribute( 'aria-describedby' ) ).toBe( false );
		} );
	} );
} );
