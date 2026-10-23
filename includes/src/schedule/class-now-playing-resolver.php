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
 * The slots are Week_Interval intervals of the whole week (ADR 0044):
 *
 * - On air: the active slot that started latest; on a tie, the first one in the
 *   stored order of its day (D3).
 * - Coming up: the slot that starts soonest, strictly after now and within the
 *   window, on any day; on a tie, the first one. Only its start is needed. A slot
 *   of the program on air that starts just when the slot on air ends is skipped:
 *   it goes on, it does not come up (K52 in docs/known-issues.md).
 * - A slot whose program is not in the map, or whose program ID is missing or not
 *   numeric, gives a null entry but still wins (C10 in docs/known-issues.md).
 *
 * @since 3.5.0
 */
final class Now_Playing_Resolver {

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
		$minute = Week_Interval::at( $now );

		// On air: the active slot with the fewest minutes since its start.
		$current          = null;
		$current_elapsed  = null;
		$current_interval = null;
		$current_program  = null;
		// Coming up: the slots starting within the window, in stored order.
		$candidates = array();
		foreach ( Week::KEYS as $day_key ) {
			foreach ( self::entries( $schedule, $day_key ) as $entry ) {
				$start = (string) ( $entry['start'] ?? '' );
				if ( '' === $start ) {
					continue;
				}
				$end      = (string) ( $entry['end'] ?? '' );
				$interval = Week_Interval::from_slot( $day_key, $start, $end );
				if ( null === $interval ) {
					continue;
				}
				if ( '' !== $end && Week_Interval::contains( $interval, $minute ) ) {
					$elapsed = ( Week_Interval::WEEK - Week_Interval::minutes_until_start( $interval, $minute ) ) % Week_Interval::WEEK;
					if ( null === $current_elapsed || $elapsed < $current_elapsed ) {
						$current          = self::build_entry( $entry, $programs, $day_labels[ $day_key ] ?? $day_key );
						$current_elapsed  = $elapsed;
						$current_interval = $interval;
						$current_program  = (string) ( $entry['program_id'] ?? '' );
					}
				}
				$delta = Week_Interval::minutes_until_start( $interval, $minute );
				if ( $delta > 0 && $delta <= $window ) {
					$candidates[] = array( $delta, $interval['start'], $entry, $day_key );
				}
			}
		}

		// Where the slot on air ends, as a minute of the week.
		$current_end = null === $current_interval ? null : ( $current_interval['start'] + $current_interval['duration'] ) % Week_Interval::WEEK;

		$upcoming       = null;
		$upcoming_delta = null;
		foreach ( $candidates as list( $delta, $start_w, $entry, $day_key ) ) {
			if ( $start_w === $current_end && (string) ( $entry['program_id'] ?? '' ) === $current_program ) {
				continue;
			}
			if ( null === $upcoming_delta || $delta < $upcoming_delta ) {
				$upcoming       = self::build_entry( $entry, $programs, $day_labels[ $day_key ] ?? $day_key );
				$upcoming_delta = $delta;
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
