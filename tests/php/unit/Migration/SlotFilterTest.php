<?php
/**
 * Tests for RadioPlayerPage\Migration\Slot_Filter.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Migration;

use RadioPlayerPage\Migration\Slot_Filter;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * The greedy filter of the migrated slots (D3 of spec 0008): slots are accepted one by
 * one, Monday to Sunday and in their order within the day, and the one that does not
 * validate with those already accepted is dropped.
 *
 * @see docs/known-issues.md K30
 */
final class SlotFilterTest extends TestCase {

	/**
	 * Program post ID => name.
	 */
	const NAMES = array(
		1 => 'Late',
		2 => 'Early',
		3 => 'Morning',
	);

	/**
	 * A valid schedule is kept whole, with nothing dropped.
	 */
	public function test_valid_schedule_is_kept() {
		$schedule = array(
			'monday'  => array( self::slot( 1, '07:00', '09:00' ), self::slot( 2, '09:00', '10:00' ) ),
			'tuesday' => array( self::slot( 3, '23:00', '01:00' ) ),
		);

		$this->assertSame(
			array(
				'schedule' => $schedule,
				'dropped'  => array(),
			),
			Slot_Filter::filter( $schedule, self::NAMES )
		);
	}

	/**
	 * In a same-day overlap, the slot listed first wins.
	 */
	public function test_same_day_overlap_drops_the_later_slot() {
		$result = Slot_Filter::filter(
			array(
				'monday' => array(
					self::slot( 1, '07:00', '09:00' ),
					self::slot( 2, '08:00', '10:00' ),
					self::slot( 3, '10:00', '11:00' ),
				),
			),
			self::NAMES
		);

		$this->assertSame( array( 'monday' => array( self::slot( 1, '07:00', '09:00' ), self::slot( 3, '10:00', '11:00' ) ) ), $result['schedule'] );
		$this->assertSame( array( self::dropped( 'monday', '08:00', '10:00', 'Early' ) ), $result['dropped'] );
	}

	/**
	 * The slot listed first wins even when it starts later in the day.
	 */
	public function test_same_day_overlap_keeps_the_listed_order() {
		$result = Slot_Filter::filter(
			array(
				'monday' => array(
					self::slot( 1, '08:00', '10:00' ),
					self::slot( 2, '07:00', '09:00' ),
				),
			),
			self::NAMES
		);

		$this->assertSame( array( 'monday' => array( self::slot( 1, '08:00', '10:00' ) ) ), $result['schedule'] );
		$this->assertSame( array( self::dropped( 'monday', '07:00', '09:00', 'Early' ) ), $result['dropped'] );
	}

	/**
	 * Monday 23:00–02:00 and Tuesday 01:00–03:00 (3.2.x): Monday's slot stays.
	 */
	public function test_cross_day_overlap_drops_the_next_day_slot() {
		$result = Slot_Filter::filter(
			array(
				'tuesday' => array( self::slot( 2, '01:00', '03:00' ) ),
				'monday'  => array( self::slot( 1, '23:00', '02:00' ) ),
			),
			self::NAMES
		);

		$this->assertSame( array( 'monday' => array( self::slot( 1, '23:00', '02:00' ) ) ), $result['schedule'] );
		$this->assertSame( array( self::dropped( 'tuesday', '01:00', '03:00', 'Early' ) ), $result['dropped'] );
	}

	/**
	 * Sunday 23:00–02:00 and Monday 01:00–03:00: Monday comes first, so Sunday's slot goes.
	 */
	public function test_sunday_to_monday_overlap_keeps_monday() {
		$result = Slot_Filter::filter(
			array(
				'sunday' => array( self::slot( 1, '23:00', '02:00' ) ),
				'monday' => array( self::slot( 2, '01:00', '03:00' ) ),
			),
			self::NAMES
		);

		$this->assertSame( array( 'monday' => array( self::slot( 2, '01:00', '03:00' ) ) ), $result['schedule'] );
		$this->assertSame( array( self::dropped( 'sunday', '23:00', '02:00', 'Late' ) ), $result['dropped'] );
	}

	/**
	 * A malformed time is dropped and the rest of the day is kept.
	 *
	 * @dataProvider data_malformed
	 *
	 * @param string $start Start.
	 * @param string $end   End.
	 */
	public function test_malformed_time_is_dropped( $start, $end ) {
		$result = Slot_Filter::filter(
			array(
				'friday' => array(
					self::slot( 1, $start, $end ),
					self::slot( 2, '10:00', '11:00' ),
				),
			),
			self::NAMES
		);

		$this->assertSame( array( 'friday' => array( self::slot( 2, '10:00', '11:00' ) ) ), $result['schedule'] );
		$this->assertSame( array( self::dropped( 'friday', $start, $end, 'Late' ) ), $result['dropped'] );
	}

	/**
	 * Malformed times.
	 *
	 * @return array<string, array{string, string}>
	 */
	public function data_malformed() {
		return array(
			'one-digit hour' => array( '7:00', '09:00' ),
			'hour 25'        => array( '07:00', '25:00' ),
			'text'           => array( 'abc', '08:00' ),
		);
	}

	/**
	 * A day emptied by the drops is left out, and keys that are not days are ignored.
	 */
	public function test_emptied_days_and_unknown_keys_are_left_out() {
		$result = Slot_Filter::filter(
			array(
				'holiday' => array( self::slot( 3, '07:00', '08:00' ) ),
				'monday'  => array( self::slot( 1, '07:00', '09:00' ) ),
				'friday'  => array( self::slot( 2, 'abc', '08:00' ) ),
			),
			self::NAMES
		);

		$this->assertSame( array( 'monday' => array( self::slot( 1, '07:00', '09:00' ) ) ), $result['schedule'] );
		$this->assertSame( array( self::dropped( 'friday', 'abc', '08:00', 'Early' ) ), $result['dropped'] );
	}

	/**
	 * Slot.
	 *
	 * @param int    $program_id Program post ID.
	 * @param string $start      Start.
	 * @param string $end        End.
	 * @return array{program_id: int, start: string, end: string}
	 */
	private static function slot( $program_id, $start, $end ) {
		return array(
			'program_id' => $program_id,
			'start'      => $start,
			'end'        => $end,
		);
	}

	/**
	 * Dropped slot.
	 *
	 * @param string $day     Day key.
	 * @param string $start   Start.
	 * @param string $end     End.
	 * @param string $program Program name.
	 * @return array{day: string, start: string, end: string, program: string}
	 */
	private static function dropped( $day, $start, $end, $program ) {
		return array(
			'day'     => $day,
			'start'   => $start,
			'end'     => $end,
			'program' => $program,
		);
	}
}
