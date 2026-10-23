<?php
/**
 * Characterization of radplapag_get_now_playing_for_station() (3.4.2) with the shared
 * `resolution` vectors.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Schedule;

use RadioPlayerPage\Tests\Integration\Support\Clock;
use RadioPlayerPage\Tests\Integration\Support\Factory;
use WP_UnitTestCase;

/**
 * Pins which program the server reports as on air and coming up: every `resolution`
 * vector at its local day and minute, plus the shape of the result, invalid indexes,
 * the station page URL and draft programs.
 */
final class ScheduleVectorsTest extends WP_UnitTestCase {

	/**
	 * Fixture factory.
	 *
	 * @var Factory
	 */
	private $factory_rpp;

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

		$this->factory_rpp = new Factory();
		foreach ( self::vectors()['programs'] as $key ) {
			$this->programs[ $key ] = $this->factory_rpp->program( $key );
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
	 * The `resolution` vectors whose PHP result is the correct one, by ID.
	 *
	 * @return array<string, array{array}>
	 */
	public function resolution_vectors() {
		return self::resolution_vectors_where( false );
	}

	/**
	 * The `resolution` vectors with the given `currently` flag, by ID.
	 *
	 * @param bool $currently Whether to return the `currently` vectors.
	 * @return array<string, array{array}>
	 */
	private static function resolution_vectors_where( $currently ) {
		$out = array();
		foreach ( self::vectors()['resolution'] as $vector ) {
			if ( ! empty( $vector['currently'] ) === $currently ) {
				$out[ $vector['id'] ] = array( $vector );
			}
		}

		return $out;
	}

	/**
	 * Each vector gives its PHP result at its local day and minute.
	 *
	 * @dataProvider resolution_vectors
	 *
	 * @param array $vector A `resolution` vector.
	 */
	public function test_resolution_vector( array $vector ) {
		$this->assert_vector_result( $vector );
	}

	/**
	 * A negative index, an index past the last station or a site without stations
	 * gives null.
	 */
	public function test_invalid_station_index_gives_null() {
		$this->assertNull( radplapag_get_now_playing_for_station( 0 ) );

		$this->factory_rpp->station( 'Station' );

		$this->assertNull( radplapag_get_now_playing_for_station( -1 ) );
		$this->assertNull( radplapag_get_now_playing_for_station( 1 ) );
		$this->assertIsArray( radplapag_get_now_playing_for_station( '0' ) );
	}

	/**
	 * Without a schedule, nothing is on air and the station page URL is empty.
	 */
	public function test_station_without_schedule_or_page() {
		$this->factory_rpp->station( 'Station' );

		$this->assertSame(
			array(
				'current'          => null,
				'upcoming'         => null,
				'station_page_url' => '',
			),
			radplapag_get_now_playing_for_station( 0 )
		);
	}

	/**
	 * `station_page_url` is the permalink of the station's player page.
	 */
	public function test_station_page_url_is_player_page_permalink() {
		$page = $this->factory_rpp->page( 'Player' );
		$this->factory_rpp->station( 'Station', array( 'player_page' => $page ) );

		$this->assertSame( get_permalink( $page ), radplapag_get_now_playing_for_station( 0 )['station_page_url'] );
	}

	/**
	 * `current` carries the program logo; `upcoming` never has `logo_id`.
	 */
	public function test_current_has_logo_and_upcoming_has_none() {
		$logo    = $this->factory_rpp->image( 'Logo' );
		$with    = $this->factory_rpp->program( 'With logo', array( 'logo_id' => $logo ) );
		$station = $this->factory_rpp->station( 'Station' );

		Clock::run(
			'monday',
			'09:55',
			function ( Clock $clock ) use ( $with, $station ) {
				$this->store_schedule(
					$station,
					$clock->rotate_schedule(
						array(
							'monday' => array(
								array(
									'program_id' => $with,
									'start'      => '09:00',
									'end'        => '10:00',
								),
								array(
									'program_id' => $with,
									'start'      => '10:00',
									'end'        => '11:00',
								),
							),
						)
					)
				);

				$result = radplapag_get_now_playing_for_station( 0 );

				$this->assertSame( $this->get_logo_id( $with ), $result['current']['logo_id'] );
				$this->assertSame( 'With logo', $result['upcoming']['name'] );
				$this->assertArrayNotHasKey( 'logo_id', $result['upcoming'] );
			}
		);
	}

	/**
	 * A slot whose program is a draft is neither on air nor coming up.
	 */
	public function test_draft_program_is_hidden() {
		$draft   = $this->factory_rpp->program( 'Draft', array(), 'draft' );
		$station = $this->factory_rpp->station( 'Station' );

		Clock::run(
			'monday',
			'09:55',
			function ( Clock $clock ) use ( $draft, $station ) {
				$this->store_schedule(
					$station,
					$clock->rotate_schedule(
						array(
							'monday' => array(
								array(
									'program_id' => $draft,
									'start'      => '09:00',
									'end'        => '10:00',
								),
								array(
									'program_id' => $draft,
									'start'      => '10:00',
									'end'        => '11:00',
								),
							),
						)
					)
				);

				$result = radplapag_get_now_playing_for_station( 0 );

				$this->assertNull( $result['current'] );
				$this->assertNull( $result['upcoming'] );
			}
		);
	}

	/**
	 * D3: the slot on air that started latest wins even when its program is a draft,
	 * so `current` is null (C10; approved edit in the phase 1 plan of spec 0009).
	 *
	 * @see docs/known-issues.md C10
	 */
	public function test_draft_program_that_started_latest_gives_no_current() {
		$draft   = $this->factory_rpp->program( 'Draft', array(), 'draft' );
		$station = $this->factory_rpp->station( 'Station' );

		Clock::run(
			'monday',
			'01:00',
			function ( Clock $clock ) use ( $draft, $station ) {
				$this->store_schedule(
					$station,
					$clock->rotate_schedule(
						array(
							'sunday' => array(
								array(
									'program_id' => $this->programs['C'],
									'start'      => '23:00',
									'end'        => '02:00',
								),
							),
							'monday' => array(
								array(
									'program_id' => $draft,
									'start'      => '00:00',
									'end'        => '06:00',
								),
								array(
									'program_id' => $this->programs['A'],
									'start'      => '00:00',
									'end'        => '06:00',
								),
							),
						)
					)
				);

				$this->assertNull( radplapag_get_now_playing_for_station( 0 )['current'] );
			}
		);
	}

	/**
	 * Malformed entries (stored without the sanitizer) are skipped: entries that are
	 * not arrays, and slots without a start (or an end, for `current`). A slot on air
	 * whose program ID is missing or not numeric gives no `current` and stops the
	 * search, so an overlapping valid slot after it is not reported either.
	 */
	public function test_malformed_entries_are_skipped() {
		$station = $this->factory_rpp->station( 'Station' );

		Clock::run(
			'monday',
			'23:55',
			function ( Clock $clock ) use ( $station ) {
				$this->store_schedule(
					$station,
					$clock->rotate_schedule(
						array(
							'monday'  => array(
								'not an entry',
								array(
									'program_id' => $this->programs['A'],
									'end'        => '23:59',
								),
								array(
									'program_id' => $this->programs['A'],
									'start'      => '23:00',
								),
								array(
									'program_id' => 'not numeric',
									'start'      => '23:50',
									'end'        => '23:58',
								),
								array(
									'program_id' => $this->programs['C'],
									'start'      => '23:50',
									'end'        => '23:59',
								),
							),
							'tuesday' => array(
								'not an entry',
								array(
									'program_id' => $this->programs['A'],
									'end'        => '01:00',
								),
								array(
									'program_id' => $this->programs['B'],
									'start'      => '00:03',
									'end'        => '01:00',
								),
							),
						)
					)
				);

				$result = radplapag_get_now_playing_for_station( 0 );

				$this->assertNull( $result['current'] );
				$this->assertSame(
					array(
						'id'         => (string) $this->programs['B'],
						'name'       => 'B',
						'day_label'  => radplapag_get_schedule_day_keys_and_labels()['day_labels'][ $clock->rotate_day( 'tuesday' ) ],
						'time_range' => '00:03-01:00',
						'is_rerun'   => false,
					),
					$result['upcoming']
				);
			}
		);
	}

	/**
	 * Puts the site on the vector's day and minute, stores its grid and compares the
	 * result with the vector's top-level (3.4.2) `current` and `upcoming`.
	 *
	 * @param array $vector A `resolution` vector.
	 */
	private function assert_vector_result( array $vector ) {
		$this->assertArrayHasKey( 'current', $vector, 'Vector without a PHP result.' );
		$this->assertArrayHasKey( 'upcoming', $vector, 'Vector without a PHP result.' );

		$station = $this->factory_rpp->station( 'Station' );
		$grid    = self::vectors()['grids'][ $vector['grid'] ];

		Clock::run(
			$vector['now']['day'],
			$vector['now']['time'],
			function ( Clock $clock ) use ( $vector, $station, $grid ) {
				$this->store_schedule( $station, $clock->rotate_schedule( $this->to_schedule( $grid ) ) );

				$result = radplapag_get_now_playing_for_station( 0 );

				$this->assertSame( $this->to_expected( $vector['current'], $clock, true ), $result['current'], 'current' );
				$this->assertSame( $this->to_expected( $vector['upcoming'], $clock, false ), $result['upcoming'], 'upcoming' );
				$this->assertSame( '', $result['station_page_url'] );
			}
		);
	}

	/**
	 * Vector grid → stored schedule (program keys become post IDs).
	 *
	 * @param array $grid Grid keyed by day.
	 * @return array
	 */
	private function to_schedule( array $grid ) {
		$schedule = array();
		foreach ( $grid as $day => $slots ) {
			foreach ( $slots as $slot ) {
				$schedule[ $day ][] = array(
					'program_id' => $this->programs[ $slot['program'] ],
					'start'      => $slot['start'],
					'end'        => $slot['end'],
					'is_rerun'   => $slot['is_rerun'],
				);
			}
		}

		return $schedule;
	}

	/**
	 * Vector `current`/`upcoming` → the entry radplapag_get_now_playing_for_station()
	 * returns. Vector programs have no logo; `upcoming` has no `logo_id` key.
	 *
	 * @param array|null $entry   Vector entry.
	 * @param Clock      $clock   Clock that rotates vector days to local days.
	 * @param bool       $current Whether the entry is `current`.
	 * @return array|null
	 */
	private function to_expected( $entry, Clock $clock, $current ) {
		if ( null === $entry ) {
			return null;
		}

		$labels   = radplapag_get_schedule_day_keys_and_labels()['day_labels'];
		$expected = array(
			'id'   => (string) $this->programs[ $entry['program'] ],
			'name' => $entry['program'],
		);
		if ( $current ) {
			$expected['logo_id'] = 0;
		}

		return $expected + array(
			'day_label'  => $labels[ $clock->rotate_day( $entry['day'] ) ],
			'time_range' => $entry['time_range'],
			'is_rerun'   => $entry['is_rerun'],
		);
	}

	/**
	 * Stores a schedule on a station as the plugin does (JSON in the meta).
	 *
	 * @param int   $station  Station post ID.
	 * @param array $schedule Schedule keyed by day.
	 */
	private function store_schedule( $station, array $schedule ) {
		update_post_meta( $station, 'radplapag_station_schedule', wp_slash( wp_json_encode( $schedule ) ) );
	}

	/**
	 * Stored logo ID of a program.
	 *
	 * @param int $program Program post ID.
	 * @return int
	 */
	private function get_logo_id( $program ) {
		$logo_id = (int) get_post_meta( $program, 'radplapag_program_logo_id', true );
		$this->assertGreaterThan( 0, $logo_id );

		return $logo_id;
	}
}
