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
	const DAY_LABELS = {
		monday: 'Monday',
		tuesday: 'Tuesday',
		wednesday: 'Wednesday',
		thursday: 'Thursday',
		friday: 'Friday',
		saturday: 'Saturday',
		sunday: 'Sunday',
	};

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

	function findSameDayOverlap( schedule, day, index ) {
		const slots = slotsOf( schedule, day );
		const current = intervalOf( day, slots[ index ] );
		for ( let i = 0; i < slots.length; i++ ) {
			const other = slots[ i ];
			if ( i === index || other.hidden || ! other.start || ! other.end ) {
				continue;
			}
			if ( overlaps( current, intervalOf( day, other ) ) ) {
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
		const interval = intervalOf( day, current );
		const following = nextDay( day );
		const slots = slotsOf( schedule, following );
		for ( let i = 0; i < slots.length; i++ ) {
			const other = slots[ i ];
			if ( ! isComplete( other ) ) {
				continue;
			}
			if ( overlaps( interval, intervalOf( following, other ) ) ) {
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
		const interval = intervalOf( day, current );
		const previous = prevDay( day );
		const slots = slotsOf( schedule, previous );
		for ( let i = 0; i < slots.length; i++ ) {
			const other = slots[ i ];
			if ( ! isComplete( other ) ) {
				continue;
			}
			if ( overlaps( interval, intervalOf( previous, other ) ) ) {
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

	/**
	 * Checks the schedule as the admin does on submit: every visible slot,
	 * from Monday to Sunday, in order.
	 *
	 * @param {Object}        schedule   Day → slots.
	 * @param {Array<string>} programIds IDs of the existing programs.
	 * @return {Object} { writes, first }: the writes of every check in order,
	 *                  and the first slot { day, index } whose own check
	 *                  fails (null if none).
	 */
	function checkSchedule( schedule, programIds ) {
		let writes = [];
		let first = null;
		DAYS.forEach( function ( day ) {
			slotsOf( schedule, day ).forEach( function ( slot, index ) {
				if ( slot.hidden ) {
					return;
				}
				const slotWrites = checkSlot(
					schedule,
					day,
					index,
					programIds
				);
				writes = writes.concat( slotWrites );
				// The slot's own write is always the last one.
				if ( ! first && slotWrites[ slotWrites.length - 1 ].error ) {
					first = { day, index };
				}
			} );
		} );
		return { writes, first };
	}

	// The week-interval model (ADR 0044), as Schedule\Week_Interval in PHP and
	// utils/week-interval.ts in the player; the three pass the `model` vectors.
	// A minute of the week is day × 1440 + minute (Monday = 0, 0 ≤ w < 10080),
	// and a slot is { start, duration }: end < start crosses midnight and
	// end == start lasts 24 hours. The overlaps of checkSlot() use it.
	const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

	function mod( value, modulus ) {
		return ( ( value % modulus ) + modulus ) % modulus;
	}

	// Loose like Time::to_minutes() in PHP: a missing, empty or unreadable
	// part counts as 0 (timeToMinutes() keeps the admin's own reading).
	function looseMinutes( time ) {
		if ( typeof time !== 'string' || time === '' ) {
			return 0;
		}
		const parts = time.split( ':' );
		return (
			( parseInt( parts[ 0 ], 10 ) || 0 ) * 60 +
			( parseInt( parts[ 1 ], 10 ) || 0 )
		);
	}

	/**
	 * Minute of the week of a day and a time of day.
	 *
	 * @param {string} day  Day key (monday … sunday).
	 * @param {string} time Time HH:MM; a result out of the week wraps into it.
	 * @return {number|null} Minute of the week (0-10079), null for an unknown day.
	 */
	function minuteOfWeek( day, time ) {
		const index = DAYS.indexOf( day );
		if ( index === -1 ) {
			return null;
		}
		return mod(
			index * MINUTES_PER_DAY + looseMinutes( time ),
			MINUTES_PER_WEEK
		);
	}

	/**
	 * Interval of a slot.
	 *
	 * @param {string} day   Day key of the slot.
	 * @param {string} start Start time HH:MM.
	 * @param {string} end   End time HH:MM.
	 * @return {Object|null} { start, duration }, null for an unknown day.
	 */
	function fromSlot( day, start, end ) {
		const startW = minuteOfWeek( day, start );
		if ( startW === null ) {
			return null;
		}
		const duration = mod(
			looseMinutes( end ) - looseMinutes( start ),
			MINUTES_PER_DAY
		);
		return { start: startW, duration: duration || MINUTES_PER_DAY };
	}

	// Interval of a row of the schedule, as fromSlot() but with the admin's
	// own reading of the times (timeToMinutes()).
	function intervalOf( day, slot ) {
		const start = timeToMinutes( slot.start );
		const duration = mod(
			timeToMinutes( slot.end ) - start,
			MINUTES_PER_DAY
		);
		return {
			start: DAYS.indexOf( day ) * MINUTES_PER_DAY + start,
			duration: duration || MINUTES_PER_DAY,
		};
	}

	/**
	 * Whether an interval contains a minute of the week (start inclusive,
	 * end exclusive).
	 *
	 * @param {Object} interval { start, duration }.
	 * @param {number} minute   Minute of the week.
	 * @return {boolean} True if it does.
	 */
	function contains( interval, minute ) {
		return (
			mod( minute - interval.start, MINUTES_PER_WEEK ) < interval.duration
		);
	}

	/**
	 * Minutes from a minute of the week to the next start of an interval:
	 * 0 at its start, up to 10079 just after it.
	 *
	 * @param {Object} interval { start, duration }.
	 * @param {number} minute   Minute of the week.
	 * @return {number} The minutes.
	 */
	function minutesUntilStart( interval, minute ) {
		return mod( interval.start - minute, MINUTES_PER_WEEK );
	}

	/**
	 * Whether two intervals share a minute, wrapping at the end of the week.
	 * Two that only touch (one ends when the other starts) do not.
	 *
	 * @param {Object} a { start, duration }.
	 * @param {Object} b { start, duration }.
	 * @return {boolean} True if they do.
	 */
	function overlaps( a, b ) {
		return contains( a, b.start ) || contains( b, a.start );
	}

	function overlapMessage( other, strings ) {
		const dayLabel = strings[ other.day ] || DAY_LABELS[ other.day ];
		const description =
			( other.name || strings.unnamedProgram || 'Unnamed program' ) +
			' (' +
			dayLabel +
			', ' +
			other.start +
			' - ' +
			other.end +
			')';
		return (
			strings.timeSlotOverlapsWithMessage ||
			'This time slot overlaps with: %s'
		).replace( '%s', function () {
			// A function, so `$` patterns in the name are not read.
			return description;
		} );
	}

	/**
	 * Text of an error, with the English fallbacks of today.
	 *
	 * @param {Object} error   Error from checkSlot().
	 * @param {Object} strings Translated strings (radplapagAdmin.strings).
	 * @return {string} The message.
	 */
	function message( error, strings ) {
		switch ( error.code ) {
			case 'invalid_program':
				return (
					strings.pleaseSelectProgram ||
					( error.reason === 'missing'
						? 'Please select a program.'
						: 'Please select a valid program.' )
				);
			case 'format':
				return (
					strings.invalidTimeFormat ||
					'Invalid time format. Times must be in HH:MM format.'
				);
			case 'required':
				return strings.allFieldsRequired || 'All fields are required.';
			default:
				// overlap and cross_midnight_overlap.
				return overlapMessage( error.other, strings );
		}
	}

	const rules = {
		DAYS,
		nextDay,
		prevDay,
		isValidTime,
		timeToMinutes,
		checkSlot,
		checkSchedule,
		message,
		minuteOfWeek,
		fromSlot,
		contains,
		minutesUntilStart,
		overlaps,
	};

	window.radplapagScheduleRules = rules;

	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = rules;
	}
} )();
