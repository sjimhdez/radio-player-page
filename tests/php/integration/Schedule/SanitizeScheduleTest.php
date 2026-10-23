<?php
/**
 * Characterization of radplapag_sanitize_station_schedule() (3.4.2).
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Schedule;

use RadioPlayerPage\Tests\Integration\Support\Factory;
use WP_Error;
use WP_UnitTestCase;

/**
 * Pins how the server sanitizes and validates a station schedule: the shared
 * `validation` vectors, the shape of the output and how errors are reported.
 */
final class SanitizeScheduleTest extends WP_UnitTestCase {

	/**
	 * An ID that is not a post: stands for a program key missing from the vectors.
	 */
	const MISSING_PROGRAM_ID = 987654321;

	/**
	 * First error message → error code of the vectors.
	 */
	const ERROR_CODES = array(
		'required'               => '/^Radio show on \w+: All fields \(radio show, start time, end time\) are required\./',
		'invalid_program'        => '/^Radio show on \w+: Please select a valid radio show\./',
		'format'                 => '/^Radio show "[^"]*" on \w+: Invalid time format\./',
		'overlap'                => '/^Radio show "[^"]*" on \w+: Time slot overlaps with "[^"]*"\./',
		'cross_midnight_overlap' => '/^Radio show "[^"]*" on \w+ \(crosses midnight\) overlaps with "[^"]*" on \w+\./',
	);

	/**
	 * Vector program key → post ID.
	 *
	 * @var array<string, int>
	 */
	private $programs = array();

	/**
	 * Creates one published program per vector key, named after it.
	 */
	public function set_up() {
		parent::set_up();

		$factory = new Factory();
		foreach ( self::vectors()['programs'] as $key ) {
			$this->programs[ $key ] = $factory->program( $key );
		}
	}

	/**
	 * The shared vectors file.
	 *
	 * @return array
	 */
	private static function vectors() {
		static $vectors = null;
		if ( null === $vectors ) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local fixture.
			$vectors = json_decode( file_get_contents( dirname( __DIR__, 3 ) . '/fixtures/schedule-vectors.json' ), true );
		}

		return $vectors;
	}

	/**
	 * The `validation` vectors, by ID.
	 *
	 * @return array<string, array{array}>
	 */
	public function validation_vectors() {
		$out = array();
		foreach ( self::vectors()['validation'] as $vector ) {
			$out[ $vector['id'] ] = array( $vector );
		}

		return $out;
	}

	/**
	 * Each vector gives the 3.4.2 PHP result. A valid schedule comes back with every
	 * row, ordered by start, `is_rerun` as a boolean.
	 *
	 * @dataProvider validation_vectors
	 *
	 * @param array $vector A `validation` vector.
	 */
	public function test_validation_vector( array $vector ) {
		$this->assertArrayHasKey( 'php', $vector, 'Vector without a PHP result.' );

		$schedule = is_string( $vector['schedule'] ) ? self::vectors()['grids'][ $vector['schedule'] ] : $vector['schedule'];
		$result   = radplapag_sanitize_station_schedule( $this->to_input( $schedule ) );

		if ( $vector['php']['valid'] ) {
			$this->assertNotWPError( $result );
			$this->assertSame( $this->to_expected_output( $schedule ), $result );
			return;
		}

		$this->assertWPError( $result );
		$this->assertSame( $vector['php']['error'], $this->first_error_code( $result ) );
	}

	/**
	 * Anything that is not an array is an empty schedule, not an error.
	 */
	public function test_non_array_input_gives_empty_schedule() {
		foreach ( array( null, '', '{"monday":[]}', 0, false ) as $input ) {
			$this->assertSame( array(), radplapag_sanitize_station_schedule( $input ) );
		}
	}

	/**
	 * Only the seven lowercase day keys are read; any other key is dropped silently.
	 */
	public function test_unknown_days_are_ignored() {
		$row = $this->row( 'A', '06:00', '10:00' );

		$result = radplapag_sanitize_station_schedule(
			array(
				'Monday'  => array( $row ),
				'funday'  => array( $row ),
				'tuesday' => array( $row ),
			)
		);

		$this->assertSame( array( 'tuesday' ), array_keys( $result ) );
	}

	/**
	 * Start and end are trimmed; a numeric string program ID is cast to int.
	 */
	public function test_times_are_trimmed_and_program_id_cast() {
		$result = radplapag_sanitize_station_schedule(
			array(
				'monday' => array(
					array(
						'program_id' => (string) $this->programs['A'],
						'start'      => ' 06:00 ',
						'end'        => "10:00\n",
					),
				),
			)
		);

		$this->assertSame(
			array(
				'monday' => array(
					array(
						'program_id' => $this->programs['A'],
						'start'      => '06:00',
						'end'        => '10:00',
						'is_rerun'   => false,
					),
				),
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
			$start           = sprintf( '%02d:00', $i * 2 );
			$row             = $this->row( 'A', $start, sprintf( '%02d:00', $i * 2 + 1 ) );
			$row['is_rerun'] = $case[0];
			$rows[]          = $row;
		}
		$rows[] = $this->row( 'B', '20:00', '21:00' );

		$result = radplapag_sanitize_station_schedule( array( 'monday' => $rows ) );

		$expected = array_merge( array_column( $cases, 1 ), array( false ) );
		$this->assertSame( $expected, array_column( $result['monday'], 'is_rerun' ) );
	}

	/**
	 * Rows come out ordered by start and days in Monday → Sunday order, whatever the
	 * input order.
	 */
	public function test_output_is_ordered_by_day_and_start() {
		$result = radplapag_sanitize_station_schedule(
			array(
				'sunday' => array( $this->row( 'E', '23:55', '00:30' ) ),
				'monday' => array(
					$this->row( 'C', '22:00', '02:00' ),
					$this->row( 'A', '06:00', '10:00' ),
					$this->row( 'B', '10:00', '14:00' ),
				),
			)
		);

		$this->assertSame( array( 'monday', 'sunday' ), array_keys( $result ) );
		$this->assertSame( array( '06:00', '10:00', '22:00' ), array_column( $result['monday'], 'start' ) );
	}

	/**
	 * Empty rows (no program, start or end) and non-array rows are skipped, and a day
	 * left without rows is not in the output.
	 */
	public function test_empty_rows_and_days_are_omitted() {
		$result = radplapag_sanitize_station_schedule(
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
				'thursday'  => array( $this->row( 'D', '02:00', '04:00' ) ),
			)
		);

		$this->assertSame( array( 'thursday' ), array_keys( $result ) );
	}

	/**
	 * A row with times but a non-numeric program ID is incomplete.
	 */
	public function test_non_numeric_program_id_is_required_error() {
		$result = radplapag_sanitize_station_schedule(
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

		$this->assertSame( 'required', $this->first_error_code( $result ) );
	}

	/**
	 * A post that is not a program is not a valid program.
	 */
	public function test_post_of_another_type_is_invalid_program() {
		$page = ( new Factory() )->page( 'Not a program' );

		$result = radplapag_sanitize_station_schedule(
			array( 'monday' => array( $this->row( $page, '06:00', '10:00' ) ) )
		);

		$this->assertSame( 'invalid_program', $this->first_error_code( $result ) );
	}

	/**
	 * A format error is the only message for its row: the row is not checked further,
	 * so a badly formatted time that would overlap another row reports no overlap.
	 */
	public function test_format_error_stops_checking_the_row() {
		$result = radplapag_sanitize_station_schedule(
			array(
				'monday' => array(
					$this->row( 'A', '06:00', '10:00' ),
					$this->row( 'B', '7:00', '09:00' ),
				),
			)
		);

		$this->assertWPError( $result );
		$this->assertSame( 'radplapag_schedule_validation', $result->get_error_code() );
		$this->assertSame(
			'Radio show "B" on Monday: Invalid time format. Times must be in HH:MM format.',
			$result->get_error_message()
		);
	}

	/**
	 * Every per-day error is reported, in day and row order, joined with a space; the
	 * valid rows are not returned.
	 */
	public function test_errors_are_concatenated_in_day_order() {
		$result = radplapag_sanitize_station_schedule(
			array(
				'wednesday' => array( $this->row( 'Z', '06:00', '10:00' ) ),
				'monday'    => array(
					$this->row( 'A', '06:00', '10:00' ),
					$this->row( 'B', '6:00', '10:00' ),
					$this->row( 'C', '09:00', '' ),
				),
			)
		);

		$this->assertWPError( $result );
		$this->assertSame(
			'Radio show "B" on Monday: Invalid time format. Times must be in HH:MM format.'
			. ' Radio show on Monday: All fields (radio show, start time, end time) are required.'
			. ' Radio show on Wednesday: Please select a valid radio show.',
			$result->get_error_message()
		);
	}

	/**
	 * The first slot that crosses midnight into the next day's first slot ends the
	 * check: earlier per-day errors are kept, later cross-day conflicts are not reported.
	 */
	public function test_cross_midnight_overlap_returns_early() {
		$result = radplapag_sanitize_station_schedule(
			array(
				'monday'    => array( $this->row( 'C', '22:00', '02:00' ) ),
				'tuesday'   => array( $this->row( 'D', '01:00', '03:00' ) ),
				'wednesday' => array( $this->row( 'E', '23:00', '01:00' ) ),
				'thursday'  => array( $this->row( 'H', '00:30', '02:00' ) ),
				'friday'    => array( $this->row( 'A', '25:00', '02:00' ) ),
			)
		);

		$this->assertWPError( $result );
		$this->assertSame(
			'Radio show "A" on Friday: Invalid time format. Times must be in HH:MM format.'
			. ' Radio show "C" on Monday (crosses midnight) overlaps with "D" on Tuesday.',
			$result->get_error_message()
		);
	}

	/**
	 * Currently, the server accepts `start == end` and stores it as given (a 24 h
	 * slot), while the admin JS rejects it. The proposal keeps the server behavior.
	 *
	 * @see docs/known-issues.md C3
	 */
	public function test_currently_accepts_start_equals_end() {
		$result = radplapag_sanitize_station_schedule(
			array( 'tuesday' => array( $this->row( 'F', '08:00', '08:00' ) ) )
		);

		$this->assertSame(
			array(
				'tuesday' => array(
					array(
						'program_id' => $this->programs['F'],
						'start'      => '08:00',
						'end'        => '08:00',
						'is_rerun'   => false,
					),
				),
			),
			$result
		);
	}

	/**
	 * A draft program is accepted in a slot: the slot keeps it, and the meta box warns
	 * that it is not shown on the site (ADR 0045).
	 *
	 * @see docs/known-issues.md C10
	 */
	public function test_accepts_draft_program() {
		$draft = ( new Factory() )->program( 'Draft', array(), 'draft' );

		$result = radplapag_sanitize_station_schedule(
			array( 'monday' => array( $this->row( $draft, '06:00', '10:00' ) ) )
		);

		$this->assertNotWPError( $result );
		$this->assertSame( $draft, $result['monday'][0]['program_id'] );
	}

	/**
	 * Currently, `start` or `end` posted as an array (`[start][]=x`, only from a
	 * hand-made POST) reaches trim(): a TypeError on PHP 8, which ends the save with a
	 * 500 after the details meta are written; on PHP 7.4 a warning. K38 of
	 * docs/known-issues.md.
	 */
	public function test_currently_array_time_reaches_trim() {
		$row          = $this->row( 'F', '08:00', '09:00' );
		$row['start'] = array( '08:00' );

		if ( PHP_VERSION_ID >= 80000 ) {
			$this->expectException( \TypeError::class );
			radplapag_sanitize_station_schedule( array( 'monday' => array( $row ) ) );
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
			radplapag_sanitize_station_schedule( array( 'monday' => array( $row ) ) );
		} finally {
			restore_error_handler();
		}

		$this->assertSame( array( 'trim() expects parameter 1 to be string, array given' ), $warnings );
	}

	/**
	 * A raw row as the meta box posts it.
	 *
	 * @param string|int $program Vector program key, or a post ID.
	 * @param string     $start   Start time.
	 * @param string     $end     End time.
	 * @return array
	 */
	private function row( $program, $start, $end ) {
		return array(
			'program_id' => (string) $this->program_id( $program ),
			'start'      => $start,
			'end'        => $end,
		);
	}

	/**
	 * Post ID of a vector program key (a missing key is a non-existent post).
	 *
	 * @param string|int $program Vector program key, or a post ID.
	 * @return int
	 */
	private function program_id( $program ) {
		if ( is_int( $program ) ) {
			return $program;
		}

		return isset( $this->programs[ $program ] ) ? $this->programs[ $program ] : self::MISSING_PROGRAM_ID;
	}

	/**
	 * Vector schedule → raw input, as the meta box posts it.
	 *
	 * @param array $schedule Vector schedule (day → rows with `program`).
	 * @return array
	 */
	private function to_input( array $schedule ) {
		$input = array();
		foreach ( $schedule as $day => $rows ) {
			foreach ( $rows as $row ) {
				$raw = $this->row( $row['program'], $row['start'], $row['end'] );
				if ( ! empty( $row['is_rerun'] ) ) {
					$raw['is_rerun'] = '1';
				}
				$input[ $day ][] = $raw;
			}
		}

		return $input;
	}

	/**
	 * Vector schedule → sanitized output: days Monday → Sunday, rows by start.
	 *
	 * @param array $schedule Vector schedule.
	 * @return array
	 */
	private function to_expected_output( array $schedule ) {
		$out = array();
		foreach ( array( 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday' ) as $day ) {
			if ( empty( $schedule[ $day ] ) ) {
				continue;
			}
			$rows = $schedule[ $day ];
			usort(
				$rows,
				function ( $a, $b ) {
					return strcmp( $a['start'], $b['start'] );
				}
			);
			foreach ( $rows as $row ) {
				$out[ $day ][] = array(
					'program_id' => $this->program_id( $row['program'] ),
					'start'      => $row['start'],
					'end'        => $row['end'],
					'is_rerun'   => ! empty( $row['is_rerun'] ),
				);
			}
		}

		return $out;
	}

	/**
	 * Error code of the first message in a validation error.
	 *
	 * @param mixed $result Return value of radplapag_sanitize_station_schedule().
	 * @return string|null
	 */
	private function first_error_code( $result ) {
		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'radplapag_schedule_validation', $result->get_error_code() );

		foreach ( self::ERROR_CODES as $code => $pattern ) {
			if ( preg_match( $pattern, $result->get_error_message() ) ) {
				return $code;
			}
		}

		return null;
	}
}
