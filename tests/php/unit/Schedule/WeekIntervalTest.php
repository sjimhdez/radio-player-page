<?php
/**
 * Tests for RadioPlayerPage\Schedule\Week_Interval.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Schedule;

use DateTimeImmutable;
use DateTimeZone;
use RadioPlayerPage\Schedule\Week_Interval;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * Slots as intervals of the week (ADR 0044), with the `model` vectors of
 * tests/fixtures/schedule-vectors.json.
 */
final class WeekIntervalTest extends TestCase {

	/**
	 * The `model` section of the shared vectors file.
	 *
	 * @return array<string, list<array<string, mixed>>>
	 */
	private static function model_vectors() {
		static $model = null;
		if ( null === $model ) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local fixture.
			$vectors = json_decode( (string) file_get_contents( RADPLAPAG_TESTS_PLUGIN_DIR . '/tests/fixtures/schedule-vectors.json' ), true );
			$model   = $vectors['model'];
		}

		return $model;
	}

	/**
	 * The vectors of one `model` operation, by ID.
	 *
	 * @param string $operation Operation key (from_slot, contains, …).
	 * @return array<string, array{array<string, mixed>}>
	 */
	private static function vectors_of( $operation ) {
		$out = array();
		foreach ( self::model_vectors()[ $operation ] as $vector ) {
			$out[ $vector['id'] ] = array( $vector );
		}

		return $out;
	}

	/**
	 * Vector slot → interval.
	 *
	 * @param array<string, string> $slot Vector slot (day, start, end).
	 * @return array{start: int, duration: int}
	 */
	private function interval( array $slot ) {
		$interval = Week_Interval::from_slot( $slot['day'], $slot['start'], $slot['end'] );
		$this->assertNotNull( $interval );

		return $interval;
	}

	/**
	 * Vector instant → minute of the week.
	 *
	 * @param array<string, string> $at Vector instant (day, time).
	 * @return int
	 */
	private function minute( array $at ) {
		$minute = Week_Interval::minute_of_week( $at['day'], $at['time'] );
		$this->assertNotNull( $minute );

		return $minute;
	}

	/**
	 * A day and time give their minute of the week, Monday 00:00 being 0.
	 *
	 * @dataProvider data_minute_of_week
	 *
	 * @param string $day      Schedule day key.
	 * @param string $time     Time HH:MM.
	 * @param int    $expected Minute of the week.
	 */
	public function test_minute_of_week( $day, $time, $expected ) {
		$this->assertSame( $expected, Week_Interval::minute_of_week( $day, $time ) );
	}

	/**
	 * Inputs for test_minute_of_week().
	 *
	 * @return array<string, array{string, string, int}>
	 */
	public function data_minute_of_week() {
		return array(
			'monday at midnight'   => array( 'monday', '00:00', 0 ),
			'monday last minute'   => array( 'monday', '23:59', 1439 ),
			'tuesday at midnight'  => array( 'tuesday', '00:00', 1440 ),
			'thursday afternoon'   => array( 'thursday', '15:30', 3 * 1440 + 930 ),
			'sunday last minute'   => array( 'sunday', '23:59', 10079 ),
			'loose time like Time' => array( 'friday', '7:5', 4 * 1440 + 425 ),
		);
	}

	/**
	 * An unknown day key has no minute of the week and no interval.
	 */
	public function test_unknown_day_is_null() {
		$this->assertNull( Week_Interval::minute_of_week( 'Monday', '08:00' ) );
		$this->assertNull( Week_Interval::from_slot( 'lunes', '08:00', '10:00' ) );
	}

	/**
	 * An instant gives its minute of the week in its own timezone.
	 *
	 * @dataProvider data_at
	 *
	 * @param string $local    Local date and time.
	 * @param string $timezone Timezone name or offset.
	 * @param int    $expected Minute of the week.
	 */
	public function test_at( $local, $timezone, $expected ) {
		$this->assertSame( $expected, Week_Interval::at( new DateTimeImmutable( $local, new DateTimeZone( $timezone ) ) ) );
	}

	/**
	 * Inputs for test_at(). 2026-10-19 is a Monday.
	 *
	 * @return array<string, array{string, string, int}>
	 */
	public function data_at() {
		return array(
			'monday at midnight'       => array( '2026-10-19 00:00:00', 'UTC', 0 ),
			'seconds are dropped'      => array( '2026-10-19 09:50:59', 'UTC', 590 ),
			'sunday last minute'       => array( '2026-10-25 23:59:00', 'UTC', 10079 ),
			'sunday to monday'         => array( '2026-10-26 00:00:00', 'UTC', 0 ),
			'negative offset'          => array( '2026-10-19 22:30:00', '-05:00', 1350 ),
			'fractional offset'        => array( '2026-10-20 01:30:00', '+05:30', 1530 ),
			'daylight saving, by name' => array( '2026-10-25 02:30:00', 'Europe/Madrid', 6 * 1440 + 150 ),
		);
	}

	/**
	 * Each slot gives its interval: start in minutes of the week and duration.
	 *
	 * @dataProvider data_from_slot
	 *
	 * @param array<string, mixed> $vector A `model.from_slot` vector.
	 */
	public function test_from_slot( array $vector ) {
		$this->assertSame( $vector['expected'], $this->interval( $vector['slot'] ) );
	}

	/**
	 * The `model.from_slot` vectors.
	 *
	 * @return array<string, array{array<string, mixed>}>
	 */
	public function data_from_slot() {
		return self::vectors_of( 'from_slot' );
	}

	/**
	 * Each slot contains, or not, its instant.
	 *
	 * @dataProvider data_contains
	 *
	 * @param array<string, mixed> $vector A `model.contains` vector.
	 */
	public function test_contains( array $vector ) {
		$this->assertSame( $vector['expected'], Week_Interval::contains( $this->interval( $vector['slot'] ), $this->minute( $vector['at'] ) ) );
	}

	/**
	 * The `model.contains` vectors.
	 *
	 * @return array<string, array{array<string, mixed>}>
	 */
	public function data_contains() {
		return self::vectors_of( 'contains' );
	}

	/**
	 * Each slot starts the given minutes after its instant, wrapping the week.
	 *
	 * @dataProvider data_minutes_until_start
	 *
	 * @param array<string, mixed> $vector A `model.minutes_until_start` vector.
	 */
	public function test_minutes_until_start( array $vector ) {
		$this->assertSame( $vector['expected'], Week_Interval::minutes_until_start( $this->interval( $vector['slot'] ), $this->minute( $vector['at'] ) ) );
	}

	/**
	 * The `model.minutes_until_start` vectors.
	 *
	 * @return array<string, array{array<string, mixed>}>
	 */
	public function data_minutes_until_start() {
		return self::vectors_of( 'minutes_until_start' );
	}

	/**
	 * Two slots overlap, or not, in either order.
	 *
	 * @dataProvider data_overlaps
	 *
	 * @param array<string, mixed> $vector A `model.overlaps` vector.
	 */
	public function test_overlaps( array $vector ) {
		$a = $this->interval( $vector['a'] );
		$b = $this->interval( $vector['b'] );

		$this->assertSame( $vector['expected'], Week_Interval::overlaps( $a, $b ), 'a, b' );
		$this->assertSame( $vector['expected'], Week_Interval::overlaps( $b, $a ), 'b, a' );
	}

	/**
	 * The `model.overlaps` vectors.
	 *
	 * @return array<string, array{array<string, mixed>}>
	 */
	public function data_overlaps() {
		return self::vectors_of( 'overlaps' );
	}

	/**
	 * Times out of the day (loose meta, never saved) still give an interval within the week.
	 *
	 * @dataProvider data_out_of_range_times
	 *
	 * @param string $day      Schedule day key.
	 * @param string $start    Start time.
	 * @param string $end      End time.
	 * @param int    $start_w  Expected start, minutes of the week.
	 * @param int    $duration Expected duration.
	 */
	public function test_out_of_range_times_stay_in_the_week( $day, $start, $end, $start_w, $duration ) {
		$this->assertSame(
			array(
				'start'    => $start_w,
				'duration' => $duration,
			),
			Week_Interval::from_slot( $day, $start, $end )
		);
	}

	/**
	 * Inputs for test_out_of_range_times_stay_in_the_week().
	 *
	 * @return array<string, array{string, string, string, int, int}>
	 */
	public function data_out_of_range_times() {
		return array(
			'24:00 on sunday is monday 00:00' => array( 'sunday', '24:00', '01:00', 0, 60 ),
			'negative start'                  => array( 'monday', '-1:30', '01:00', 10050, 90 ),
			'end past the day'                => array( 'monday', '22:00', '25:00', 1320, 180 ),
		);
	}
}
