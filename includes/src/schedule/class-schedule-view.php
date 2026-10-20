<?php
/**
 * The days of the schedule block.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\Schedule;

use DateTimeImmutable;

defined( 'ABSPATH' ) || exit;

/**
 * Builds, from a station schedule, the days and slots that the schedule block shows.
 *
 * The rules are those of radplapag_build_programs_map() and
 * radplapag_get_schedule_for_station() in 3.4.2:
 *
 * - The seven days, Monday to Sunday or starting with today, each with its slots
 *   sorted by start. Entries that are not arrays, or have no program ID, start or
 *   end, are skipped; a program that is not in the map gives an empty name.
 * - A slot is live by its start and end only: today's, or yesterday's that crosses
 *   midnight. A slot that crosses midnight is also live early on its own day (C16
 *   in docs/known-issues.md).
 *
 * @since 3.5.0
 */
final class Schedule_View {

	/**
	 * Returns the program IDs of a schedule: numeric and above 0, as integers and
	 * unique, in the order they first appear.
	 *
	 * @since 3.5.0
	 *
	 * @param array<mixed> $schedule Stored schedule: day => [ [ program_id, start, end, is_rerun ], ... ].
	 * @return list<int>
	 */
	public static function program_ids( array $schedule ): array {
		$program_ids = array();
		foreach ( $schedule as $day_entries ) {
			if ( ! is_array( $day_entries ) ) {
				continue;
			}
			foreach ( $day_entries as $entry ) {
				if ( ! is_array( $entry ) ) {
					continue;
				}
				$pid = $entry['program_id'] ?? null;
				if ( null === $pid || '' === $pid ) {
					continue;
				}
				$pid_int = is_numeric( $pid ) ? (int) $pid : 0;
				if ( $pid_int > 0 ) {
					$program_ids[ $pid_int ] = true;
				}
			}
		}

		return array_keys( $program_ids );
	}

	/**
	 * Returns the days of the schedule with their slots.
	 *
	 * @since 3.5.0
	 *
	 * @param array<mixed>                                                                                                               $schedule     Stored schedule.
	 * @param array<int|string, array{name: string, description: string|null, extended_description: string|null, logo_url: string|null}> $programs_map Program ID => data, as radplapag_build_programs_map() returns them.
	 * @param array<string, string>                                                                                                      $day_labels   Day key => label; a day without label shows its key.
	 * @param DateTimeImmutable                                                                                                          $now          Now, in the station's timezone.
	 * @param string                                                                                                                     $day_order    'current_first' starts with today; anything else, Monday to Sunday.
	 * @param callable(string): string                                                                                                   $sanitize_id  Sanitizer of the stored program ID.
	 * @return list<array{day_key: string, label: string, slots: list<array{program_id: string, program_name: string, program_description: string, program_extended_description: string, start: string, end: string, time_range: string, is_live: bool, is_rerun: bool}>}>
	 */
	public static function days( array $schedule, array $programs_map, array $day_labels, DateTimeImmutable $now, string $day_order, callable $sanitize_id ): array {
		$local           = Week::local_day_and_minutes( $now );
		$day_of_week     = $local['day'];
		$current_minutes = $local['minutes'];
		$prev_day        = ( $day_of_week + 6 ) % 7;

		$days = array();
		foreach ( Week::KEYS as $day_key ) {
			$php_day     = Week::php_day_for_key( $day_key );
			$day_entries = isset( $schedule[ $day_key ] ) && is_array( $schedule[ $day_key ] ) ? $schedule[ $day_key ] : array();
			$slots       = array();
			foreach ( $day_entries as $entry ) {
				if ( ! is_array( $entry ) ) {
					continue;
				}
				$program_id = (string) $sanitize_id( (string) ( $entry['program_id'] ?? '' ) );
				$start      = (string) ( $entry['start'] ?? '' );
				$end        = (string) ( $entry['end'] ?? '' );
				if ( '' === $program_id || '' === $start || '' === $end ) {
					continue;
				}
				$program = $programs_map[ $program_id ] ?? array(
					'name'                 => '',
					'description'          => null,
					'extended_description' => null,
					'logo_url'             => null,
				);
				$is_live = false;
				if ( $php_day === $day_of_week ) {
					$is_live = Time::is_slot_active( $start, $end, $current_minutes, false );
				} elseif ( $php_day === $prev_day ) {
					$is_live = Time::is_slot_active( $start, $end, $current_minutes, true );
				}
				$slots[] = array(
					'program_id'                   => $program_id,
					'program_name'                 => $program['name'],
					'program_description'          => is_string( $program['description'] ) ? $program['description'] : '',
					'program_extended_description' => is_string( $program['extended_description'] ) ? $program['extended_description'] : '',
					'start'                        => $start,
					'end'                          => $end,
					'time_range'                   => $start . '-' . $end,
					'is_live'                      => $is_live,
					'is_rerun'                     => ! empty( $entry['is_rerun'] ),
				);
			}
			usort(
				$slots,
				function ( $a, $b ) {
					return Time::to_minutes( $a['start'] ) - Time::to_minutes( $b['start'] );
				}
			);
			$days[] = array(
				'day_key' => $day_key,
				'label'   => $day_labels[ $day_key ] ?? $day_key,
				'slots'   => $slots,
			);
		}

		if ( 'current_first' === $day_order ) {
			// Week::KEYS starts on Monday; PHP day 0 is Sunday.
			$start_index = ( $day_of_week + 6 ) % 7;
			$days        = array_merge( array_slice( $days, $start_index ), array_slice( $days, 0, $start_index ) );
		}

		return $days;
	}
}
