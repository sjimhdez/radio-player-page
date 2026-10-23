<?php
/**
 * Characterization of the station and program readers (3.4.2): radplapag_get_stations(),
 * radplapag_get_config(), Radplapag_Station_Config, Radplapag_Program_Config,
 * radplapag_get_station_for_current_page(),
 * radplapag_get_player_pages_assigned_to_other_stations(), radplapag_get_program_data()
 * and radplapag_get_all_programs_for_select().
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Data;

use Radplapag_Program_Config;
use Radplapag_Station_Config;
use RadioPlayerPage\Tests\Integration\Support\Factory;
use WP_UnitTestCase;

/**
 * Pins what the blocks, the clean page and the admin read from the CPTs.
 */
final class ConfigTest extends WP_UnitTestCase {

	const STREAM = 'https://stream.example.com/live.mp3';

	/**
	 * Fixture factory.
	 *
	 * @var Factory
	 */
	private $factory_rpp;

	/**
	 * Creates the factory.
	 */
	public function set_up() {
		parent::set_up();

		$this->factory_rpp = new Factory();
	}

	/**
	 * Titles of the stations returned by radplapag_get_stations().
	 *
	 * @return string[]
	 */
	private function station_titles() {
		return array_column( radplapag_get_stations(), 'station_title' );
	}

	// Station list and station rows.

	/**
	 * Without stations the list is empty.
	 */
	public function test_get_stations_is_empty_without_stations() {
		$this->assertSame( array(), radplapag_get_stations() );
	}

	/**
	 * Only published stations are returned.
	 */
	public function test_get_stations_returns_only_published_stations() {
		$this->factory_rpp->station( 'Published' );
		$this->factory_rpp->station( 'Draft', array( 'status' => 'draft' ) );
		$this->factory_rpp->station( 'Pending', array( 'status' => 'pending' ) );
		$this->factory_rpp->station( 'Private', array( 'status' => 'private' ) );
		$this->factory_rpp->station( 'Trashed', array( 'status' => 'trash' ) );

		$this->assertSame( array( 'Published' ), $this->station_titles() );
	}

	/**
	 * Stations are ordered by menu_order, then by title.
	 */
	public function test_get_stations_orders_by_menu_order_then_title() {
		$this->factory_rpp->station( 'Bravo', array( 'menu_order' => 1 ) );
		$this->factory_rpp->station( 'Zulu', array( 'menu_order' => 0 ) );
		$this->factory_rpp->station( 'Alpha', array( 'menu_order' => 1 ) );
		$this->factory_rpp->station( 'Charlie', array( 'menu_order' => 0 ) );

		$this->assertSame( array( 'Charlie', 'Zulu', 'Alpha', 'Bravo' ), $this->station_titles() );
	}

	/**
	 * The list is indexed from 0, so blocks address stations by position.
	 */
	public function test_get_stations_is_a_list() {
		$this->factory_rpp->station( 'One' );
		$this->factory_rpp->station( 'Two' );

		$this->assertSame( array( 0, 1 ), array_keys( radplapag_get_stations() ) );
	}

	/**
	 * A fully configured station has this shape and these values.
	 */
	public function test_station_row_has_the_documented_shape() {
		$page       = $this->factory_rpp->page( 'Player' );
		$background = $this->factory_rpp->image( 'background' );
		$logo       = $this->factory_rpp->image( 'logo' );
		$intro      = $this->factory_rpp->audio( 'intro' );
		$program    = $this->factory_rpp->program( 'Morning' );
		$schedule   = array(
			'monday' => array(
				array(
					'program_id' => (string) $program,
					'start'      => '07:00',
					'end'        => '09:00',
					'is_rerun'   => true,
				),
			),
		);
		$station    = $this->factory_rpp->station(
			'Station',
			array(
				'stream_url'     => self::STREAM,
				'player_page'    => $page,
				'background_id'  => $background,
				'logo_id'        => $logo,
				'intro_audio_id' => $intro,
				'theme_color'    => 'purple',
				'visualizer'     => 'waterfall',
				'schedule'       => $schedule,
			)
		);

		$this->assertSame(
			array(
				array(
					'id'             => $station,
					'stream_url'     => self::STREAM,
					'player_page'    => $page,
					'station_title'  => 'Station',
					'background_id'  => $background,
					'logo_id'        => $logo,
					'intro_audio_id' => $intro,
					'theme_color'    => 'purple',
					'visualizer'     => 'waterfall',
					'schedule'       => $schedule,
				),
			),
			radplapag_get_stations()
		);
	}

	/**
	 * A station without meta falls back to empty values and the default theme and visualizer.
	 */
	public function test_station_row_without_meta_uses_defaults() {
		$station = $this->factory_rpp->station( 'Bare' );

		$this->assertSame(
			array(
				'id'             => $station,
				'stream_url'     => '',
				'player_page'    => 0,
				'station_title'  => 'Bare',
				'background_id'  => 0,
				'logo_id'        => 0,
				'intro_audio_id' => 0,
				'theme_color'    => 'neutral',
				'visualizer'     => 'oscilloscope',
				'schedule'       => array(),
			),
			radplapag_get_stations()[0]
		);
	}

	/**
	 * A stored theme or visualizer outside the whitelist falls back to the default.
	 */
	public function test_station_row_replaces_unknown_theme_and_visualizer() {
		$this->factory_rpp->station(
			'Station',
			array(
				'theme_color' => 'magenta',
				'visualizer'  => 'spiral',
			)
		);

		$row = radplapag_get_stations()[0];
		$this->assertSame( 'neutral', $row['theme_color'] );
		$this->assertSame( 'oscilloscope', $row['visualizer'] );
	}

	/**
	 * Each whitelisted theme is kept.
	 */
	public function test_station_row_keeps_every_valid_theme() {
		$themes = array( 'neutral', 'blue', 'green', 'red', 'orange', 'yellow', 'purple', 'pink' );
		foreach ( $themes as $i => $theme ) {
			$this->factory_rpp->station(
				'Station ' . $theme,
				array(
					'theme_color' => $theme,
					'menu_order'  => $i,
				)
			);
		}

		$this->assertSame( $themes, array_column( radplapag_get_stations(), 'theme_color' ) );
	}

	/**
	 * Each whitelisted visualizer is kept.
	 */
	public function test_station_row_keeps_every_valid_visualizer() {
		$visualizers = array( 'oscilloscope', 'bars', 'particles', 'waterfall' );
		foreach ( $visualizers as $i => $visualizer ) {
			$this->factory_rpp->station(
				'Station ' . $visualizer,
				array(
					'visualizer' => $visualizer,
					'menu_order' => $i,
				)
			);
		}

		$this->assertSame( $visualizers, array_column( radplapag_get_stations(), 'visualizer' ) );
	}

	/**
	 * A schedule meta that is not valid JSON reads as an empty schedule.
	 */
	public function test_station_row_with_invalid_schedule_json_has_empty_schedule() {
		$this->factory_rpp->station( 'Station', array( 'schedule' => '{not json' ) );

		$this->assertSame( array(), radplapag_get_stations()[0]['schedule'] );
	}

	/**
	 * A schedule meta that is valid JSON but not an object reads as an empty schedule.
	 */
	public function test_station_row_with_scalar_schedule_json_has_empty_schedule() {
		$this->factory_rpp->station( 'Station', array( 'schedule' => '"monday"' ) );

		$this->assertSame( array(), radplapag_get_stations()[0]['schedule'] );
	}

	/**
	 * The schedule is decoded as stored, without sanitizing it again.
	 */
	public function test_station_row_returns_the_stored_schedule_as_is() {
		$this->factory_rpp->station( 'Station', array( 'schedule' => '{"funday":[{"start":"x"}]}' ) );

		$this->assertSame( array( 'funday' => array( array( 'start' => 'x' ) ) ), radplapag_get_stations()[0]['schedule'] );
	}

	// Config.

	/**
	 * The config wraps the station list under `stations`.
	 */
	public function test_get_config_wraps_the_stations() {
		$this->factory_rpp->station( 'One' );
		$this->factory_rpp->station( 'Draft', array( 'status' => 'draft' ) );

		$this->assertSame( array( 'stations' => radplapag_get_stations() ), radplapag_get_config() );
		$this->assertCount( 1, radplapag_get_config()['stations'] );
	}

	/**
	 * Without stations the config still has the key.
	 */
	public function test_get_config_without_stations() {
		$this->assertSame( array( 'stations' => array() ), radplapag_get_config() );
	}

	// Station of the current page.

	/**
	 * On the player page of a station with a stream URL, that station is returned.
	 */
	public function test_station_for_current_page_matches_the_player_page() {
		$page    = $this->factory_rpp->page( 'Player' );
		$station = $this->factory_rpp->station(
			'Station',
			array(
				'stream_url'  => self::STREAM,
				'player_page' => $page,
			)
		);
		$this->go_to( get_permalink( $page ) );

		$result = radplapag_get_station_for_current_page();
		$this->assertIsArray( $result );
		$this->assertSame( $station, $result['id'] );
		$this->assertSame( radplapag_get_stations()[0], $result );
	}

	/**
	 * A station without a stream URL does not match its player page.
	 */
	public function test_station_for_current_page_ignores_station_without_url() {
		$page = $this->factory_rpp->page( 'Player' );
		$this->factory_rpp->station( 'Station', array( 'player_page' => $page ) );
		$this->go_to( get_permalink( $page ) );

		$this->assertFalse( radplapag_get_station_for_current_page() );
	}

	/**
	 * On another page nothing matches.
	 */
	public function test_station_for_current_page_is_false_on_another_page() {
		$page  = $this->factory_rpp->page( 'Player' );
		$other = $this->factory_rpp->page( 'Other' );
		$this->factory_rpp->station(
			'Station',
			array(
				'stream_url'  => self::STREAM,
				'player_page' => $page,
			)
		);
		$this->go_to( get_permalink( $other ) );

		$this->assertFalse( radplapag_get_station_for_current_page() );
	}

	/**
	 * Without stations nothing matches.
	 */
	public function test_station_for_current_page_is_false_without_stations() {
		$page = $this->factory_rpp->page( 'Player' );
		$this->go_to( get_permalink( $page ) );

		$this->assertFalse( radplapag_get_station_for_current_page() );
	}

	/**
	 * A draft station does not match its player page.
	 */
	public function test_station_for_current_page_ignores_draft_station() {
		$page = $this->factory_rpp->page( 'Player' );
		$this->factory_rpp->station(
			'Station',
			array(
				'status'      => 'draft',
				'stream_url'  => self::STREAM,
				'player_page' => $page,
			)
		);
		$this->go_to( get_permalink( $page ) );

		$this->assertFalse( radplapag_get_station_for_current_page() );
	}

	/**
	 * When two stations share a page, the first one in list order wins.
	 */
	public function test_station_for_current_page_returns_the_first_match() {
		$page = $this->factory_rpp->page( 'Player' );
		$this->factory_rpp->station(
			'Second',
			array(
				'menu_order'  => 1,
				'stream_url'  => self::STREAM,
				'player_page' => $page,
			)
		);
		$this->factory_rpp->station(
			'First',
			array(
				'menu_order'  => 0,
				'stream_url'  => self::STREAM,
				'player_page' => $page,
			)
		);
		$this->go_to( get_permalink( $page ) );

		$this->assertSame( 'First', radplapag_get_station_for_current_page()['station_title'] );
	}

	/**
	 * When nothing is queried (ID 0), a station with a URL and no player page does
	 * not match (K24).
	 */
	public function test_station_for_current_page_returns_false_when_nothing_is_queried() {
		$this->factory_rpp->station( 'Station', array( 'stream_url' => self::STREAM ) );
		$this->go_to( home_url( '/' ) );

		$this->assertSame( 0, get_queried_object_id() );
		$this->assertFalse( radplapag_get_station_for_current_page() );
	}

	/**
	 * Outside a page nothing matches: on a category archive whose term ID equals
	 * a player page ID, no station is returned (K24).
	 */
	public function test_station_for_current_page_is_false_on_a_term_with_the_page_id() {
		$term = self::factory()->category->create( array( 'name' => 'Rock' ) );
		self::factory()->post->create( array( 'post_category' => array( $term ) ) );
		$this->factory_rpp->station(
			'Station',
			array(
				'stream_url'  => self::STREAM,
				'player_page' => $term,
			)
		);
		$this->go_to( get_category_link( $term ) );

		$this->assertTrue( is_category() );
		$this->assertSame( $term, get_queried_object_id() );
		$this->assertFalse( radplapag_get_station_for_current_page() );
	}

	// Player pages assigned to other stations.

	/**
	 * Returns the player pages of every station except the excluded one.
	 */
	public function test_assigned_pages_exclude_the_given_station() {
		$page_a  = $this->factory_rpp->page( 'A' );
		$page_b  = $this->factory_rpp->page( 'B' );
		$station = $this->factory_rpp->station( 'A', array( 'player_page' => $page_a ) );
		$this->factory_rpp->station( 'B', array( 'player_page' => $page_b ) );

		$this->assertSame( array( $page_b ), radplapag_get_player_pages_assigned_to_other_stations( $station ) );
	}

	/**
	 * Without an excluded station (0, the default) every page is returned.
	 */
	public function test_assigned_pages_without_exclusion_return_all() {
		$page_a = $this->factory_rpp->page( 'A' );
		$page_b = $this->factory_rpp->page( 'B' );
		$this->factory_rpp->station( 'A', array( 'player_page' => $page_a ) );
		$this->factory_rpp->station( 'B', array( 'player_page' => $page_b ) );

		$pages = radplapag_get_player_pages_assigned_to_other_stations();
		sort( $pages );
		$this->assertSame( array( $page_a, $page_b ), $pages );
	}

	/**
	 * Draft, pending and private stations count; trashed ones do not.
	 */
	public function test_assigned_pages_count_any_status_but_trash() {
		$pages = array();
		foreach ( array( 'publish', 'draft', 'pending', 'private', 'trash' ) as $status ) {
			$pages[ $status ] = $this->factory_rpp->page( $status );
			$this->factory_rpp->station(
				$status,
				array(
					'status'      => $status,
					'player_page' => $pages[ $status ],
				)
			);
		}

		$assigned = radplapag_get_player_pages_assigned_to_other_stations();
		sort( $assigned );
		$this->assertSame( array( $pages['publish'], $pages['draft'], $pages['pending'], $pages['private'] ), $assigned );
	}

	/**
	 * Stations without a player page are skipped and repeated pages appear once, as a list.
	 */
	public function test_assigned_pages_are_unique_and_skip_empty() {
		$page = $this->factory_rpp->page( 'Shared' );
		$this->factory_rpp->station( 'No page' );
		$this->factory_rpp->station( 'One', array( 'player_page' => $page ) );
		$this->factory_rpp->station( 'Two', array( 'player_page' => $page ) );

		$this->assertSame( array( $page ), radplapag_get_player_pages_assigned_to_other_stations() );
	}

	/**
	 * Without stations the list is empty.
	 */
	public function test_assigned_pages_without_stations() {
		$this->assertSame( array(), radplapag_get_player_pages_assigned_to_other_stations( 123 ) );
	}

	// Program data.

	/**
	 * A published program returns its name, descriptions and logo.
	 */
	public function test_program_data_of_a_published_program() {
		$logo    = $this->factory_rpp->image( 'show-logo' );
		$program = $this->factory_rpp->program(
			'Morning',
			array(
				'description'          => 'Short',
				'extended_description' => "Long\ntext",
				'logo_id'              => $logo,
			)
		);

		$data = radplapag_get_program_data( $program );
		$this->assertSame( array( 'name', 'description', 'extended_description', 'logo_id', 'logo_url' ), array_keys( $data ) );
		$this->assertSame( 'Morning', $data['name'] );
		$this->assertSame( 'Short', $data['description'] );
		$this->assertSame( "Long\ntext", $data['extended_description'] );
		$this->assertSame( $logo, $data['logo_id'] );
		$this->assertSame( wp_get_attachment_url( $logo ), $data['logo_url'] );
		$this->assertStringEndsWith( '/show-logo.jpg', $data['logo_url'] );
	}

	/**
	 * A program without meta has empty strings, logo 0 and a null logo URL.
	 */
	public function test_program_data_without_meta() {
		$program = $this->factory_rpp->program( 'Bare' );

		$this->assertSame(
			array(
				'name'                 => 'Bare',
				'description'          => '',
				'extended_description' => '',
				'logo_id'              => 0,
				'logo_url'             => null,
			),
			radplapag_get_program_data( $program )
		);
	}

	/**
	 * A draft program is returned unless publication is required.
	 */
	public function test_program_data_of_a_draft_depends_on_require_published() {
		$program = $this->factory_rpp->program( 'Draft', array(), 'draft' );

		$this->assertSame( 'Draft', radplapag_get_program_data( $program )['name'] );
		$this->assertSame( 'Draft', radplapag_get_program_data( $program, false )['name'] );
		$this->assertNull( radplapag_get_program_data( $program, true ) );
	}

	/**
	 * A published program is returned when publication is required.
	 */
	public function test_program_data_of_a_published_program_with_require_published() {
		$program = $this->factory_rpp->program( 'Published' );

		$this->assertSame( 'Published', radplapag_get_program_data( $program, true )['name'] );
	}

	/**
	 * Invalid IDs, missing posts and posts of another type return null.
	 */
	public function test_program_data_is_null_for_invalid_ids() {
		$station = $this->factory_rpp->station( 'Station' );

		$this->assertNull( radplapag_get_program_data( 0 ) );
		$this->assertNull( radplapag_get_program_data( -1 ) );
		$this->assertNull( radplapag_get_program_data( 'abc' ) );
		$this->assertNull( radplapag_get_program_data( PHP_INT_MAX ) );
		$this->assertNull( radplapag_get_program_data( $station ) );
	}

	/**
	 * A numeric string ID is accepted.
	 */
	public function test_program_data_accepts_numeric_string_id() {
		$program = $this->factory_rpp->program( 'Morning' );

		$this->assertSame( 'Morning', radplapag_get_program_data( (string) $program )['name'] );
	}

	// Program config object, which has no caller in 3.4.2.

	/**
	 * The config built by from_post_id() is the program data with the ID first.
	 */
	public function test_program_config_to_array_adds_the_id() {
		$program = $this->factory_rpp->program( 'Morning', array( 'description' => 'Short' ) );

		$config = Radplapag_Program_Config::from_post_id( $program );
		$this->assertInstanceOf( Radplapag_Program_Config::class, $config );
		$this->assertSame( $program, $config->get_post_id() );
		$this->assertSame(
			array_merge( array( 'id' => $program ), radplapag_get_program_data( $program ) ),
			$config->to_array()
		);
		$this->assertSame( 'id', array_keys( $config->to_array() )[0] );
	}

	/**
	 * A draft program also builds a config (publication is not required).
	 */
	public function test_program_config_accepts_a_draft() {
		$program = $this->factory_rpp->program( 'Draft', array(), 'draft' );

		$this->assertInstanceOf( Radplapag_Program_Config::class, Radplapag_Program_Config::from_post_id( $program ) );
	}

	/**
	 * Invalid IDs and posts of another type give null.
	 */
	public function test_program_config_is_null_for_invalid_ids() {
		$station = $this->factory_rpp->station( 'Station' );

		$this->assertNull( Radplapag_Program_Config::from_post_id( 0 ) );
		$this->assertNull( Radplapag_Program_Config::from_post_id( -5 ) );
		$this->assertNull( Radplapag_Program_Config::from_post_id( PHP_INT_MAX ) );
		$this->assertNull( Radplapag_Program_Config::from_post_id( $station ) );
	}

	// Station config object, which has no caller in 3.4.2.

	/**
	 * The config built by from_post() gives the same row as radplapag_get_stations().
	 */
	public function test_station_config_to_array_is_the_station_row() {
		$this->factory_rpp->station(
			'Station',
			array(
				'stream_url'  => self::STREAM,
				'theme_color' => 'red',
				'schedule'    => '{"monday":[{"program_id":1,"start":"08:00","end":"09:00"}]}',
			)
		);
		$row = radplapag_get_stations()[0];

		$config = Radplapag_Station_Config::from_post( get_post( $row['id'] ) );
		$this->assertInstanceOf( Radplapag_Station_Config::class, $config );
		$this->assertSame( $row, $config->to_array() );
	}

	/**
	 * A draft station also builds a config (publication is not required).
	 */
	public function test_station_config_accepts_a_draft() {
		$station = $this->factory_rpp->station( 'Draft', array( 'status' => 'draft' ) );

		$config = Radplapag_Station_Config::from_post( get_post( $station ) );
		$this->assertInstanceOf( Radplapag_Station_Config::class, $config );
		$this->assertSame( 'Draft', $config->to_array()['station_title'] );
	}

	/**
	 * Anything but a station post gives null, an ID included.
	 */
	public function test_station_config_is_null_for_anything_but_a_station_post() {
		$station = $this->factory_rpp->station( 'Station' );
		$program = $this->factory_rpp->program( 'Morning' );

		$this->assertNull( Radplapag_Station_Config::from_post( null ) );
		$this->assertNull( Radplapag_Station_Config::from_post( $station ) );
		$this->assertNull( Radplapag_Station_Config::from_post( get_post( $program ) ) );
		$this->assertNull( Radplapag_Station_Config::from_post( get_post( $this->factory_rpp->page( 'Page' ) ) ) );
	}

	// Programs for the schedule select.

	/**
	 * Published and draft programs are listed by title, as id and name.
	 */
	public function test_programs_for_select_lists_published_and_drafts_by_title() {
		$charlie = $this->factory_rpp->program( 'Charlie' );
		$alpha   = $this->factory_rpp->program( 'Alpha', array(), 'draft' );
		$bravo   = $this->factory_rpp->program( 'Bravo' );
		$this->factory_rpp->program( 'Pending', array(), 'pending' );
		$this->factory_rpp->program( 'Private', array(), 'private' );
		$this->factory_rpp->program( 'Trashed', array(), 'trash' );

		$this->assertSame(
			array(
				array(
					'id'   => $alpha,
					'name' => 'Alpha',
				),
				array(
					'id'   => $bravo,
					'name' => 'Bravo',
				),
				array(
					'id'   => $charlie,
					'name' => 'Charlie',
				),
			),
			radplapag_get_all_programs_for_select()
		);
	}

	/**
	 * Without programs the list is empty.
	 */
	public function test_programs_for_select_without_programs() {
		$this->factory_rpp->station( 'Station' );

		$this->assertSame( array(), radplapag_get_all_programs_for_select() );
	}

	/**
	 * A user without unfiltered_html (a site administrator in a network, or with
	 * DISALLOW_UNFILTERED_HTML) saves titles through kses, which stores `&` as
	 * `&amp;`. The readers of the PHP API return the stored title as is; only the
	 * player globals decode it (Player\Globals_Builder). K21 of docs/known-issues.md.
	 */
	public function test_titles_saved_through_kses_keep_their_entities_in_the_api() {
		add_filter(
			'map_meta_cap',
			static function ( $caps, $cap ) {
				return 'unfiltered_html' === $cap ? array( 'do_not_allow' ) : $caps;
			},
			10,
			2
		);
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$this->assertFalse( current_user_can( 'unfiltered_html' ) );

		$station = $this->factory_rpp->station( 'Rock & Roll' );
		$program = $this->factory_rpp->program( 'Drum & Bass' );

		$this->assertSame( $station, radplapag_get_stations()[0]['id'] );
		$this->assertSame( 'Rock &amp; Roll', radplapag_get_stations()[0]['station_title'] );
		$this->assertSame( 'Drum &amp; Bass', radplapag_get_program_data( $program, true )['name'] );
	}
}
