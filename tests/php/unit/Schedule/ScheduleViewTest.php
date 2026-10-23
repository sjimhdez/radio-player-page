<?php
/**
 * Tests for RadioPlayerPage\Schedule\Schedule_View.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Schedule;

use DateTimeImmutable;
use DateTimeZone;
use RadioPlayerPage\Schedule\Schedule_View;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * The days of the schedule block, with the 3.4.2 rules of
 * radplapag_get_schedule_for_station() and radplapag_build_programs_map().
 * 2026-10-19 is a Monday.
 */
final class ScheduleViewTest extends TestCase {

	/**
	 * Program ID => data, as radplapag_build_programs_map() returns them.
	 *
	 * @var array<int|string, array{name: string, description: string|null, extended_description: string|null, logo_url: string|null}>
	 */
	private $programs = array(
		'1' => array(
			'name'                 => 'Morning',
			'description'          => 'Wake up',
			'extended_description' => 'Wake up with us',
			'logo_url'             => 'https://example.com/logo.png',
		),
		'2' => array(
			'name'                 => 'Late',
			'description'          => null,
			'extended_description' => null,
			'logo_url'             => null,
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
	 * order they first appear in the stored schedule.
	 */
	public function test_program_ids() {
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
		);

		$this->assertSame( array( 7, 3, 5 ), Schedule_View::program_ids( $schedule ) );
	}

	/**
	 * An empty schedule has no program IDs.
	 */
	public function test_program_ids_of_empty_schedule() {
		$this->assertSame( array(), Schedule_View::program_ids( array() ) );
	}

	/**
	 * `natural` gives the seven days Monday to Sunday, with their labels and no
	 * slots when the day is missing or is not an array.
	 */
	public function test_natural_order_has_the_seven_days() {
		$days = $this->days( array( 'tuesday' => 'not a day' ), '2026-10-21 10:00', 'natural' );

		$this->assertSame(
			array( 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday' ),
			array_column( $days, 'day_key' )
		);
		$this->assertSame( array_values( $this->labels ), array_column( $days, 'label' ) );
		$this->assertSame( array_fill( 0, 7, array() ), array_column( $days, 'slots' ) );
	}

	/**
	 * `current_first` starts with today and wraps around the week.
	 *
	 * @dataProvider current_first_cases
	 *
	 * @param string $local Date and time (Y-m-d H:i).
	 * @param string $first Expected first day key.
	 * @param string $last  Expected last day key.
	 */
	public function test_current_first_starts_with_today( $local, $first, $last ) {
		$days = $this->days( array(), $local, 'current_first' );

		$this->assertCount( 7, $days );
		$this->assertSame( $first, $days[0]['day_key'] );
		$this->assertSame( $last, $days[6]['day_key'] );
	}

	/**
	 * Today and the expected first and last days.
	 *
	 * @return array<string, array{string, string, string}>
	 */
	public function current_first_cases() {
		return array(
			'monday'    => array( '2026-10-19 10:00', 'monday', 'sunday' ),
			'wednesday' => array( '2026-10-21 10:00', 'wednesday', 'tuesday' ),
			'sunday'    => array( '2026-10-25 10:00', 'sunday', 'saturday' ),
		);
	}

	/**
	 * Any order other than `current_first` keeps Monday to Sunday.
	 */
	public function test_unknown_order_is_natural() {
		$days = $this->days( array(), '2026-10-21 10:00', 'something' );

		$this->assertSame( 'monday', $days[0]['day_key'] );
	}

	/**
	 * A day without a label keeps its key as label.
	 */
	public function test_day_without_label_uses_its_key() {
		$days = Schedule_View::days( array(), $this->programs, array( 'monday' => 'Lunes' ), self::instant( '2026-10-19 10:00' ), 'natural', 'strval' );

		$this->assertSame( 'Lunes', $days[0]['label'] );
		$this->assertSame( 'tuesday', $days[1]['label'] );
	}

	/**
	 * A slot carries its program's name and descriptions, its times and its flags;
	 * a null description comes out as an empty string.
	 */
	public function test_slot_shape() {
		$schedule = array(
			'monday' => array(
				self::slot( 1, '09:00', '10:00' ),
				self::slot( '2', '10:00', '11:00', true ),
			),
		);

		$this->assertSame(
			array(
				array(
					'program_id'                   => '1',
					'program_name'                 => 'Morning',
					'program_description'          => 'Wake up',
					'program_extended_description' => 'Wake up with us',
					'start'                        => '09:00',
					'end'                          => '10:00',
					'time_range'                   => '09:00-10:00',
					'is_live'                      => true,
					'is_rerun'                     => false,
				),
				array(
					'program_id'                   => '2',
					'program_name'                 => 'Late',
					'program_description'          => '',
					'program_extended_description' => '',
					'start'                        => '10:00',
					'end'                          => '11:00',
					'time_range'                   => '10:00-11:00',
					'is_live'                      => false,
					'is_rerun'                     => true,
				),
			),
			$this->days( $schedule, '2026-10-19 09:30', 'natural' )[0]['slots']
		);
	}

	/**
	 * `is_rerun` is any non-empty value.
	 */
	public function test_is_rerun_is_truthiness() {
		$slot             = self::slot( 1, '09:00', '10:00' );
		$slot['is_rerun'] = '1';
		$days             = $this->days( array( 'monday' => array( $slot ) ), '2026-10-19 12:00', 'natural' );

		$this->assertTrue( $days[0]['slots'][0]['is_rerun'] );
	}

	/**
	 * A slot whose program is not in the map stays, with an empty name and descriptions.
	 */
	public function test_unknown_program_has_empty_name() {
		$days = $this->days( array( 'monday' => array( self::slot( 9, '09:00', '10:00' ) ) ), '2026-10-19 12:00', 'natural' );
		$slot = $days[0]['slots'][0];

		$this->assertSame( '9', $slot['program_id'] );
		$this->assertSame( '', $slot['program_name'] );
		$this->assertSame( '', $slot['program_description'] );
		$this->assertSame( '', $slot['program_extended_description'] );
	}

	/**
	 * The program ID goes through the sanitizer as a string, and the program is
	 * looked up by the sanitized ID (not normalized: "1.7" is not program 1).
	 */
	public function test_program_id_goes_through_the_sanitizer() {
		$schedule = array(
			'monday' => array(
				self::slot( ' 1 ', '09:00', '10:00' ),
				self::slot( '1.7', '10:00', '11:00' ),
			),
		);
		$seen     = array();
		$sanitize = function ( $value ) use ( &$seen ) {
			$seen[] = $value;
			return trim( $value );
		};

		$slots = Schedule_View::days( $schedule, $this->programs, $this->labels, self::instant( '2026-10-19 12:00' ), 'natural', $sanitize )[0]['slots'];

		$this->assertSame( array( ' 1 ', '1.7' ), $seen );
		$this->assertSame( array( '1', '1.7' ), array_column( $slots, 'program_id' ) );
		$this->assertSame( array( 'Morning', '' ), array_column( $slots, 'program_name' ) );
	}

	/**
	 * Entries that are not arrays, or have no program ID, start or end (after the
	 * sanitizer), are skipped.
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
				self::slot( 1, '', '09:00' ),
				self::slot( 1, '08:00', '' ),
				self::slot( 'drop', '08:00', '09:00' ),
				self::slot( 1, '09:00', '10:00' ),
			),
		);
		$sanitize = function ( $value ) {
			return 'drop' === $value ? '' : $value;
		};

		$slots = Schedule_View::days( $schedule, $this->programs, $this->labels, self::instant( '2026-10-19 12:00' ), 'natural', $sanitize )[0]['slots'];

		$this->assertSame( array( '09:00-10:00' ), array_column( $slots, 'time_range' ) );
	}

	/**
	 * Slots are sorted by start time in minutes ("7:05" is before "08:00").
	 */
	public function test_slots_sorted_by_start() {
		$schedule = array(
			'monday' => array(
				self::slot( 1, '18:00', '19:00' ),
				self::slot( 1, '08:00', '09:00' ),
				self::slot( 1, '7:05', '08:00' ),
				self::slot( 1, '12:00', '13:00' ),
			),
		);

		$slots = $this->days( $schedule, '2026-10-19 23:00', 'natural' )[0]['slots'];

		$this->assertSame( array( '7:05', '08:00', '12:00', '18:00' ), array_column( $slots, 'start' ) );
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
			'sunday'  => array(
				self::slot( 1, '23:00', '02:00' ),
				self::slot( 2, '20:00', '21:00' ),
			),
			'tuesday' => array( self::slot( 1, '23:00', '02:00' ) ),
		);

		// Tuesday's slot first, then Sunday's sorted by start (20:00, 23:00).
		$this->assertSame( array( false, false, true ), $this->live( $schedule, '2026-10-19 01:59' ) );
		$this->assertSame( array( false, false, false ), $this->live( $schedule, '2026-10-19 02:00' ) );
	}

	/**
	 * Sunday is the day before Monday, and Saturday the day before Sunday.
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

		$days = Schedule_View::days( $schedule, $this->programs, $this->labels, $now, 'current_first', 'strval' );

		$this->assertSame( 'sunday', $days[0]['day_key'] );
		$this->assertTrue( $days[0]['slots'][0]['is_live'] );
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
			$days = Schedule_View::days( $schedule, $this->programs, $this->labels, $instant->setTimezone( $madrid ), 'natural', 'strval' );
			$this->assertTrue( $days[6]['slots'][0]['is_live'], $instant->format( 'c' ) );
		}
	}

	/**
	 * A slot that crosses midnight is not live in the early morning of its own day;
	 * only yesterday's slot, really on air, is (vector 13: Monday 00:10).
	 *
	 * @see docs/known-issues.md C16
	 */
	public function test_midnight_slot_is_not_live_early_on_its_own_day() {
		$schedule = array(
			'sunday' => array( self::slot( 1, '23:00', '01:00' ) ),
			'monday' => array( self::slot( 2, '23:00', '00:30' ) ),
		);

		$this->assertSame( array( false, true ), $this->live( $schedule, '2026-10-19 00:10' ) );
		$this->assertSame( array( true, false ), $this->live( $schedule, '2026-10-19 23:10' ) );
	}

	/**
	 * The days of a schedule, Monday first or today first.
	 *
	 * @param array<mixed> $schedule  Stored schedule.
	 * @param string       $local     UTC date and time (Y-m-d H:i).
	 * @param string       $day_order Day order.
	 * @return array<int, array<string, mixed>>
	 */
	private function days( array $schedule, $local, $day_order ) {
		return Schedule_View::days( $schedule, $this->programs, $this->labels, self::instant( $local ), $day_order, 'strval' );
	}

	/**
	 * The `is_live` flags of every slot, Monday to Sunday.
	 *
	 * @param array<mixed> $schedule Stored schedule.
	 * @param string       $local    UTC date and time (Y-m-d H:i).
	 * @return bool[]
	 */
	private function live( array $schedule, $local ) {
		$live = array();
		foreach ( $this->days( $schedule, $local, 'natural' ) as $day ) {
			foreach ( $day['slots'] as $slot ) {
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
	 * @param bool   $is_rerun   Whether it is a rerun.
	 * @return array<string, mixed>
	 */
	private static function slot( $program_id, $start, $end, $is_rerun = false ) {
		return array(
			'program_id' => $program_id,
			'start'      => $start,
			'end'        => $end,
			'is_rerun'   => $is_rerun,
		);
	}
}
