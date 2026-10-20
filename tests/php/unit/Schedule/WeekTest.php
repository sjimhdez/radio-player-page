<?php
/**
 * Tests for RadioPlayerPage\Schedule\Week.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Schedule;

use DateTimeImmutable;
use DateTimeZone;
use RadioPlayerPage\Schedule\Week;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * Schedule day keys, PHP day numbers (`w`, 0 = Sunday) and the station-local day and time.
 */
final class WeekTest extends TestCase {

	/**
	 * The keys run Monday to Sunday, as radplapag_get_schedule_day_keys_and_labels() lists them.
	 */
	public function test_keys_run_monday_to_sunday() {
		$this->assertSame(
			array( 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday' ),
			Week::KEYS
		);
	}

	/**
	 * Each key maps to its PHP day number and back.
	 *
	 * @dataProvider data_key_and_php_day
	 *
	 * @param string $key     Schedule day key.
	 * @param int    $php_day PHP day number.
	 */
	public function test_key_and_php_day( $key, $php_day ) {
		$this->assertSame( $php_day, Week::php_day_for_key( $key ) );
		$this->assertSame( $key, Week::key_for_php_day( $php_day ) );
	}

	/**
	 * Inputs for test_key_and_php_day().
	 *
	 * @return array<string, array{string, int}>
	 */
	public function data_key_and_php_day() {
		return array(
			'sunday'    => array( 'sunday', 0 ),
			'monday'    => array( 'monday', 1 ),
			'tuesday'   => array( 'tuesday', 2 ),
			'wednesday' => array( 'wednesday', 3 ),
			'thursday'  => array( 'thursday', 4 ),
			'friday'    => array( 'friday', 5 ),
			'saturday'  => array( 'saturday', 6 ),
		);
	}

	/**
	 * Unknown keys and day numbers out of 0–6 map to null.
	 */
	public function test_unknown_key_or_day_is_null() {
		$this->assertNull( Week::php_day_for_key( 'Monday' ) );
		$this->assertNull( Week::php_day_for_key( '' ) );
		$this->assertNull( Week::key_for_php_day( -1 ) );
		$this->assertNull( Week::key_for_php_day( 7 ) );
	}

	/**
	 * The day and minutes are read in the timezone of the given instant.
	 *
	 * @dataProvider data_local_day_and_minutes
	 *
	 * @param string $local    Local date and time.
	 * @param string $timezone Timezone name or offset.
	 * @param int    $day      Expected PHP day number.
	 * @param int    $minutes  Expected minutes since midnight.
	 */
	public function test_local_day_and_minutes( $local, $timezone, $day, $minutes ) {
		$now = new DateTimeImmutable( $local, new DateTimeZone( $timezone ) );
		$this->assertSame(
			array(
				'day'     => $day,
				'minutes' => $minutes,
			),
			Week::local_day_and_minutes( $now )
		);
	}

	/**
	 * Inputs for test_local_day_and_minutes(). 2026-10-19 is a Monday.
	 *
	 * @return array<string, array{string, string, int, int}>
	 */
	public function data_local_day_and_minutes() {
		return array(
			'midnight'                 => array( '2026-10-19 00:00:00', 'UTC', 1, 0 ),
			'last minute of the day'   => array( '2026-10-19 23:59:59', 'UTC', 1, 1439 ),
			'next day at midnight'     => array( '2026-10-20 00:00:00', 'UTC', 2, 0 ),
			'sunday to monday: before' => array( '2026-10-18 23:59:00', 'UTC', 0, 1439 ),
			'sunday to monday: after'  => array( '2026-10-19 00:00:00', 'UTC', 1, 0 ),
			'seconds are dropped'      => array( '2026-10-19 09:50:59', 'UTC', 1, 590 ),
			'negative offset'          => array( '2026-10-19 22:30:00', '-05:00', 1, 1350 ),
			'fractional offset'        => array( '2026-10-20 01:30:00', '+05:30', 2, 90 ),
		);
	}

	/**
	 * The same instant gives the local day and time of each timezone (the "tz" vectors, as PHP sees them).
	 *
	 * @dataProvider data_tz_vectors
	 *
	 * @param string $utc      Instant in UTC (ISO 8601).
	 * @param string $offset   Station offset, as +HH:MM.
	 * @param int    $day      Expected PHP day number.
	 * @param int    $minutes  Expected minutes since midnight.
	 */
	public function test_tz_vectors( $utc, $offset, $day, $minutes ) {
		$now = ( new DateTimeImmutable( $utc ) )->setTimezone( new DateTimeZone( $offset ) );
		$this->assertSame(
			array(
				'day'     => $day,
				'minutes' => $minutes,
			),
			Week::local_day_and_minutes( $now )
		);
	}

	/**
	 * The "tz" vectors of tests/fixtures/schedule-vectors.json, with their offset in hours as +HH:MM.
	 *
	 * @return array<string, array{string, string, int, int}>
	 */
	public function data_tz_vectors() {
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local fixture.
		$json    = (string) file_get_contents( RADPLAPAG_TESTS_PLUGIN_DIR . '/tests/fixtures/schedule-vectors.json' );
		$vectors = json_decode( $json, true );
		$data    = array();
		foreach ( $vectors['tz'] as $vector ) {
			$offset_minutes        = (int) round( $vector['timezoneOffset'] * 60 );
			$offset                = sprintf( '%s%02d:%02d', $offset_minutes < 0 ? '-' : '+', intdiv( abs( $offset_minutes ), 60 ), abs( $offset_minutes ) % 60 );
			$data[ $vector['id'] ] = array( $vector['utc'], $offset, $vector['expected']['dayOfWeek'], $vector['expected']['currentTime'] );
		}
		return $data;
	}

	/**
	 * With the site timezone, PHP follows daylight saving time on every request (C9 is player only).
	 *
	 * @dataProvider data_daylight_saving_time
	 *
	 * @param string $utc      Instant in UTC (ISO 8601).
	 * @param string $timezone Timezone name.
	 * @param int    $day      Expected PHP day number.
	 * @param int    $minutes  Expected minutes since midnight.
	 */
	public function test_daylight_saving_time( $utc, $timezone, $day, $minutes ) {
		$now = ( new DateTimeImmutable( $utc ) )->setTimezone( new DateTimeZone( $timezone ) );
		$this->assertSame(
			array(
				'day'     => $day,
				'minutes' => $minutes,
			),
			Week::local_day_and_minutes( $now )
		);
	}

	/**
	 * Inputs for test_daylight_saving_time(). Europe/Madrid switches at 01:00 UTC on 2026-03-29 and 2026-10-25 (Sundays).
	 *
	 * @return array<string, array{string, string, int, int}>
	 */
	public function data_daylight_saving_time() {
		return array(
			'madrid: before spring forward' => array( '2026-03-29T00:59:00Z', 'Europe/Madrid', 0, 119 ),
			'madrid: after spring forward'  => array( '2026-03-29T01:00:00Z', 'Europe/Madrid', 0, 180 ),
			'madrid: before fall back'      => array( '2026-10-25T00:59:00Z', 'Europe/Madrid', 0, 179 ),
			'madrid: after fall back'       => array( '2026-10-25T01:00:00Z', 'Europe/Madrid', 0, 120 ),
			'madrid: summer day change'     => array( '2026-07-05T22:00:00Z', 'Europe/Madrid', 1, 0 ),
			'vector tz-dst-start, correct'  => array( '2026-03-08T08:30:00Z', 'America/New_York', 0, 270 ),
		);
	}
}
