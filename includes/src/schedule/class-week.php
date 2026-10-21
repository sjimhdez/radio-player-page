<?php
/**
 * Days of the week for the station schedule.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\Schedule;

use DateTimeImmutable;

defined( 'ABSPATH' ) || exit;

/**
 * Schedule day keys, PHP day numbers (format `w`, 0 = Sunday) and the local
 * day and time of an instant.
 *
 * @since 3.5.0
 */
final class Week {

	/**
	 * Schedule day keys, Monday to Sunday.
	 */
	const KEYS = array( 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday' );

	/**
	 * Returns the PHP day number of a schedule day key.
	 *
	 * @since 3.5.0
	 *
	 * @param string $key Schedule day key (monday ... sunday).
	 * @return int|null 0 (Sunday) to 6 (Saturday), or null for an unknown key.
	 */
	public static function php_day_for_key( string $key ): ?int {
		$index = array_search( $key, self::KEYS, true );
		if ( false === $index ) {
			return null;
		}
		return ( $index + 1 ) % 7;
	}

	/**
	 * Returns the schedule day key of a PHP day number.
	 *
	 * @since 3.5.0
	 *
	 * @param int $php_day 0 (Sunday) to 6 (Saturday).
	 * @return string|null Schedule day key, or null out of 0-6.
	 */
	public static function key_for_php_day( int $php_day ): ?string {
		if ( $php_day < 0 || $php_day > 6 ) {
			return null;
		}
		return self::KEYS[ ( $php_day + 6 ) % 7 ];
	}

	/**
	 * Returns the day and minutes since midnight of an instant, in its own timezone.
	 *
	 * @since 3.5.0
	 *
	 * @param DateTimeImmutable $now Instant, in the station's timezone.
	 * @return array{day: int, minutes: int} PHP day number (0 = Sunday) and minutes (0-1439).
	 */
	public static function local_day_and_minutes( DateTimeImmutable $now ): array {
		return array(
			'day'     => (int) $now->format( 'w' ),
			'minutes' => (int) $now->format( 'G' ) * 60 + (int) $now->format( 'i' ),
		);
	}
}
