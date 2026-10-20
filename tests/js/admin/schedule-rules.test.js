/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import rules from '../../../admin/js/schedule-rules.js';

const PROGRAM_IDS = [ '501', '502', '503' ];

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

	it( 'currently rejects a slot whose start equals its end (C3)', () => {
		expect( checkMonday( slot( '501', '08:00', '08:00' ) ) ).toEqual(
			ownWrite( { code: 'start_equals_end' } )
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

	it( 'currently counts slots without a program and names them after the placeholder (K75)', () => {
		expect( checkAgainst( [ slot( '', '09:00', '11:00' ) ] ) ).toEqual(
			ownWrite( {
				code: 'overlap',
				other: {
					day: 'monday',
					name: 'Select Radio Show',
					start: '09:00',
					end: '11:00',
				},
			} )
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

describe( 'global', () => {
	it( 'exposes the same rules on window.radplapagScheduleRules', () => {
		expect( window.radplapagScheduleRules ).toBe( rules );
	} );
} );
