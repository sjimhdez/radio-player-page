<?php
/**
 * Characterization of the admin screens: menu, assets, JS data and meta boxes (3.4.2).
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Admin;

use RadioPlayerPage\Tests\Integration\Support\Factory;
use RadioPlayerPage\Tests\Integration\Support\Snapshot;
use RuntimeException;
use WP_UnitTestCase;

/**
 * Pins the RPP menu, which assets load on which screen, the shape of radplapagAdmin,
 * radplapag_get_admin_strings() and the meta boxes. Also writes the station meta box
 * fixture that the admin JS tests (Vitest) load.
 */
final class AdminScreensTest extends WP_UnitTestCase {

	/**
	 * Keys of radplapag_get_admin_strings()['strings'], in order.
	 */
	const STRING_KEYS = array(
		'addProgramImage',
		'selectImage',
		'changeImage',
		'streamUrlRequired',
		'streamUrlInvalid',
		'playerPageRequired',
		'playerPageAlreadyAssigned',
		'monday',
		'tuesday',
		'wednesday',
		'thursday',
		'friday',
		'saturday',
		'sunday',
		'invalidTimeFormat',
		'completeTimeFields',
		'startEndSame',
		'unnamedProgram',
		'timeSlotOverlapsWith',
		'timeSlotOverlapsWithMessage',
		'pleaseSelectProgram',
		'pleaseSelectProgramWithName',
		'allFieldsRequired',
		'selectProgram',
		'to',
		'removeTimeSlot',
		'scheduleRerun',
		'showMoreFields',
		'hideMoreFields',
		'programName',
		'programImageLabel',
		'programDescription',
		'descriptionLabel',
		'programExtendedDescription',
		'extendedDescriptionLabel',
		'removeImage',
		'recommendedImageSize',
		'recommendedProgramImageSize',
		'removeProgram',
		'programNameRequired',
	);

	/**
	 * Globals each test starts empty, with their empty value (null makes wp_scripts()
	 * and wp_styles() build a new registry).
	 */
	const ISOLATED = array(
		'wp_scripts'        => null,
		'wp_styles'         => null,
		'menu'              => array(),
		'submenu'           => array(),
		'wp_meta_boxes'     => array(),
		'_registered_pages' => array(),
	);

	/**
	 * Fixture factory.
	 *
	 * @var Factory
	 */
	private $factory_rpp;

	/**
	 * REQUEST_URI before the test (wp_nonce_field() prints it as the referer).
	 *
	 * @var string|null
	 */
	private $request_uri;

	/**
	 * Values of the ISOLATED globals before the test.
	 *
	 * @var array<string, mixed>
	 */
	private $globals = array();

	/**
	 * Logs in an administrator on post.php and starts with empty script, style, menu
	 * and meta box registries.
	 */
	public function set_up() {
		parent::set_up();

		require_once ABSPATH . 'wp-admin/includes/plugin.php';
		require_once ABSPATH . 'wp-admin/includes/template.php';

		radplapag_register_station_meta();
		radplapag_register_program_meta();
		$this->factory_rpp = new Factory();

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );

		foreach ( self::ISOLATED as $name => $empty ) {
			$this->globals[ $name ] = isset( $GLOBALS[ $name ] ) ? $GLOBALS[ $name ] : null;
			$GLOBALS[ $name ]       = $empty; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited , WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- Restored in tear_down().
		}

		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized, WordPress.Security.ValidatedSanitizedInput.MissingUnslash -- Saved to restore it.
		$this->request_uri      = isset( $_SERVER['REQUEST_URI'] ) ? $_SERVER['REQUEST_URI'] : null;
		$_SERVER['REQUEST_URI'] = '/wp-admin/post.php';
	}

	/**
	 * Restores REQUEST_URI and the registries (the blocks' scripts are registered on
	 * init, once per run, and later tests need them).
	 */
	public function tear_down() {
		foreach ( $this->globals as $name => $value ) {
			$GLOBALS[ $name ] = $value; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited, WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- Restored as it was.
		}
		if ( null === $this->request_uri ) {
			unset( $_SERVER['REQUEST_URI'] );
		} else {
			$_SERVER['REQUEST_URI'] = $this->request_uri; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Restored as it was.
		}

		parent::tear_down();
	}

	// ── Menu ────────────────────────────────────────────────────────────────────

	/**
	 * RPP is a top-level page at position 30, for manage_options, with the microphone
	 * icon; opening it redirects to the stations list.
	 */
	public function test_admin_menu_adds_the_rpp_top_level_page() {
		radplapag_admin_menu();

		$item = $GLOBALS['menu'][30];
		$this->assertSame( 'RPP', $item[0] );
		$this->assertSame( 'manage_options', $item[1] );
		$this->assertSame( 'radplapag', $item[2] );
		$this->assertSame( 'Radio Stations', $item[3] );
		$this->assertSame( 'dashicons-microphone', $item[6] );
		$this->assertSame( 10, has_action( 'toplevel_page_radplapag', 'radplapag_menu_redirect_to_stations' ) );
	}

	/**
	 * Under RPP, WordPress first adds a link to RPP itself, then Stations and Programs;
	 * radplapag_remove_duplicate_rpp_submenu() leaves only the two lists.
	 */
	public function test_duplicate_rpp_submenu_is_removed() {
		radplapag_admin_menu();
		_add_post_type_submenus();

		$this->assertSame(
			array( 'radplapag', 'edit.php?post_type=radplapag_station', 'edit.php?post_type=radplapag_program' ),
			array_values( wp_list_pluck( $GLOBALS['submenu']['radplapag'], 2 ) )
		);

		radplapag_remove_duplicate_rpp_submenu();

		$this->assertSame(
			array( 'edit.php?post_type=radplapag_station', 'edit.php?post_type=radplapag_program' ),
			array_values( wp_list_pluck( $GLOBALS['submenu']['radplapag'], 2 ) )
		);
	}

	/**
	 * Opening admin.php?page=radplapag redirects to the stations list.
	 */
	public function test_menu_page_redirects_to_the_stations_list() {
		add_filter(
			'wp_redirect',
			static function ( $location ) {
				throw new RuntimeException( $location ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Test.
			}
		);

		$this->expectException( RuntimeException::class );
		$this->expectExceptionMessage( admin_url( 'edit.php?post_type=radplapag_station' ) );

		radplapag_menu_redirect_to_stations();
	}

	// ── Assets ──────────────────────────────────────────────────────────────────

	/**
	 * Screens without the plugin's assets: no screen, the dashboard, a page, and the
	 * station and program lists.
	 *
	 * @return array<string, array{0: string|null}>
	 */
	public function data_other_screens() {
		return array(
			'no screen'    => array( null ),
			'dashboard'    => array( 'dashboard' ),
			'page'         => array( 'page' ),
			'station list' => array( 'edit-radplapag_station' ),
			'program list' => array( 'edit-radplapag_program' ),
		);
	}

	/**
	 * Outside the station and program edit screens, nothing is enqueued.
	 *
	 * @dataProvider data_other_screens
	 *
	 * @param string|null $screen Screen ID.
	 */
	public function test_admin_scripts_enqueue_nothing_on_other_screens( $screen ) {
		if ( null !== $screen ) {
			set_current_screen( $screen );
		}
		$media = did_action( 'wp_enqueue_media' );

		radplapag_admin_scripts( 'post.php' );
		radplapag_station_edit_scripts();
		radplapag_program_edit_scripts();

		$this->assertFalse( wp_style_is( 'radplapag-admin', 'enqueued' ) );
		$this->assertFalse( wp_script_is( 'radplapag-station-admin', 'enqueued' ) );
		$this->assertFalse( wp_script_is( 'radplapag-program-admin', 'enqueued' ) );
		$this->assertSame( $media, did_action( 'wp_enqueue_media' ) );
	}

	/**
	 * On the station screen: the CSS, media, station-admin.js and program-admin.js
	 * (for the logo and background pickers), both in the footer.
	 */
	public function test_admin_scripts_on_the_station_screen() {
		set_current_screen( 'radplapag_station' );
		$media = did_action( 'wp_enqueue_media' );

		radplapag_admin_scripts( 'post.php' );

		$admin = plugin_dir_url( RADPLAPAG_PLUGIN_FILE ) . 'admin/';
		$style = wp_styles()->registered['radplapag-admin'];
		$this->assertTrue( wp_style_is( 'radplapag-admin', 'enqueued' ) );
		$this->assertSame( $admin . 'css/admin.css', $style->src );
		$this->assertSame( array(), $style->deps );
		$this->assertSame( '3.4.2', $style->ver );

		foreach ( array(
			'radplapag-station-admin' => 'station-admin.js',
			'radplapag-program-admin' => 'program-admin.js',
		) as $handle => $file ) {
			$script = wp_scripts()->registered[ $handle ];
			$this->assertTrue( wp_script_is( $handle, 'enqueued' ), $handle );
			$this->assertSame( $admin . 'js/' . $file, $script->src, $handle );
			$this->assertSame( array( 'jquery', 'media-editor' ), $script->deps, $handle );
			$this->assertSame( '3.4.2', $script->ver, $handle );
			$this->assertSame( 1, wp_scripts()->get_data( $handle, 'group' ), $handle );
		}
		$this->assertSame( $media + 1, did_action( 'wp_enqueue_media' ) );
	}

	/**
	 * On the program screen, radplapag_admin_scripts() enqueues only the CSS;
	 * radplapag_program_edit_scripts() adds media and program-admin.js.
	 */
	public function test_admin_scripts_on_the_program_screen() {
		set_current_screen( 'radplapag_program' );
		$media = did_action( 'wp_enqueue_media' );

		radplapag_admin_scripts( 'post.php' );

		$this->assertTrue( wp_style_is( 'radplapag-admin', 'enqueued' ) );
		$this->assertFalse( wp_script_is( 'radplapag-station-admin', 'enqueued' ) );
		$this->assertFalse( wp_script_is( 'radplapag-program-admin', 'enqueued' ) );
		$this->assertSame( $media, did_action( 'wp_enqueue_media' ) );

		radplapag_station_edit_scripts();
		$this->assertSame( $media, did_action( 'wp_enqueue_media' ) );

		radplapag_program_edit_scripts();

		$script = wp_scripts()->registered['radplapag-program-admin'];
		$this->assertTrue( wp_script_is( 'radplapag-program-admin', 'enqueued' ) );
		$this->assertSame( plugin_dir_url( RADPLAPAG_PLUGIN_FILE ) . 'admin/js/program-admin.js', $script->src );
		$this->assertSame( array( 'jquery', 'media-editor' ), $script->deps );
		$this->assertSame( '3.4.2', $script->ver );
		$this->assertSame( 1, wp_scripts()->get_data( 'radplapag-program-admin', 'group' ) );
		$this->assertSame( $media + 1, did_action( 'wp_enqueue_media' ) );
	}

	/**
	 * On the station screen, radplapag_station_edit_scripts() enqueues media.
	 */
	public function test_station_edit_scripts_enqueue_media_on_the_station_screen() {
		set_current_screen( 'radplapag_station' );
		$media = did_action( 'wp_enqueue_media' );

		radplapag_station_edit_scripts();

		$this->assertSame( $media + 1, did_action( 'wp_enqueue_media' ) );
		$this->assertFalse( wp_script_is( 'radplapag-station-admin', 'enqueued' ) );
	}

	/**
	 * The station screen localizes radplapagAdmin: the admin strings plus the pages of other
	 * stations. In the CLI, filter_input() reads no `post`, so no station is excluded
	 * (the exclusion is checked below and in e2e, phase 2).
	 */
	public function test_station_screen_localizes_radplapag_admin() {
		$main  = $this->factory_rpp->page( 'Main Player' );
		$other = $this->factory_rpp->page( 'Other Player' );
		$this->factory_rpp->station( 'Test FM', array( 'player_page' => $main ) );
		$this->factory_rpp->station( 'Other FM', array( 'player_page' => $other ) );
		$this->factory_rpp->program( 'Morning Show' );
		set_current_screen( 'radplapag_station' );

		radplapag_admin_scripts( 'post.php' );

		$data = wp_scripts()->get_data( 'radplapag-station-admin', 'data' );
		$this->assertSame( 1, preg_match( '/^var radplapagAdmin = (.*);$/s', $data, $m ) );
		$localized = json_decode( $m[1], true );

		$this->assertSame( array( 'programs', 'strings', 'assignedPlayerPages' ), array_keys( $localized ) );
		$this->assertSame( radplapag_get_admin_strings()['programs'], $localized['programs'] );
		$this->assertSame( radplapag_get_admin_strings()['strings'], $localized['strings'] );
		$this->assertEqualsCanonicalizing( array( $main, $other ), $localized['assignedPlayerPages'] );
		$this->assertFalse( wp_scripts()->get_data( 'radplapag-program-admin', 'data' ) );
	}

	/**
	 * The pages of other stations: any status but trash, without the excluded station,
	 * without stations that have no page, and each page once.
	 */
	public function test_player_pages_assigned_to_other_stations() {
		$a    = $this->factory_rpp->page( 'A' );
		$b    = $this->factory_rpp->page( 'B' );
		$c    = $this->factory_rpp->page( 'C' );
		$d    = $this->factory_rpp->page( 'D' );
		$self = $this->factory_rpp->station( 'Self', array( 'player_page' => $a ) );
		$this->factory_rpp->station( 'Published', array( 'player_page' => $b ) );
		$this->factory_rpp->station( 'Same page', array( 'player_page' => $b ) );
		$this->factory_rpp->station(
			'Draft',
			array(
				'player_page' => $c,
				'status'      => 'draft',
			)
		);
		$this->factory_rpp->station(
			'Trashed',
			array(
				'player_page' => $d,
				'status'      => 'trash',
			)
		);
		$this->factory_rpp->station( 'No page' );

		$this->assertEqualsCanonicalizing( array( $b, $c ), radplapag_get_player_pages_assigned_to_other_stations( $self ) );
		$this->assertEqualsCanonicalizing( array( $a, $b, $c ), radplapag_get_player_pages_assigned_to_other_stations() );
	}

	// ── Admin strings ───────────────────────────────────────────────────────────

	/**
	 * The strings: exactly these keys, all non-empty, and the overlap message with %s.
	 */
	public function test_admin_strings_keys() {
		$strings = radplapag_get_admin_strings();

		$this->assertSame( array( 'programs', 'strings' ), array_keys( $strings ) );
		$this->assertSame( self::STRING_KEYS, array_keys( $strings['strings'] ) );
		foreach ( $strings['strings'] as $key => $value ) {
			$this->assertIsString( $value, $key );
			$this->assertNotSame( '', $value, $key );
		}
		$this->assertSame( 'This time slot overlaps with: %s', $strings['strings']['timeSlotOverlapsWithMessage'] );
		$this->assertSame( 'Rerun', $strings['strings']['scheduleRerun'] );
	}

	/**
	 * The programs for the schedule selects: published and draft, by title, as
	 * `id` (int) and `name`; pending, private and trashed ones are left out.
	 */
	public function test_admin_strings_programs() {
		$this->assertSame( array(), radplapag_get_admin_strings()['programs'] );

		$night   = $this->factory_rpp->program( 'Night Owl' );
		$morning = $this->factory_rpp->program( 'Morning Show' );
		$draft   = $this->factory_rpp->program( 'Draft Show', array(), 'draft' );
		$this->factory_rpp->program( 'Pending Show', array(), 'pending' );
		$this->factory_rpp->program( 'Private Show', array(), 'private' );
		$this->factory_rpp->program( 'Trashed Show', array(), 'trash' );

		$this->assertSame(
			array(
				array(
					'id'   => $draft,
					'name' => 'Draft Show',
				),
				array(
					'id'   => $morning,
					'name' => 'Morning Show',
				),
				array(
					'id'   => $night,
					'name' => 'Night Owl',
				),
			),
			radplapag_get_admin_strings()['programs']
		);
	}

	// ── Meta boxes ──────────────────────────────────────────────────────────────

	/**
	 * Station: Details and Radio Schedule, in the normal context; program: Details.
	 */
	public function test_meta_boxes_are_registered() {
		radplapag_add_station_meta_boxes();
		radplapag_add_program_meta_boxes();

		$boxes = array();
		foreach ( $GLOBALS['wp_meta_boxes'] as $type => $contexts ) {
			foreach ( $contexts as $context => $priorities ) {
				foreach ( $priorities as $priority => $by_id ) {
					foreach ( $by_id as $id => $box ) {
						$boxes[] = array( $type, $context, $priority, $id, $box['title'], $box['callback'] );
					}
				}
			}
		}

		$this->assertSame(
			array(
				array( 'radplapag_station', 'normal', 'default', 'radplapag_station_details', 'Details', 'radplapag_render_station_details_meta_box' ),
				array( 'radplapag_station', 'normal', 'default', 'radplapag_station_schedule', 'Radio Schedule', 'radplapag_render_station_schedule_meta_box' ),
				array( 'radplapag_program', 'normal', 'default', 'radplapag_program_details', 'Details', 'radplapag_render_program_meta_boxes' ),
			),
			$boxes
		);
	}

	/**
	 * The station details box prints a nonce for `radplapag_station_meta` that verifies.
	 */
	public function test_station_details_box_prints_a_valid_nonce() {
		$html = $this->render( 'radplapag_render_station_details_meta_box', $this->factory_rpp->station( 'Test FM' ) );

		$this->assertSame( 1, preg_match( '/name="radplapag_station_meta_nonce" value="([^"]+)"/', $html, $m ) );
		$this->assertSame( 1, wp_verify_nonce( $m[1], 'radplapag_station_meta' ) );
	}

	/**
	 * A station without meta: no page selected, empty URL, neutral and oscilloscope
	 * selected, no previews and the remove buttons hidden.
	 */
	public function test_station_details_box_defaults() {
		$this->factory_rpp->page( 'Main Player' );
		$html = $this->render( 'radplapag_render_station_details_meta_box', $this->factory_rpp->station( 'Test FM' ) );

		$this->assertStringNotContainsString( 'selected', $this->select( $html, 'radplapag_station_player_page' ) );
		$this->assertStringContainsString( 'name="radplapag_station_stream_url" id="radplapag_station_stream_url" value=""', $html );
		$this->assertSame( array( 'neutral' ), $this->selected( $html, 'radplapag_station_theme_color' ) );
		$this->assertSame( array( 'oscilloscope' ), $this->selected( $html, 'radplapag_station_visualizer' ) );
		$this->assertStringNotContainsString( '<img', $html );
		$this->assertStringNotContainsString( '<audio', $html );
		$this->assertSame( 3, substr_count( $html, ' style="display:none;"' ) );
	}

	/**
	 * Unknown theme and visualizer values fall back to the first of the list.
	 */
	public function test_station_details_box_unknown_values_fall_back() {
		$station = $this->factory_rpp->station( 'Test FM' );
		// Below the registered sanitizer, as an old or foreign writer would leave them.
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.SlowDBQuery -- Test data.
		foreach ( array(
			'radplapag_station_theme_color' => 'teal',
			'radplapag_station_visualizer'  => 'spiral',
		) as $key => $value ) {
			$GLOBALS['wpdb']->insert(
				$GLOBALS['wpdb']->postmeta,
				array(
					'post_id'    => $station,
					'meta_key'   => $key,
					'meta_value' => $value,
				)
			);
		}
		// phpcs:enable
		wp_cache_delete( $station, 'post_meta' );

		$html = $this->render( 'radplapag_render_station_details_meta_box', $station );

		$this->assertSame( array( 'neutral' ), $this->selected( $html, 'radplapag_station_theme_color' ) );
		$this->assertSame( array( 'oscilloscope' ), $this->selected( $html, 'radplapag_station_visualizer' ) );
	}

	/**
	 * The page select lists published pages only.
	 */
	public function test_station_details_box_lists_published_pages() {
		$this->factory_rpp->page( 'Main Player' );
		self::factory()->post->create(
			array(
				'post_type'   => 'page',
				'post_title'  => 'Draft Page',
				'post_status' => 'draft',
			)
		);

		$html = $this->render( 'radplapag_render_station_details_meta_box', $this->factory_rpp->station( 'Test FM' ) );

		$this->assertStringContainsString( '>Main Player</option>', $html );
		$this->assertStringNotContainsString( 'Draft Page', $html );
	}

	/**
	 * Without a schedule, or with invalid JSON, the box prints the seven days, empty,
	 * inside #radplapag-station-cpt-container.
	 *
	 * @return array<string, array{0: array<string, mixed>}>
	 */
	public function data_empty_schedules() {
		return array(
			'no schedule'  => array( array() ),
			'invalid JSON' => array( array( 'schedule' => '{not json' ) ),
		);
	}

	/**
	 * See data_empty_schedules().
	 *
	 * @dataProvider data_empty_schedules
	 *
	 * @param array<string, mixed> $meta Station meta.
	 */
	public function test_schedule_box_without_slots( array $meta ) {
		$html = $this->render( 'radplapag_render_station_schedule_meta_box', $this->factory_rpp->station( 'Test FM', $meta ) );

		$this->assertStringStartsWith( '<div id="radplapag-station-cpt-container">', trim( $html ) );
		$this->assertSame( 1, preg_match_all( '/class="radplapag-schedule-wrapper"/', $html ) );
		preg_match_all( '/class="radplapag-schedule-day" data-day="([a-z]+)"/', $html, $m );
		$this->assertSame( array( 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday' ), $m[1] );
		$this->assertSame( 7, substr_count( $html, 'class="button radplapag-add-program"' ) );
		$this->assertStringNotContainsString( 'radplapag-program-row', $html );
		$this->assertStringNotContainsString( 'nonce', $html );
	}

	/**
	 * Slots print sorted by start but keep their array index in the field names, and
	 * the rerun checkbox is checked.
	 */
	public function test_schedule_box_sorts_slots_by_start_keeping_indexes() {
		$morning = $this->factory_rpp->program( 'Morning Show' );
		$night   = $this->factory_rpp->program( 'Night Owl' );
		$station = $this->factory_rpp->station(
			'Test FM',
			array(
				'schedule' => array(
					'monday' => array(
						array(
							'program_id' => $night,
							'start'      => '22:00',
							'end'        => '02:00',
							'is_rerun'   => true,
						),
						array(
							'program_id' => $morning,
							'start'      => '07:00',
							'end'        => '10:00',
						),
					),
				),
			)
		);

		$html = $this->render( 'radplapag_render_station_schedule_meta_box', $station );

		preg_match_all( '/data-program-index="(\d+)"/', $html, $m );
		$this->assertSame( array( '1', '0' ), $m[1] );
		$this->assertStringContainsString( 'name="radplapag_station_schedule[monday][0][is_rerun]" value="1"  checked=\'checked\'', $html );
		$this->assertStringContainsString( 'name="radplapag_station_schedule[monday][1][is_rerun]" value="1"  class', $html );
	}

	/**
	 * The program box: a nonce for `radplapag_program_meta` that verifies, the values,
	 * the maxlength of both descriptions and the logo preview.
	 */
	public function test_program_box() {
		$logo    = $this->factory_rpp->image( 'show-logo' );
		$program = $this->factory_rpp->program(
			'Morning Show',
			array(
				'description'          => 'News & talk',
				'extended_description' => "Line one\nLine \"two\" & more",
				'logo_id'              => $logo,
			)
		);

		$html = $this->render( 'radplapag_render_program_meta_boxes', $program );

		$this->assertSame( 1, preg_match( '/name="radplapag_program_meta_nonce" value="([^"]+)"/', $html, $m ) );
		$this->assertSame( 1, wp_verify_nonce( $m[1], 'radplapag_program_meta' ) );
		$this->assertStringContainsString( 'name="radplapag_program_description" value="News &amp; talk" class="large-text radplapag-field-input" maxlength="256"', $html );
		$this->assertStringContainsString( 'maxlength="512">Line one' . "\n" . 'Line &quot;two&quot; &amp; more</textarea>', $html );
		$this->assertStringContainsString( 'name="radplapag_program_logo_id" value="' . $logo . '"', $html );
		$this->assertStringContainsString( '<img src="', $html );
		$this->assertStringNotContainsString( 'display:none', $html );
	}

	/**
	 * A program without meta: empty fields, logo 0, no preview, remove button hidden.
	 */
	public function test_program_box_defaults() {
		$html = $this->render( 'radplapag_render_program_meta_boxes', $this->factory_rpp->program( 'Morning Show' ) );

		$this->assertStringContainsString( 'name="radplapag_program_description" value=""', $html );
		$this->assertStringContainsString( 'maxlength="512"></textarea>', $html );
		$this->assertStringContainsString( 'name="radplapag_program_logo_id" value="0"', $html );
		$this->assertStringNotContainsString( '<img', $html );
		$this->assertStringContainsString( ' style="display:none;"', $html );
	}

	/**
	 * Both station boxes inside `<form id="post">`, as on post.php, normalized and
	 * written to tests/fixtures/admin/station-meta-box.html for the admin JS tests.
	 * IDs are replaced with fixed numbers (listed in the header comment) so the JS
	 * sees numeric IDs.
	 */
	public function test_station_meta_box_fixture() {
		$main    = $this->factory_rpp->page( 'Main Player' );
		$other   = $this->factory_rpp->page( 'Other Player' );
		$free    = $this->factory_rpp->page( 'Free Page' );
		$morning = $this->factory_rpp->program( 'Morning Show' );
		$night   = $this->factory_rpp->program( 'Night Owl' );
		$draft   = $this->factory_rpp->program( 'Draft Show', array(), 'draft' );
		$logo    = $this->factory_rpp->image( 'logo' );
		$bg      = $this->factory_rpp->image( 'background' );
		$intro   = $this->factory_rpp->audio( 'intro' );
		$this->factory_rpp->station( 'Other FM', array( 'player_page' => $other ) );
		$station = $this->factory_rpp->station(
			'Test FM',
			array(
				'player_page'    => $main,
				'stream_url'     => 'https://stream.example.test/live.mp3',
				'theme_color'    => 'blue',
				'visualizer'     => 'bars',
				'logo_id'        => $logo,
				'background_id'  => $bg,
				'intro_audio_id' => $intro,
				'schedule'       => array(
					'monday'    => array(
						array(
							'program_id' => $night,
							'start'      => '22:00',
							'end'        => '02:00',
						),
						array(
							'program_id' => $morning,
							'start'      => '07:00',
							'end'        => '10:00',
						),
					),
					'wednesday' => array(
						array(
							'program_id' => $morning,
							'start'      => '07:00',
							'end'        => '10:00',
							'is_rerun'   => true,
						),
					),
				),
			)
		);

		$ids = array(
			$main    => '101',
			$other   => '102',
			$free    => '103',
			$morning => '201',
			$night   => '202',
			$draft   => '203',
			$station => '301',
			$logo    => '401',
			$bg      => '402',
			$intro   => '403',
		);

		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Test request.
		$_SERVER['REQUEST_URI'] = '/wp-admin/post.php?post=' . $station . '&action=edit';

		$html = '<!-- Written by tests/php/integration/Admin/AdminScreensTest.php (test_station_meta_box_fixture); do not edit by hand.' . "\n"
			. '     Pages: 101 Main Player (this station), 102 Other Player (Other FM), 103 Free Page.' . "\n"
			. '     Programs: 201 Morning Show, 202 Night Owl, 203 Draft Show (draft). Station: 301 Test FM.' . "\n"
			. '     Attachments: 401 logo, 402 background, 403 intro (audio). -->' . "\n"
			. '<form id="post">' . "\n"
			. $this->render( 'radplapag_render_station_details_meta_box', $station )
			. $this->render( 'radplapag_render_station_schedule_meta_box', $station )
			. '</form>' . "\n";
		$html = preg_replace( '/(name="radplapag_station_meta_nonce" value=")[^"]+/', '$1{{NONCE}}', $html );

		Snapshot::assert_matches_file( $this, dirname( __DIR__, 3 ) . '/fixtures/admin/station-meta-box.html', $html, $ids );
	}

	/**
	 * Output of a meta box render callback.
	 *
	 * @param callable $callback Render callback.
	 * @param int      $post_id  Post ID.
	 * @return string
	 */
	private function render( $callback, $post_id ) {
		ob_start();
		call_user_func( $callback, get_post( $post_id ) );

		return ob_get_clean();
	}

	/**
	 * HTML of the select with the given name.
	 *
	 * @param string $html Meta box HTML.
	 * @param string $name Select name.
	 * @return string
	 */
	private function select( $html, $name ) {
		$this->assertSame( 1, preg_match( '#<select name="' . preg_quote( $name, '#' ) . '".*?</select>#s', $html, $m ), $name );

		return $m[0];
	}

	/**
	 * Values of the selected options of a select.
	 *
	 * @param string $html Meta box HTML.
	 * @param string $name Select name.
	 * @return string[]
	 */
	private function selected( $html, $name ) {
		preg_match_all( '#<option value="([^"]*)"\s+selected=\'selected\'#', $this->select( $html, $name ), $m );

		return $m[1];
	}
}
