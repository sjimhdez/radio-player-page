<?php
/**
 * Tests for RadioPlayerPage\Migration\Legacy_Plan.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Migration;

use RadioPlayerPage\Migration\Legacy_Plan;
use RadioPlayerPage\Migration\Slot_Filter;
use RadioPlayerPage\Schedule\Slot_Validator;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * The plan of the radplapag_settings → CPT migration of 3.4.2: programs, duplicates,
 * station values and schedules by legacy program ID, before anything is written.
 */
final class LegacyPlanTest extends TestCase {

	/**
	 * First fake post ID given to a fixture placeholder.
	 */
	const FIRST_FAKE_ID = 9001;

	/**
	 * Option values without any useful station give no plan (no_data).
	 *
	 * @dataProvider data_no_data
	 *
	 * @param mixed $raw Value of radplapag_settings.
	 */
	public function test_no_data_gives_null( $raw ) {
		$this->assertNull( Legacy_Plan::build( $raw, self::sanitizers() ) );
	}

	/**
	 * Inputs for test_no_data_gives_null().
	 *
	 * @return array<string, array{mixed}>
	 */
	public function data_no_data() {
		return array(
			'missing option'      => array( null ),
			'string'              => array( 'stations' ),
			'no stations key'     => array( array( 'stream_url' => 'https://example.com/live.mp3' ) ),
			'stations not a list' => array( array( 'stations' => 'nope' ) ),
			'empty stations'      => array( array( 'stations' => array() ) ),
		);
	}

	/**
	 * Programs are unique by legacy ID, in order of first appearance and with the data of the last one.
	 */
	public function test_programs_by_legacy_id() {
		$plan = Legacy_Plan::build(
			self::settings(
				array(
					self::station( 'One', array( self::program( 'prog_a', 'A' ), self::program( 'prog_b', 'B' ) ) ),
					self::station( 'Two', array( self::program( 'prog_c', 'C' ), self::program( 'prog_a', 'A again' ) ) ),
				)
			),
			self::sanitizers()
		);

		$this->assertNotNull( $plan );
		$this->assertSame( array( 'prog_a', 'prog_b', 'prog_c' ), array_column( $plan['programs'], 'id' ) );
		$this->assertSame( array( 'A again', 'B', 'C' ), array_column( $plan['programs'], 'name' ) );
	}

	/**
	 * A legacy ID repeated with differing data is a duplicate each time it differs from the last one kept.
	 */
	public function test_duplicates_with_differing_data() {
		$plan = Legacy_Plan::build(
			self::settings(
				array(
					self::station( 'One', array( self::program( 'prog_a', 'A' ), self::program( 'prog_b', 'B' ) ) ),
					self::station( 'Two', array( self::program( 'prog_a', 'A2' ), self::program( 'prog_b', 'B' ) ) ),
					self::station( 'Three', array( self::program( 'prog_a', 'A3' ) ) ),
				)
			),
			self::sanitizers()
		);

		$this->assertNotNull( $plan );
		$this->assertSame( array( 'prog_a', 'prog_a' ), $plan['duplicates'] );
	}

	/**
	 * The fingerprint covers name, description, extended description and logo, before sanitizing.
	 *
	 * @dataProvider data_fingerprint_fields
	 *
	 * @param string $field Program field that differs.
	 */
	public function test_fingerprint_fields( $field ) {
		$first            = self::program( 'prog_a', 'A' );
		$second           = $first;
		$second[ $field ] = 'x' . ( $first[ $field ] ?? '' );

		$plan = Legacy_Plan::build( self::settings( array( self::station( 'One', array( $first, $second ) ) ) ), self::sanitizers() );

		$this->assertNotNull( $plan );
		$this->assertSame( array( 'prog_a' ), $plan['duplicates'] );
	}

	/**
	 * Inputs for test_fingerprint_fields().
	 *
	 * @return array<string, array{string}>
	 */
	public function data_fingerprint_fields() {
		return array(
			'name'                 => array( 'name' ),
			'description'          => array( 'description' ),
			'extended description' => array( 'extended_description' ),
			'logo'                 => array( 'logo_id' ),
		);
	}

	/**
	 * Programs that are not arrays or have no ID, and program lists that are not arrays, are skipped.
	 */
	public function test_programs_without_id_are_skipped() {
		$stations = array(
			self::station( 'One', array( 'not a program', array( 'name' => 'No id' ), self::program( '', 'Empty id' ), self::program( 'prog_a', 'A' ) ) ),
			self::station( 'Two', array() ),
		);

		$stations[1]['programs'] = 'nope';
		$plan                    = Legacy_Plan::build( self::settings( $stations ), self::sanitizers() );

		$this->assertNotNull( $plan );
		$this->assertSame( array( 'prog_a' ), array_column( $plan['programs'], 'id' ) );
	}

	/**
	 * Program values go through the WordPress sanitizers; an empty name stays '' (the writer gives the default).
	 */
	public function test_program_values() {
		$plan = Legacy_Plan::build(
			self::settings(
				array(
					self::station(
						'One',
						array(
							array(
								'id'                   => 'prog_a',
								'name'                 => '  Good <i>Show</i>  ',
								'description'          => '<b>Desc</b>',
								'extended_description' => "Line 1\n<b>Line 2</b>",
								'logo_id'              => '-7',
							),
							array( 'id' => 42 ),
						)
					),
				)
			),
			self::sanitizers()
		);

		$this->assertNotNull( $plan );
		$this->assertSame(
			array(
				array(
					'id'                   => 'prog_a',
					'name'                 => 'Good Show',
					'description'          => 'Desc',
					'extended_description' => "Line 1\nLine 2",
					'logo_id'              => 7,
				),
				array(
					'id'                   => '42',
					'name'                 => '',
					'description'          => '',
					'extended_description' => '',
					'logo_id'              => 0,
				),
			),
			$plan['programs']
		);
	}

	/**
	 * Station values go through the WordPress sanitizers and the whitelists; menu_order counts only array stations.
	 */
	public function test_station_values() {
		$plan = Legacy_Plan::build(
			self::settings(
				array(
					'not a station',
					array(
						'station_title' => ' <b>North</b> ',
						'stream_url'    => '  https://example.com/live.mp3  ',
						'player_page'   => '34',
						'background_id' => '-5',
						'logo_id'       => 6,
						'theme_color'   => 'BLUE',
						'visualizer'    => 'Bars',
					),
					array(
						'theme_color' => 'teal',
						'visualizer'  => 'spectrum',
					),
				)
			),
			self::sanitizers()
		);

		$this->assertNotNull( $plan );
		$this->assertSame(
			array(
				array(
					'title'         => 'North',
					'stream_url'    => 'https://example.com/live.mp3',
					'player_page'   => 34,
					'background_id' => 5,
					'logo_id'       => 6,
					'theme_color'   => 'blue',
					'visualizer'    => 'bars',
					'menu_order'    => 0,
					'schedule'      => array(),
					'skipped'       => array(),
				),
				array(
					'title'         => '',
					'stream_url'    => '',
					'player_page'   => 0,
					'background_id' => 0,
					'logo_id'       => 0,
					'theme_color'   => 'neutral',
					'visualizer'    => 'oscilloscope',
					'menu_order'    => 1,
					'schedule'      => array(),
					'skipped'       => array(),
				),
			),
			$plan['stations']
		);
	}

	/**
	 * The schedule keeps the legacy program IDs, trims the times, drops incomplete rows and
	 * empty days, and lists the rows of unknown programs as skipped, in schedule order.
	 */
	public function test_schedule_by_legacy_id() {
		$station             = self::station( 'One', array( self::program( 'prog_a', 'A' ) ) );
		$station['schedule'] = array(
			'Monday'    => array( self::slot( 'prog_a', '07:00', '08:00' ) ),
			'tuesday'   => 'not a list',
			'wednesday' => array(
				'not a slot',
				self::slot( 'prog_a', '', '08:00' ),
				self::slot( '', '07:00', '08:00' ),
				self::slot( 'prog_x', '07:00', '08:00' ),
				self::slot( 'prog_a', ' 09:00 ', ' 10:00 ' ),
				self::slot( 'prog_y', '11:00', '12:00' ),
			),
			'thursday'  => array( self::slot( 'prog_z', '07:00', '08:00' ) ),
		);

		$plan = Legacy_Plan::build( self::settings( array( $station ) ), self::sanitizers() );

		$this->assertNotNull( $plan );
		$this->assertSame(
			array(
				'Monday'    => array( self::slot( 'prog_a', '07:00', '08:00' ) ),
				'wednesday' => array( self::slot( 'prog_a', '09:00', '10:00' ) ),
			),
			$plan['stations'][0]['schedule']
		);
		$this->assertSame( array( 'prog_x', 'prog_y', 'prog_z' ), $plan['stations'][0]['skipped'] );
	}

	/**
	 * A program of another station is known to every schedule.
	 */
	public function test_schedule_uses_programs_of_any_station() {
		$one             = self::station( 'One', array( self::program( 'prog_a', 'A' ) ) );
		$two             = self::station( 'Two', array() );
		$two['schedule'] = array( 'monday' => array( self::slot( 'prog_a', '07:00', '08:00' ) ) );

		$plan = Legacy_Plan::build( self::settings( array( $two, $one ) ), self::sanitizers() );

		$this->assertNotNull( $plan );
		$this->assertSame( array( 'monday' => array( self::slot( 'prog_a', '07:00', '08:00' ) ) ), $plan['stations'][0]['schedule'] );
		$this->assertSame( array(), $plan['stations'][0]['skipped'] );
	}

	/**
	 * The plan does not read is_rerun: the legacy formats never had it.
	 *
	 * @see docs/adr/0039-legacy-slots-have-no-is-rerun.md
	 */
	public function test_slot_ignores_is_rerun() {
		$station             = self::station( 'One', array( self::program( 'prog_a', 'A' ) ) );
		$station['schedule'] = array( 'monday' => array( self::slot( 'prog_a', '07:00', '08:00' ) + array( 'is_rerun' => true ) ) );

		$plan = Legacy_Plan::build( self::settings( array( $station ) ), self::sanitizers() );

		$this->assertNotNull( $plan );
		$this->assertSame( array( 'monday' => array( self::slot( 'prog_a', '07:00', '08:00' ) ) ), $plan['stations'][0]['schedule'] );
	}

	/**
	 * A stations list without any array station gives a plan with no stations, not no_data:
	 * the option is still deleted and the notice says no station was found.
	 *
	 * @see docs/known-issues.md K32
	 */
	public function test_stations_without_any_station_give_an_empty_plan() {
		$this->assertSame(
			array(
				'programs'   => array(),
				'duplicates' => array(),
				'stations'   => array(),
			),
			Legacy_Plan::build( array( 'stations' => array( 'x' ) ), self::sanitizers() )
		);
	}

	/**
	 * The plan keeps a 3.2.x slot that crosses midnight into the next day's slot, and the
	 * slot filter drops the later one (Tuesday's), so the schedule validates.
	 *
	 * @see docs/known-issues.md K30
	 */
	public function test_cross_day_overlap_from_3_2_drops_the_later_slot() {
		$station             = self::station( 'One', array( self::program( 'prog_late', 'Late' ), self::program( 'prog_early', 'Early' ) ) );
		$station['schedule'] = array(
			'monday'  => array( self::slot( 'prog_late', '23:00', '02:00' ) ),
			'tuesday' => array( self::slot( 'prog_early', '01:00', '03:00' ) ),
		);

		$plan = Legacy_Plan::build( self::settings( array( $station ) ), self::sanitizers() );

		$this->assertNotNull( $plan );
		$this->assertSame( $station['schedule'], $plan['stations'][0]['schedule'] );
		$result = self::filter( $plan, 0 );
		$this->assertSame( array(), $result['errors'] );
		$this->assertSame( array( 'monday' ), array_keys( $result['schedule'] ) );
		$this->assertSame(
			array(
				array(
					'day'     => 'tuesday',
					'start'   => '01:00',
					'end'     => '03:00',
					'program' => 'Early',
				),
			),
			$result['dropped']
		);
	}

	/**
	 * The plan of each legacy fixture, with the writer's defaults, the registered meta
	 * callbacks and the validator, gives the stations and programs of its golden.
	 *
	 * @dataProvider data_fixtures
	 *
	 * @param string $file Fixture path.
	 */
	public function test_fixture_matches_golden( $file ) {
		$ids    = array();
		$images = array();
		$raw    = self::load( $file, $ids, $images );
		$golden = self::read_json( dirname( $file ) . '/golden/' . basename( $file ) );
		$plan   = Legacy_Plan::build( $raw['settings'], self::sanitizers() );

		$this->assertSame(
			array(
				'stations' => $golden['stations'],
				'programs' => $golden['programs'],
			),
			self::project( $plan, array_flip( $ids ), $images )
		);
	}

	/**
	 * One case per fixture file.
	 *
	 * @return array<string, array{string}>
	 */
	public function data_fixtures() {
		$out = array();
		foreach ( (array) glob( RADPLAPAG_TESTS_PLUGIN_DIR . '/tests/fixtures/legacy-settings/*.json' ) as $file ) {
			$out[ basename( (string) $file, '.json' ) ] = array( (string) $file );
		}

		return $out;
	}

	/**
	 * The flat 1.x option gives no plan.
	 */
	public function test_flat_fixture_gives_null() {
		$ids    = array();
		$images = array();
		$raw    = self::load( RADPLAPAG_TESTS_PLUGIN_DIR . '/tests/fixtures/legacy-settings/v1.1-flat.json', $ids, $images );

		$this->assertNull( Legacy_Plan::build( $raw['settings'], self::sanitizers() ) );
	}

	/**
	 * In corrupt-times, the first station is valid and the second fails with `format`.
	 */
	public function test_corrupt_times_fails_on_the_second_station() {
		$ids    = array();
		$images = array();
		$raw    = self::load( RADPLAPAG_TESTS_PLUGIN_DIR . '/tests/fixtures/legacy-settings/corrupt-times.json', $ids, $images );
		$plan   = Legacy_Plan::build( $raw['settings'], self::sanitizers() );

		$this->assertNotNull( $plan );
		$this->assertSame( array(), self::validate( $plan, 0 )['errors'] );
		$this->assertSame( array( 'format' ), array_column( self::validate( $plan, 1 )['errors'], 'code' ) );
	}

	/**
	 * Stand-ins for the WordPress sanitizers, close enough for the fixtures.
	 *
	 * @return array<string, callable>
	 */
	private static function sanitizers() {
		$strip = static function ( $value ) {
			return strip_tags( (string) preg_replace( '@<(script|style)[^>]*?>.*?</\\1>@si', '', (string) $value ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.strip_tags_strip_tags -- Stand-in for wp_strip_all_tags().
		};

		return array(
			'text'     => static function ( $value ) use ( $strip ) {
				return trim( (string) preg_replace( '/[\r\n\t ]+/', ' ', $strip( $value ) ) );
			},
			'textarea' => static function ( $value ) use ( $strip ) {
				return trim( $strip( $value ) );
			},
			'url'      => static function ( $value ) {
				return preg_match( '#^https?://#i', (string) $value ) ? (string) $value : '';
			},
			'key'      => static function ( $value ) {
				return (string) preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $value ) );
			},
			'absint'   => static function ( $value ) {
				return abs( (int) $value );
			},
		);
	}

	/**
	 * Legacy option with these stations.
	 *
	 * @param array<mixed> $stations Legacy stations.
	 * @return array{stations: array<mixed>}
	 */
	private static function settings( array $stations ) {
		return array( 'stations' => $stations );
	}

	/**
	 * Legacy station with a title and programs.
	 *
	 * @param string       $title    Station title.
	 * @param array<mixed> $programs Legacy programs.
	 * @return array<string, mixed>
	 */
	private static function station( $title, array $programs ) {
		return array(
			'station_title' => $title,
			'stream_url'    => 'https://example.com/live.mp3',
			'player_page'   => 34,
			'programs'      => $programs,
		);
	}

	/**
	 * Legacy program.
	 *
	 * @param string $id   Legacy ID.
	 * @param string $name Name.
	 * @return array<string, mixed>
	 */
	private static function program( $id, $name ) {
		return array(
			'id'                   => $id,
			'name'                 => $name,
			'description'          => 'Desc',
			'extended_description' => 'Ext',
			'logo_id'              => 0,
		);
	}

	/**
	 * Legacy slot.
	 *
	 * @param string $program_id Legacy program ID.
	 * @param string $start      Start.
	 * @param string $end        End.
	 * @return array{program_id: string, start: string, end: string}
	 */
	private static function slot( $program_id, $start, $end ) {
		return array(
			'program_id' => $program_id,
			'start'      => $start,
			'end'        => $end,
		);
	}

	/**
	 * Validates a station's schedule with programs numbered 1, 2, … in plan order.
	 *
	 * @param array<string, mixed> $plan  Plan.
	 * @param int                  $index Station index.
	 * @return array{schedule: array<string, mixed>, errors: list<array<string, mixed>>}
	 */
	private static function validate( array $plan, $index ) {
		$post_ids = array();
		$names    = array();
		self::number( $plan, $post_ids, $names );

		return Slot_Validator::validate( self::translate( $plan['stations'][ $index ]['schedule'], $post_ids ), $names );
	}

	/**
	 * Filters a station's schedule with Slot_Filter and validates what is left, as the
	 * writer does, with programs numbered 1, 2, … in plan order.
	 *
	 * @param array<string, mixed> $plan  Plan.
	 * @param int                  $index Station index.
	 * @return array{schedule: array<string, mixed>, errors: list<array<string, mixed>>, dropped: list<array<string, string>>}
	 */
	private static function filter( array $plan, $index ) {
		$post_ids = array();
		$names    = array();
		self::number( $plan, $post_ids, $names );
		$filtered = Slot_Filter::filter( self::translate( $plan['stations'][ $index ]['schedule'], $post_ids ), $names );

		return Slot_Validator::validate( $filtered['schedule'], $names ) + array( 'dropped' => $filtered['dropped'] );
	}

	/**
	 * Numbers the plan's programs 1, 2, … in plan order, with the writer's default name.
	 *
	 * @param array<string, mixed> $plan     Plan.
	 * @param array<string, int>   $post_ids Filled with legacy ID → post ID.
	 * @param array<int, string>   $names    Filled with post ID → name.
	 * @return void
	 */
	private static function number( array $plan, array &$post_ids, array &$names ) {
		foreach ( $plan['programs'] as $i => $program ) {
			$post_ids[ $program['id'] ] = $i + 1;
			$names[ $i + 1 ]            = '' === $program['name'] ? 'Radio Show' : $program['name'];
		}
	}

	/**
	 * Replaces legacy program IDs with post IDs, as the writer does.
	 *
	 * @param array<string, list<array{program_id: string, start: string, end: string}>> $schedule Plan schedule.
	 * @param array<string, int>                                                         $post_ids Legacy ID → post ID.
	 * @return array<string, list<array{program_id: int, start: string, end: string}>>
	 */
	private static function translate( array $schedule, array $post_ids ) {
		foreach ( $schedule as $day => $slots ) {
			foreach ( $slots as $i => $slot ) {
				$schedule[ $day ][ $i ]['program_id'] = $post_ids[ $slot['program_id'] ];
			}
		}

		return $schedule;
	}

	/**
	 * Reads a fixture, giving each `{{PAGE:…}}` and `{{ATTACHMENT:…}}` placeholder a fake post ID.
	 *
	 * @param string             $file   Fixture path.
	 * @param array<string, int> $ids    Filled with placeholder → fake ID.
	 * @param array<int, true>   $images Filled with the fake IDs of image attachments.
	 * @return array<string, mixed>
	 */
	private static function load( $file, array &$ids, array &$images ) {
		$json = (string) file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local fixture.
		$raw  = json_decode( $json, true );

		$next = self::FIRST_FAKE_ID;
		preg_match_all( '/\{\{PAGE:[^}]+\}\}/', $json, $pages );
		foreach ( array_unique( $pages[0] ) as $placeholder ) {
			$ids[ $placeholder ] = $next++;
		}
		$attachments = isset( $raw['attachments'] ) ? $raw['attachments'] : array();
		foreach ( $attachments as $name => $type ) {
			$ids[ '{{ATTACHMENT:' . $name . '}}' ] = $next;
			if ( 'image' === $type ) {
				$images[ $next ] = true;
			}
			++$next;
		}

		$replace = array();
		foreach ( $ids as $placeholder => $id ) {
			$replace[ $placeholder ] = (string) $id;
		}

		return json_decode( strtr( $json, $replace ), true );
	}

	/**
	 * Reads a JSON file.
	 *
	 * @param string $file Path.
	 * @return array<string, mixed>
	 */
	private static function read_json( $file ) {
		return json_decode( (string) file_get_contents( $file ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local fixture.
	}

	/**
	 * What the migration writes from a plan, in the golden's shape: the writer's default
	 * titles, the attachment checks of the registered meta callbacks (an ID that is not an
	 * image is 0) and the schedule left by Slot_Filter and validated, as JSON, with post IDs
	 * as placeholders. Nothing if what is left still fails.
	 *
	 * @param array<string, mixed>|null $plan   Plan.
	 * @param array<int, string>        $names  Fake ID → placeholder.
	 * @param array<int, true>          $images Fake IDs of image attachments.
	 * @return array{stations: list<array<string, mixed>>, programs: list<array<string, mixed>>}
	 */
	private static function project( $plan, array $names, array $images ) {
		$nothing = array(
			'stations' => array(),
			'programs' => array(),
		);
		if ( null === $plan ) {
			return $nothing;
		}

		$id    = static function ( $value ) use ( $names ) {
			return isset( $names[ $value ] ) ? $names[ $value ] : (string) $value;
		};
		$image = static function ( $value ) use ( $id, $images ) {
			return isset( $images[ $value ] ) ? $id( $value ) : '0';
		};

		$programs = array();
		foreach ( $plan['programs'] as $i => $program ) {
			$title           = '' === $program['name'] ? 'Radio Show' : $program['name'];
			$names[ $i + 1 ] = '{{PROGRAM:' . $title . '}}';
			$programs[]      = array(
				'title'      => $title,
				'status'     => 'publish',
				'menu_order' => 0,
				'meta'       => array(
					'radplapag_program_description' => $program['description'],
					'radplapag_program_extended_description' => $program['extended_description'],
					'radplapag_program_logo_id'     => $image( $program['logo_id'] ),
				),
			);
		}

		$stations = array();
		foreach ( $plan['stations'] as $index => $station ) {
			$result = self::filter( $plan, $index );
			if ( array() !== $result['errors'] ) {
				return $nothing;
			}
			$schedule = preg_replace_callback(
				'/"program_id":(\d+)/',
				static function ( $m ) use ( $names ) {
					return '"program_id":"' . $names[ (int) $m[1] ] . '"';
				},
				(string) json_encode( $result['schedule'] ) // phpcs:ignore WordPress.WP.AlternativeFunctions.json_encode_json_encode -- No WordPress in the unit suite.
			);

			$stations[] = array(
				'title'      => '' === $station['title'] ? 'Radio Station' : $station['title'],
				'status'     => 'publish',
				'menu_order' => $station['menu_order'],
				'meta'       => array(
					'radplapag_station_background_id' => $image( $station['background_id'] ),
					'radplapag_station_logo_id'       => $image( $station['logo_id'] ),
					'radplapag_station_player_page'   => $id( $station['player_page'] ),
					'radplapag_station_schedule'      => $schedule,
					'radplapag_station_stream_url'    => $station['stream_url'],
					'radplapag_station_theme_color'   => $station['theme_color'],
					'radplapag_station_visualizer'    => $station['visualizer'],
				),
			);
		}

		return array(
			'stations' => $stations,
			'programs' => $programs,
		);
	}
}
