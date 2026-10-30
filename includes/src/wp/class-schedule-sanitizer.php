<?php
/**
 * Sanitization of a station schedule with the programs of WordPress.
 *
 * @package radio-player-page
 * @since 3.6.0
 */

namespace RadioPlayerPage\WP;

use RadioPlayerPage\Schedule\Slot_Validator;
use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * Builds the program names of a raw schedule and validates it with Slot_Validator.
 *
 * @since 3.6.0
 */
final class Schedule_Sanitizer {

	/**
	 * Sanitizes and validates a raw schedule.
	 *
	 * The programs the rows use count in any status (the meta box warns about the
	 * ones that are not public, ADR 0045). An ID of $kept_ids that is not a program
	 * (deleted for good) is accepted with the label "Radio Show #ID (Deleted)" (K106,
	 * ADR 0062); any other ID that is not a program gives `invalid_program`.
	 *
	 * @since 3.6.0
	 *
	 * @param mixed $input    Raw schedule: day => [ [ program_id, start, end, is_rerun ], ... ].
	 * @param int[] $kept_ids Program IDs of the schedule the station has saved.
	 * @return array<string, list<array{program_id: int, start: string, end: string, is_rerun: bool}>>|WP_Error Sanitized schedule keyed by day, or WP_Error with the messages.
	 */
	public static function sanitize( $input, array $kept_ids = array() ) {
		$program_names = array();
		if ( is_array( $input ) ) {
			foreach ( $input as $day_rows ) {
				if ( ! is_array( $day_rows ) ) {
					continue;
				}
				foreach ( $day_rows as $row ) {
					$program_id = is_array( $row ) && isset( $row['program_id'] ) && is_numeric( $row['program_id'] ) ? (int) $row['program_id'] : 0;
					if ( $program_id <= 0 || isset( $program_names[ $program_id ] ) ) {
						continue;
					}
					$program_data = Program_Repository::data( $program_id, false );
					if ( $program_data ) {
						$program_names[ $program_id ] = $program_data['name'];
					} elseif ( in_array( $program_id, $kept_ids, true ) ) {
						$program_names[ $program_id ] = Program_Repository::deleted_label( $program_id );
					}
				}
			}
		}

		$result = Slot_Validator::validate( $input, $program_names );
		if ( ! empty( $result['errors'] ) ) {
			return new WP_Error( 'radplapag_schedule_validation', Schedule_Messages::join( $result['errors'] ) );
		}
		return $result['schedule'];
	}
}
