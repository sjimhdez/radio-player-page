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
 * happens on save), and a slot with end <= start crosses midnight (Week_Interval,
 * ADR 0044).
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
	 * Mirrors isProgramActive() in player/src/core/schedule/program-schedule.ts. The slot
	 * is a Week_Interval on a Monday and the minute is on that Monday, or on the
	 * Tuesday for the previous day's slot: a slot with end <= start crosses
	 * midnight, so on its own day it is active from its start (not before its
	 * end, C16) and as the previous day's slot, before its end.
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
		$interval = Week_Interval::from_slot( 'monday', $start, $end );
		$minute   = ( $is_prev_day_crossing ? Week_Interval::DAY : 0 ) + $current_minutes;

		return null !== $interval && Week_Interval::contains( $interval, $minute );
	}
}
