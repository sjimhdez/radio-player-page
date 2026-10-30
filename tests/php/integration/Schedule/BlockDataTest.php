<?php
/**
 * Characterization of the data helpers of the schedule and programs list blocks (3.4.2).
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Schedule;

use RadioPlayerPage\Tests\Integration\Support\Clock;
use RadioPlayerPage\Tests\Integration\Support\Factory;
use WP_UnitTestCase;

/**
 * Pins radplapag_get_schedule_for_station(), radplapag_get_programs_list_for_station(),
 * radplapag_build_programs_map() and radplapag_get_schedule_day_keys_and_labels():
 * day order, slot order and shape, which slots are live (shared `resolution`
 * vectors), the programs map, skipped entries and draft programs.
 *
 * Cases:
 * - day keys and labels: Monday to Sunday, English labels;
 * - programs map: one entry per published program, invalid IDs and drafts out,
 *   empty descriptions → null, logo URL;
 * - schedule: invalid index → null; `natural` keeps Monday to Sunday, `current_first`
 *   (and only it) starts with today; slots sorted by start; incomplete entries
 *   skipped; slots of unknown or draft programs left out (C10); empty
 *   descriptions → '' in the slot; `station_page_url`; `is_live` per vector (C16);
 * - programs list: invalid index → null; programs in order of first appearance
 *   (Monday to Sunday); slots by day and start; drafts, unknown and non-numeric
 *   program IDs out; empty descriptions → null; `is_live` per vector (C16).
 * - password-protected program: not public, neither in its data, both blocks nor the program on air (K88).
 */
final class BlockDataTest extends WP_UnitTestCase {

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
	 * Day keys go Monday to Sunday, each with its English label.
	 */
	public function test_day_keys_and_labels() {
		$this->assertSame(
			array(
				'day_keys_order' => array( 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday' ),
				'day_labels'     => array(
					'monday'    => 'Monday',
					'tuesday'   => 'Tuesday',
					'wednesday' => 'Wednesday',
					'thursday'  => 'Thursday',
					'friday'    => 'Friday',
					'saturday'  => 'Saturday',
					'sunday'    => 'Sunday',
				),
			),
			radplapag_get_schedule_day_keys_and_labels()
		);
	}

	/**
	 * The programs map has one entry per published program, keyed by ID (an integer key
	 * in PHP) in order of first appearance; empty descriptions become null and the logo is a URL.
	 */
	public function test_programs_map_entries() {
		$logo = $this->factory_rpp->image( 'Logo' );
		$full = $this->factory_rpp->program(
			'Full',
			array(
				'description'          => 'Short',
				'extended_description' => 'Long',
				'logo_id'              => $logo,
			)
		);
		$bare = $this->programs['A'];

		$map = radplapag_build_programs_map(
			array(
				'schedule' => array(
					'monday'  => array(
						array( 'program_id' => $full ),
						array( 'program_id' => (string) $bare ),
					),
					'tuesday' => array(
						array( 'program_id' => $full ),
					),
				),
			)
		);

		$logo_url = wp_get_attachment_image_url( $logo, 'full' );
		$this->assertIsString( $logo_url );
		$this->assertSame(
			array(
				(string) $full => array(
					'name'                 => 'Full',
					'description'          => 'Short',
					'extended_description' => 'Long',
					'logo_url'             => $logo_url,
				),
				(string) $bare => array(
					'name'                 => 'A',
					'description'          => null,
					'extended_description' => null,
					'logo_url'             => null,
				),
			),
			$map
		);
	}

	/**
	 * Entries without a positive numeric ID, unknown IDs, other post types, drafts and
	 * non-array days or entries are left out of the programs map.
	 */
	public function test_programs_map_skips_invalid_entries() {
		$draft = $this->factory_rpp->program( 'Draft', array(), 'draft' );
		$page  = $this->factory_rpp->page( 'Page' );

		$map = radplapag_build_programs_map(
			array(
				'schedule' => array(
					'monday'  => array(
						'not an entry',
						array(),
						array( 'program_id' => '' ),
						array( 'program_id' => null ),
						array( 'program_id' => 'abc' ),
						array( 'program_id' => 0 ),
						array( 'program_id' => -3 ),
						array( 'program_id' => 999999 ),
						array( 'program_id' => $page ),
						array( 'program_id' => $draft ),
						array( 'program_id' => $this->programs['B'] ),
					),
					'tuesday' => 'not a day',
				),
			)
		);

		$this->assertSame( array( $this->programs['B'] ), array_keys( $map ) );
	}

	/**
	 * A station without a schedule, or with one that is not an array, gives an empty map.
	 */
	public function test_programs_map_without_schedule_is_empty() {
		$this->assertSame( array(), radplapag_build_programs_map( array() ) );
		$this->assertSame( array(), radplapag_build_programs_map( array( 'schedule' => 'x' ) ) );
	}

	/**
	 * A negative index, an index past the last station or a site without stations
	 * gives null in both blocks.
	 */
	public function test_invalid_station_index_gives_null() {
		$this->assertNull( radplapag_get_schedule_for_station( 0 ) );
		$this->assertNull( radplapag_get_programs_list_for_station( 0 ) );

		$this->factory_rpp->station( 'Station' );

		$this->assertNull( radplapag_get_schedule_for_station( -1 ) );
		$this->assertNull( radplapag_get_schedule_for_station( 1 ) );
		$this->assertNull( radplapag_get_programs_list_for_station( -1 ) );
		$this->assertNull( radplapag_get_programs_list_for_station( 1 ) );
		$this->assertIsArray( radplapag_get_schedule_for_station( '0' ) );
		$this->assertIsArray( radplapag_get_programs_list_for_station( '0' ) );
	}

	/**
	 * Without a schedule: seven empty days, no programs and no station page URL; the
	 * programs list is empty.
	 */
	public function test_station_without_schedule() {
		$this->factory_rpp->station( 'Station' );

		$result = radplapag_get_schedule_for_station( 0, 'natural' );

		$this->assertSame( array(), $result['programs'] );
		$this->assertSame( '', $result['station_page_url'] );
		$this->assertSame(
			array_map(
				function ( $day ) {
					return array(
						'day_key' => $day,
						'label'   => ucfirst( $day ),
						'slots'   => array(),
					);
				},
				Clock::DAYS
			),
			$result['days']
		);
		$this->assertSame( array(), radplapag_get_programs_list_for_station( 0 ) );
	}

	/**
	 * `station_page_url` is the permalink of the station's player page.
	 */
	public function test_station_page_url_is_player_page_permalink() {
		$page = $this->factory_rpp->page( 'Player' );
		$this->factory_rpp->station( 'Station', array( 'player_page' => $page ) );

		$this->assertSame( get_permalink( $page ), radplapag_get_schedule_for_station( 0 )['station_page_url'] );
	}

	/**
	 * `current_first` (the default) starts with today's local day and keeps the week
	 * order; `natural` and any other value keep Monday to Sunday.
	 *
	 * The mutation "no reordering" only shows when today is not a Monday.
	 */
	public function test_day_order() {
		$this->factory_rpp->station( 'Station' );

		Clock::run(
			'monday',
			'12:00',
			function ( Clock $clock ) {
				$today    = array_search( $clock->rotate_day( 'monday' ), Clock::DAYS, true );
				$expected = array_merge( array_slice( Clock::DAYS, $today ), array_slice( Clock::DAYS, 0, $today ) );

				$this->assertSame( $expected, $this->day_keys( radplapag_get_schedule_for_station( 0 ) ) );
				$this->assertSame( $expected, $this->day_keys( radplapag_get_schedule_for_station( 0, 'current_first' ) ) );
				$this->assertSame( Clock::DAYS, $this->day_keys( radplapag_get_schedule_for_station( 0, 'natural' ) ) );
				$this->assertSame( Clock::DAYS, $this->day_keys( radplapag_get_schedule_for_station( 0, 'other' ) ) );
			}
		);
	}

	/**
	 * A schedule slot carries the program name and descriptions (empty → ''), its
	 * times and the rerun flag; the programs map comes with it.
	 */
	public function test_schedule_slot_shape() {
		$full    = $this->factory_rpp->program(
			'Full',
			array(
				'description'          => 'Short',
				'extended_description' => 'Long',
			)
		);
		$bare    = $this->programs['A'];
		$station = $this->factory_rpp->station( 'Station' );

		Clock::run(
			'monday',
			'12:00',
			function ( Clock $clock ) use ( $full, $bare, $station ) {
				$this->store_schedule(
					$station,
					$clock->rotate_schedule(
						array(
							'wednesday' => array(
								array(
									'program_id' => $full,
									'start'      => '08:00',
									'end'        => '09:00',
									'is_rerun'   => true,
								),
								array(
									'program_id' => (string) $bare,
									'start'      => '09:00',
									'end'        => '10:00',
								),
							),
						)
					)
				);

				$result = radplapag_get_schedule_for_station( 0, 'natural' );

				$this->assertSame(
					array(
						array(
							'program_id'                   => (string) $full,
							'program_name'                 => 'Full',
							'program_description'          => 'Short',
							'program_extended_description' => 'Long',
							'start'                        => '08:00',
							'end'                          => '09:00',
							'time_range'                   => '08:00-09:00',
							'is_live'                      => false,
							'is_rerun'                     => true,
						),
						array(
							'program_id'                   => (string) $bare,
							'program_name'                 => 'A',
							'program_description'          => '',
							'program_extended_description' => '',
							'start'                        => '09:00',
							'end'                          => '10:00',
							'time_range'                   => '09:00-10:00',
							'is_live'                      => false,
							'is_rerun'                     => false,
						),
					),
					$this->day( $result, $clock->rotate_day( 'wednesday' ) )['slots']
				);
				$this->assertSame( array( $full, $bare ), array_keys( $result['programs'] ) );
				$this->assertSame( 'Wednesday', $this->day( $result, 'wednesday' )['label'] );
			}
		);
	}

	/**
	 * Slots of a day come out sorted by start, whatever their stored order.
	 */
	public function test_schedule_slots_sorted_by_start() {
		$station = $this->factory_rpp->station( 'Station' );

		$this->store_schedule(
			$station,
			array(
				'friday' => array(
					$this->slot( 'C', '22:00', '02:00' ),
					$this->slot( 'A', '06:00', '10:00' ),
					$this->slot( 'B', '10:00', '14:00' ),
				),
			)
		);

		$this->assertSame(
			array( '06:00-10:00', '10:00-14:00', '22:00-02:00' ),
			array_column( $this->day( radplapag_get_schedule_for_station( 0, 'natural' ), 'friday' )['slots'], 'time_range' )
		);
	}

	/**
	 * Entries that are not arrays or lack a program, start or end are skipped; days
	 * that are not arrays give no slots.
	 */
	public function test_schedule_skips_incomplete_entries() {
		$station = $this->factory_rpp->station( 'Station' );

		$this->store_schedule(
			$station,
			array(
				'monday'  => array(
					'not an entry',
					array(
						'start' => '08:00',
						'end'   => '09:00',
					),
					array(
						'program_id' => $this->programs['A'],
						'end'        => '09:00',
					),
					array(
						'program_id' => $this->programs['A'],
						'start'      => '08:00',
					),
					$this->slot( 'B', '10:00', '11:00' ),
				),
				'tuesday' => 'not a day',
			)
		);

		$result = radplapag_get_schedule_for_station( 0, 'natural' );

		$this->assertSame( array( 'B' ), array_column( $this->day( $result, 'monday' )['slots'], 'program_name' ) );
		$this->assertSame( array(), $this->day( $result, 'tuesday' )['slots'] );
	}

	/**
	 * The slot of a program that does not exist is left out of the schedule (C10, ADR 0045).
	 */
	public function test_unknown_program_slot_is_left_out() {
		$station = $this->factory_rpp->station( 'Station' );

		$this->store_schedule(
			$station,
			array(
				'monday' => array(
					array(
						'program_id' => 999999,
						'start'      => '08:00',
						'end'        => '09:00',
					),
				),
			)
		);

		$result = radplapag_get_schedule_for_station( 0, 'natural' );

		$this->assertSame( array(), $this->day( $result, 'monday' )['slots'] );
		$this->assertSame( array(), $result['programs'] );
	}

	/**
	 * C10: the slot of a draft program is left out of the schedule block, as it is of
	 * the programs list.
	 *
	 * @see docs/known-issues.md C10
	 */
	public function test_draft_program_slot_is_left_out() {
		$draft   = $this->factory_rpp->program( 'Draft', array( 'description' => 'Hidden' ), 'draft' );
		$station = $this->factory_rpp->station( 'Station' );

		$this->store_schedule(
			$station,
			array(
				'monday' => array(
					array(
						'program_id' => $draft,
						'start'      => '08:00',
						'end'        => '09:00',
					),
				),
			)
		);

		$result = radplapag_get_schedule_for_station( 0, 'natural' );

		$this->assertSame( array(), $this->day( $result, 'monday' )['slots'] );
		$this->assertSame( array(), $result['programs'] );
		$this->assertSame( array(), radplapag_get_programs_list_for_station( 0 ) );
	}

	/**
	 * K106 (ADR 0062): the slot of a program deleted for good, which the admin keeps,
	 * is left out of the schedule block, the programs list and the program on air; the
	 * published program after it is coming up within its 10 minutes.
	 */
	public function test_slot_of_a_deleted_program_stays_off_the_site() {
		$deleted = $this->factory_rpp->program( 'Gone', array( 'description' => 'Hidden' ) );
		$station = $this->factory_rpp->station( 'Station' );

		Clock::run(
			'monday',
			'08:55',
			function ( Clock $clock ) use ( $deleted, $station ) {
				$this->store_schedule(
					$station,
					$clock->rotate_schedule(
						array(
							'monday' => array(
								array(
									'program_id' => $deleted,
									'start'      => '08:00',
									'end'        => '09:00',
								),
								array(
									'program_id' => $this->programs['A'],
									'start'      => '09:00',
									'end'        => '10:00',
								),
							),
						)
					)
				);
				wp_delete_post( $deleted, true );

				$this->assertSame( array( 'A' ), array_column( $this->day( radplapag_get_schedule_for_station( 0, 'natural' ), $clock->rotate_day( 'monday' ) )['slots'], 'program_name' ) );
				$this->assertSame( array( 'A' ), array_column( radplapag_get_programs_list_for_station( 0 ), 'name' ) );
				$now_playing = radplapag_get_now_playing_for_station( 0 );
				$this->assertNull( $now_playing['current'] );
				$this->assertSame( 'A', $now_playing['upcoming']['name'] );
			}
		);
	}

	/**
	 * K88: a published program with a password is not public (ADR 0045): no data when
	 * publication is required, no slot in the schedule block, no entry in the programs
	 * list and not on air.
	 *
	 * @see docs/known-issues.md K88
	 */
	public function test_password_protected_program_is_not_public() {
		$program = $this->factory_rpp->program( 'Locked', array( 'description' => 'Secret' ) );
		wp_update_post(
			array(
				'ID'            => $program,
				'post_password' => 'secret',
			)
		);
		$station = $this->factory_rpp->station( 'Station' );

		$this->assertNull( radplapag_get_program_data( $program, true ) );
		$this->assertSame( 'Locked', radplapag_get_program_data( $program, false )['name'] );

		Clock::run(
			'monday',
			'08:30',
			function ( Clock $clock ) use ( $program, $station ) {
				$this->store_schedule(
					$station,
					$clock->rotate_schedule(
						array(
							'monday' => array(
								array(
									'program_id' => $program,
									'start'      => '08:00',
									'end'        => '09:00',
								),
							),
						)
					)
				);

				$this->assertSame( array(), $this->day( radplapag_get_schedule_for_station( 0, 'natural' ), $clock->rotate_day( 'monday' ) )['slots'] );
				$this->assertSame( array(), radplapag_get_programs_list_for_station( 0 ) );
				$this->assertNull( radplapag_get_now_playing_for_station( 0 )['current'] );
			}
		);
	}

	/**
	 * Programs come in order of first appearance from Monday to Sunday, each once,
	 * with their slots sorted by day and start, and empty descriptions as null.
	 */
	public function test_programs_list_order_and_shape() {
		$logo    = $this->factory_rpp->image( 'Logo' );
		$full    = $this->factory_rpp->program(
			'Full',
			array(
				'description'          => 'Short',
				'extended_description' => 'Long',
				'logo_id'              => $logo,
			)
		);
		$station = $this->factory_rpp->station( 'Station' );

		Clock::run(
			'monday',
			'12:00',
			function ( Clock $clock ) use ( $full, $logo, $station ) {
				$this->store_schedule(
					$station,
					$clock->rotate_schedule(
						array(
							'sunday'    => array(
								$this->slot( 'A', '20:00', '21:00' ),
							),
							'wednesday' => array(
								$this->slot( 'A', '18:00', '19:00' ),
								$this->slot( 'B', '07:00', '08:00' ),
								$this->slot( 'A', '06:00', '07:00' ),
							),
							'thursday'  => array(
								array(
									'program_id' => (string) $full,
									'start'      => '09:00',
									'end'        => '10:00',
								),
							),
						)
					)
				);

				$list = radplapag_get_programs_list_for_station( 0 );

				// Order of first appearance depends on the rotated days; slots are compared unrotated.
				$first = array();
				foreach ( Clock::DAYS as $day ) {
					foreach ( array( 'A', 'B', 'Full' ) as $name ) {
						$vector_day = $clock->unrotate_day( $day );
						if ( ! in_array( $name, $first, true ) && in_array( $name, $this->names_on( $vector_day ), true ) ) {
							$first[] = $name;
						}
					}
				}
				$this->assertSame( $first, array_column( $list, 'name' ) );

				$by_name = array_column( $list, null, 'name' );
				$this->assertSame(
					array(
						'id'                   => (string) $this->programs['A'],
						'name'                 => 'A',
						'logo_id'              => 0,
						'description'          => null,
						'extended_description' => null,
					),
					array_diff_key( $by_name['A'], array( 'slots' => true ) )
				);
				$this->assertSame(
					array(
						'id'                   => (string) $full,
						'name'                 => 'Full',
						'logo_id'              => $logo,
						'description'          => 'Short',
						'extended_description' => 'Long',
						'slots'                => array(
							array(
								'day_key'    => $clock->rotate_day( 'thursday' ),
								'day_label'  => ucfirst( $clock->rotate_day( 'thursday' ) ),
								'time_range' => '09:00-10:00',
								'is_live'    => false,
							),
						),
					),
					$by_name['Full']
				);

				$a_slots = array();
				foreach ( $by_name['A']['slots'] as $slot ) {
					$a_slots[] = $slot['day_key'] . ' ' . $slot['time_range'];
				}
				$expected = array();
				foreach ( Clock::DAYS as $day ) {
					$vector_day = $clock->unrotate_day( $day );
					if ( 'wednesday' === $vector_day ) {
						$expected[] = $day . ' 06:00-07:00';
						$expected[] = $day . ' 18:00-19:00';
					} elseif ( 'sunday' === $vector_day ) {
						$expected[] = $day . ' 20:00-21:00';
					}
				}
				$this->assertSame( $expected, $a_slots );
			}
		);
	}

	/**
	 * Drafts, unknown programs and non-numeric or empty program IDs are left out of the
	 * programs list; incomplete entries give no slot.
	 */
	public function test_programs_list_skips_invalid_programs() {
		$draft   = $this->factory_rpp->program( 'Draft', array(), 'draft' );
		$station = $this->factory_rpp->station( 'Station' );

		$this->store_schedule(
			$station,
			array(
				'monday'  => array(
					'not an entry',
					array(
						'program_id' => '',
						'start'      => '01:00',
						'end'        => '02:00',
					),
					array(
						'program_id' => 'abc',
						'start'      => '02:00',
						'end'        => '03:00',
					),
					array(
						'program_id' => 999999,
						'start'      => '03:00',
						'end'        => '04:00',
					),
					array(
						'program_id' => $draft,
						'start'      => '04:00',
						'end'        => '05:00',
					),
					array(
						'program_id' => $this->programs['B'],
						'start'      => '05:00',
					),
					$this->slot( 'B', '06:00', '07:00' ),
				),
				'tuesday' => 'not a day',
			)
		);

		$list = radplapag_get_programs_list_for_station( 0 );

		$this->assertSame( array( 'B' ), array_column( $list, 'name' ) );
		$this->assertSame( array( '06:00-07:00' ), array_column( $list[0]['slots'], 'time_range' ) );
	}

	/**
	 * Each vector marks as live, in both blocks, exactly its PHP `current` slot.
	 *
	 * @dataProvider resolution_vectors
	 *
	 * @param array $vector A `resolution` vector.
	 */
	public function test_live_slots_by_vector( array $vector ) {
		$this->assert_live_slots( $vector, $this->live_expected( array( $vector['current'] ) ) );
	}

	/**
	 * Puts the site on the vector's day and minute, stores its grid (its `unpublished`
	 * programs as drafts) and compares the live slots of both blocks with $expected
	 * (vector days).
	 *
	 * @param array    $vector   A `resolution` vector.
	 * @param string[] $expected Sorted "day program time_range" entries.
	 */
	private function assert_live_slots( array $vector, array $expected ) {
		$station = $this->factory_rpp->station( 'Station' );
		$grid    = self::vectors()['grids'][ $vector['grid'] ];
		foreach ( isset( $vector['unpublished'] ) ? $vector['unpublished'] : array() as $key ) {
			wp_update_post(
				array(
					'ID'          => $this->programs[ $key ],
					'post_status' => 'draft',
				)
			);
		}

		Clock::run(
			$vector['now']['day'],
			$vector['now']['time'],
			function ( Clock $clock ) use ( $station, $grid, $expected ) {
				$schedule = array();
				foreach ( $grid as $day => $slots ) {
					foreach ( $slots as $slot ) {
						$schedule[ $day ][] = $this->slot( $slot['program'], $slot['start'], $slot['end'] );
					}
				}
				$this->store_schedule( $station, $clock->rotate_schedule( $schedule ) );

				$live = array();
				foreach ( radplapag_get_schedule_for_station( 0 )['days'] as $day ) {
					foreach ( $day['slots'] as $slot ) {
						if ( $slot['is_live'] ) {
							$live[] = $clock->unrotate_day( $day['day_key'] ) . ' ' . $slot['program_name'] . ' ' . $slot['time_range'];
						}
					}
				}
				sort( $live );
				$this->assertSame( $expected, $live, 'schedule' );

				$live = array();
				foreach ( radplapag_get_programs_list_for_station( 0 ) as $program ) {
					foreach ( $program['slots'] as $slot ) {
						if ( $slot['is_live'] ) {
							$live[] = $clock->unrotate_day( $slot['day_key'] ) . ' ' . $program['name'] . ' ' . $slot['time_range'];
						}
					}
				}
				sort( $live );
				$this->assertSame( $expected, $live, 'programs list' );
			}
		);
	}

	/**
	 * Vector `current` entries → sorted "day program time_range" entries, without nulls
	 * or repeats.
	 *
	 * @param array $entries Vector `current` entries (or null).
	 * @return string[]
	 */
	private function live_expected( array $entries ) {
		$out = array();
		foreach ( $entries as $entry ) {
			if ( null !== $entry ) {
				$out[] = $entry['day'] . ' ' . $entry['program'] . ' ' . $entry['time_range'];
			}
		}
		$out = array_values( array_unique( $out ) );
		sort( $out );

		return $out;
	}

	/**
	 * A stored slot for a vector program.
	 *
	 * @param string $program Vector program key.
	 * @param string $start   Start, HH:MM.
	 * @param string $end     End, HH:MM.
	 * @return array
	 */
	private function slot( $program, $start, $end ) {
		return array(
			'program_id' => $this->programs[ $program ],
			'start'      => $start,
			'end'        => $end,
			'is_rerun'   => false,
		);
	}

	/**
	 * Program names scheduled on a vector day in test_programs_list_order_and_shape().
	 *
	 * @param string $day Vector day key.
	 * @return string[]
	 */
	private function names_on( $day ) {
		$names = array(
			'sunday'    => array( 'A' ),
			'wednesday' => array( 'A', 'B' ),
			'thursday'  => array( 'Full' ),
		);

		return isset( $names[ $day ] ) ? $names[ $day ] : array();
	}

	/**
	 * Day keys of a schedule result, in order.
	 *
	 * @param array $result radplapag_get_schedule_for_station() result.
	 * @return string[]
	 */
	private function day_keys( array $result ) {
		return array_column( $result['days'], 'day_key' );
	}

	/**
	 * One day of a schedule result.
	 *
	 * @param array  $result radplapag_get_schedule_for_station() result.
	 * @param string $day    Day key.
	 * @return array
	 */
	private function day( array $result, $day ) {
		foreach ( $result['days'] as $entry ) {
			if ( $entry['day_key'] === $day ) {
				return $entry;
			}
		}
		$this->fail( "No day $day." );
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
}
