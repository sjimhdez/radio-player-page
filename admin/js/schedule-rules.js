/**
 * Station schedule rules for the admin: pure functions over data, no DOM.
 * station-admin.js reads the rows into a schedule, calls these rules and
 * paints the writes they return.
 *
 * A schedule maps each day to its slots in DOM order (hidden rows included):
 * { monday: [ { programId, name, start, end, hidden } ], … }.
 * Errors carry the codes of tests/fixtures/schedule-vectors.json.
 *
 * Exposed as window.radplapagScheduleRules (internal, not a public API).
 */
( function () {
	const DAYS = [
		'monday',
		'tuesday',
		'wednesday',
		'thursday',
		'friday',
		'saturday',
		'sunday',
	];
	const MINUTES_PER_DAY = 24 * 60;

	function nextDay( day ) {
		return DAYS[ ( DAYS.indexOf( day ) + 1 ) % DAYS.length ];
	}

	function prevDay( day ) {
		return DAYS[ ( DAYS.indexOf( day ) + DAYS.length - 1 ) % DAYS.length ];
	}

	function isValidTime( time ) {
		return !! time && /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test( time );
	}

	function timeToMinutes( time ) {
		if ( ! time || time.length < 5 ) {
			return 0;
		}
		const parts = time.split( ':' );
		return parseInt( parts[ 0 ], 10 ) * 60 + parseInt( parts[ 1 ], 10 );
	}

	function slotsOf( schedule, day ) {
		return schedule[ day ] || [];
	}

	function describeSlot( day, slot ) {
		return { day, name: slot.name, start: slot.start, end: slot.end };
	}

	function write( day, index, error ) {
		return { day, index, error };
	}

	function crossesMidnight( slot ) {
		return timeToMinutes( slot.end ) <= timeToMinutes( slot.start );
	}

	// A slot that ends at or before its start runs until the end of its day.
	function sameDayEnd( slot ) {
		return crossesMidnight( slot )
			? MINUTES_PER_DAY
			: timeToMinutes( slot.end );
	}

	function findSameDayOverlap( schedule, day, index ) {
		const slots = slotsOf( schedule, day );
		const current = slots[ index ];
		const currentStart = timeToMinutes( current.start );
		const currentEnd = sameDayEnd( current );
		for ( let i = 0; i < slots.length; i++ ) {
			const other = slots[ i ];
			if ( i === index || other.hidden || ! other.start || ! other.end ) {
				continue;
			}
			if (
				currentStart < sameDayEnd( other ) &&
				currentEnd > timeToMinutes( other.start )
			) {
				return {
					code: 'overlap',
					other: describeSlot( day, other ),
				};
			}
		}
		return null;
	}

	function isComplete( slot ) {
		return (
			! slot.hidden && !! slot.start && !! slot.end && !! slot.programId
		);
	}

	// Both rows get an error: the other one first, then the slot itself.
	function crossDayWrites(
		day,
		index,
		current,
		otherDay,
		otherIndex,
		other
	) {
		return [
			write( otherDay, otherIndex, {
				code: 'cross_midnight_overlap',
				other: describeSlot( day, current ),
			} ),
			write( day, index, {
				code: 'cross_midnight_overlap',
				other: describeSlot( otherDay, other ),
			} ),
		];
	}

	function findNextDayOverlap( schedule, day, index ) {
		const current = slotsOf( schedule, day )[ index ];
		if ( ! crossesMidnight( current ) ) {
			return null;
		}
		const currentEnd = timeToMinutes( current.end );
		const following = nextDay( day );
		const slots = slotsOf( schedule, following );
		for ( let i = 0; i < slots.length; i++ ) {
			const other = slots[ i ];
			if ( ! isComplete( other ) ) {
				continue;
			}
			if ( currentEnd > timeToMinutes( other.start ) ) {
				return crossDayWrites(
					day,
					index,
					current,
					following,
					i,
					other
				);
			}
		}
		return null;
	}

	function findPrevDayOverlap( schedule, day, index ) {
		const current = slotsOf( schedule, day )[ index ];
		const currentStart = timeToMinutes( current.start );
		const previous = prevDay( day );
		const slots = slotsOf( schedule, previous );
		for ( let i = 0; i < slots.length; i++ ) {
			const other = slots[ i ];
			if ( ! isComplete( other ) || ! crossesMidnight( other ) ) {
				continue;
			}
			if ( timeToMinutes( other.end ) > currentStart ) {
				return crossDayWrites(
					day,
					index,
					current,
					previous,
					i,
					other
				);
			}
		}
		return null;
	}

	function checkSlotFields( slot, programIds ) {
		if ( ! slot.programId ) {
			return { code: 'invalid_program', reason: 'missing' };
		}
		const known = programIds.some( function ( id ) {
			return String( id ) === String( slot.programId );
		} );
		if ( ! known ) {
			return { code: 'invalid_program', reason: 'unknown' };
		}
		if (
			( slot.start && ! isValidTime( slot.start ) ) ||
			( slot.end && ! isValidTime( slot.end ) )
		) {
			return { code: 'format' };
		}
		if (
			slot.start &&
			slot.end &&
			timeToMinutes( slot.start ) === timeToMinutes( slot.end )
		) {
			return { code: 'start_equals_end' };
		}
		if ( ! slot.start || ! slot.end ) {
			return { code: 'required' };
		}
		return null;
	}

	/**
	 * Checks one slot as the admin does when a row is validated.
	 *
	 * @param {Object}        schedule   Day → slots.
	 * @param {string}        day        Day of the slot.
	 * @param {number}        index      Position of the slot in its day.
	 * @param {Array<string>} programIds IDs of the existing programs.
	 * @return {Array<Object>} Ordered writes { day, index, error|null }.
	 */
	function checkSlot( schedule, day, index, programIds ) {
		const slot = slotsOf( schedule, day )[ index ];
		if ( ! slot.programId && ! slot.start && ! slot.end ) {
			return [ write( day, index, null ) ];
		}
		const fieldError = checkSlotFields( slot, programIds );
		if ( fieldError ) {
			return [ write( day, index, fieldError ) ];
		}
		const overlap = findSameDayOverlap( schedule, day, index );
		if ( overlap ) {
			return [ write( day, index, overlap ) ];
		}
		return (
			findNextDayOverlap( schedule, day, index ) ||
			findPrevDayOverlap( schedule, day, index ) || [
				write( day, index, null ),
			]
		);
	}

	const rules = {
		DAYS,
		nextDay,
		prevDay,
		isValidTime,
		timeToMinutes,
		checkSlot,
	};

	window.radplapagScheduleRules = rules;

	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = rules;
	}
} )();
