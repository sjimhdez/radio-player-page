<?php
/**
 * Server clock for the integration tests (spec 0002 §4.3).
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Support;

use DateTime;
use DateTimeZone;
use PHPUnit\Framework\AssertionFailedError;
use RuntimeException;

/**
 * Puts the site on a given local minute without touching the plugin.
 *
 * The plugin reads the time with `new DateTime( 'now', wp_timezone() )` and has no
 * seam, so the clock cannot be frozen. Instead, Clock::set() keeps the real UTC time,
 * sets `gmt_offset` (with an empty `timezone_string`) so that the local minute is the
 * requested one, and reports how far today's local weekday is from the requested day.
 * Tests then rotate their schedule by that amount (rotate_schedule(), rotate_day()).
 *
 * With $exact_day, the offset may span several days instead (up to ±96 h, which
 * PHP and wp_timezone_string() accept, though no real site uses it), so that the local
 * day is the requested one and the rotation is the identity. Use it where the result
 * depends on the real weekday beyond today and yesterday, such as the Monday-to-Sunday
 * order of the blocks (K73).
 *
 * Seconds are not controlled: if the minute changes while a test runs, Clock::run()
 * repeats it once.
 */
final class Clock {

	const DAYS = array( 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday' );

	/**
	 * Requested local time, HH:MM.
	 *
	 * @var string
	 */
	private $time;

	/**
	 * UTC offset applied, in minutes: in (-720, 720], or within ±96 h with $exact_day.
	 *
	 * @var int
	 */
	private $offset_minutes;

	/**
	 * Days to add to a vector day to get the real local day (0–6).
	 *
	 * @var int
	 */
	private $shift;

	/**
	 * Builds a clock; use Clock::set() or Clock::run().
	 *
	 * @param string $time           Requested local time, HH:MM.
	 * @param int    $offset_minutes UTC offset applied, in minutes.
	 * @param int    $shift          Days from the vector day to the local day.
	 */
	private function __construct( $time, $offset_minutes, $shift ) {
		$this->time           = $time;
		$this->offset_minutes = $offset_minutes;
		$this->shift          = $shift;
	}

	/**
	 * Runs $check with the site on $day at $time, and repeats it once if the minute
	 * changed meanwhile. A failure while the minute still holds is rethrown.
	 *
	 * @param string   $day       Vector day key (monday … sunday).
	 * @param string   $time      Vector local time, HH:MM.
	 * @param callable $check     Receives the Clock; its return value is returned.
	 * @param bool     $exact_day Whether the local day must be $day itself (no rotation).
	 * @return mixed
	 * @throws AssertionFailedError When $check fails while the minute holds.
	 * @throws RuntimeException When the minute changes on both attempts.
	 */
	public static function run( $day, $time, callable $check, $exact_day = false ) {
		for ( $attempt = 1; $attempt <= 2; $attempt++ ) {
			$clock = self::set( $day, $time, $exact_day );

			try {
				$result = $check( $clock );
			} catch ( AssertionFailedError $e ) {
				if ( $clock->holds() ) {
					throw $e;
				}
				continue;
			}

			if ( $clock->holds() ) {
				return $result;
			}
		}

		throw new RuntimeException( esc_html( "The minute changed twice while testing $day $time." ) );
	}

	/**
	 * Sets `gmt_offset` so that the local time is $time and returns the clock.
	 *
	 * @param string $day       Vector day key (monday … sunday).
	 * @param string $time      Vector local time, HH:MM.
	 * @param bool   $exact_day Whether the local day must be $day itself (no rotation).
	 * @return self
	 * @throws RuntimeException When the time cannot be set exactly.
	 */
	public static function set( $day, $time, $exact_day = false ) {
		$vector_day = array_search( $day, self::DAYS, true );
		if ( false === $vector_day || ! preg_match( '/^([01]\d|2[0-3]):([0-5]\d)$/', $time, $m ) ) {
			throw new RuntimeException( esc_html( "Invalid clock target: $day $time." ) );
		}
		$target = (int) $m[1] * 60 + (int) $m[2];

		// The UTC minute can change between reading it and checking it: try twice.
		for ( $attempt = 1; $attempt <= 2; $attempt++ ) {
			$utc    = new DateTime( 'now', new DateTimeZone( 'UTC' ) );
			$offset = $target - ( (int) $utc->format( 'G' ) * 60 + (int) $utc->format( 'i' ) );
			if ( $exact_day ) {
				// Nearest $day to today's UTC day: from 3 days back to 3 days ahead.
				$days    = ( $vector_day - array_search( strtolower( $utc->format( 'l' ) ), self::DAYS, true ) + 7 ) % 7;
				$offset += ( $days > 3 ? $days - 7 : $days ) * 1440;
			} elseif ( $offset > 720 ) {
				$offset -= 1440;
			} elseif ( $offset <= -720 ) {
				$offset += 1440;
			}

			update_option( 'timezone_string', '' );
			update_option( 'gmt_offset', self::gmt_offset_for( $offset ) );

			$local = new DateTime( 'now', wp_timezone() );
			if ( $local->format( 'H:i' ) !== $time ) {
				continue;
			}
			if ( wp_timezone()->getOffset( $utc ) !== $offset * 60 ) {
				throw new RuntimeException( esc_html( 'wp_timezone() does not apply the offset exactly: ' . wp_timezone_string() ) );
			}

			$local_day = array_search( strtolower( $local->format( 'l' ) ), self::DAYS, true );
			if ( $exact_day && $local_day !== $vector_day ) {
				continue;
			}

			return new self( $time, $offset, ( $local_day - $vector_day + 7 ) % 7 );
		}

		throw new RuntimeException( esc_html( "Could not set the clock to $time." ) );
	}

	/**
	 * Value for `gmt_offset` that wp_timezone_string() turns into exactly $minutes.
	 *
	 * The minutes in wp_timezone_string() are printed with `%02d`, which truncates: 17/60 h
	 * would come out as 16 minutes. Adding half a minute makes the truncation land on
	 * the right minute.
	 *
	 * @param int $minutes Offset in minutes.
	 * @return float|int
	 */
	private static function gmt_offset_for( $minutes ) {
		if ( 0 === $minutes ) {
			return 0;
		}
		$sign = $minutes < 0 ? -1 : 1;
		$abs  = abs( $minutes );

		return $sign * ( intdiv( $abs, 60 ) + ( $abs % 60 + 0.5 ) / 60 );
	}

	/**
	 * Whether the local minute is still the requested one.
	 *
	 * @return bool
	 */
	public function holds() {
		return ( new DateTime( 'now', wp_timezone() ) )->format( 'H:i' ) === $this->time;
	}

	/**
	 * UTC offset applied, in minutes.
	 *
	 * @return int
	 */
	public function offset_minutes() {
		return $this->offset_minutes;
	}

	/**
	 * Real local day key for a vector day key.
	 *
	 * @param string $day Vector day key.
	 * @return string
	 */
	public function rotate_day( $day ) {
		return self::DAYS[ ( array_search( $day, self::DAYS, true ) + $this->shift ) % 7 ];
	}

	/**
	 * Vector day key for a real local day key (inverse of rotate_day()).
	 *
	 * @param string $day Real local day key.
	 * @return string
	 */
	public function unrotate_day( $day ) {
		return self::DAYS[ ( array_search( $day, self::DAYS, true ) - $this->shift + 7 ) % 7 ];
	}

	/**
	 * Moves each day of a schedule to its real local day; slots are untouched.
	 * Keys that are not day keys are kept as they are.
	 *
	 * @param array $schedule Schedule keyed by vector day.
	 * @return array
	 */
	public function rotate_schedule( array $schedule ) {
		$rotated = array();
		foreach ( $schedule as $day => $slots ) {
			$key             = in_array( $day, self::DAYS, true ) ? $this->rotate_day( $day ) : $day;
			$rotated[ $key ] = $slots;
		}

		return $rotated;
	}
}
