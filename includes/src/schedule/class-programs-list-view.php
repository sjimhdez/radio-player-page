<?php
/**
 * The programs of the programs list block.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\Schedule;

use DateTimeImmutable;

defined( 'ABSPATH' ) || exit;

/**
 * Builds, from a station schedule, the programs and slots that the programs list
 * block shows.
 *
 * The rules are those of radplapag_get_programs_list_for_station() in 3.4.2:
 *
 * - The programs in the order they first appear, Monday to Sunday; a program that
 *   is not in the map is left out. Each one has its slots sorted by day, then by
 *   start. Entries that are not arrays, or have no program ID, start or end, are
 *   skipped.
 * - A slot is live by its start and end only: today's, or yesterday's that crosses
 *   midnight. A slot that crosses midnight is also live early on its own day (C16
 *   in docs/known-issues.md).
 *
 * @since 3.5.0
 */
final class Programs_List_View {

	/**
	 * Returns the program IDs of a schedule: numeric and above 0, as integers and
	 * unique, in the order they first appear Monday to Sunday.
	 *
	 * @since 3.5.0
	 *
	 * @param array<mixed> $schedule Stored schedule: day => [ [ program_id, start, end, is_rerun ], ... ].
	 * @return list<int>
	 */
	public static function program_ids_in_order( array $schedule ): array {
		$program_ids = array();
		foreach ( Week::KEYS as $day_key ) {
			foreach ( self::entries( $schedule, $day_key ) as $entry ) {
				$pid = $entry['program_id'] ?? null;
				if ( null === $pid || '' === $pid || ! is_numeric( $pid ) ) {
					continue;
				}
				$pid_int = (int) $pid;
				if ( $pid_int > 0 ) {
					$program_ids[ $pid_int ] = true;
				}
			}
		}

		return array_keys( $program_ids );
	}

	/**
	 * Returns the programs of the schedule with their slots.
	 *
	 * @since 3.5.0
	 *
	 * @param array<mixed>                                                                                     $schedule    Stored schedule.
	 * @param array<int, array{name: string, description: string, extended_description: string, logo_id: int}> $programs    Program ID => data, as radplapag_get_program_data() returns them.
	 * @param array<string, string>                                                                            $day_labels  Day key => label; a day without label shows its key.
	 * @param DateTimeImmutable                                                                                $now         Now, in the station's timezone.
	 * @param callable(mixed): string                                                                          $sanitize_id Sanitizer of a stored program ID that is not numeric.
	 * @return list<array{id: string, name: string, logo_id: int, description: string|null, extended_description: string|null, slots: list<array{day_key: string, day_label: string, time_range: string, is_live: bool}>}>
	 */
	public static function build( array $schedule, array $programs, array $day_labels, DateTimeImmutable $now, callable $sanitize_id ): array {
		$local           = Week::local_day_and_minutes( $now );
		$day_of_week     = $local['day'];
		$current_minutes = $local['minutes'];
		$prev_day        = ( $day_of_week + 6 ) % 7;

		/**
		 * Program key => slots. Collected Monday to Sunday, so already sorted by day;
		 * PHP turns the numeric program keys into integers.
		 *
		 * @var array<int|string, list<array{day_key: string, day_label: string, time_range: string, is_live: bool}>> $slots_by_program
		 */
		$slots_by_program = array();
		foreach ( Week::KEYS as $day_key ) {
			$php_day = Week::php_day_for_key( $day_key );
			foreach ( self::entries( $schedule, $day_key ) as $entry ) {
				$program_id = $entry['program_id'] ?? '';
				if ( '' === $program_id ) {
					continue;
				}
				$program_key = is_numeric( $program_id ) ? (string) (int) $program_id : (string) $sanitize_id( $program_id );
				$start       = (string) ( $entry['start'] ?? '' );
				$end         = (string) ( $entry['end'] ?? '' );
				if ( '' === $start || '' === $end ) {
					continue;
				}
				$is_live = false;
				if ( $php_day === $day_of_week ) {
					$is_live = Time::is_slot_active( $start, $end, $current_minutes, false );
				} elseif ( $php_day === $prev_day ) {
					$is_live = Time::is_slot_active( $start, $end, $current_minutes, true );
				}
				$slots_by_program[ $program_key ][] = array(
					'day_key'    => $day_key,
					'day_label'  => $day_labels[ $day_key ] ?? $day_key,
					'time_range' => $start . '-' . $end,
					'is_live'    => $is_live,
				);
			}
		}

		$day_positions = array_flip( Week::KEYS );
		foreach ( array_keys( $slots_by_program ) as $program_key ) {
			usort(
				$slots_by_program[ $program_key ],
				function ( $a, $b ) use ( $day_positions ) {
					if ( $a['day_key'] !== $b['day_key'] ) {
						return $day_positions[ $a['day_key'] ] - $day_positions[ $b['day_key'] ];
					}
					return Time::to_minutes( substr( $a['time_range'], 0, 5 ) ) - Time::to_minutes( substr( $b['time_range'], 0, 5 ) );
				}
			);
		}

		$out = array();
		foreach ( self::program_ids_in_order( $schedule ) as $post_id ) {
			if ( ! isset( $programs[ $post_id ] ) ) {
				continue;
			}
			$data  = $programs[ $post_id ];
			$key   = (string) $post_id;
			$out[] = array(
				'id'                   => $key,
				'name'                 => $data['name'],
				'logo_id'              => $data['logo_id'] > 0 ? $data['logo_id'] : 0,
				'description'          => '' !== $data['description'] ? $data['description'] : null,
				'extended_description' => '' !== $data['extended_description'] ? $data['extended_description'] : null,
				'slots'                => $slots_by_program[ $key ] ?? array(),
			);
		}

		return $out;
	}

	/**
	 * Returns the entries of a day that are arrays.
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
}
