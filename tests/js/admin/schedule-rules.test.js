/**
 * External dependencies
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import rules from '../../../admin/js/schedule-rules.js';

const PROGRAM_IDS = [ '501', '502', '503' ];

const VECTORS = JSON.parse(
	readFileSync(
		resolve( __dirname, '../../fixtures/schedule-vectors.json' ),
		'utf8'
	)
);

/**
 * Builds a slot as the admin reads it from a row.
 *
 * @param {string} programId Selected program ID ('' for the placeholder).
 * @param {string} start     Start time.
 * @param {string} end       End time.
 * @param {Object} [extra]   Other fields (name, hidden).
 * @return {Object} The slot.
 */
function slot( programId, start, end, extra = {} ) {
	return {
		programId,
		name: programId ? 'Program ' + programId : 'Select Radio Show',
		start,
		end,
		hidden: false,
		...extra,
	};
}

/**
 * Checks the first slot of Monday.
 *
 * @param {Object} monday Slot to check.
 * @return {Array} The writes.
 */
function checkMonday( monday ) {
	return rules.checkSlot( { monday: [ monday ] }, 'monday', 0, PROGRAM_IDS );
}

/**
 * The single write for Monday's first slot.
 *
 * @param {Object|null} error Expected error.
 * @return {Array} The writes.
 */
function ownWrite( error ) {
	return [ { day: 'monday', index: 0, error } ];
}

describe( 'days', () => {
	it( 'lists the week from Monday to Sunday', () => {
		expect( rules.DAYS ).toEqual( [
			'monday',
			'tuesday',
			'wednesday',
			'thursday',
			'friday',
			'saturday',
			'sunday',
		] );
	} );

	it( 'gives the next day, wrapping Sunday to Monday', () => {
		expect( rules.nextDay( 'monday' ) ).toBe( 'tuesday' );
		expect( rules.nextDay( 'sunday' ) ).toBe( 'monday' );
	} );

	it( 'gives the previous day, wrapping Monday to Sunday', () => {
		expect( rules.prevDay( 'tuesday' ) ).toBe( 'monday' );
		expect( rules.prevDay( 'monday' ) ).toBe( 'sunday' );
	} );
} );

describe( 'times', () => {
	it.each( [ '00:00', '08:05', '19:30', '23:59' ] )(
		'accepts %s as HH:MM',
		( time ) => {
			expect( rules.isValidTime( time ) ).toBe( true );
		}
	);

	it.each( [ '', undefined, '24:00', '8:00', '08:60', '08:00:30', 'ab:cd' ] )(
		'rejects %s',
		( time ) => {
			expect( rules.isValidTime( time ) ).toBe( false );
		}
	);

	it( 'converts HH:MM to minutes', () => {
		expect( rules.timeToMinutes( '00:00' ) ).toBe( 0 );
		expect( rules.timeToMinutes( '08:30' ) ).toBe( 510 );
		expect( rules.timeToMinutes( '23:59' ) ).toBe( 1439 );
	} );

	it( 'converts an empty or short time to 0', () => {
		expect( rules.timeToMinutes( '' ) ).toBe( 0 );
		expect( rules.timeToMinutes( undefined ) ).toBe( 0 );
		expect( rules.timeToMinutes( '8:00' ) ).toBe( 0 );
	} );

	it( 'reads only hours and minutes of a longer time', () => {
		expect( rules.timeToMinutes( '08:00:30' ) ).toBe( 480 );
	} );
} );

describe( 'checkSlot: one row', () => {
	it( 'clears an empty row', () => {
		expect( checkMonday( slot( '', '', '' ) ) ).toEqual( ownWrite( null ) );
	} );

	it( 'clears a valid row', () => {
		expect( checkMonday( slot( '501', '08:00', '09:00' ) ) ).toEqual(
			ownWrite( null )
		);
	} );

	it( 'asks for a program when only times are set', () => {
		const error = { code: 'invalid_program', reason: 'missing' };
		expect( checkMonday( slot( '', '08:00', '' ) ) ).toEqual(
			ownWrite( error )
		);
		expect( checkMonday( slot( '', '', '09:00' ) ) ).toEqual(
			ownWrite( error )
		);
	} );

	it( 'rejects a program that is not in the list', () => {
		expect( checkMonday( slot( '999', '08:00', '09:00' ) ) ).toEqual(
			ownWrite( { code: 'invalid_program', reason: 'unknown' } )
		);
	} );

	it( 'compares program IDs as strings', () => {
		const writes = rules.checkSlot(
			{ monday: [ slot( '501', '08:00', '09:00' ) ] },
			'monday',
			0,
			[ 501 ]
		);
		expect( writes ).toEqual( ownWrite( null ) );
	} );

	it( 'checks the program before the time format', () => {
		expect( checkMonday( slot( '999', '08:00:30', '' ) ) ).toEqual(
			ownWrite( { code: 'invalid_program', reason: 'unknown' } )
		);
	} );

	it( 'rejects a start time that is not HH:MM', () => {
		expect( checkMonday( slot( '501', '08:00:30', '09:00' ) ) ).toEqual(
			ownWrite( { code: 'format' } )
		);
	} );

	it( 'rejects an end time that is not HH:MM', () => {
		expect( checkMonday( slot( '501', '08:00', '09:00:30' ) ) ).toEqual(
			ownWrite( { code: 'format' } )
		);
	} );

	it( 'checks the format before missing fields', () => {
		expect( checkMonday( slot( '501', '08:00:30', '' ) ) ).toEqual(
			ownWrite( { code: 'format' } )
		);
	} );

	// docs/known-issues.md C3: like the server, start == end is a 24 h slot.
	it( 'accepts a slot whose start equals its end as a 24 h slot', () => {
		expect( checkMonday( slot( '501', '08:00', '08:00' ) ) ).toEqual(
			ownWrite( null )
		);
	} );

	it( 'requires both times once a program is chosen', () => {
		const error = { code: 'required' };
		expect( checkMonday( slot( '501', '', '' ) ) ).toEqual(
			ownWrite( error )
		);
		expect( checkMonday( slot( '501', '08:00', '' ) ) ).toEqual(
			ownWrite( error )
		);
		expect( checkMonday( slot( '501', '', '09:00' ) ) ).toEqual(
			ownWrite( error )
		);
	} );
} );

describe( 'checkSlot: same day', () => {
	/**
	 * Checks Monday's first slot against the others of the day.
	 *
	 * @param {Array} others Other Monday slots.
	 * @return {Array} The writes.
	 */
	function checkAgainst( others ) {
		return rules.checkSlot(
			{ monday: [ slot( '501', '08:00', '10:00' ), ...others ] },
			'monday',
			0,
			PROGRAM_IDS
		);
	}

	it( 'reports the first slot of the day that overlaps', () => {
		expect(
			checkAgainst( [
				slot( '502', '10:00', '11:00' ),
				slot( '502', '09:00', '11:00' ),
				slot( '503', '07:00', '08:30' ),
			] )
		).toEqual(
			ownWrite( {
				code: 'overlap',
				other: {
					day: 'monday',
					name: 'Program 502',
					start: '09:00',
					end: '11:00',
				},
			} )
		);
	} );

	it( 'accepts slots that only touch', () => {
		expect(
			checkAgainst( [
				slot( '502', '06:00', '08:00' ),
				slot( '503', '10:00', '12:00' ),
			] )
		).toEqual( ownWrite( null ) );
	} );

	it( 'runs a slot that crosses midnight until the end of its day', () => {
		const writes = rules.checkSlot(
			{
				monday: [
					slot( '501', '22:00', '02:00' ),
					slot( '502', '23:00', '23:30' ),
				],
			},
			'monday',
			0,
			PROGRAM_IDS
		);
		expect( writes[ 0 ].error.code ).toBe( 'overlap' );
	} );

	it( 'runs the other slot that crosses midnight until the end of its day', () => {
		expect(
			checkAgainst( [ slot( '502', '07:00', '06:00' ) ] )[ 0 ].error.code
		).toBe( 'overlap' );
	} );

	it( 'skips hidden slots', () => {
		expect(
			checkAgainst( [
				slot( '502', '09:00', '11:00', { hidden: true } ),
			] )
		).toEqual( ownWrite( null ) );
	} );

	it( 'skips slots without both times', () => {
		expect(
			checkAgainst( [
				slot( '502', '09:00', '' ),
				slot( '502', '', '09:30' ),
			] )
		).toEqual( ownWrite( null ) );
	} );

	it( 'skips slots without a program, like the cross-day checks (K75)', () => {
		expect( checkAgainst( [ slot( '', '09:00', '11:00' ) ] ) ).toEqual(
			ownWrite( null )
		);
	} );

	it( 'passes an empty name on', () => {
		expect(
			checkAgainst( [
				slot( '502', '09:00', '11:00', { name: '' } ),
			] )[ 0 ].error.other.name
		).toBe( '' );
	} );

	it( 'excludes the slot by its position, hidden slots included', () => {
		const writes = rules.checkSlot(
			{
				monday: [
					slot( '502', '20:00', '21:00', { hidden: true } ),
					slot( '501', '08:00', '10:00' ),
				],
			},
			'monday',
			1,
			PROGRAM_IDS
		);
		expect( writes ).toEqual( [
			{ day: 'monday', index: 1, error: null },
		] );
	} );

	it( 'checks the same day before the next day', () => {
		const writes = rules.checkSlot(
			{
				monday: [
					slot( '501', '22:00', '02:00' ),
					slot( '502', '23:00', '23:30' ),
				],
				tuesday: [ slot( '503', '01:00', '03:00' ) ],
			},
			'monday',
			0,
			PROGRAM_IDS
		);
		expect( writes ).toHaveLength( 1 );
		expect( writes[ 0 ].error.code ).toBe( 'overlap' );
	} );
} );

describe( 'checkSlot: next day', () => {
	/**
	 * Checks a Monday slot against Tuesday.
	 *
	 * @param {Object} monday  Monday slot.
	 * @param {Array}  tuesday Tuesday slots.
	 * @return {Array} The writes.
	 */
	function checkMondayAgainst( monday, tuesday ) {
		return rules.checkSlot(
			{ monday: [ monday ], tuesday },
			'monday',
			0,
			PROGRAM_IDS
		);
	}

	it( 'marks the next-day slot first, then the slot itself', () => {
		expect(
			checkMondayAgainst( slot( '501', '22:00', '02:00' ), [
				slot( '502', '00:30', '00:45' ),
				slot( '503', '01:00', '03:00' ),
			] )
		).toEqual( [
			{
				day: 'tuesday',
				index: 0,
				error: {
					code: 'cross_midnight_overlap',
					other: {
						day: 'monday',
						name: 'Program 501',
						start: '22:00',
						end: '02:00',
					},
				},
			},
			{
				day: 'monday',
				index: 0,
				error: {
					code: 'cross_midnight_overlap',
					other: {
						day: 'tuesday',
						name: 'Program 502',
						start: '00:30',
						end: '00:45',
					},
				},
			},
		] );
	} );

	it( 'accepts a next-day slot that starts when it ends', () => {
		expect(
			checkMondayAgainst( slot( '501', '22:00', '02:00' ), [
				slot( '502', '02:00', '04:00' ),
			] )
		).toEqual( ownWrite( null ) );
	} );

	it( 'ignores the next day when the slot does not cross midnight', () => {
		expect(
			checkMondayAgainst( slot( '501', '08:00', '10:00' ), [
				slot( '502', '00:30', '09:00' ),
			] )
		).toEqual( ownWrite( null ) );
	} );

	it( 'skips hidden next-day slots', () => {
		expect(
			checkMondayAgainst( slot( '501', '22:00', '02:00' ), [
				slot( '502', '01:00', '03:00', { hidden: true } ),
			] )
		).toEqual( ownWrite( null ) );
	} );

	it( 'skips next-day slots without a program or both times', () => {
		expect(
			checkMondayAgainst( slot( '501', '22:00', '02:00' ), [
				slot( '', '01:00', '03:00' ),
				slot( '502', '01:00', '' ),
				slot( '502', '', '03:00' ),
			] )
		).toEqual( ownWrite( null ) );
	} );

	it( 'wraps from Sunday to Monday', () => {
		const writes = rules.checkSlot(
			{
				sunday: [ slot( '501', '23:55', '00:30' ) ],
				monday: [ slot( '502', '00:15', '01:00' ) ],
			},
			'sunday',
			0,
			PROGRAM_IDS
		);
		expect( writes.map( ( w ) => w.day ) ).toEqual( [
			'monday',
			'sunday',
		] );
	} );

	it( 'treats a missing day as empty', () => {
		expect( checkMonday( slot( '501', '22:00', '02:00' ) ) ).toEqual(
			ownWrite( null )
		);
	} );

	it( 'checks the next day before the previous day', () => {
		const writes = rules.checkSlot(
			{
				sunday: [ slot( '503', '22:00', '01:00' ) ],
				monday: [ slot( '501', '00:30', '00:15' ) ],
				tuesday: [ slot( '502', '00:00', '01:00' ) ],
			},
			'monday',
			0,
			PROGRAM_IDS
		);
		expect( writes.map( ( w ) => w.day ) ).toEqual( [
			'tuesday',
			'monday',
		] );
	} );
} );

describe( 'checkSlot: previous day', () => {
	/**
	 * Checks a Tuesday slot against Monday.
	 *
	 * @param {Object} tuesday Tuesday slot.
	 * @param {Array}  monday  Monday slots.
	 * @return {Array} The writes.
	 */
	function checkTuesdayAgainst( tuesday, monday ) {
		return rules.checkSlot(
			{ monday, tuesday: [ tuesday ] },
			'tuesday',
			0,
			PROGRAM_IDS
		);
	}

	it( 'marks the previous-day slot first, then the slot itself', () => {
		expect(
			checkTuesdayAgainst( slot( '503', '01:00', '03:00' ), [
				slot( '502', '08:00', '09:00' ),
				slot( '501', '22:00', '02:00' ),
			] )
		).toEqual( [
			{
				day: 'monday',
				index: 1,
				error: {
					code: 'cross_midnight_overlap',
					other: {
						day: 'tuesday',
						name: 'Program 503',
						start: '01:00',
						end: '03:00',
					},
				},
			},
			{
				day: 'tuesday',
				index: 0,
				error: {
					code: 'cross_midnight_overlap',
					other: {
						day: 'monday',
						name: 'Program 501',
						start: '22:00',
						end: '02:00',
					},
				},
			},
		] );
	} );

	it( 'accepts a slot that starts when the previous-day slot ends', () => {
		expect(
			checkTuesdayAgainst( slot( '503', '02:00', '04:00' ), [
				slot( '501', '22:00', '02:00' ),
			] )
		).toEqual( [ { day: 'tuesday', index: 0, error: null } ] );
	} );

	it( 'skips hidden previous-day slots', () => {
		expect(
			checkTuesdayAgainst( slot( '503', '01:00', '03:00' ), [
				slot( '501', '22:00', '02:00', { hidden: true } ),
			] )
		).toEqual( [ { day: 'tuesday', index: 0, error: null } ] );
	} );

	it( 'skips previous-day slots without a program or both times', () => {
		expect(
			checkTuesdayAgainst( slot( '503', '01:00', '03:00' ), [
				slot( '', '22:00', '02:00' ),
				slot( '501', '22:00', '' ),
				slot( '501', '', '02:00' ),
			] )
		).toEqual( [ { day: 'tuesday', index: 0, error: null } ] );
	} );

	it( 'wraps from Monday to Sunday', () => {
		const writes = rules.checkSlot(
			{
				sunday: [ slot( '501', '23:55', '00:30' ) ],
				monday: [ slot( '502', '00:15', '01:00' ) ],
			},
			'monday',
			0,
			PROGRAM_IDS
		);
		expect( writes.map( ( w ) => w.day ) ).toEqual( [
			'sunday',
			'monday',
		] );
	} );
} );

describe( 'checkSchedule: submit', () => {
	it( 'has no writes and no first error without slots', () => {
		expect( rules.checkSchedule( {}, PROGRAM_IDS ) ).toEqual( {
			writes: [],
			first: null,
		} );
	} );

	it( 'checks every visible slot from Monday to Sunday, in order', () => {
		const result = rules.checkSchedule(
			{
				sunday: [ slot( '503', '08:00', '09:00' ) ],
				monday: [
					slot( '501', '08:00', '09:00' ),
					slot( '502', '10:00', '11:00', { hidden: true } ),
					slot( '', '', '' ),
				],
				wednesday: [ slot( '502', '08:00', '09:00' ) ],
			},
			PROGRAM_IDS
		);
		expect( result ).toEqual( {
			writes: [
				{ day: 'monday', index: 0, error: null },
				{ day: 'monday', index: 2, error: null },
				{ day: 'wednesday', index: 0, error: null },
				{ day: 'sunday', index: 0, error: null },
			],
			first: null,
		} );
	} );

	it( 'keeps the writes of each check, the other row included', () => {
		const result = rules.checkSchedule(
			{
				monday: [ slot( '501', '22:00', '02:00' ) ],
				tuesday: [ slot( '502', '01:00', '03:00' ) ],
			},
			PROGRAM_IDS
		);
		expect(
			result.writes.map( ( w ) => [ w.day, w.error && w.error.code ] )
		).toEqual( [
			[ 'tuesday', 'cross_midnight_overlap' ],
			[ 'monday', 'cross_midnight_overlap' ],
			[ 'monday', 'cross_midnight_overlap' ],
			[ 'tuesday', 'cross_midnight_overlap' ],
		] );
	} );

	it( 'gives the first slot whose own check fails', () => {
		const result = rules.checkSchedule(
			{
				monday: [ slot( '501', '08:00', '09:00' ) ],
				tuesday: [
					slot( '502', '08:00', '' ),
					slot( '999', '10:00', '11:00' ),
				],
			},
			PROGRAM_IDS
		);
		expect( result.first ).toEqual( { day: 'tuesday', index: 0 } );
	} );

	it( 'does not take a slot marked by another check as the first', () => {
		// Monday's check marks Sunday first, but Monday fails first.
		const result = rules.checkSchedule(
			{
				sunday: [ slot( '501', '23:55', '00:30' ) ],
				monday: [ slot( '502', '00:15', '01:00' ) ],
			},
			PROGRAM_IDS
		);
		expect( result.writes[ 0 ] ).toMatchObject( {
			day: 'sunday',
			index: 0,
		} );
		expect( result.first ).toEqual( { day: 'monday', index: 0 } );
	} );
} );

/**
 * The value a slot time keeps in an <input type="time">: the browser empties
 * anything that is not a valid time, such as 24:00.
 *
 * @param {string} time Time from the vector.
 * @return {string} The value the admin reads.
 */
function timeInputValue( time ) {
	return rules.isValidTime( time ) ? time : '';
}

describe( 'checkSchedule: validation vectors (admin layer)', () => {
	// One program per vector key; a key missing from "programs" is a program
	// that does not exist.
	const vectorProgramIds = Object.fromEntries(
		VECTORS.programs.map( ( key, i ) => [ key, String( 501 + i ) ] )
	);

	/**
	 * Builds the schedule the admin reads from a vector.
	 *
	 * @param {Object|string} schedule Day → slots, or the name of a grid.
	 * @return {Object} Day → slots.
	 */
	function readVector( schedule ) {
		const days =
			typeof schedule === 'string' ? VECTORS.grids[ schedule ] : schedule;
		return Object.fromEntries(
			Object.entries( days ).map( ( [ day, slots ] ) => [
				day,
				slots.map( ( s ) =>
					slot(
						vectorProgramIds[ s.program ] || '999',
						timeInputValue( s.start ),
						timeInputValue( s.end ),
						{ name: s.program }
					)
				),
			] )
		);
	}

	/**
	 * Applies the writes in order and reads what the screen ends up showing.
	 *
	 * @param {Object} schedule Day → slots.
	 * @param {Object} result   Result of checkSchedule().
	 * @return {Object} Error code of the first failing slot and of the first
	 *                  slot showing an error.
	 */
	function finalState( schedule, result ) {
		const shown = {};
		result.writes.forEach( ( w ) => {
			shown[ w.day + ':' + w.index ] = w.error;
		} );
		const codeAt = ( day, index ) => {
			const error = shown[ day + ':' + index ];
			return error ? error.code : null;
		};
		let firstRowWithError = null;
		rules.DAYS.forEach( ( day ) => {
			( schedule[ day ] || [] ).forEach( ( _slot, index ) => {
				if ( firstRowWithError === null ) {
					firstRowWithError = codeAt( day, index );
				}
			} );
		} );
		return {
			valid: result.first === null,
			firstError: result.first
				? codeAt( result.first.day, result.first.index )
				: null,
			firstRowWithError,
		};
	}

	const vectors = VECTORS.validation.map( ( vector ) => [
		vector.admin && vector.admin.currently
			? `currently ${ vector.id } (${ vector.admin.issue })`
			: vector.id,
		vector,
	] );

	it.each( vectors )( '%s', ( _title, vector ) => {
		expect( vector.admin ).toBeDefined();
		const schedule = readVector( vector.schedule );

		const result = rules.checkSchedule(
			schedule,
			Object.values( vectorProgramIds )
		);

		const error = vector.admin.valid ? null : vector.admin.error;
		expect( finalState( schedule, result ) ).toEqual( {
			valid: vector.admin.valid,
			firstError: error,
			firstRowWithError: error,
		} );
	} );
} );

describe( 'message', () => {
	const STRINGS = {
		pleaseSelectProgram: 'Elige un programa.',
		invalidTimeFormat: 'Formato no válido.',
		allFieldsRequired: 'Faltan campos.',
		timeSlotOverlapsWithMessage: 'Se solapa con: %s',
		unnamedProgram: 'Sin título',
		monday: 'Lunes',
		tuesday: 'Martes',
		wednesday: 'Miércoles',
		thursday: 'Jueves',
		friday: 'Viernes',
		saturday: 'Sábado',
		sunday: 'Domingo',
	};

	/**
	 * An overlap error with another slot.
	 *
	 * @param {string} code Error code.
	 * @param {string} name Name of the other program.
	 * @param {string} day  Day of the other slot.
	 * @return {Object} The error.
	 */
	function overlapWith( code, name, day = 'monday' ) {
		return { code, other: { day, name, start: '09:00', end: '11:00' } };
	}

	it.each( [
		[
			{ code: 'invalid_program', reason: 'missing' },
			'Please select a program.',
		],
		[
			{ code: 'invalid_program', reason: 'unknown' },
			'Please select a valid program.',
		],
		[
			{ code: 'format' },
			'Invalid time format. Times must be in HH:MM format.',
		],
		[ { code: 'required' }, 'All fields are required.' ],
		[
			overlapWith( 'overlap', 'Night Owl' ),
			'This time slot overlaps with: Night Owl (Monday, 09:00 - 11:00)',
		],
		[
			overlapWith( 'cross_midnight_overlap', 'Night Owl', 'tuesday' ),
			'This time slot overlaps with: Night Owl (Tuesday, 09:00 - 11:00)',
		],
	] )( 'falls back to English for %o', ( error, text ) => {
		expect( rules.message( error, {} ) ).toBe( text );
	} );

	it.each( [
		[
			{ code: 'invalid_program', reason: 'missing' },
			'Elige un programa.',
		],
		[
			{ code: 'invalid_program', reason: 'unknown' },
			'Elige un programa.',
		],
		[ { code: 'format' }, 'Formato no válido.' ],
		[ { code: 'required' }, 'Faltan campos.' ],
		[
			overlapWith( 'overlap', 'Night Owl' ),
			'Se solapa con: Night Owl (Lunes, 09:00 - 11:00)',
		],
		[
			overlapWith( 'cross_midnight_overlap', 'Night Owl', 'sunday' ),
			'Se solapa con: Night Owl (Domingo, 09:00 - 11:00)',
		],
	] )( 'uses the translated strings for %o', ( error, text ) => {
		expect( rules.message( error, STRINGS ) ).toBe( text );
	} );

	it.each( [
		[ 'monday', 'Monday', 'Lunes' ],
		[ 'tuesday', 'Tuesday', 'Martes' ],
		[ 'wednesday', 'Wednesday', 'Miércoles' ],
		[ 'thursday', 'Thursday', 'Jueves' ],
		[ 'friday', 'Friday', 'Viernes' ],
		[ 'saturday', 'Saturday', 'Sábado' ],
		[ 'sunday', 'Sunday', 'Domingo' ],
	] )( 'labels %s as %s or its translation', ( day, english, translated ) => {
		const error = overlapWith( 'overlap', 'X', day );
		expect( rules.message( error, {} ) ).toContain( '(' + english + ',' );
		expect( rules.message( error, STRINGS ) ).toContain(
			'(' + translated + ','
		);
	} );

	it( 'names an untitled program in a same-day overlap', () => {
		const error = overlapWith( 'overlap', '' );
		expect( rules.message( error, {} ) ).toBe(
			'This time slot overlaps with: Unnamed program (Monday, 09:00 - 11:00)'
		);
		expect( rules.message( error, STRINGS ) ).toBe(
			'Se solapa con: Sin título (Lunes, 09:00 - 11:00)'
		);
	} );

	it( 'names an untitled program in an overlap between days (K74)', () => {
		const error = overlapWith( 'cross_midnight_overlap', '' );
		expect( rules.message( error, {} ) ).toBe(
			'This time slot overlaps with: Unnamed program (Monday, 09:00 - 11:00)'
		);
		expect( rules.message( error, STRINGS ) ).toBe(
			'Se solapa con: Sin título (Lunes, 09:00 - 11:00)'
		);
	} );

	it( 'keeps `$$` in the program name (K44)', () => {
		expect(
			rules.message( overlapWith( 'overlap', 'Money $$ Talk' ), {} )
		).toBe(
			'This time slot overlaps with: Money $$ Talk (Monday, 09:00 - 11:00)'
		);
		expect(
			rules.message(
				overlapWith( 'cross_midnight_overlap', 'Money $$ Talk' ),
				{}
			)
		).toBe(
			'This time slot overlaps with: Money $$ Talk (Monday, 09:00 - 11:00)'
		);
	} );

	it( 'replaces only the first %s', () => {
		expect(
			rules.message( overlapWith( 'overlap', 'X' ), {
				timeSlotOverlapsWithMessage: '%s / %s',
			} )
		).toBe( 'X (Monday, 09:00 - 11:00) / %s' );
	} );
} );

// The week-interval model (ADR 0044), with the `model` vectors that PHP and the
// player read too. Nothing in the admin uses it yet (phase 3 of spec 0009).
describe( 'model', () => {
	/**
	 * Interval of a vector slot.
	 *
	 * @param {Object} vectorSlot { day, start, end }.
	 * @return {Object} { start, duration }.
	 */
	function interval( vectorSlot ) {
		const result = rules.fromSlot(
			vectorSlot.day,
			vectorSlot.start,
			vectorSlot.end
		);
		expect( result ).not.toBeNull();
		return result;
	}

	/**
	 * Minute of the week of a vector instant.
	 *
	 * @param {Object} instant { day, time }.
	 * @return {number} The minute of the week.
	 */
	function minute( instant ) {
		const result = rules.minuteOfWeek( instant.day, instant.time );
		expect( result ).not.toBeNull();
		return result;
	}

	it.each( [
		[ 'monday', '00:00', 0 ],
		[ 'monday', '23:59', 1439 ],
		[ 'tuesday', '00:00', 1440 ],
		[ 'thursday', '15:30', 3 * 1440 + 930 ],
		[ 'sunday', '23:59', 10079 ],
		[ 'friday', '7:5', 4 * 1440 + 425 ],
	] )( 'gives %s %s as minute %i of the week', ( day, time, expected ) => {
		expect( rules.minuteOfWeek( day, time ) ).toBe( expected );
	} );

	it( 'has no minute and no interval for an unknown day key', () => {
		expect( rules.minuteOfWeek( 'Monday', '08:00' ) ).toBeNull();
		expect( rules.fromSlot( 'lunes', '08:00', '10:00' ) ).toBeNull();
	} );

	it.each( VECTORS.model.from_slot.map( ( v ) => [ v.id, v ] ) )(
		'from_slot %s',
		( _id, vector ) => {
			expect( interval( vector.slot ) ).toEqual( vector.expected );
		}
	);

	it.each( VECTORS.model.contains.map( ( v ) => [ v.id, v ] ) )(
		'contains %s',
		( _id, vector ) => {
			expect(
				rules.contains( interval( vector.slot ), minute( vector.at ) )
			).toBe( vector.expected );
		}
	);

	it.each( VECTORS.model.minutes_until_start.map( ( v ) => [ v.id, v ] ) )(
		'minutes_until_start %s',
		( _id, vector ) => {
			expect(
				rules.minutesUntilStart(
					interval( vector.slot ),
					minute( vector.at )
				)
			).toBe( vector.expected );
		}
	);

	it.each( VECTORS.model.overlaps.map( ( v ) => [ v.id, v ] ) )(
		'overlaps %s, in either order',
		( _id, vector ) => {
			const a = interval( vector.a );
			const b = interval( vector.b );
			expect( rules.overlaps( a, b ), 'a, b' ).toBe( vector.expected );
			expect( rules.overlaps( b, a ), 'b, a' ).toBe( vector.expected );
		}
	);

	// Loose times, never saved: still an interval within the week, as in PHP.
	it.each( [
		[ 'sunday', '24:00', '01:00', 0, 60 ],
		[ 'monday', '-1:30', '01:00', 10050, 90 ],
		[ 'monday', '22:00', '25:00', 1320, 180 ],
	] )(
		'gives %s %s-%s as { start: %i, duration: %i }',
		( day, start, end, startW, duration ) => {
			expect( rules.fromSlot( day, start, end ) ).toEqual( {
				start: startW,
				duration,
			} );
		}
	);

	it( 'reads an empty or missing time as 00:00', () => {
		expect( rules.fromSlot( 'monday', '', '01:00' ) ).toEqual( {
			start: 0,
			duration: 60,
		} );
		expect( rules.fromSlot( 'monday', undefined, null ) ).toEqual( {
			start: 0,
			duration: 1440,
		} );
		expect( rules.minuteOfWeek( 'monday', 'abc' ) ).toBe( 0 );
	} );
} );

describe( 'global', () => {
	it( 'exposes the same rules on window.radplapagScheduleRules', () => {
		expect( window.radplapagScheduleRules ).toBe( rules );
	} );
} );
