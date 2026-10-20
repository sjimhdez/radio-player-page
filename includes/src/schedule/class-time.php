<?php
/**
 * Times of day and slot activity for the station schedule.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\Schedule;

defined( 'ABSPATH' ) || exit;

/**
 * "HH:MM" times as minutes since midnight, and whether a slot is on air.
 *
 * The rules are the loose ones of 3.4.2: nothing is rejected here (validation
 * happens on save), and a slot with end <= start crosses midnight (C16 in
 * docs/known-issues.md).
 *
 * @since 3.5.0
 */
final class Time {

	/**
	 * Parses "HH:MM" to minutes since midnight.
	 *
	 * Non-strings and empty strings give 0; each part goes through intval(), so
	 * "7:5" is 425, "24:00" is 1440 and "abc" is 0.
	 *
	 * @since 3.5.0
	 *
	 * @param mixed $time Time string in HH:MM format.
	 * @return int Minutes since midnight.
	 */
	public static function to_minutes( $time ): int {
		if ( ! is_string( $time ) || '' === $time ) {
			return 0;
		}
		$parts = array_map( 'intval', explode( ':', $time, 2 ) );
		return $parts[0] * 60 + ( $parts[1] ?? 0 );
	}

	/**
	 * Checks if a slot is active at the given minute, by its start and end only.
	 *
	 * Mirrors isProgramActive() in player/src/utils/program-schedule.ts. A slot
	 * with end <= start crosses midnight: on its own day it is active from its
	 * start or before its end; as the previous day's slot, before its end.
	 *
	 * @since 3.5.0
	 *
	 * @param mixed $start                Start time HH:MM.
	 * @param mixed $end                  End time HH:MM.
	 * @param int   $current_minutes      Current time as minutes since midnight (0-1439).
	 * @param bool  $is_prev_day_crossing True when evaluating the previous day's slot.
	 * @return bool True if the slot is active.
	 */
	public static function is_slot_active( $start, $end, int $current_minutes, bool $is_prev_day_crossing = false ): bool {
		$start_min = self::to_minutes( $start );
		$end_min   = self::to_minutes( $end );

		if ( $is_prev_day_crossing ) {
			return $end_min <= $start_min && $current_minutes < $end_min;
		}

		if ( $end_min <= $start_min ) {
			return $current_minutes >= $start_min || $current_minutes < $end_min;
		}

		return $current_minutes >= $start_min && $current_minutes < $end_min;
	}
}
