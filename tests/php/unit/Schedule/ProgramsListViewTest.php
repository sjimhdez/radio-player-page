<?php
/**
 * Tests for RadioPlayerPage\Schedule\Programs_List_View.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Schedule;

use DateTimeImmutable;
use DateTimeZone;
use RadioPlayerPage\Schedule\Programs_List_View;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * The programs of the programs list block, with the 3.4.2 rules of
 * radplapag_get_programs_list_for_station(). 2026-10-19 is a Monday.
 */
final class ProgramsListViewTest extends TestCase {

	/**
	 * Program ID => data, as radplapag_get_program_data() returns them.
	 *
	 * @var array<int, array{name: string, description: string, extended_description: string, logo_id: int}>
	 */
	private $programs = array(
		1 => array(
			'name'                 => 'Morning',
			'description'          => 'Wake up',
			'extended_description' => 'Wake up with us',
			'logo_id'              => 12,
		),
		2 => array(
			'name'                 => 'Late',
			'description'          => '',
			'extended_description' => '',
			'logo_id'              => 0,
		),
		3 => array(
			'name'                 => 'Noon',
			'description'          => '',
			'extended_description' => '',
			'logo_id'              => -5,
		),
	);

	/**
	 * Day key => label, as the wrapper passes the translated ones.
	 *
	 * @var array<string, string>
	 */
	private $labels = array(
		'monday'    => 'Lunes',
		'tuesday'   => 'Martes',
		'wednesday' => 'Miércoles',
		'thursday'  => 'Jueves',
		'friday'    => 'Viernes',
		'saturday'  => 'Sábado',
		'sunday'    => 'Domingo',
	);

	/**
	 * The program IDs are the numeric ones above 0, normalized and unique, in the
	 * order they first appear Monday to Sunday (not in the stored order of the days).
	 */
	public function test_program_ids_in_order() {
		$schedule = array(
			'friday'  => array(
				self::slot( '7', '09:00', '10:00' ),
				self::slot( 3, '10:00', '11:00' ),
			),
			'monday'  => array(
				self::slot( 3, '09:00', '10:00' ),
				self::slot( '7.9', '10:00', '11:00' ),
				self::slot( '5', '', '' ),
			),
			'tuesday' => array(
				self::slot( 0, '09:00', '10:00' ),
				self::slot( -4, '09:00', '10:00' ),
				self::slot( 'abc', '09:00', '10:00' ),
				self::slot( '', '09:00', '10:00' ),
				self::slot( null, '09:00', '10:00' ),
				array( 'start' => '09:00' ),
				'not a slot',
			),
			'sunday'  => 'not a day',
			'holiday' => array( self::slot( 8, '09:00', '10:00' ) ),
		);

		$this->assertSame( array( 3, 7, 5 ), Programs_List_View::program_ids_in_order( $schedule ) );
	}

	/**
	 * An empty schedule has no program IDs and no programs.
	 */
	public function test_empty_schedule() {
		$this->assertSame( array(), Programs_List_View::program_ids_in_order( array() ) );
		$this->assertSame( array(), $this->build( array(), '2026-10-19 10:00' ) );
	}

	/**
	 * A program carries its ID as a string, its name, its logo (0 when not above 0),
	 * its descriptions (null when empty) and its slots.
	 */
	public function test_program_shape() {
		$schedule = array(
			'monday'  => array(
				self::slot( 1, '09:00', '10:00' ),
				self::slot( 2, '22:00', '23:00' ),
			),
			'tuesday' => array( self::slot( 3, '12:00', '13:00' ) ),
		);

		$this->assertSame(
			array(
				array(
					'id'                   => '1',
					'name'                 => 'Morning',
					'logo_id'              => 12,
					'description'          => 'Wake up',
					'extended_description' => 'Wake up with us',
					'slots'                => array(
						array(
							'day_key'    => 'monday',
							'day_label'  => 'Lunes',
							'time_range' => '09:00-10:00',
							'is_live'    => true,
						),
					),
				),
				array(
					'id'                   => '2',
					'name'                 => 'Late',
					'logo_id'              => 0,
					'description'          => null,
					'extended_description' => null,
					'slots'                => array(
						array(
							'day_key'    => 'monday',
							'day_label'  => 'Lunes',
							'time_range' => '22:00-23:00',
							'is_live'    => false,
						),
					),
				),
				array(
					'id'                   => '3',
					'name'                 => 'Noon',
					'logo_id'              => 0,
					'description'          => null,
					'extended_description' => null,
					'slots'                => array(
						array(
							'day_key'    => 'tuesday',
							'day_label'  => 'Martes',
							'time_range' => '12:00-13:00',
							'is_live'    => false,
						),
					),
				),
			),
			$this->build( $schedule, '2026-10-19 09:30' )
		);
	}

	/**
	 * A program that is not in the map (unpublished in WordPress) is left out.
	 */
	public function test_unknown_program_is_left_out() {
		$schedule = array(
			'monday' => array(
				self::slot( 9, '08:00', '09:00' ),
				self::slot( 1, '09:00', '10:00' ),
			),
		);

		$this->assertSame( array( '1' ), array_column( $this->build( $schedule, '2026-10-19 12:00' ), 'id' ) );
	}

	/**
	 * A day without a label shows its key.
	 */
	public function test_day_without_label_uses_its_key() {
		$schedule = array(
			'monday'  => array( self::slot( 1, '09:00', '10:00' ) ),
			'tuesday' => array( self::slot( 1, '09:00', '10:00' ) ),
		);

		$programs = Programs_List_View::build( $schedule, $this->programs, array( 'monday' => 'Lunes' ), self::instant( '2026-10-19 12:00' ), 'strval' );

		$this->assertSame( array( 'Lunes', 'tuesday' ), array_column( $programs[0]['slots'], 'day_label' ) );
	}

	/**
	 * The slots of a program are sorted by day, Monday to Sunday, then by start time
	 * in minutes ("7:05" is before "08:00").
	 */
	public function test_slots_sorted_by_day_then_start() {
		$schedule = array(
			'sunday'  => array( self::slot( 1, '06:00', '07:00' ) ),
			'tuesday' => array(
				self::slot( 1, '18:00', '19:00' ),
				self::slot( 1, '08:00', '09:00' ),
				self::slot( 1, '7:05', '08:00' ),
			),
			'monday'  => array( self::slot( 1, '20:00', '21:00' ) ),
		);

		$slots = $this->build( $schedule, '2026-10-21 12:00' )[0]['slots'];

		$this->assertSame(
			array( 'monday 20:00-21:00', 'tuesday 7:05-08:00', 'tuesday 08:00-09:00', 'tuesday 18:00-19:00', 'sunday 06:00-07:00' ),
			array_map(
				function ( $slot ) {
					return $slot['day_key'] . ' ' . $slot['time_range'];
				},
				$slots
			)
		);
	}

	/**
	 * A numeric program ID is normalized to its integer, so "01" and 1 are the same
	 * program; "1.7" is program 1 too.
	 */
	public function test_numeric_program_id_is_normalized() {
		$schedule = array(
			'monday' => array(
				self::slot( '01', '09:00', '10:00' ),
				self::slot( '1.7', '10:00', '11:00' ),
				self::slot( 1, '11:00', '12:00' ),
			),
		);

		$programs = $this->build( $schedule, '2026-10-19 23:00' );

		$this->assertCount( 1, $programs );
		$this->assertSame( array( '09:00-10:00', '10:00-11:00', '11:00-12:00' ), array_column( $programs[0]['slots'], 'time_range' ) );
	}

	/**
	 * A non-numeric program ID goes through the sanitizer as stored; if the result is
	 * the ID of a listed program, the slot joins that program.
	 */
	public function test_non_numeric_program_id_goes_through_the_sanitizer() {
		$schedule = array(
			'monday' => array(
				self::slot( 1, '09:00', '10:00' ),
				self::slot( 'one', '10:00', '11:00' ),
				self::slot( 'abc', '11:00', '12:00' ),
			),
		);
		$seen     = array();
		$sanitize = function ( $value ) use ( &$seen ) {
			$seen[] = $value;
			return 'one' === $value ? '1' : $value;
		};

		$programs = Programs_List_View::build( $schedule, $this->programs, $this->labels, self::instant( '2026-10-19 23:00' ), $sanitize );

		$this->assertSame( array( 'one', 'abc' ), $seen );
		$this->assertCount( 1, $programs );
		$this->assertSame( array( '09:00-10:00', '10:00-11:00' ), array_column( $programs[0]['slots'], 'time_range' ) );
	}

	/**
	 * Entries that are not arrays, or have no program ID, start or end, are skipped.
	 */
	public function test_incomplete_entries_are_skipped() {
		$schedule = array(
			'monday' => array(
				'not a slot',
				array(
					'start' => '08:00',
					'end'   => '09:00',
				),
				self::slot( '', '08:00', '09:00' ),
				self::slot( null, '08:00', '09:00' ),
				self::slot( 1, '', '09:00' ),
				self::slot( 1, '08:00', '' ),
				array( 'program_id' => 1 ),
				self::slot( 1, '09:00', '10:00' ),
			),
		);

		$programs = $this->build( $schedule, '2026-10-19 23:00' );

		$this->assertSame( array( '09:00-10:00' ), array_column( $programs[0]['slots'], 'time_range' ) );
	}

	/**
	 * A program whose only slots have no start or end is still listed, with no slots.
	 */
	public function test_program_without_complete_slots_has_no_slots() {
		$schedule = array( 'monday' => array( self::slot( 2, '', '' ) ) );

		$programs = $this->build( $schedule, '2026-10-19 23:00' );

		$this->assertSame( array( '2' ), array_column( $programs, 'id' ) );
		$this->assertSame( array(), $programs[0]['slots'] );
	}

	/**
	 * Today's slot is live inside its bounds (start included, end excluded); the
	 * same slot on another day is not.
	 */
	public function test_today_slot_is_live_within_bounds() {
		$schedule = array(
			'monday'  => array( self::slot( 1, '09:00', '10:00' ) ),
			'tuesday' => array( self::slot( 1, '09:00', '10:00' ) ),
		);

		$this->assertSame( array( true, false ), $this->live( $schedule, '2026-10-19 09:00' ) );
		$this->assertSame( array( true, false ), $this->live( $schedule, '2026-10-19 09:59' ) );
		$this->assertSame( array( false, false ), $this->live( $schedule, '2026-10-19 10:00' ) );
		$this->assertSame( array( false, false ), $this->live( $schedule, '2026-10-19 08:59' ) );
	}

	/**
	 * Yesterday's slot that crosses midnight is live until its end; one that does
	 * not cross is not.
	 */
	public function test_previous_day_slot_crossing_midnight_is_live() {
		$schedule = array(
			'sunday' => array(
				self::slot( 1, '23:00', '02:00' ),
				self::slot( 1, '20:00', '21:00' ),
			),
		);

		// Sorted by start: 20:00, 23:00.
		$this->assertSame( array( false, true ), $this->live( $schedule, '2026-10-19 01:59' ) );
		$this->assertSame( array( false, false ), $this->live( $schedule, '2026-10-19 02:00' ) );
	}

	/**
	 * Saturday is the day before Sunday.
	 */
	public function test_week_wraps_around() {
		$schedule = array( 'saturday' => array( self::slot( 1, '23:00', '02:00' ) ) );

		$this->assertSame( array( true ), $this->live( $schedule, '2026-10-25 01:00' ) );
	}

	/**
	 * The day and minute come from `$now` in its own timezone.
	 */
	public function test_uses_the_timezone_of_now() {
		$schedule = array( 'sunday' => array( self::slot( 1, '20:00', '21:00' ) ) );
		$now      = new DateTimeImmutable( '2026-10-19 01:30', new DateTimeZone( 'UTC' ) );
		$now      = $now->setTimezone( new DateTimeZone( '-05:00' ) );

		$programs = Programs_List_View::build( $schedule, $this->programs, $this->labels, $now, 'strval' );

		$this->assertTrue( $programs[0]['slots'][0]['is_live'] );
	}

	/**
	 * Across the change to winter time in Europe/Madrid (02:59 CEST, then 02:00 CET),
	 * the local wall time decides.
	 */
	public function test_daylight_saving_time() {
		$schedule = array( 'sunday' => array( self::slot( 1, '02:30', '03:00' ) ) );
		$madrid   = new DateTimeZone( 'Europe/Madrid' );
		$before   = new DateTimeImmutable( '2026-10-25 00:45', new DateTimeZone( 'UTC' ) );

		foreach ( array( $before, $before->modify( '+1 hour' ) ) as $instant ) {
			$programs = Programs_List_View::build( $schedule, $this->programs, $this->labels, $instant->setTimezone( $madrid ), 'strval' );
			$this->assertTrue( $programs[0]['slots'][0]['is_live'], $instant->format( 'c' ) );
		}
	}

	/**
	 * C16: a slot that crosses midnight is live in the early morning of its own day,
	 * alongside yesterday's slot that is really on air (vector 13: Monday 00:10).
	 *
	 * @see docs/known-issues.md C16
	 */
	public function test_currently_midnight_slot_is_live_early_on_its_own_day() {
		$schedule = array(
			'sunday' => array( self::slot( 1, '23:00', '01:00' ) ),
			'monday' => array( self::slot( 2, '23:00', '00:30' ) ),
		);

		// Program 2 first: it appears on Monday.
		$this->assertSame( array( true, true ), $this->live( $schedule, '2026-10-19 00:10' ) );
		$this->assertSame( array( false, true ), $this->live( $schedule, '2026-10-19 00:45' ) );
	}

	/**
	 * The programs of a schedule.
	 *
	 * @param array<mixed> $schedule Stored schedule.
	 * @param string       $local    UTC date and time (Y-m-d H:i).
	 * @return array<int, array<string, mixed>>
	 */
	private function build( array $schedule, $local ) {
		return Programs_List_View::build( $schedule, $this->programs, $this->labels, self::instant( $local ), 'strval' );
	}

	/**
	 * The `is_live` flags of every slot, program by program.
	 *
	 * @param array<mixed> $schedule Stored schedule.
	 * @param string       $local    UTC date and time (Y-m-d H:i).
	 * @return bool[]
	 */
	private function live( array $schedule, $local ) {
		$live = array();
		foreach ( $this->build( $schedule, $local ) as $program ) {
			foreach ( $program['slots'] as $slot ) {
				$live[] = $slot['is_live'];
			}
		}
		return $live;
	}

	/**
	 * A UTC instant.
	 *
	 * @param string $local Date and time (Y-m-d H:i).
	 * @return DateTimeImmutable
	 */
	private static function instant( $local ) {
		return new DateTimeImmutable( $local, new DateTimeZone( 'UTC' ) );
	}

	/**
	 * A stored slot.
	 *
	 * @param mixed  $program_id Program ID.
	 * @param string $start      Start HH:MM.
	 * @param string $end        End HH:MM.
	 * @return array<string, mixed>
	 */
	private static function slot( $program_id, $start, $end ) {
		return array(
			'program_id' => $program_id,
			'start'      => $start,
			'end'        => $end,
		);
	}
}
