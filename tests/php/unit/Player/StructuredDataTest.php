<?php
/**
 * Tests for RadioPlayerPage\Player\Structured_Data.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Player;

use RadioPlayerPage\Player\Structured_Data;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * The schema.org JSON-LD of the clean page (ADR 0070).
 */
final class StructuredDataTest extends TestCase {

	const URL = 'https://example.com/radio/';

	/**
	 * The station as the clean page passes it.
	 *
	 * @param array<string, mixed> $overrides Keys to replace.
	 * @return array<string, mixed>
	 */
	private static function station( array $overrides = array() ): array {
		return array_merge(
			array(
				'name'           => 'Radio One',
				'url'            => self::URL,
				'logo_url'       => 'https://example.com/logo.png',
				'background_url' => 'https://example.com/bg.jpg',
				'in_language'    => 'en-US',
			),
			$overrides
		);
	}

	/**
	 * A program as Globals_Builder::programs() gives it.
	 *
	 * @param string      $id          Program ID.
	 * @param string      $name        Name.
	 * @param string|null $description Short description.
	 * @param string|null $logo_url    Logo URL.
	 * @return array<string, mixed>
	 */
	private static function program( string $id, string $name, ?string $description = null, ?string $logo_url = null ): array {
		return array(
			'id'                  => $id,
			'name'                => $name,
			'description'         => $description,
			'extendedDescription' => 'Extended, never printed.',
			'logoUrl'             => $logo_url,
		);
	}

	/**
	 * A slot as Globals_Builder::schedule() gives it.
	 *
	 * @param string $program_id Program ID.
	 * @param string $start      Start time.
	 * @param string $end        End time.
	 * @param bool   $is_rerun   Rerun flag.
	 * @return array<string, mixed>
	 */
	private static function slot( string $program_id, string $start, string $end, bool $is_rerun = false ): array {
		return array(
			'program_id' => $program_id,
			'start'      => $start,
			'end'        => $end,
			'is_rerun'   => $is_rerun,
		);
	}

	/**
	 * The graph, in a zone by default.
	 *
	 * @param array<string, mixed>                $station  Station.
	 * @param list<array<string, mixed>>          $programs Programs.
	 * @param array<string, list<array<string, mixed>>> $schedule Schedule.
	 * @param string|null                         $timezone IANA zone or null.
	 * @param string                              $offset   Offset `±HH:MM`.
	 * @return array<string, mixed>
	 */
	private static function graph( array $station, array $programs = array(), array $schedule = array(), ?string $timezone = 'Europe/Madrid', string $offset = '+01:00' ): array {
		return Structured_Data::graph( $station, $programs, $schedule, $timezone, $offset );
	}

	/**
	 * The events of a graph, after the station node.
	 *
	 * @param array<string, mixed> $graph Graph.
	 * @return list<array<string, mixed>>
	 */
	private static function events( array $graph ): array {
		return array_slice( $graph['@graph'], 1 );
	}

	/**
	 * Without slots, the graph is only the station, without event.
	 */
	public function test_without_slots_only_the_station() {
		$this->assertSame(
			array(
				'@context' => 'https://schema.org',
				'@graph'   => array(
					array(
						'@type' => 'RadioStation',
						'@id'   => self::URL . '#station',
						'name'  => 'Radio One',
						'url'   => self::URL,
						'logo'  => 'https://example.com/logo.png',
						'image' => 'https://example.com/logo.png',
					),
				),
			),
			self::graph( self::station(), array( self::program( '12', 'Morning' ) ) )
		);
	}

	/**
	 * The image is the logo, else the background; without media, neither logo nor image.
	 */
	public function test_logo_and_image() {
		$background = self::graph( self::station( array( 'logo_url' => null ) ) )['@graph'][0];
		$this->assertArrayNotHasKey( 'logo', $background );
		$this->assertSame( 'https://example.com/bg.jpg', $background['image'] );

		$none = self::graph(
			self::station(
				array(
					'logo_url'       => '',
					'background_url' => '',
				)
			)
		)['@graph'][0];
		$this->assertArrayNotHasKey( 'logo', $none );
		$this->assertArrayNotHasKey( 'image', $none );
	}

	/**
	 * A program with one slot gives one event, linked from the station.
	 */
	public function test_one_event_per_program() {
		$graph = self::graph(
			self::station(),
			array( self::program( '12', 'Morning', 'Wake up.', 'https://example.com/p12.png' ) ),
			array( 'monday' => array( self::slot( '12', '06:00', '10:00' ) ) )
		);

		$this->assertSame( array( array( '@id' => self::URL . '#program-12' ) ), $graph['@graph'][0]['event'] );

		$events = self::events( $graph );
		$this->assertCount( 1, $events );
		$event = $events[0];
		unset( $event['eventSchedule'] );
		$this->assertSame(
			array(
				'@type'               => 'BroadcastEvent',
				'@id'                 => self::URL . '#program-12',
				'name'                => 'Morning',
				'description'         => 'Wake up.',
				'image'               => 'https://example.com/p12.png',
				'isLiveBroadcast'     => true,
				'inLanguage'          => 'en-US',
				'eventAttendanceMode' => 'https://schema.org/OnlineEventAttendanceMode',
				'location'            => array(
					'@type' => 'VirtualLocation',
					'url'   => self::URL,
				),
				'organizer'           => array( '@id' => self::URL . '#station' ),
			),
			$event
		);
		$this->assertCount( 1, $events[0]['eventSchedule'] );
	}

	/**
	 * A null description and logo are left out.
	 */
	public function test_null_description_and_logo_are_left_out() {
		$events = self::events(
			self::graph(
				self::station(),
				array( self::program( '12', 'Morning' ) ),
				array( 'monday' => array( self::slot( '12', '06:00', '10:00' ) ) )
			)
		);

		$this->assertArrayNotHasKey( 'description', $events[0] );
		$this->assertArrayNotHasKey( 'image', $events[0] );
	}

	/**
	 * The slots of a program are grouped, and its reruns go in another event, after the live one.
	 */
	public function test_slots_are_grouped_and_reruns_apart() {
		$graph  = self::graph(
			self::station(),
			array( self::program( '12', 'Morning' ) ),
			array(
				'monday'  => array( self::slot( '12', '06:00', '10:00', true ) ),
				'tuesday' => array( self::slot( '12', '06:00', '10:00' ) ),
				'friday'  => array( self::slot( '12', '06:00', '10:00' ) ),
			)
		);
		$events = self::events( $graph );

		$this->assertSame(
			array( self::URL . '#program-12', self::URL . '#program-12-rerun' ),
			array_column( $events, '@id' )
		);
		$this->assertSame( array( true, false ), array_column( $events, 'isLiveBroadcast' ) );
		$this->assertCount( 2, $events[0]['eventSchedule'] );
		$this->assertCount( 1, $events[1]['eventSchedule'] );
		$this->assertSame(
			array( array( '@id' => self::URL . '#program-12' ), array( '@id' => self::URL . '#program-12-rerun' ) ),
			$graph['@graph'][0]['event']
		);
	}

	/**
	 * The events follow the order of the programs (first appearance, K78), not of the slots.
	 */
	public function test_events_follow_the_order_of_the_programs() {
		$events = self::events(
			self::graph(
				self::station(),
				array( self::program( '7', 'B' ), self::program( '3', 'A' ) ),
				array(
					'monday'  => array( self::slot( '3', '06:00', '07:00' ) ),
					'tuesday' => array( self::slot( '7', '06:00', '07:00' ) ),
				)
			)
		);

		$this->assertSame( array( 'B', 'A' ), array_column( $events, 'name' ) );
	}

	/**
	 * A slot of a program that is not in the list is left out, and a program without slots has no event.
	 */
	public function test_slots_of_unknown_programs_are_left_out() {
		$graph = self::graph(
			self::station(),
			array( self::program( '12', 'Morning' ), self::program( '13', 'Idle' ) ),
			array( 'monday' => array( self::slot( '99', '06:00', '07:00' ), self::slot( '12', '08:00', '09:00' ) ) )
		);

		$this->assertSame( array( 'Morning' ), array_column( self::events( $graph ), 'name' ) );
		$this->assertCount( 1, $graph['@graph'][0]['event'] );
	}

	/**
	 * The schedule of one program in a graph.
	 *
	 * @param array<string, list<array<string, mixed>>> $schedule Schedule of program 12.
	 * @param string|null                               $timezone IANA zone or null.
	 * @param string                                    $offset   Offset.
	 * @return list<array<string, mixed>>
	 */
	private static function schedule_of( array $schedule, ?string $timezone = 'Europe/Madrid', string $offset = '+01:00' ): array {
		$events = self::events( self::graph( self::station(), array( self::program( '12', 'Morning' ) ), $schedule, $timezone, $offset ) );
		return isset( $events[0] ) ? $events[0]['eventSchedule'] : array();
	}

	/**
	 * A slot that crosses midnight keeps its end and gets the duration that disambiguates it.
	 */
	public function test_slot_across_midnight() {
		$this->assertSame(
			array(
				array(
					'@type'            => 'Schedule',
					'byDay'            => 'https://schema.org/Monday',
					'startTime'        => '23:00:00',
					'endTime'          => '01:00:00',
					'duration'         => 'PT2H',
					'repeatFrequency'  => 'P1W',
					'scheduleTimezone' => 'Europe/Madrid',
				),
			),
			self::schedule_of( array( 'monday' => array( self::slot( '12', '23:00', '01:00' ) ) ) )
		);
	}

	/**
	 * Durations leave out the zero parts; start == end lasts 24 hours.
	 *
	 * @dataProvider data_durations
	 *
	 * @param string $start    Start.
	 * @param string $end      End.
	 * @param string $duration Expected duration.
	 */
	public function test_duration( $start, $end, $duration ) {
		$schedule = self::schedule_of( array( 'monday' => array( self::slot( '12', $start, $end ) ) ) );

		$this->assertSame( $duration, $schedule[0]['duration'] );
	}

	/**
	 * Inputs for test_duration().
	 *
	 * @return array<string, array{string, string, string}>
	 */
	public function data_durations() {
		return array(
			'hours'               => array( '06:00', '10:00', 'PT4H' ),
			'hours and minutes'   => array( '06:00', '07:30', 'PT1H30M' ),
			'minutes, past 00:00' => array( '23:55', '00:30', 'PT35M' ),
			'one minute'          => array( '06:00', '06:01', 'PT1M' ),
			'24 hours at 00:00'   => array( '00:00', '00:00', 'PT24H' ),
			'24 hours at 06:00'   => array( '06:00', '06:00', 'PT24H' ),
		);
	}

	/**
	 * The seven days map to the schema.org days, in the order of the week whatever the order of the keys.
	 */
	public function test_days_in_the_order_of_the_week() {
		$schedule = array();
		foreach ( array( 'sunday', 'saturday', 'friday', 'thursday', 'wednesday', 'tuesday', 'monday' ) as $day ) {
			$schedule[ $day ] = array( self::slot( '12', '06:00', '07:00' ) );
		}

		$this->assertSame(
			array(
				'https://schema.org/Monday',
				'https://schema.org/Tuesday',
				'https://schema.org/Wednesday',
				'https://schema.org/Thursday',
				'https://schema.org/Friday',
				'https://schema.org/Saturday',
				'https://schema.org/Sunday',
			),
			array_column( self::schedule_of( $schedule ), 'byDay' )
		);
	}

	/**
	 * The slots of a day keep their order.
	 */
	public function test_slots_of_a_day_keep_their_order() {
		$schedule = self::schedule_of(
			array( 'monday' => array( self::slot( '12', '06:00', '07:00' ), self::slot( '12', '20:00', '21:00' ) ) )
		);

		$this->assertSame( array( '06:00:00', '20:00:00' ), array_column( $schedule, 'startTime' ) );
	}

	/**
	 * A slot with a time that is not a strict HH:MM, or on an unknown day, is left out.
	 *
	 * @dataProvider data_unprintable_slots
	 *
	 * @param string $day   Day key.
	 * @param mixed  $start Start.
	 * @param mixed  $end   End.
	 */
	public function test_unprintable_slot_is_left_out( $day, $start, $end ) {
		$schedule = self::schedule_of(
			array(
				$day     => array(
					array(
						'program_id' => '12',
						'start'      => $start,
						'end'        => $end,
						'is_rerun'   => false,
					),
				),
				'friday' => array( self::slot( '12', '06:00', '07:00' ) ),
			)
		);

		$this->assertSame( array( 'https://schema.org/Friday' ), array_column( $schedule, 'byDay' ) );
	}

	/**
	 * Inputs for test_unprintable_slot_is_left_out().
	 *
	 * @return array<string, array{string, mixed, mixed}>
	 */
	public function data_unprintable_slots() {
		return array(
			'single-digit hour' => array( 'monday', '7:00', '08:00' ),
			'24:00'             => array( 'monday', '06:00', '24:00' ),
			'minute 60'         => array( 'monday', '06:60', '08:00' ),
			'seconds'           => array( 'monday', '06:00:00', '08:00' ),
			'text'              => array( 'monday', 'abc', '08:00' ),
			'not a string'      => array( 'monday', 600, '08:00' ),
			'trailing newline'  => array( 'monday', "06:00\n", '08:00' ),
			'unknown day'       => array( 'funday', '06:00', '08:00' ),
			'capitalized day'   => array( 'Monday', '06:00', '08:00' ),
		);
	}

	/**
	 * A program whose slots are all left out has no event.
	 */
	public function test_program_without_printable_slots_has_no_event() {
		$graph = self::graph(
			self::station(),
			array( self::program( '12', 'Morning' ) ),
			array( 'monday' => array( self::slot( '12', '7:00', '08:00' ) ) )
		);

		$this->assertCount( 1, $graph['@graph'] );
		$this->assertArrayNotHasKey( 'event', $graph['@graph'][0] );
	}

	/**
	 * Without a zone (a manual offset), no scheduleTimezone and each time carries the offset.
	 *
	 * @dataProvider data_offsets
	 *
	 * @param string $offset Offset of the site.
	 */
	public function test_manual_offset( $offset ) {
		$schedule = self::schedule_of( array( 'monday' => array( self::slot( '12', '23:00', '01:00' ) ) ), null, $offset );

		$this->assertArrayNotHasKey( 'scheduleTimezone', $schedule[0] );
		$this->assertSame( '23:00:00' . $offset, $schedule[0]['startTime'] );
		$this->assertSame( '01:00:00' . $offset, $schedule[0]['endTime'] );
		$this->assertSame( 'PT2H', $schedule[0]['duration'] );
	}

	/**
	 * Inputs for test_manual_offset().
	 *
	 * @return array<string, array{string}>
	 */
	public function data_offsets() {
		return array(
			'+05:30' => array( '+05:30' ),
			'-03:30' => array( '-03:30' ),
			'+00:00' => array( '+00:00' ),
		);
	}
}
