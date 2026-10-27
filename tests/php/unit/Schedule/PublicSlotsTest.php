<?php
/**
 * Tests for RadioPlayerPage\Schedule\Public_Slots.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Schedule;

use RadioPlayerPage\Schedule\Public_Slots;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * The filter of the stored schedule down to the slots of public programs (ADR 0045,
 * D4 of spec 0009).
 */
final class PublicSlotsTest extends TestCase {

	/**
	 * Slots of public programs are kept as stored, in their days and order.
	 */
	public function test_keeps_slots_of_public_programs_in_stored_order() {
		$schedule = array(
			'tuesday' => array( self::slot( 2, '10:00', '11:00' ), self::slot( 1, '08:00', '09:00' ) ),
			'monday'  => array( self::slot( 1, '07:00', '09:00', true ) ),
		);

		$this->assertSame( $schedule, Public_Slots::filter( $schedule, array( 1, 2 ) ) );
	}

	/**
	 * A slot whose program is not in the list is dropped; its day stays.
	 */
	public function test_drops_slots_of_programs_not_in_the_list() {
		$result = Public_Slots::filter(
			array(
				'monday'  => array( self::slot( 1, '07:00', '09:00' ), self::slot( 2, '09:00', '10:00' ), self::slot( 3, '10:00', '11:00' ) ),
				'tuesday' => array( self::slot( 2, '07:00', '09:00' ) ),
			),
			array( 1, 3 )
		);

		$this->assertSame(
			array(
				'monday'  => array( self::slot( 1, '07:00', '09:00' ), self::slot( 3, '10:00', '11:00' ) ),
				'tuesday' => array(),
			),
			$result
		);
	}

	/**
	 * A numeric string program_id counts as its integer.
	 */
	public function test_numeric_string_program_id_matches() {
		$slot = array(
			'program_id' => '2',
			'start'      => '07:00',
			'end'        => '08:00',
		);

		$this->assertSame( array( 'monday' => array( $slot ) ), Public_Slots::filter( array( 'monday' => array( $slot ) ), array( 2 ) ) );
	}

	/**
	 * A non-numeric, empty or missing program_id is a program that does not exist.
	 */
	public function test_drops_slots_without_a_numeric_program_id() {
		$result = Public_Slots::filter(
			array(
				'monday' => array(
					array(
						'program_id' => 'tagged id',
						'start'      => '07:00',
						'end'        => '08:00',
					),
					array(
						'program_id' => '',
						'start'      => '08:00',
						'end'        => '09:00',
					),
					array(
						'start' => '09:00',
						'end'   => '10:00',
					),
					array(
						'program_id' => null,
						'start'      => '10:00',
						'end'        => '11:00',
					),
				),
			),
			array( 0 )
		);

		$this->assertSame( array( 'monday' => array() ), $result );
	}

	/**
	 * Entries that are not arrays are dropped from a day.
	 */
	public function test_drops_entries_that_are_not_arrays() {
		$result = Public_Slots::filter(
			array( 'monday' => array( 'junk', 1, self::slot( 1, '07:00', '08:00' ), null ) ),
			array( 1 )
		);

		$this->assertSame( array( 'monday' => array( self::slot( 1, '07:00', '08:00' ) ) ), $result );
	}

	/**
	 * Days that are not arrays are dropped.
	 */
	public function test_drops_days_that_are_not_arrays() {
		$result = Public_Slots::filter(
			array(
				'monday'  => 'junk',
				'tuesday' => array( self::slot( 1, '07:00', '08:00' ) ),
				'friday'  => null,
			),
			array( 1 )
		);

		$this->assertSame( array( 'tuesday' => array( self::slot( 1, '07:00', '08:00' ) ) ), $result );
	}

	/**
	 * With no public programs, every slot goes; an empty schedule stays empty.
	 */
	public function test_no_public_programs_leaves_empty_days() {
		$this->assertSame( array( 'monday' => array() ), Public_Slots::filter( array( 'monday' => array( self::slot( 1, '07:00', '08:00' ) ) ), array() ) );
		$this->assertSame( array(), Public_Slots::filter( array(), array( 1 ) ) );
	}

	/**
	 * A stored slot.
	 *
	 * @param int    $program_id Program post ID.
	 * @param string $start      Start time.
	 * @param string $end        End time.
	 * @param bool   $is_rerun   Whether it is a rerun.
	 * @return array{program_id: int, start: string, end: string, is_rerun: bool}
	 */
	private static function slot( int $program_id, string $start, string $end, bool $is_rerun = false ): array {
		return array(
			'program_id' => $program_id,
			'start'      => $start,
			'end'        => $end,
			'is_rerun'   => $is_rerun,
		);
	}
}
