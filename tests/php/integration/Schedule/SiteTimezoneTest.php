<?php
/**
 * Characterization of the site time zone in radplapag_get_now_playing_for_station()
 * (3.4.2): a named zone with daylight saving time.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Schedule;

use DateTime;
use DateTimeZone;
use RadioPlayerPage\Tests\Integration\Support\Factory;
use WP_UnitTestCase;

/**
 * The server reads the time with wp_timezone() on every request, so a `timezone_string`
 * with daylight saving time is followed (spec 0002 §4.2: DST in integration). The
 * vectors use `gmt_offset` (Support/Clock), which has no DST.
 */
final class SiteTimezoneTest extends WP_UnitTestCase {

	/**
	 * Zones with opposite DST seasons: at any date at least one of them is on DST.
	 */
	const DST_ZONES = array( 'Europe/Madrid', 'Australia/Sydney' );

	/**
	 * A slot at the local DST hour is on air; the slot at the same hour in standard
	 * time (one hour earlier) is not.
	 */
	public function test_follows_daylight_saving_time_of_the_site_zone() {
		$zone = $this->zone_on_dst();
		update_option( 'timezone_string', $zone );
		update_option( 'gmt_offset', '' );
		// Retry once if the hour changes between building the grid and reading it.
		for ( $attempt = 0; $attempt < 2; $attempt++ ) {
			$before = new DateTime( 'now', new DateTimeZone( $zone ) );
			$result = $this->now_playing_around( $before );
			$after  = new DateTime( 'now', new DateTimeZone( $zone ) );
			if ( $before->format( 'Y-m-d H' ) === $after->format( 'Y-m-d H' ) ) {
				break;
			}
		}

		$this->assertNotNull( $result['current'], $zone );
		$this->assertSame( 'DST hour', $result['current']['name'], $zone );
	}

	/**
	 * First zone of DST_ZONES that is on daylight saving time now.
	 *
	 * @return string
	 */
	private function zone_on_dst() {
		foreach ( self::DST_ZONES as $zone ) {
			if ( '1' === ( new DateTime( 'now', new DateTimeZone( $zone ) ) )->format( 'I' ) ) {
				return $zone;
			}
		}
		$this->fail( 'No zone of DST_ZONES is on daylight saving time now.' );
	}

	/**
	 * Builds a station with one program in the local DST hour and another in the
	 * standard-time hour, and reads what is on air.
	 *
	 * @param DateTime $dst Now, in the DST zone.
	 * @return array
	 */
	private function now_playing_around( DateTime $dst ) {
		$standard = clone $dst;
		$standard->setTimezone( new DateTimeZone( sprintf( '%+03d:00', intdiv( $dst->getOffset() - HOUR_IN_SECONDS, HOUR_IN_SECONDS ) ) ) );

		$factory  = new Factory();
		$schedule = array();
		foreach ( array(
			'DST hour'      => $dst,
			'Standard hour' => $standard,
		) as $name => $time ) {
			$hour               = (int) $time->format( 'G' );
			$day                = strtolower( $time->format( 'l' ) );
			$schedule[ $day ][] = array(
				'program_id' => (string) $factory->program( $name ),
				'start'      => sprintf( '%02d:00', $hour ),
				'end'        => sprintf( '%02d:00', ( $hour + 1 ) % 24 ),
				'is_rerun'   => false,
			);
		}
		foreach ( get_posts(
			array(
				'post_type'   => 'radplapag_station',
				'fields'      => 'ids',
				'post_status' => 'any',
			)
		) as $old ) {
			wp_delete_post( $old, true );
		}
		$factory->station( 'Station', array( 'schedule' => $schedule ) );

		return radplapag_get_now_playing_for_station( 0 );
	}
}
