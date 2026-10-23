<?php
/**
 * Greedy filter of the slots of a migrated schedule.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\Migration;

use RadioPlayerPage\Schedule\Slot_Validator;
use RadioPlayerPage\Schedule\Week;

defined( 'ABSPATH' ) || exit;

/**
 * Drops the legacy slots that would make a station's schedule fail validation (ADR 0037).
 *
 * Slots are accepted one by one, Monday to Sunday and in their order within the day. A
 * slot is dropped when Slot_Validator::validate() gives errors for the slots already
 * accepted plus that one (format, times, overlap in the day or across days), so the
 * earlier slot wins: with Sunday 23:00–02:00 and Monday 01:00–03:00, Monday stays.
 * Keys that are not days are left out, as the validator does.
 *
 * @since 3.5.0
 */
final class Slot_Filter {

	/**
	 * Splits a schedule into the slots kept and the slots dropped.
	 *
	 * @since 3.5.0
	 *
	 * @param array<array-key, list<array{program_id: int, start: string, end: string}>> $schedule      Schedule with program post IDs.
	 * @param array<int, string>                                                         $program_names Program post ID => name.
	 * @return array{schedule: array<string, list<array{program_id: int, start: string, end: string}>>, dropped: list<array{day: string, start: string, end: string, program: string}>}
	 */
	public static function filter( array $schedule, array $program_names ): array {
		$kept    = array();
		$dropped = array();

		foreach ( Week::KEYS as $day ) {
			if ( empty( $schedule[ $day ] ) ) {
				continue;
			}
			foreach ( $schedule[ $day ] as $slot ) {
				$candidate           = $kept;
				$candidate[ $day ][] = $slot;
				if ( array() === Slot_Validator::validate( $candidate, $program_names )['errors'] ) {
					$kept = $candidate;
					continue;
				}
				$dropped[] = array(
					'day'     => $day,
					'start'   => $slot['start'],
					'end'     => $slot['end'],
					'program' => $program_names[ $slot['program_id'] ] ?? '',
				);
			}
		}

		return array(
			'schedule' => $kept,
			'dropped'  => $dropped,
		);
	}
}
