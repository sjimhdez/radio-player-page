/**
 * Station clock for the e2e site: tests/e2e/fixtures/seed-e2e.php sets the
 * timezone to `Asia/Kolkata`, a fixed UTC+5:30 with no DST (C9).
 */

/** Station offset from UTC, in hours. */
export const STATION_OFFSET_HOURS = 5.5;

/** Day of the station week. */
export type StationDay =
	| 'monday'
	| 'tuesday'
	| 'wednesday'
	| 'thursday'
	| 'friday'
	| 'saturday'
	| 'sunday';

const DAYS: StationDay[] = [
	'monday',
	'tuesday',
	'wednesday',
	'thursday',
	'friday',
	'saturday',
	'sunday',
];

// Midnight UTC of a Monday (2024-01-01): the reference week.
const REFERENCE_MONDAY_UTC = Date.UTC( 2024, 0, 1 );

/**
 * The UTC instant at which the station clock reads `day` `time`, in the
 * reference week, for `page.clock`.
 *
 * @param day  Station day.
 * @param time Station time, `HH:MM`.
 */
export function stationInstant( day: StationDay, time: string ): Date {
	const [ hours, minutes ] = time.split( ':' ).map( Number );
	const localMs =
		REFERENCE_MONDAY_UTC +
		DAYS.indexOf( day ) * 86_400_000 +
		( hours * 60 + minutes ) * 60_000;
	return new Date( localMs - STATION_OFFSET_HOURS * 3_600_000 );
}
