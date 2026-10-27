<?php
/**
 * Characterization of the site time zone in radplapag_get_now_playing_for_station()
 * (3.4.2): a named zone with daylight saving time. Also the zone that reaches the
 * player in RADPLAPAG_CONFIG (C9, ADR 0046).
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Schedule;

use DateTime;
use DateTimeZone;
use RadioPlayerPage\Player\Globals_Builder;
use RadioPlayerPage\Tests\Integration\Support\Factory;
use RadioPlayerPage\WP\Clock;
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
	 * With `timezone_string` the player gets the zone next to the offset (C9, ADR 0046).
	 */
	public function test_config_prints_the_site_zone() {
		update_option( 'timezone_string', 'America/New_York' );
		update_option( 'gmt_offset', '' );

		$this->assertSame( 'America/New_York', $this->config()['timezone'] );
	}

	/**
	 * With a manual offset (`gmt_offset`) there is no zone: the player keeps timezoneOffset.
	 */
	public function test_config_prints_no_zone_with_a_manual_offset() {
		update_option( 'timezone_string', '' );
		update_option( 'gmt_offset', -3.5 );

		$config = $this->config();
		$this->assertNull( $config['timezone'] );
		$this->assertSame( -3.5, $config['timezoneOffset'] );
	}

	/**
	 * RADPLAPAG_CONFIG as radplapag_output_clean_page() builds it, with the time of WP\Clock.
	 *
	 * @return array
	 */
	private function config() {
		return Globals_Builder::config( array( 'stream_url' => 'https://example.com/stream.mp3' ), array(), 'Site', Clock::now(), 'sanitize_key' );
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
