<?php
/**
 * The current time in the site's timezone.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\WP;

use DateTimeImmutable;

defined( 'ABSPATH' ) || exit;

/**
 * Gives the pure core the time it never reads on its own.
 *
 * @since 3.5.0
 */
final class Clock {

	/**
	 * Now, in the timezone of the site settings (wp_timezone()).
	 *
	 * @since 3.5.0
	 *
	 * @return DateTimeImmutable
	 */
	public static function now(): DateTimeImmutable {
		return new DateTimeImmutable( 'now', wp_timezone() );
	}
}
