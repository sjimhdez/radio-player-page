<?php
/**
 * Slots as intervals of the week for the station schedule.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\Schedule;

use DateTimeImmutable;

defined( 'ABSPATH' ) || exit;

/**
 * The week-interval model of the schedule (ADR 0044).
 *
 * A minute of the week is day × 1440 + minute, with Monday = 0 and Sunday = 6
 * (0 ≤ w < 10080). A slot is the interval [start, start + duration) of the week,
 * wrapping at the end of Sunday: end > start lasts end - start, end < start
 * crosses midnight and end == start lasts 24 hours. Mirrors
 * player/src/utils/week-interval.ts and radplapagScheduleRules in the admin; the
 * three pass the `model` vectors of tests/fixtures/schedule-vectors.json.
 *
 * @since 3.5.0
 */
final class Week_Interval {

	/**
	 * Minutes in a day.
	 */
	const DAY = 1440;

	/**
	 * Minutes in a week.
	 */
	const WEEK = 10080;

	/**
	 * Returns the minute of the week of an instant, in its own timezone.
	 *
	 * @since 3.5.0
	 *
	 * @param DateTimeImmutable $now Instant, in the station's timezone.
	 * @return int Minute of the week (0-10079).
	 */
	public static function at( DateTimeImmutable $now ): int {
		return ( (int) $now->format( 'N' ) - 1 ) * self::DAY + (int) $now->format( 'G' ) * 60 + (int) $now->format( 'i' );
	}

	/**
	 * Returns the minute of the week of a schedule day and a time of day.
	 *
	 * The time is parsed loosely by Time::to_minutes(); a result out of the week
	 * wraps into it.
	 *
	 * @since 3.5.0
	 *
	 * @param string $day  Schedule day key (monday ... sunday).
	 * @param mixed  $time Time HH:MM.
	 * @return int|null Minute of the week (0-10079), or null for an unknown day.
	 */
	public static function minute_of_week( string $day, $time ): ?int {
		$index = array_search( $day, Week::KEYS, true );
		if ( false === $index ) {
			return null;
		}
		return self::mod( $index * self::DAY + Time::to_minutes( $time ), self::WEEK );
	}

	/**
	 * Returns the interval of a slot.
	 *
	 * @since 3.5.0
	 *
	 * @param string $day   Schedule day key the slot belongs to.
	 * @param mixed  $start Start time HH:MM.
	 * @param mixed  $end   End time HH:MM.
	 * @return array{start: int, duration: int}|null Start as minute of the week and
	 *                                               duration in minutes (1-1440), or
	 *                                               null for an unknown day.
	 */
	public static function from_slot( string $day, $start, $end ): ?array {
		$start_w = self::minute_of_week( $day, $start );
		if ( null === $start_w ) {
			return null;
		}
		$duration = self::mod( Time::to_minutes( $end ) - Time::to_minutes( $start ), self::DAY );
		return array(
			'start'    => $start_w,
			'duration' => 0 === $duration ? self::DAY : $duration,
		);
	}

	/**
	 * Checks if an interval contains a minute of the week (start inclusive, end exclusive).
	 *
	 * @since 3.5.0
	 *
	 * @param array{start: int, duration: int} $interval Interval from from_slot().
	 * @param int                              $minute   Minute of the week.
	 * @return bool True if the slot is on air at that minute.
	 */
	public static function contains( array $interval, int $minute ): bool {
		return self::mod( $minute - $interval['start'], self::WEEK ) < $interval['duration'];
	}

	/**
	 * Returns the minutes from a minute of the week to the next start of an interval.
	 *
	 * @since 3.5.0
	 *
	 * @param array{start: int, duration: int} $interval Interval from from_slot().
	 * @param int                              $minute   Minute of the week.
	 * @return int 0 at its start, up to 10079 just after it.
	 */
	public static function minutes_until_start( array $interval, int $minute ): int {
		return self::mod( $interval['start'] - $minute, self::WEEK );
	}

	/**
	 * Checks if two intervals overlap, wrapping at the end of the week.
	 *
	 * Two intervals that only touch (one ends when the other starts) do not.
	 *
	 * @since 3.5.0
	 *
	 * @param array{start: int, duration: int} $a Interval from from_slot().
	 * @param array{start: int, duration: int} $b Interval from from_slot().
	 * @return bool True if they share at least one minute.
	 */
	public static function overlaps( array $a, array $b ): bool {
		return self::contains( $a, $b['start'] ) || self::contains( $b, $a['start'] );
	}

	/**
	 * Returns the non-negative remainder of a division.
	 *
	 * @param int $value   Dividend.
	 * @param int $modulus Divisor (positive).
	 * @return int 0 to $modulus - 1.
	 */
	private static function mod( int $value, int $modulus ): int {
		return ( ( $value % $modulus ) + $modulus ) % $modulus;
	}
}
