<?php
/**
 * Tests for RadioPlayerPage\Schedule\Now_Playing_Resolver.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Schedule;

use DateTimeImmutable;
use DateTimeZone;
use RadioPlayerPage\Schedule\Now_Playing_Resolver;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * The program on air and the next one coming up, with the 3.4.2 rules of
 * radplapag_get_now_playing_for_station(). 2026-10-19 is a Monday.
 */
final class NowPlayingResolverTest extends TestCase {

	/**
	 * Upcoming window, in minutes (RADPLAPAG_NOW_PLAYING_UPCOMING_WINDOW_MINUTES).
	 */
	const WINDOW = 10;

	/**
	 * Program ID => data, as the wrapper loads the published ones.
	 *
	 * @var array<int, array{name: string, logo_id: int}>
	 */
	private $programs = array(
		1 => array(
			'name'    => 'Morning',
			'logo_id' => 42,
		),
		2 => array(
			'name'    => 'Late',
			'logo_id' => 0,
		),
		3 => array(
			'name'    => 'Night',
			'logo_id' => -1,
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
	 * An empty schedule gives nothing on air and nothing coming up.
	 */
	public function test_empty_schedule() {
		$this->assertSame(
			array(
				'current'  => null,
				'upcoming' => null,
			),
			$this->resolve( array(), '2026-10-19 10:00' )
		);
	}

	/**
	 * `current` carries the logo and the labelled day; `upcoming` has the same shape without `logo_id`.
	 */
	public function test_shape_of_current_and_upcoming() {
		$schedule = array(
			'monday' => array(
				self::slot( 1, '09:00', '10:00' ),
				self::slot( '2', '10:05', '11:00', true ),
			),
		);

		$this->assertSame(
			array(
				'current'  => array(
					'id'         => '1',
					'name'       => 'Morning',
					'logo_id'    => 42,
					'day_label'  => 'Lunes',
					'time_range' => '09:00-10:00',
					'is_rerun'   => false,
				),
				'upcoming' => array(
					'id'         => '2',
					'name'       => 'Late',
					'day_label'  => 'Lunes',
					'time_range' => '10:05-11:00',
					'is_rerun'   => true,
				),
			),
			$this->resolve( $schedule, '2026-10-19 09:55' )
		);
	}

	/**
	 * A logo ID of 0 or less comes out as 0.
	 */
	public function test_logo_id_not_positive_is_zero() {
		$schedule = array( 'monday' => array( self::slot( 3, '09:00', '10:00' ) ) );

		$this->assertSame( 0, $this->resolve( $schedule, '2026-10-19 09:30' )['current']['logo_id'] );
	}

	/**
	 * A day without a label keeps its key as label.
	 */
	public function test_day_without_label_uses_its_key() {
		$schedule = array( 'monday' => array( self::slot( 1, '09:00', '10:00' ) ) );
		$result   = Now_Playing_Resolver::resolve( $schedule, $this->programs, array(), self::instant( '2026-10-19 09:30' ), self::WINDOW );

		$this->assertSame( 'monday', $result['current']['day_label'] );
	}

	/**
	 * The program ID is normalized: numeric strings and floats become their integer.
	 */
	public function test_program_id_is_normalized() {
		$schedule = array( 'monday' => array( self::slot( '1.7', '09:00', '10:00' ) ) );

		$this->assertSame( '1', $this->resolve( $schedule, '2026-10-19 09:30' )['current']['id'] );
	}

	/**
	 * `is_rerun` is any non-empty value.
	 */
	public function test_is_rerun_is_truthiness() {
		$slot             = self::slot( 1, '09:00', '10:00' );
		$slot['is_rerun'] = '1';
		$schedule         = array( 'monday' => array( $slot ) );

		$this->assertTrue( $this->resolve( $schedule, '2026-10-19 09:30' )['current']['is_rerun'] );

		unset( $schedule['monday'][0]['is_rerun'] );
		$this->assertFalse( $this->resolve( $schedule, '2026-10-19 09:30' )['current']['is_rerun'] );
	}

	/**
	 * The start is inclusive and the end exclusive.
	 */
	public function test_slot_bounds() {
		$schedule = array( 'monday' => array( self::slot( 1, '09:00', '10:00' ) ) );

		$this->assertNull( $this->resolve( $schedule, '2026-10-19 08:59' )['current'] );
		$this->assertSame( '1', $this->resolve( $schedule, '2026-10-19 09:00' )['current']['id'] );
		$this->assertSame( '1', $this->resolve( $schedule, '2026-10-19 09:59' )['current']['id'] );
		$this->assertNull( $this->resolve( $schedule, '2026-10-19 10:00' )['current'] );
	}

	/**
	 * Of two overlapping slots on air, the first in the day wins.
	 */
	public function test_first_active_slot_wins() {
		$schedule = array(
			'monday' => array(
				self::slot( 2, '09:30', '11:00' ),
				self::slot( 1, '09:00', '10:00' ),
			),
		);

		$this->assertSame( '2', $this->resolve( $schedule, '2026-10-19 09:45' )['current']['id'] );
	}

	/**
	 * D3: of two overlapping slots on air, the one that started latest wins, whatever their order.
	 */
	public function test_latest_started_slot_wins() {
		$schedule = array(
			'monday' => array(
				self::slot( 1, '09:00', '11:00' ),
				self::slot( 2, '09:30', '10:30' ),
			),
		);

		$this->assertSame( '2', $this->resolve( $schedule, '2026-10-19 09:45' )['current']['id'] );
		$this->assertSame( '2', $this->resolve( $schedule, '2026-10-19 09:30' )['current']['id'] );
	}

	/**
	 * D3: of two slots on air that started at the same minute, the first in the day wins.
	 */
	public function test_same_start_first_slot_wins() {
		$schedule = array(
			'monday' => array(
				self::slot( 2, '09:00', '10:00' ),
				self::slot( 1, '09:00', '11:00' ),
			),
		);

		$this->assertSame( '2', $this->resolve( $schedule, '2026-10-19 09:30' )['current']['id'] );
	}

	/**
	 * D3: of yesterday's slots that cross midnight, the one that started latest wins,
	 * labelled with its own day.
	 */
	public function test_latest_started_slot_wins_among_yesterdays() {
		$schedule = array(
			'monday' => array(
				self::slot( 1, '22:00', '02:00' ),
				self::slot( 2, '23:30', '01:00' ),
			),
		);

		$current = $this->resolve( $schedule, '2026-10-20 00:30' )['current'];
		$this->assertSame( '2', $current['id'] );
		$this->assertSame( 'Lunes', $current['day_label'] );
	}

	/**
	 * After midnight, yesterday's slot that crosses midnight is on air, labelled with its own day.
	 */
	public function test_previous_day_slot_crossing_midnight() {
		$schedule = array( 'sunday' => array( self::slot( 3, '23:00', '01:00' ) ) );

		$current = $this->resolve( $schedule, '2026-10-19 00:30' )['current'];
		$this->assertSame( '3', $current['id'] );
		$this->assertSame( 'Domingo', $current['day_label'] );
		$this->assertNull( $this->resolve( $schedule, '2026-10-19 01:00' )['current'] );
	}

	/**
	 * Today's slot wins over yesterday's crossing one.
	 */
	public function test_today_wins_over_yesterday() {
		$schedule = array(
			'sunday' => array( self::slot( 3, '23:00', '02:00' ) ),
			'monday' => array( self::slot( 1, '00:00', '06:00' ) ),
		);

		$this->assertSame( '1', $this->resolve( $schedule, '2026-10-19 01:00' )['current']['id'] );
	}

	/**
	 * An upcoming slot starts strictly after now and within the window, inclusive.
	 */
	public function test_upcoming_window_bounds() {
		$schedule = array( 'monday' => array( self::slot( 1, '10:00', '11:00' ) ) );

		$this->assertNull( $this->resolve( $schedule, '2026-10-19 09:49' )['upcoming'] );
		$this->assertSame( '1', $this->resolve( $schedule, '2026-10-19 09:50' )['upcoming']['id'] );
		$this->assertSame( '1', $this->resolve( $schedule, '2026-10-19 09:59' )['upcoming']['id'] );
		$this->assertNull( $this->resolve( $schedule, '2026-10-19 10:00' )['upcoming'] );
	}

	/**
	 * The window is a parameter.
	 */
	public function test_window_is_a_parameter() {
		$schedule = array( 'monday' => array( self::slot( 1, '10:00', '11:00' ) ) );
		$result   = Now_Playing_Resolver::resolve( $schedule, $this->programs, $this->labels, self::instant( '2026-10-19 09:40' ), 20 );

		$this->assertSame( '1', $result['upcoming']['id'] );
	}

	/**
	 * The nearest upcoming slot wins; on a tie, the first one.
	 */
	public function test_nearest_upcoming_wins() {
		$schedule = array(
			'monday' => array(
				self::slot( 2, '10:05', '11:00' ),
				self::slot( 1, '10:02', '11:00' ),
				self::slot( 3, '10:02', '11:00' ),
			),
		);

		$this->assertSame( '1', $this->resolve( $schedule, '2026-10-19 10:00' )['upcoming']['id'] );
	}

	/**
	 * Near midnight, tomorrow's first slots count as upcoming, labelled with their day.
	 */
	public function test_upcoming_after_midnight() {
		$schedule = array( 'tuesday' => array( self::slot( 2, '00:05', '01:00' ) ) );

		$this->assertNull( $this->resolve( $schedule, '2026-10-19 23:49' )['upcoming'] );
		$upcoming = $this->resolve( $schedule, '2026-10-19 23:58' )['upcoming'];
		$this->assertSame( '2', $upcoming['id'] );
		$this->assertSame( 'Martes', $upcoming['day_label'] );
	}

	/**
	 * Today's slot that starts sooner wins over tomorrow's; on a tie, today's.
	 */
	public function test_today_upcoming_wins_over_tomorrow_on_tie() {
		$schedule = array(
			'monday'  => array( self::slot( 1, '23:59', '23:59' ) ),
			'tuesday' => array( self::slot( 2, '00:00', '01:00' ) ),
		);

		$this->assertSame( '1', $this->resolve( $schedule, '2026-10-19 23:58' )['upcoming']['id'] );
		$this->assertSame( '2', $this->resolve( $schedule, '2026-10-19 23:59' )['upcoming']['id'] );
	}

	/**
	 * Sunday wraps to Monday for upcoming, and Monday looks back at Sunday for current.
	 */
	public function test_week_wraps_around() {
		$schedule = array(
			'monday' => array( self::slot( 1, '00:05', '01:00' ) ),
			'sunday' => array( self::slot( 3, '22:00', '00:02' ) ),
		);

		$this->assertSame( '1', $this->resolve( $schedule, '2026-10-18 23:58' )['upcoming']['id'] );
		$this->assertSame( '3', $this->resolve( $schedule, '2026-10-19 00:01' )['current']['id'] );
	}

	/**
	 * The day and minute are those of the instant's own timezone.
	 */
	public function test_uses_the_timezone_of_now() {
		$schedule = array( 'monday' => array( self::slot( 1, '22:00', '23:00' ) ) );
		$now      = ( new DateTimeImmutable( '2026-10-20T03:30:00Z' ) )->setTimezone( new DateTimeZone( '-05:00' ) );
		$result   = Now_Playing_Resolver::resolve( $schedule, $this->programs, $this->labels, $now, self::WINDOW );

		$this->assertSame( '1', $result['current']['id'] );
	}

	/**
	 * On the day daylight saving time starts, the slot on air is that of the local wall time.
	 */
	public function test_daylight_saving_time() {
		$schedule = array(
			'sunday' => array(
				self::slot( 1, '01:00', '03:00' ),
				self::slot( 2, '03:00', '04:00' ),
			),
		);
		$now      = ( new DateTimeImmutable( '2026-03-29T01:30:00Z' ) )->setTimezone( new DateTimeZone( 'Europe/Madrid' ) );
		$result   = Now_Playing_Resolver::resolve( $schedule, $this->programs, $this->labels, $now, self::WINDOW );

		$this->assertSame( '2', $result['current']['id'] );
	}

	/**
	 * A slot whose program is not in the map (draft, deleted) is not on air: `current` is null.
	 */
	public function test_unknown_program_is_not_on_air() {
		$schedule = array( 'monday' => array( self::slot( 99, '09:00', '10:00' ) ) );

		$this->assertNull( $this->resolve( $schedule, '2026-10-19 09:30' )['current'] );
	}

	/**
	 * C10: a slot whose program is unknown is skipped even when it started latest,
	 * so the known program on air wins (approved edit in the phase 2 plan of spec 0009).
	 *
	 * @see docs/known-issues.md C10
	 */
	public function test_unknown_program_that_started_latest_is_skipped() {
		$schedule = array(
			'sunday' => array( self::slot( 3, '23:00', '02:00' ) ),
			'monday' => array(
				self::slot( 99, '00:00', '06:00' ),
				self::slot( 1, '00:00', '06:00' ),
			),
		);

		$this->assertSame( '1', $this->resolve( $schedule, '2026-10-19 01:00' )['current']['id'] );
	}

	/**
	 * Malformed entries are skipped: days that are not arrays, entries that are not
	 * arrays, slots without start (or end, for current) and slots whose program ID is
	 * missing or not numeric (C10; approved edit in the phase 2 plan of spec 0009).
	 */
	public function test_malformed_entries_are_skipped() {
		$schedule = array(
			'sunday'  => 'not a day',
			'monday'  => array(
				'not an entry',
				array(
					'program_id' => 1,
					'end'        => '23:59',
				),
				array(
					'program_id' => 1,
					'start'      => '23:00',
				),
				array(
					'program_id' => 'not numeric',
					'start'      => '23:50',
					'end'        => '23:58',
				),
				self::slot( 3, '23:50', '23:59' ),
			),
			'tuesday' => array(
				'not an entry',
				array(
					'program_id' => 1,
					'end'        => '01:00',
				),
				self::slot( 2, '00:03', '01:00' ),
			),
		);

		$result = $this->resolve( $schedule, '2026-10-19 23:55' );

		$this->assertSame( '3', $result['current']['id'] );
		$this->assertSame( '2', $result['upcoming']['id'] );
		$this->assertSame( '00:03-01:00', $result['upcoming']['time_range'] );
	}

	/**
	 * A slot without program ID that is coming up gives a null `upcoming`.
	 */
	public function test_upcoming_without_program_id_is_null() {
		$schedule = array(
			'monday' => array(
				array(
					'start' => '10:05',
					'end'   => '11:00',
				),
			),
		);

		$this->assertNull( $this->resolve( $schedule, '2026-10-19 10:00' )['upcoming'] );
	}

	/**
	 * C10 (variant): a slot of a program not in the map within the upcoming window
	 * is skipped, so the program after it is announced.
	 *
	 * @see docs/known-issues.md C10
	 */
	public function test_unknown_program_slot_does_not_hide_the_next_upcoming_program() {
		$schedule = array(
			'monday' => array(
				self::slot( 99, '10:00', '10:05' ),
				self::slot( 1, '10:05', '11:00' ),
			),
		);

		$this->assertSame( '1', $this->resolve( $schedule, '2026-10-19 09:58' )['upcoming']['id'] );
	}

	/**
	 * K52: a 24-hour slot on every day is not announced as coming up while it is on air.
	 *
	 * @see docs/known-issues.md K52
	 */
	public function test_24_hour_slot_is_not_coming_up_while_on_air() {
		$schedule = array();
		foreach ( array_keys( $this->labels ) as $day ) {
			$schedule[ $day ] = array( self::slot( 1, '00:00', '00:00' ) );
		}

		$result = $this->resolve( $schedule, '2026-10-19 23:55' );

		$this->assertSame( '1', $result['current']['id'] );
		$this->assertNull( $result['upcoming'] );
	}

	/**
	 * K52: the second half of a program split at midnight is not announced as coming up.
	 *
	 * @see docs/known-issues.md K52
	 */
	public function test_second_half_of_program_split_at_midnight_is_not_coming_up() {
		$schedule = array(
			'monday'  => array( self::slot( 1, '22:00', '00:00' ) ),
			'tuesday' => array( self::slot( 1, '00:00', '02:00' ) ),
		);

		$result = $this->resolve( $schedule, '2026-10-19 23:55' );

		$this->assertSame( '22:00-00:00', $result['current']['time_range'] );
		$this->assertNull( $result['upcoming'] );
	}

	/**
	 * K52: another program starting when the current one ends is still coming up.
	 */
	public function test_other_program_starting_at_the_end_is_coming_up() {
		$schedule = array(
			'monday'  => array( self::slot( 1, '22:00', '00:00' ) ),
			'tuesday' => array( self::slot( 2, '00:00', '02:00' ) ),
		);

		$result = $this->resolve( $schedule, '2026-10-19 23:55' );

		$this->assertSame( '1', $result['current']['id'] );
		$this->assertSame( '2', $result['upcoming']['id'] );
	}

	/**
	 * K52: the same program starting later than the end of the current one is still coming up.
	 */
	public function test_same_program_after_a_gap_is_coming_up() {
		$schedule = array(
			'monday' => array(
				self::slot( 1, '22:00', '23:55' ),
				self::slot( 1, '23:58', '01:00' ),
			),
		);

		$result = $this->resolve( $schedule, '2026-10-19 23:54' );

		$this->assertSame( '22:00-23:55', $result['current']['time_range'] );
		$this->assertSame( '23:58-01:00', $result['upcoming']['time_range'] );
	}

	/**
	 * Resolves with the test programs, labels and window at a UTC wall time.
	 *
	 * @param array<string, mixed> $schedule Schedule keyed by day.
	 * @param string               $local    Date and time (Y-m-d H:i), UTC.
	 * @return array{current: array<string, mixed>|null, upcoming: array<string, mixed>|null}
	 */
	private function resolve( array $schedule, $local ) {
		return Now_Playing_Resolver::resolve( $schedule, $this->programs, $this->labels, self::instant( $local ), self::WINDOW );
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
	 * @param int|string $program_id Program ID.
	 * @param string     $start      Start HH:MM.
	 * @param string     $end        End HH:MM.
	 * @param bool       $is_rerun   Whether it is a rerun.
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
