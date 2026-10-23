<?php
/**
 * Filter of a station schedule down to the slots of public programs.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\Schedule;

defined( 'ABSPATH' ) || exit;

/**
 * Keeps only the slots of public programs (ADR 0045, D4 of spec 0009).
 *
 * The WordPress adapter passes the IDs of the public programs and runs this before
 * resolving, in every public entry point. Days and the stored order are kept, and
 * slots are returned as stored. A day that is not an array, an entry that is not an
 * array and a slot whose program_id is not numeric (a program that does not exist)
 * or not in the list are dropped; a day left without slots stays, empty.
 *
 * @since 3.5.0
 */
final class Public_Slots {

	/**
	 * Returns the schedule with only the slots of the given programs.
	 *
	 * @since 3.5.0
	 *
	 * @param array<mixed> $schedule    Stored schedule: day => [ [ program_id, start, end, is_rerun ], ... ].
	 * @param int[]        $program_ids Post IDs of the public programs.
	 * @return array<array-key, list<array<mixed>>> Day => slots kept.
	 */
	public static function filter( array $schedule, array $program_ids ): array {
		$public = array_flip( $program_ids );
		$result = array();

		foreach ( $schedule as $day => $entries ) {
			if ( ! is_array( $entries ) ) {
				continue;
			}
			$kept = array();
			foreach ( $entries as $entry ) {
				if ( ! is_array( $entry ) || ! isset( $entry['program_id'] ) || ! is_numeric( $entry['program_id'] ) ) {
					continue;
				}
				if ( isset( $public[ (int) $entry['program_id'] ] ) ) {
					$kept[] = $entry;
				}
			}
			$result[ $day ] = $kept;
		}

		return $result;
	}
}
