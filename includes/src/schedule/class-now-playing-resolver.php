<?php
/**
 * The program on air and the next one coming up.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\Schedule;

use DateTimeImmutable;

defined( 'ABSPATH' ) || exit;

/**
 * Resolves, from a station schedule, the program on air and the nearest one
 * starting within the upcoming window.
 *
 * The rules are those of radplapag_get_now_playing_for_station() in 3.4.2:
 *
 * - On air: the first active slot of today, else of yesterday's slots that cross
 *   midnight. A slot that crosses midnight is also active early on its own day
 *   (C16 in docs/known-issues.md).
 * - Coming up: the slot that starts soonest, strictly after now and within the
 *   window, later today or (near midnight) early tomorrow; on a tie, the first one.
 * - A slot whose program is not in the map, or whose program ID is missing or not
 *   numeric, gives a null entry but still ends the search in its day (yesterday's
 *   slots are still looked at) and still takes the window (C10 in
 *   docs/known-issues.md).
 *
 * @since 3.5.0
 */
final class Now_Playing_Resolver {

	/**
	 * Minutes in a day.
	 */
	const DAY_MINUTES = 1440;

	/**
	 * Resolves the program on air and the one coming up.
	 *
	 * @since 3.5.0
	 *
	 * @param array<mixed>                                  $schedule   Stored schedule: day => [ [ program_id, start, end, is_rerun ], ... ].
	 * @param array<int, array{name: string, logo_id: int}> $programs   Program ID => data of every program that may be shown.
	 * @param array<string, string>                         $day_labels Day key => label; a day without label shows its key.
	 * @param DateTimeImmutable                             $now        Now, in the station's timezone.
	 * @param int                                           $window     Upcoming window, in minutes.
	 * @return array{current: array{id: string, name: string, logo_id: int, day_label: string, time_range: string, is_rerun: bool}|null, upcoming: array{id: string, name: string, day_label: string, time_range: string, is_rerun: bool}|null}
	 */
	public static function resolve( array $schedule, array $programs, array $day_labels, DateTimeImmutable $now, int $window ): array {
		$local           = Week::local_day_and_minutes( $now );
		$current_minutes = $local['minutes'];
		$today_key       = (string) Week::key_for_php_day( $local['day'] );
		$prev_day_key    = (string) Week::key_for_php_day( ( $local['day'] + 6 ) % 7 );
		$tomorrow_key    = (string) Week::key_for_php_day( ( $local['day'] + 1 ) % 7 );

		// On air: today's slots first, then yesterday's slots that cross midnight into now.
		$current = null;
		foreach ( array( array( $today_key, false ), array( $prev_day_key, true ) ) as $candidate ) {
			if ( null !== $current ) {
				break;
			}
			list( $day_key, $is_prev_day_crossing ) = $candidate;
			foreach ( self::entries( $schedule, $day_key ) as $entry ) {
				$start = (string) ( $entry['start'] ?? '' );
				$end   = (string) ( $entry['end'] ?? '' );
				if ( '' === $start || '' === $end ) {
					continue;
				}
				if ( Time::is_slot_active( $start, $end, $current_minutes, $is_prev_day_crossing ) ) {
					$current = self::build_entry( $entry, $programs, $day_labels[ $day_key ] ?? $day_key );
					break;
				}
			}
		}

		// Coming up: nearest slot starting within the window, later today or just after midnight tomorrow.
		$upcoming       = null;
		$upcoming_delta = null;
		$days           = array( array( $today_key, -$current_minutes ) );
		if ( self::DAY_MINUTES - $current_minutes <= $window ) {
			$days[] = array( $tomorrow_key, self::DAY_MINUTES - $current_minutes );
		}
		foreach ( $days as $day ) {
			list( $day_key, $offset ) = $day;
			foreach ( self::entries( $schedule, $day_key ) as $entry ) {
				$start = (string) ( $entry['start'] ?? '' );
				if ( '' === $start ) {
					continue;
				}
				$delta = $offset + Time::to_minutes( $start );
				if ( $delta > 0 && $delta <= $window && ( null === $upcoming_delta || $delta < $upcoming_delta ) ) {
					$upcoming       = self::build_entry( $entry, $programs, $day_labels[ $day_key ] ?? $day_key );
					$upcoming_delta = $delta;
				}
			}
		}

		if ( null !== $upcoming ) {
			unset( $upcoming['logo_id'] );
		}

		return array(
			'current'  => $current,
			'upcoming' => $upcoming,
		);
	}

	/**
	 * The entries of a day that are arrays (a day that is not an array has none).
	 *
	 * @param array<mixed> $schedule Stored schedule.
	 * @param string       $day_key  Day key.
	 * @return list<array<mixed>>
	 */
	private static function entries( array $schedule, string $day_key ): array {
		if ( ! isset( $schedule[ $day_key ] ) || ! is_array( $schedule[ $day_key ] ) ) {
			return array();
		}

		return array_values( array_filter( $schedule[ $day_key ], 'is_array' ) );
	}

	/**
	 * The entry of a slot, or null when its program is unknown.
	 *
	 * @param array<mixed>                                  $entry     Stored slot.
	 * @param array<int, array{name: string, logo_id: int}> $programs  Program ID => data.
	 * @param string                                        $day_label Label of the slot's day.
	 * @return array{id: string, name: string, logo_id: int, day_label: string, time_range: string, is_rerun: bool}|null
	 */
	private static function build_entry( array $entry, array $programs, string $day_label ): ?array {
		$program_id = $entry['program_id'] ?? '';
		if ( '' === $program_id || ! is_numeric( $program_id ) ) {
			return null;
		}
		$id = (int) $program_id;
		if ( ! isset( $programs[ $id ] ) ) {
			return null;
		}
		$start = (string) ( $entry['start'] ?? '' );
		$end   = (string) ( $entry['end'] ?? '' );

		return array(
			'id'         => (string) $id,
			'name'       => $programs[ $id ]['name'],
			'logo_id'    => $programs[ $id ]['logo_id'] > 0 ? $programs[ $id ]['logo_id'] : 0,
			'day_label'  => $day_label,
			'time_range' => $start . '-' . $end,
			'is_rerun'   => ! empty( $entry['is_rerun'] ),
		);
	}
}
