<?php
/**
 * Tests for RadioPlayerPage\Schedule\Slot_Validator.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Schedule;

use RadioPlayerPage\Schedule\Slot_Validator;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * Validation of a station schedule as radplapag_sanitize_station_schedule() does it in
 * 3.4.2: the cases of SanitizeScheduleTest, with error codes instead of messages.
 */
final class SlotValidatorTest extends TestCase {

	/**
	 * Program ID → name: the programs radplapag_get_program_data() finds.
	 */
	const PROGRAMS = array(
		1 => 'A',
		2 => 'B',
		3 => 'C',
		4 => 'D',
		5 => 'E',
		6 => 'F',
		7 => 'G',
		8 => 'H',
	);

	/**
	 * An ID that is not in the names map.
	 */
	const MISSING_PROGRAM_ID = 987654321;

	/**
	 * Anything that is not an array is an empty schedule, not an error.
	 */
	public function test_non_array_input_gives_empty_schedule() {
		foreach ( array( null, '', '{"monday":[]}', 0, false ) as $input ) {
			$this->assertSame(
				array(
					'schedule' => array(),
					'errors'   => array(),
				),
				Slot_Validator::validate( $input, self::PROGRAMS )
			);
		}
	}

	/**
	 * Only the seven lowercase day keys are read; any other key is dropped silently.
	 */
	public function test_unknown_days_are_ignored() {
		$row = $this->row( 1, '06:00', '10:00' );

		$result = $this->validate(
			array(
				'Monday'  => array( $row ),
				'funday'  => array( $row ),
				'tuesday' => array( $row ),
			)
		);

		$this->assertSame( array(), $result['errors'] );
		$this->assertSame( array( 'tuesday' ), array_keys( $result['schedule'] ) );
	}

	/**
	 * Start and end are trimmed; a numeric string program ID is cast to int.
	 */
	public function test_times_are_trimmed_and_program_id_cast() {
		$result = $this->validate(
			array(
				'monday' => array(
					array(
						'program_id' => '1',
						'start'      => ' 06:00 ',
						'end'        => "10:00\n",
					),
				),
			)
		);

		$this->assertSame(
			array(
				'schedule' => array(
					'monday' => array(
						array(
							'program_id' => 1,
							'start'      => '06:00',
							'end'        => '10:00',
							'is_rerun'   => false,
						),
					),
				),
				'errors'   => array(),
			),
			$result
		);
	}

	/**
	 * `is_rerun` is `! empty()`: any truthy value is true, missing is false.
	 */
	public function test_is_rerun_is_boolean() {
		$cases = array(
			array( '1', true ),
			array( 'yes', true ),
			array( 1, true ),
			array( '0', false ),
			array( '', false ),
			array( 0, false ),
			array( null, false ),
		);
		$rows  = array();
		foreach ( $cases as $i => $case ) {
			$row             = $this->row( 1, sprintf( '%02d:00', $i * 2 ), sprintf( '%02d:00', $i * 2 + 1 ) );
			$row['is_rerun'] = $case[0];
			$rows[]          = $row;
		}
		$rows[] = $this->row( 2, '20:00', '21:00' );

		$result = $this->validate( array( 'monday' => $rows ) );

		$expected = array_merge( array_column( $cases, 1 ), array( false ) );
		$this->assertSame( $expected, array_column( $result['schedule']['monday'], 'is_rerun' ) );
	}

	/**
	 * Rows come out ordered by start and days in Monday → Sunday order, whatever the
	 * input order.
	 */
	public function test_output_is_ordered_by_day_and_start() {
		$result = $this->validate(
			array(
				'sunday' => array( $this->row( 5, '23:55', '00:30' ) ),
				'monday' => array(
					$this->row( 3, '22:00', '02:00' ),
					$this->row( 1, '06:00', '10:00' ),
					$this->row( 2, '10:00', '14:00' ),
				),
			)
		);

		$this->assertSame( array(), $result['errors'] );
		$this->assertSame( array( 'monday', 'sunday' ), array_keys( $result['schedule'] ) );
		$this->assertSame( array( '06:00', '10:00', '22:00' ), array_column( $result['schedule']['monday'], 'start' ) );
	}

	/**
	 * Empty rows (no program, start or end) and non-array rows are skipped, and a day
	 * left without rows is not in the output.
	 */
	public function test_empty_rows_and_days_are_omitted() {
		$result = $this->validate(
			array(
				'monday'    => array(
					array(
						'program_id' => '',
						'start'      => '',
						'end'        => '',
					),
					array( 'program_id' => '0' ),
					'not a row',
				),
				'tuesday'   => array(),
				'wednesday' => 'not a day',
				'thursday'  => array( $this->row( 4, '02:00', '04:00' ) ),
			)
		);

		$this->assertSame( array(), $result['errors'] );
		$this->assertSame( array( 'thursday' ), array_keys( $result['schedule'] ) );
	}

	/**
	 * Required fields go through empty(): "0" as a time counts as missing.
	 */
	public function test_zero_string_time_is_required_error() {
		$result = $this->validate( array( 'monday' => array( $this->row( 1, '0', '10:00' ) ) ) );

		$this->assertSame( array( $this->error( 'required', 'monday' ) ), $result['errors'] );
	}

	/**
	 * A row with times but a non-numeric program ID is incomplete.
	 */
	public function test_non_numeric_program_id_is_required_error() {
		$result = $this->validate(
			array(
				'monday' => array(
					array(
						'program_id' => 'abc',
						'start'      => '06:00',
						'end'        => '10:00',
					),
				),
			)
		);

		$this->assertSame( array( $this->error( 'required', 'monday' ) ), $result['errors'] );
	}

	/**
	 * An ID that is not in the names map is not a valid program.
	 */
	public function test_unknown_program_is_invalid_program() {
		$result = $this->validate(
			array( 'monday' => array( $this->row( self::MISSING_PROGRAM_ID, '06:00', '10:00' ) ) )
		);

		$this->assertSame( array( $this->error( 'invalid_program', 'monday' ) ), $result['errors'] );
		$this->assertSame( array(), $result['schedule'] );
	}

	/**
	 * Times must be HH:MM, 00:00 to 23:59, two digits each.
	 *
	 * @dataProvider data_bad_times
	 *
	 * @param string $start Start time.
	 * @param string $end   End time.
	 */
	public function test_bad_time_is_format_error( $start, $end ) {
		$result = $this->validate( array( 'friday' => array( $this->row( 2, $start, $end ) ) ) );

		$this->assertSame( array( $this->error( 'format', 'friday', 'B' ) ), $result['errors'] );
	}

	/**
	 * Inputs for test_bad_time_is_format_error().
	 *
	 * @return array<string, array{string, string}>
	 */
	public function data_bad_times() {
		return array(
			'one-digit hour' => array( '7:00', '09:00' ),
			'24:00 end'      => array( '22:00', '24:00' ),
			'minute 60'      => array( '06:60', '09:00' ),
			'seconds'        => array( '06:00:00', '09:00' ),
			'words'          => array( '06:00', 'noon' ),
		);
	}

	/**
	 * A format error is the only error for its row: the row is not checked further,
	 * so a badly formatted time that would overlap another row reports no overlap.
	 */
	public function test_format_error_stops_checking_the_row() {
		$result = $this->validate(
			array(
				'monday' => array(
					$this->row( 1, '06:00', '10:00' ),
					$this->row( 2, '7:00', '09:00' ),
				),
			)
		);

		$this->assertSame( array( $this->error( 'format', 'monday', 'B' ) ), $result['errors'] );
	}

	/**
	 * Two rows of a day that share time: the later start overlaps the earlier one,
	 * which is kept.
	 */
	public function test_same_day_overlap() {
		$result = $this->validate(
			array(
				'monday' => array(
					$this->row( 2, '09:00', '12:00' ),
					$this->row( 1, '06:00', '10:00' ),
				),
			)
		);

		$this->assertSame( array( $this->error( 'overlap', 'monday', 'B', 'A' ) ), $result['errors'] );
		$this->assertSame( array( '06:00' ), array_column( $result['schedule']['monday'], 'start' ) );
	}

	/**
	 * A slot that crosses midnight runs to the end of its day: a later slot of the same
	 * day overlaps it.
	 */
	public function test_crossing_slot_overlaps_later_slot_of_its_day() {
		$result = $this->validate(
			array(
				'monday' => array(
					$this->row( 3, '22:00', '02:00' ),
					$this->row( 7, '23:00', '23:50' ),
				),
			)
		);

		$this->assertSame( array( $this->error( 'overlap', 'monday', 'G', 'C' ) ), $result['errors'] );
	}

	/**
	 * Back-to-back slots do not overlap.
	 */
	public function test_adjacent_slots_do_not_overlap() {
		$result = $this->validate(
			array(
				'monday' => array(
					$this->row( 1, '06:00', '10:00' ),
					$this->row( 2, '10:00', '14:00' ),
				),
			)
		);

		$this->assertSame( array(), $result['errors'] );
	}

	/**
	 * Every per-day error is reported, in day and row order; the valid rows are still in
	 * the schedule.
	 */
	public function test_errors_are_in_day_and_row_order() {
		$result = $this->validate(
			array(
				'wednesday' => array( $this->row( self::MISSING_PROGRAM_ID, '06:00', '10:00' ) ),
				'monday'    => array(
					$this->row( 1, '06:00', '10:00' ),
					$this->row( 2, '6:00', '10:00' ),
					$this->row( 3, '09:00', '' ),
				),
			)
		);

		$this->assertSame(
			array(
				$this->error( 'format', 'monday', 'B' ),
				$this->error( 'required', 'monday' ),
				$this->error( 'invalid_program', 'wednesday' ),
			),
			$result['errors']
		);
		$this->assertSame( array( 'monday' ), array_keys( $result['schedule'] ) );
	}

	/**
	 * A slot that crosses midnight and runs past the start of a slot of the next day is
	 * a cross-day overlap; Sunday's next day is Monday.
	 */
	public function test_cross_midnight_overlap_wraps_from_sunday_to_monday() {
		$result = $this->validate(
			array(
				'monday' => array( $this->row( 1, '00:10', '01:00' ) ),
				'sunday' => array( $this->row( 5, '23:55', '00:30' ) ),
			)
		);

		$this->assertSame(
			array( $this->error( 'cross_midnight_overlap', 'sunday', 'E', 'A', 'monday' ) ),
			$result['errors']
		);
	}

	/**
	 * A crossing slot that ends exactly when the next day's slot starts does not overlap.
	 */
	public function test_cross_midnight_exact_boundary_is_valid() {
		$result = $this->validate(
			array(
				'monday'  => array( $this->row( 3, '22:00', '02:00' ) ),
				'tuesday' => array( $this->row( 4, '02:00', '04:00' ) ),
			)
		);

		$this->assertSame( array(), $result['errors'] );
	}

	/**
	 * The first slot that crosses midnight into the next day's slot ends the check:
	 * earlier per-day errors are kept, later cross-day conflicts are not reported.
	 */
	public function test_cross_midnight_overlap_returns_early() {
		$result = $this->validate(
			array(
				'monday'    => array( $this->row( 3, '22:00', '02:00' ) ),
				'tuesday'   => array( $this->row( 4, '01:00', '03:00' ) ),
				'wednesday' => array( $this->row( 5, '23:00', '01:00' ) ),
				'thursday'  => array( $this->row( 8, '00:30', '02:00' ) ),
				'friday'    => array( $this->row( 1, '25:00', '02:00' ) ),
			)
		);

		$this->assertSame(
			array(
				$this->error( 'format', 'friday', 'A' ),
				$this->error( 'cross_midnight_overlap', 'monday', 'C', 'D', 'tuesday' ),
			),
			$result['errors']
		);
	}

	/**
	 * Currently, `start == end` is accepted and stored as given (a 24 h slot), while the
	 * admin JS rejects it. The proposal keeps this behavior.
	 *
	 * @see docs/known-issues.md C3
	 */
	public function test_currently_accepts_start_equals_end() {
		$result = $this->validate( array( 'tuesday' => array( $this->row( 6, '08:00', '08:00' ) ) ) );

		$this->assertSame(
			array(
				'schedule' => array(
					'tuesday' => array(
						array(
							'program_id' => 6,
							'start'      => '08:00',
							'end'        => '08:00',
							'is_rerun'   => false,
						),
					),
				),
				'errors'   => array(),
			),
			$result
		);
	}

	/**
	 * Currently, any program in the names map is accepted, and the wrapper puts drafts
	 * in it (radplapag_get_program_data() finds them): a draft is accepted in a slot
	 * without any warning, although drafts are never shown.
	 *
	 * @see docs/known-issues.md C10
	 */
	public function test_currently_accepts_draft_program() {
		$draft  = 42;
		$result = Slot_Validator::validate(
			array( 'monday' => array( $this->row( $draft, '06:00', '10:00' ) ) ),
			array( $draft => 'Draft' )
		);

		$this->assertSame( array(), $result['errors'] );
		$this->assertSame( $draft, $result['schedule']['monday'][0]['program_id'] );
	}

	/**
	 * Currently, `start` or `end` posted as an array (`[start][]=x`, only from a
	 * hand-made POST) reaches trim(): a TypeError on PHP 8; on PHP 7.4 a warning.
	 *
	 * @see docs/known-issues.md K38
	 */
	public function test_currently_array_time_reaches_trim() {
		$row          = $this->row( 6, '08:00', '09:00' );
		$row['start'] = array( '08:00' );

		if ( PHP_VERSION_ID >= 80000 ) {
			$this->expectException( \TypeError::class );
			$this->validate( array( 'monday' => array( $row ) ) );
			return;
		}

		$warnings = array();
		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_set_error_handler -- Captures the PHP 7.4 warning (expectWarning() is deprecated in PHPUnit 9.6).
		set_error_handler(
			static function ( $errno, $errstr ) use ( &$warnings ) {
				$warnings[] = $errstr;
				return true;
			},
			E_WARNING
		);
		try {
			$this->validate( array( 'monday' => array( $row ) ) );
		} finally {
			restore_error_handler();
		}

		$this->assertSame( array( 'trim() expects parameter 1 to be string, array given' ), $warnings );
	}

	/**
	 * Validates with the default names map.
	 *
	 * @param mixed $input Raw schedule.
	 * @return array{schedule: array<string, list<array{program_id: int, start: string, end: string, is_rerun: bool}>>, errors: list<array{code: string, day: string, program: string|null, other: string|null, next_day: string|null}>}
	 */
	private function validate( $input ) {
		return Slot_Validator::validate( $input, self::PROGRAMS );
	}

	/**
	 * A raw row as the meta box posts it.
	 *
	 * @param int    $program_id Program ID.
	 * @param string $start      Start time.
	 * @param string $end        End time.
	 * @return array<string, string>
	 */
	private function row( $program_id, $start, $end ) {
		return array(
			'program_id' => (string) $program_id,
			'start'      => $start,
			'end'        => $end,
		);
	}

	/**
	 * An expected error.
	 *
	 * @param string      $code     Error code.
	 * @param string      $day      Day key.
	 * @param string|null $program  Program name.
	 * @param string|null $other    Overlapping program name.
	 * @param string|null $next_day Next day key (cross-day overlap).
	 * @return array{code: string, day: string, program: string|null, other: string|null, next_day: string|null}
	 */
	private function error( $code, $day, $program = null, $other = null, $next_day = null ) {
		return array(
			'code'     => $code,
			'day'      => $day,
			'program'  => $program,
			'other'    => $other,
			'next_day' => $next_day,
		);
	}
}
