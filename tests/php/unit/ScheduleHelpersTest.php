<?php
/**
 * Characterization of the pure schedule helpers in includes/radplapag-schedule-block.php.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit;

use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * Pins radplapag_parse_time_to_minutes() and radplapag_is_slot_active() as of 3.4.2.
 */
final class ScheduleHelpersTest extends TestCase {

	/**
	 * Loads the helpers file (it only calls __() inside functions, so it loads without WordPress).
	 */
	public static function set_up_before_class() {
		parent::set_up_before_class();
		require_once RADPLAPAG_TESTS_PLUGIN_DIR . '/includes/radplapag-schedule-block.php';
	}

	/**
	 * Well-formed and loosely formed times parse to minutes since midnight.
	 *
	 * @dataProvider data_parse_time_to_minutes
	 *
	 * @param mixed $time     Input.
	 * @param int   $expected Minutes.
	 */
	public function test_parse_time_to_minutes( $time, $expected ) {
		$this->assertSame( $expected, radplapag_parse_time_to_minutes( $time ) );
	}

	/**
	 * Inputs for test_parse_time_to_minutes().
	 *
	 * @return array
	 */
	public function data_parse_time_to_minutes() {
		return array(
			'midnight'                => array( '00:00', 0 ),
			'last minute'             => array( '23:59', 1439 ),
			'regular'                 => array( '07:05', 425 ),
			'no leading zeros'        => array( '7:5', 425 ),
			'24:00 is not rejected'   => array( '24:00', 1440 ),
			'hours only'              => array( '10', 600 ),
			'seconds are dropped'     => array( '12:30:45', 750 ),
			'negative hour'           => array( '-1:30', -30 ),
			'garbage'                 => array( 'abc', 0 ),
			'garbage minutes'         => array( '08:xx', 480 ),
			'empty string'            => array( '', 0 ),
			'null is not a string'    => array( null, 0 ),
			'integer is not a string' => array( 600, 0 ),
		);
	}

	/**
	 * A slot within the day is active from its start (inclusive) to its end (exclusive).
	 *
	 * @dataProvider data_slot_within_the_day
	 *
	 * @param int  $now      Current minutes.
	 * @param bool $expected Whether the slot is active.
	 */
	public function test_slot_within_the_day( $now, $expected ) {
		$this->assertSame( $expected, radplapag_is_slot_active( '06:00', '10:00', $now ) );
	}

	/**
	 * Inputs for test_slot_within_the_day().
	 *
	 * @return array
	 */
	public function data_slot_within_the_day() {
		return array(
			'before start' => array( 359, false ),
			'at start'     => array( 360, true ),
			'inside'       => array( 480, true ),
			'last minute'  => array( 599, true ),
			'at end'       => array( 600, false ),
		);
	}

	/**
	 * A slot crossing midnight is active on its own day from its start until midnight.
	 *
	 * @dataProvider data_slot_crossing_midnight_today
	 *
	 * @param int  $now      Current minutes.
	 * @param bool $expected Whether the slot is active.
	 */
	public function test_slot_crossing_midnight_today( $now, $expected ) {
		$this->assertSame( $expected, radplapag_is_slot_active( '22:00', '02:00', $now ) );
	}

	/**
	 * Inputs for test_slot_crossing_midnight_today().
	 *
	 * @return array
	 */
	public function data_slot_crossing_midnight_today() {
		return array(
			'before start' => array( 1319, false ),
			'at start'     => array( 1320, true ),
			'late evening' => array( 1380, true ),
			'last minute'  => array( 1439, true ),
			'after end'    => array( 120, false ),
		);
	}

	/**
	 * A slot crossing midnight is not active in the early morning of its own day.
	 *
	 * That part belongs to the previous day's occurrence (C16 in docs/known-issues.md, ADR 0044).
	 *
	 * @dataProvider data_slot_crossing_midnight_is_not_active_early_on_its_own_day
	 *
	 * @param string $start Start.
	 * @param string $end   End.
	 * @param int    $now   Current minutes.
	 */
	public function test_slot_crossing_midnight_is_not_active_early_on_its_own_day( $start, $end, $now ) {
		$this->assertFalse( radplapag_is_slot_active( $start, $end, $now ) );
	}

	/**
	 * Inputs for test_slot_crossing_midnight_is_not_active_early_on_its_own_day().
	 *
	 * @return array
	 */
	public function data_slot_crossing_midnight_is_not_active_early_on_its_own_day() {
		return array(
			'vector 13: C on monday 00:10' => array( '22:00', '02:00', 10 ),
			'vector 14: C on monday 00:30' => array( '22:00', '02:00', 30 ),
			'midnight'                     => array( '22:00', '02:00', 0 ),
			'C3-4: 24 h slot before start' => array( '08:00', '08:00', 420 ),
		);
	}

	/**
	 * The previous day's slot crossing midnight is active until its end (exclusive).
	 *
	 * @dataProvider data_previous_day_crossing
	 *
	 * @param string $start    Start.
	 * @param string $end      End.
	 * @param int    $now      Current minutes.
	 * @param bool   $expected Whether the slot is active.
	 */
	public function test_previous_day_crossing( $start, $end, $now, $expected ) {
		$this->assertSame( $expected, radplapag_is_slot_active( $start, $end, $now, true ) );
	}

	/**
	 * Inputs for test_previous_day_crossing().
	 *
	 * @return array
	 */
	public function data_previous_day_crossing() {
		return array(
			'midnight'                   => array( '22:00', '02:00', 0, true ),
			'before end'                 => array( '22:00', '02:00', 119, true ),
			'at end'                     => array( '22:00', '02:00', 120, false ),
			'evening is not yesterday'   => array( '22:00', '02:00', 1380, false ),
			'slot not crossing midnight' => array( '06:00', '10:00', 30, false ),
			'24 h slot before its end'   => array( '08:00', '08:00', 479, true ),
			'24 h slot at its end'       => array( '08:00', '08:00', 480, false ),
		);
	}

	/**
	 * A slot with start == end is treated as crossing midnight (24 h) on its own day.
	 *
	 * @dataProvider data_start_equals_end_today
	 *
	 * @param int  $now      Current minutes.
	 * @param bool $expected Whether the slot is active.
	 */
	public function test_start_equals_end_today( $now, $expected ) {
		$this->assertSame( $expected, radplapag_is_slot_active( '08:00', '08:00', $now ) );
	}

	/**
	 * Inputs for test_start_equals_end_today().
	 *
	 * @return array
	 */
	public function data_start_equals_end_today() {
		return array(
			'at start' => array( 480, true ),
			'evening'  => array( 1380, true ),
		);
	}

	/**
	 * Unparseable times count as 00:00, so the slot becomes a 24 h slot from midnight.
	 */
	public function test_unparseable_times_make_a_slot_from_midnight() {
		$this->assertTrue( radplapag_is_slot_active( '', '', 0 ) );
		$this->assertTrue( radplapag_is_slot_active( 'abc', 'xyz', 1439 ) );
	}
}
