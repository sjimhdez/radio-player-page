<?php
/**
 * Validation of a station schedule.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\Schedule;

defined( 'ABSPATH' ) || exit;

/**
 * Sanitizes and validates a raw station schedule, as the meta box posts it.
 *
 * The rules are those of radplapag_sanitize_station_schedule() in 3.4.2. Errors are
 * codes with their data; the wrapper turns them into messages:
 *
 * - `required`: a row has some, but not all, of program, start and end.
 * - `invalid_program`: the program ID is not in the names map.
 * - `format`: start or end is not HH:MM (00:00-23:59).
 * - `overlap`: a row overlaps an earlier-starting row of the same day.
 * - `cross_midnight_overlap`: a row overlaps a row of the next day. The first one
 *   ends the check.
 *
 * Overlaps are those of the week-interval model (Week_Interval, ADR 0044): a row
 * with end < start crosses midnight and start == end is a 24 h slot.
 *
 * @since 3.5.0
 */
final class Slot_Validator {

	/**
	 * HH:MM, 00:00 to 23:59.
	 */
	const TIME_REGEX = '/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/';

	/**
	 * Sanitizes and validates a raw schedule.
	 *
	 * Days are read Monday to Sunday (other keys are dropped), rows come out ordered by
	 * start, and days without valid rows are left out. Errors follow day and row order;
	 * the valid rows are in the schedule even when there are errors.
	 *
	 * @since 3.5.0
	 *
	 * @param mixed              $input         Raw schedule: day => [ [ program_id, start, end, is_rerun ], ... ].
	 * @param array<int, string> $program_names Program ID => name of every program a slot may use.
	 * @return array{schedule: array<string, list<array{program_id: int, start: string, end: string, is_rerun: bool}>>, errors: list<array{code: string, day: string, program: string|null, other: string|null, next_day: string|null}>}
	 */
	public static function validate( $input, array $program_names ): array {
		$schedule = array();
		$errors   = array();

		if ( ! is_array( $input ) ) {
			return array(
				'schedule' => $schedule,
				'errors'   => $errors,
			);
		}

		foreach ( Week::KEYS as $day ) {
			if ( ! isset( $input[ $day ] ) || ! is_array( $input[ $day ] ) ) {
				continue;
			}

			$rows = array();
			foreach ( $input[ $day ] as $program ) {
				if ( ! is_array( $program ) ) {
					continue;
				}
				$program_id_raw = isset( $program['program_id'] ) ? $program['program_id'] : '';
				$program_id     = is_numeric( $program_id_raw ) ? (int) $program_id_raw : 0;
				// A time that is not a string (a hand-made POST) counts as missing (K38).
				$start = isset( $program['start'] ) && is_string( $program['start'] ) ? trim( $program['start'] ) : '';
				$end   = isset( $program['end'] ) && is_string( $program['end'] ) ? trim( $program['end'] ) : '';

				if ( $program_id <= 0 && empty( $start ) && empty( $end ) ) {
					continue;
				}
				if ( $program_id <= 0 || empty( $start ) || empty( $end ) ) {
					$errors[] = self::error( 'required', $day );
					continue;
				}
				if ( ! array_key_exists( $program_id, $program_names ) ) {
					$errors[] = self::error( 'invalid_program', $day );
					continue;
				}
				$name = $program_names[ $program_id ];
				if ( ! preg_match( self::TIME_REGEX, $start ) || ! preg_match( self::TIME_REGEX, $end ) ) {
					$errors[] = self::error( 'format', $day, $name );
					continue;
				}

				$rows[] = array(
					'program_id' => $program_id,
					'name'       => $name,
					'start'      => $start,
					'end'        => $end,
					'is_rerun'   => ! empty( $program['is_rerun'] ),
					'start_min'  => Time::to_minutes( $start ),
				);
			}

			usort(
				$rows,
				function ( $a, $b ) {
					return $a['start_min'] - $b['start_min'];
				}
			);

			$kept = array();
			foreach ( $rows as $row ) {
				foreach ( $kept as $other ) {
					if ( self::overlap( $day, $row, $day, $other ) ) {
						$errors[] = self::error( 'overlap', $day, $row['name'], $other['name'] );
						continue 2;
					}
				}
				$kept[]             = $row;
				$schedule[ $day ][] = array(
					'program_id' => $row['program_id'],
					'start'      => $row['start'],
					'end'        => $row['end'],
					'is_rerun'   => $row['is_rerun'],
				);
			}
		}

		$conflict = self::first_cross_midnight_overlap( $schedule, $program_names );
		if ( null !== $conflict ) {
			$errors[] = $conflict;
		}

		return array(
			'schedule' => $schedule,
			'errors'   => $errors,
		);
	}

	/**
	 * Finds the first row that overlaps a row of the next day.
	 *
	 * Rows are already valid. Days are checked Monday to Sunday (Sunday's next day is
	 * Monday) and rows in start order.
	 *
	 * @since 3.5.0
	 *
	 * @param array<string, list<array{program_id: int, start: string, end: string, is_rerun: bool}>> $schedule      Validated schedule.
	 * @param array<int, string>                                                                      $program_names Program ID => name.
	 * @return array{code: string, day: string, program: string|null, other: string|null, next_day: string|null}|null
	 */
	private static function first_cross_midnight_overlap( array $schedule, array $program_names ): ?array {
		foreach ( Week::KEYS as $day_idx => $day ) {
			if ( empty( $schedule[ $day ] ) ) {
				continue;
			}
			$next_day = Week::KEYS[ ( $day_idx + 1 ) % 7 ];
			foreach ( $schedule[ $day ] as $row ) {
				if ( empty( $schedule[ $next_day ] ) ) {
					continue;
				}
				foreach ( $schedule[ $next_day ] as $next_row ) {
					if ( self::overlap( $day, $row, $next_day, $next_row ) ) {
						return self::error(
							'cross_midnight_overlap',
							$day,
							$program_names[ $row['program_id'] ],
							$program_names[ $next_row['program_id'] ],
							$next_day
						);
					}
				}
			}
		}

		return null;
	}

	/**
	 * Checks if two valid rows overlap as intervals of the week.
	 *
	 * @since 3.5.0
	 *
	 * @param string                            $day       Day key of the first row.
	 * @param array{start: string, end: string} $row       First row.
	 * @param string                            $other_day Day key of the second row.
	 * @param array{start: string, end: string} $other     Second row.
	 * @return bool True if they share at least one minute.
	 */
	private static function overlap( string $day, array $row, string $other_day, array $other ): bool {
		$a = Week_Interval::from_slot( $day, $row['start'], $row['end'] );
		$b = Week_Interval::from_slot( $other_day, $other['start'], $other['end'] );
		return null !== $a && null !== $b && Week_Interval::overlaps( $a, $b );
	}

	/**
	 * Builds an error.
	 *
	 * @since 3.5.0
	 *
	 * @param string      $code     Error code.
	 * @param string      $day      Day key of the row.
	 * @param string|null $program  Program name of the row.
	 * @param string|null $other    Name of the program it overlaps.
	 * @param string|null $next_day Day key of the program it overlaps (cross-day only).
	 * @return array{code: string, day: string, program: string|null, other: string|null, next_day: string|null}
	 */
	private static function error( string $code, string $day, ?string $program = null, ?string $other = null, ?string $next_day = null ): array {
		return array(
			'code'     => $code,
			'day'      => $day,
			'program'  => $program,
			'other'    => $other,
			'next_day' => $next_day,
		);
	}
}
