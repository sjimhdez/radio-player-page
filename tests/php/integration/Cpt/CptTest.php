<?php
/**
 * Characterization of the station and program post types: registration, meta,
 * capabilities and editor (3.4.2).
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Cpt;

use RadioPlayerPage\Tests\Integration\Support\Factory;
use WP_UnitTestCase;

/**
 * Pins the arguments of both register_post_type() calls, the registered meta, who
 * can do what with the posts and which editor each type uses.
 */
final class CptTest extends WP_UnitTestCase {

	const TYPES = array( 'radplapag_station', 'radplapag_program' );

	/**
	 * Capability suffixes that the user_has_cap filters grant, as `<prefix>_<type>(s)`.
	 */
	const GRANTED = array(
		'edit_%ss',
		'edit_others_%ss',
		'publish_%ss',
		'read_private_%ss',
		'delete_%ss',
		'delete_private_%ss',
		'delete_published_%ss',
		'delete_others_%ss',
		'edit_%s',
		'read_%s',
		'delete_%s',
		'create_%ss',
	);

	/**
	 * Own meta arguments: type, single, show_in_rest and whether there is a sanitizer.
	 */
	const META = array(
		'radplapag_station' => array(
			'radplapag_station_stream_url'     => array( 'string', true, true, true ),
			'radplapag_station_player_page'    => array( 'integer', true, true, true ),
			'radplapag_station_background_id'  => array( 'integer', true, true, true ),
			'radplapag_station_logo_id'        => array( 'integer', true, true, true ),
			'radplapag_station_intro_audio_id' => array( 'integer', true, true, true ),
			'radplapag_station_theme_color'    => array( 'string', true, true, true ),
			'radplapag_station_visualizer'     => array( 'string', true, true, true ),
			'radplapag_station_schedule'       => array( 'string', true, false, false ),
			'radplapag_station_hide_title'     => array( 'boolean', true, true, true ),
			'radplapag_station_show_song'      => array( 'boolean', true, true, true ),
		),
		'radplapag_program' => array(
			'radplapag_program_description'          => array( 'string', true, true, true ),
			'radplapag_program_extended_description' => array( 'string', true, true, true ),
			'radplapag_program_logo_id'              => array( 'integer', true, true, true ),
		),
	);

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

		// WP_UnitTestCase unregisters all meta after each test; on a site it is registered on init.
		radplapag_register_station_meta();
		radplapag_register_program_meta();
		$this->factory_rpp = new Factory();
	}

	/**
	 * A user with the given role.
	 *
	 * @param string $role Role.
	 * @return \WP_User
	 */
	private function user( $role ) {
		return new \WP_User( self::factory()->user->create( array( 'role' => $role ) ) );
	}

	/**
	 * The registered meta of a post type.
	 *
	 * @param string $type Post type.
	 * @return array
	 */
	private function meta( $type ) {
		return get_registered_meta_keys( 'post', $type );
	}

	/**
	 * Runs a registered meta sanitizer.
	 *
	 * @param string $type  Post type.
	 * @param string $key   Meta key.
	 * @param mixed  $value Value.
	 * @return mixed
	 */
	private function sanitize( $type, $key, $value ) {
		return sanitize_meta( $key, $value, 'post', $type );
	}

	// Post types.

	/**
	 * Both types are private, shown in the plugin menu, title only, in REST.
	 */
	public function test_post_type_arguments() {
		$positions = array(
			'radplapag_station' => 5,
			'radplapag_program' => 10,
		);

		foreach ( self::TYPES as $type ) {
			$object = get_post_type_object( $type );

			$this->assertNotNull( $object, $type );
			$this->assertSame(
				array(
					'public'             => false,
					'publicly_queryable' => false,
					'show_ui'            => true,
					'show_in_menu'       => 'radplapag',
					'query_var'          => false,
					'rewrite'            => false,
					'capability_type'    => $type,
					'map_meta_cap'       => true,
					'has_archive'        => false,
					'hierarchical'       => false,
					'menu_position'      => $positions[ $type ],
					'show_in_rest'       => true,
					'supports'           => array( 'title' => true ),
				),
				array(
					'public'             => $object->public,
					'publicly_queryable' => $object->publicly_queryable,
					'show_ui'            => $object->show_ui,
					'show_in_menu'       => $object->show_in_menu,
					'query_var'          => $object->query_var,
					'rewrite'            => $object->rewrite,
					'capability_type'    => $object->capability_type,
					'map_meta_cap'       => $object->map_meta_cap,
					'has_archive'        => $object->has_archive,
					'hierarchical'       => $object->hierarchical,
					'menu_position'      => $object->menu_position,
					'show_in_rest'       => $object->show_in_rest,
					'supports'           => get_all_post_type_supports( $type ),
				),
				$type
			);
		}
	}

	/**
	 * The primitive capabilities come from the plural capability type.
	 */
	public function test_post_type_capabilities_use_the_custom_type() {
		foreach ( self::TYPES as $type ) {
			$cap = get_post_type_object( $type )->cap;

			$this->assertSame( 'edit_' . $type . 's', $cap->edit_posts, $type );
			$this->assertSame( 'edit_others_' . $type . 's', $cap->edit_others_posts, $type );
			$this->assertSame( 'publish_' . $type . 's', $cap->publish_posts, $type );
			$this->assertSame( 'delete_' . $type . 's', $cap->delete_posts, $type );
			$this->assertSame( 'edit_published_' . $type . 's', $cap->edit_published_posts, $type );
			$this->assertSame( 'edit_' . $type . 's', $cap->create_posts, $type );
		}
	}

	/**
	 * The labels shown in the admin.
	 */
	public function test_post_type_labels() {
		$station = get_post_type_object( 'radplapag_station' )->labels;
		$program = get_post_type_object( 'radplapag_program' )->labels;

		$this->assertSame( array( 'Radio Stations', 'Radio Station', 'Add Radio Station' ), array( $station->name, $station->singular_name, $station->add_new_item ) );
		$this->assertSame( array( 'Radio Shows', 'Radio Show', 'Add Radio Show' ), array( $program->name, $program->singular_name, $program->add_new_item ) );
	}

	// Meta.

	/**
	 * Exactly these keys are registered, with this type, single and show_in_rest.
	 */
	public function test_registered_meta_keys_and_arguments() {
		foreach ( self::META as $type => $keys ) {
			$registered = $this->meta( $type );
			$actual     = array();
			foreach ( $registered as $key => $args ) {
				$actual[ $key ] = array( $args['type'], $args['single'], $args['show_in_rest'], null !== $args['sanitize_callback'] );
			}

			$this->assertSame( $keys, $actual, $type );
		}
	}

	/**
	 * Every meta key is editable only with manage_options.
	 */
	public function test_meta_auth_callbacks_require_manage_options() {
		$admin  = $this->user( 'administrator' );
		$editor = $this->user( 'editor' );

		foreach ( self::META as $type => $keys ) {
			$registered = $this->meta( $type );
			foreach ( array_keys( $keys ) as $key ) {
				$auth = $registered[ $key ]['auth_callback'];

				wp_set_current_user( $admin->ID );
				$this->assertTrue( $auth( false, $key, 0, $admin->ID, 'edit_post_meta', array() ), $key );

				wp_set_current_user( $editor->ID );
				$this->assertFalse( $auth( true, $key, 0, $editor->ID, 'edit_post_meta', array() ), $key );
			}
		}
	}

	/**
	 * The stream URL goes through esc_url_raw().
	 */
	public function test_station_stream_url_sanitizer() {
		$this->assertSame( 'https://example.com/live.mp3', $this->sanitize( 'radplapag_station', 'radplapag_station_stream_url', 'https://example.com/live.mp3' ) );
		$this->assertSame( '', $this->sanitize( 'radplapag_station', 'radplapag_station_stream_url', 'javascript:alert(1)' ) );
	}

	/**
	 * The player page goes through absint().
	 */
	public function test_station_player_page_sanitizer() {
		$this->assertSame( 12, $this->sanitize( 'radplapag_station', 'radplapag_station_player_page', '-12' ) );
		$this->assertSame( 0, $this->sanitize( 'radplapag_station', 'radplapag_station_player_page', 'abc' ) );
	}

	/**
	 * Background, station logo and program logo: an image ID stays, anything else is 0.
	 */
	public function test_image_id_sanitizers() {
		$image = $this->factory_rpp->image( 'image' );
		$audio = $this->factory_rpp->audio( 'audio' );
		$keys  = array(
			array( 'radplapag_station', 'radplapag_station_background_id' ),
			array( 'radplapag_station', 'radplapag_station_logo_id' ),
			array( 'radplapag_program', 'radplapag_program_logo_id' ),
		);

		foreach ( $keys as list( $type, $key ) ) {
			$this->assertSame( $image, $this->sanitize( $type, $key, (string) $image ), $key );
			$this->assertSame( 0, $this->sanitize( $type, $key, $audio ), $key );
			$this->assertSame( 0, $this->sanitize( $type, $key, 999999 ), $key );
			$this->assertSame( 0, $this->sanitize( $type, $key, '' ), $key );
		}
	}

	/**
	 * The intro audio keeps only audio/mpeg attachments.
	 */
	public function test_station_intro_audio_sanitizer() {
		$mp3   = $this->factory_rpp->audio( 'mp3' );
		$ogg   = $this->factory_rpp->audio( 'ogg', 'audio/ogg' );
		$image = $this->factory_rpp->image( 'image' );
		$key   = 'radplapag_station_intro_audio_id';

		$this->assertSame( $mp3, $this->sanitize( 'radplapag_station', $key, $mp3 ) );
		$this->assertSame( 0, $this->sanitize( 'radplapag_station', $key, $ogg ) );
		$this->assertSame( 0, $this->sanitize( 'radplapag_station', $key, $image ) );
		$this->assertSame( 0, $this->sanitize( 'radplapag_station', $key, 0 ) );
	}

	/**
	 * Theme color and visualizer go through sanitize_key(), without a whitelist.
	 */
	public function test_station_key_sanitizers() {
		foreach ( array( 'radplapag_station_theme_color', 'radplapag_station_visualizer' ) as $key ) {
			$this->assertSame( 'blue', $this->sanitize( 'radplapag_station', $key, 'Blue' ), $key );
			$this->assertSame( 'nota-color', $this->sanitize( 'radplapag_station', $key, 'Not a-Color!' ), $key );
		}
	}

	/**
	 * The hide title meta goes through rest_sanitize_boolean() (ADR 0054).
	 */
	public function test_station_hide_title_sanitizer() {
		$key = 'radplapag_station_hide_title';

		$this->assertTrue( $this->sanitize( 'radplapag_station', $key, '1' ) );
		$this->assertFalse( $this->sanitize( 'radplapag_station', $key, '' ) );
		$this->assertFalse( $this->sanitize( 'radplapag_station', $key, 'false' ) );
	}

	/**
	 * The show song meta goes through rest_sanitize_boolean() (ADR 0068).
	 */
	public function test_station_show_song_sanitizer() {
		$key = 'radplapag_station_show_song';

		$this->assertTrue( $this->sanitize( 'radplapag_station', $key, '1' ) );
		$this->assertFalse( $this->sanitize( 'radplapag_station', $key, '' ) );
		$this->assertFalse( $this->sanitize( 'radplapag_station', $key, 'false' ) );
	}

	/**
	 * The schedule meta has no sanitizer: the value is stored as given.
	 */
	public function test_station_schedule_is_not_sanitized() {
		$this->assertSame( '{not json', $this->sanitize( 'radplapag_station', 'radplapag_station_schedule', '{not json' ) );
	}

	/**
	 * The program descriptions go through sanitize_text_field() / sanitize_textarea_field().
	 */
	public function test_program_description_sanitizers() {
		$this->assertSame( 'a b', $this->sanitize( 'radplapag_program', 'radplapag_program_description', "<b>a</b>\nb" ) );
		$this->assertSame( "a\nb", $this->sanitize( 'radplapag_program', 'radplapag_program_extended_description', "<b>a</b>\nb" ) );
	}

	// Capabilities.

	/**
	 * With manage_options, the user_has_cap filters add exactly these capabilities.
	 */
	public function test_user_has_cap_grants_exactly_these_caps_with_manage_options() {
		$user = $this->user( 'administrator' );

		foreach ( self::TYPES as $type ) {
			$expected = array();
			foreach ( self::GRANTED as $format ) {
				$expected[ sprintf( $format, $type ) ] = true;
			}
			$callback = 'radplapag_grant_' . substr( $type, strlen( 'radplapag_' ) ) . '_caps_to_manage_options';

			$granted = $callback( array( 'manage_options' => true ), array(), array(), $user );

			$this->assertSame( array( 'manage_options' => true ) + $expected, $granted, $type );
		}
	}

	/**
	 * Without manage_options the filters change nothing.
	 */
	public function test_user_has_cap_grants_nothing_without_manage_options() {
		$user    = $this->user( 'editor' );
		$allcaps = array(
			'edit_posts'     => true,
			'manage_options' => false,
		);

		$this->assertSame( $allcaps, radplapag_grant_station_caps_to_manage_options( $allcaps, array(), array(), $user ) );
		$this->assertSame( $allcaps, radplapag_grant_program_caps_to_manage_options( $allcaps, array(), array(), $user ) );
	}

	/**
	 * An administrator has every plural type capability; an editor none. The
	 * singular ones are meta capabilities and need a post (next test).
	 */
	public function test_type_capabilities_of_administrator_and_editor() {
		$admin  = $this->user( 'administrator' );
		$editor = $this->user( 'editor' );

		foreach ( self::TYPES as $type ) {
			foreach ( self::GRANTED as $format ) {
				if ( '%ss' !== substr( $format, -3 ) ) {
					continue;
				}
				$cap = sprintf( $format, $type );
				$this->assertTrue( user_can( $admin, $cap ), $cap );
				$this->assertFalse( user_can( $editor, $cap ), $cap );
			}
		}
	}

	/**
	 * An administrator can edit, delete, read and publish any station or program,
	 * published or draft, also through the singular type capabilities; an editor
	 * cannot.
	 */
	public function test_post_meta_capabilities_of_administrator_and_editor() {
		$admin  = $this->user( 'administrator' );
		$editor = $this->user( 'editor' );
		$posts  = array(
			$this->factory_rpp->station( 'Published' ),
			$this->factory_rpp->station( 'Draft', array( 'status' => 'draft' ) ),
			$this->factory_rpp->program( 'Published' ),
			$this->factory_rpp->program( 'Draft', array(), 'draft' ),
		);

		foreach ( $posts as $post ) {
			$type = get_post_type( $post );
			foreach ( array( 'edit_post', 'delete_post', 'read_post', 'publish_post', 'edit_' . $type, 'delete_' . $type, 'read_' . $type ) as $cap ) {
				$this->assertTrue( user_can( $admin, $cap, $post ), $cap . ' ' . $post );
				$this->assertFalse( user_can( $editor, $cap, $post ), $cap . ' ' . $post );
			}
		}
	}

	/**
	 * The map_meta_cap filter: the four post meta capabilities on a station or
	 * program need manage_options.
	 */
	public function test_map_meta_cap_maps_post_caps_to_manage_options() {
		$station = $this->factory_rpp->station( 'Station' );
		$program = $this->factory_rpp->program( 'Program' );

		foreach ( array( $station, $program ) as $post ) {
			foreach ( array( 'edit_post', 'delete_post', 'read_post', 'publish_post' ) as $cap ) {
				$this->assertSame( array( 'manage_options' ), map_meta_cap( $cap, 1, $post ), $cap );
				$this->assertSame( array( 'manage_options' ), radplapag_map_cpt_meta_cap( array( 'x' ), $cap, 1, array( $post ) ), $cap );
			}
		}
	}

	/**
	 * The map_meta_cap filter leaves other capabilities, other post types and calls
	 * without a post alone.
	 */
	public function test_map_meta_cap_leaves_other_cases_alone() {
		$station = $this->factory_rpp->station( 'Station' );
		$page    = $this->factory_rpp->page( 'Page' );

		$this->assertSame( array( 'x' ), radplapag_map_cpt_meta_cap( array( 'x' ), 'edit_post_meta', 1, array( $station ) ) );
		$this->assertSame( array( 'x' ), radplapag_map_cpt_meta_cap( array( 'x' ), 'edit_posts', 1, array() ) );
		$this->assertSame( array( 'x' ), radplapag_map_cpt_meta_cap( array( 'x' ), 'edit_post', 1, array( $page ) ) );
		$this->assertSame( array( 'x' ), radplapag_map_cpt_meta_cap( array( 'x' ), 'edit_post', 1, array() ) );
		$this->assertSame( array( 'x' ), radplapag_map_cpt_meta_cap( array( 'x' ), 'edit_post', 1, array( 0 ) ) );
	}

	/**
	 * A call without a post does not fall back to the global post (get_post( 0 )
	 * does): with the loop on a station it still leaves the capabilities alone.
	 */
	public function test_map_meta_cap_without_a_post_ignores_the_global_post() {
		// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Puts the loop on a station; tear_down() resets it.
		$GLOBALS['post'] = get_post( $this->factory_rpp->station( 'Station' ) );

		$this->assertSame( array( 'x' ), radplapag_map_cpt_meta_cap( array( 'x' ), 'edit_post', 1, array() ) );
		$this->assertSame( array( 'x' ), radplapag_map_cpt_meta_cap( array( 'x' ), 'edit_post', 1, array( 0 ) ) );
	}

	// Editor.

	/**
	 * The station filter forces the classic editor and passes other types through.
	 */
	public function test_station_use_classic_editor_filter() {
		$this->assertFalse( radplapag_station_use_classic_editor( true, 'radplapag_station' ) );
		$this->assertTrue( radplapag_station_use_classic_editor( true, 'post' ) );
		$this->assertFalse( radplapag_station_use_classic_editor( false, 'post' ) );
	}

	/**
	 * Both types use the classic editor. The program has no filter, but it does not
	 * support `editor`, so WordPress does not offer the block editor either. C12 of
	 * docs/known-issues.md does not reproduce.
	 */
	public function test_both_types_use_the_classic_editor() {
		$station = $this->factory_rpp->station( 'Station' );
		$program = $this->factory_rpp->program( 'Program' );

		$this->assertFalse( use_block_editor_for_post_type( 'radplapag_station' ) );
		$this->assertFalse( use_block_editor_for_post_type( 'radplapag_program' ) );
		$this->assertFalse( use_block_editor_for_post( $station ) );
		$this->assertFalse( use_block_editor_for_post( $program ) );
	}

	// REST.

	/**
	 * Both types are private (`public => false`) but in REST, and the posts
	 * controller lets anyone read a published post: an anonymous visitor lists the
	 * published stations and programs with title, slug, dates and link, also a
	 * station whose player page is a draft. The meta is not in the response
	 * (the types do not support custom-fields), and drafts are not listed. K22 of
	 * docs/known-issues.md.
	 */
	public function test_currently_rest_lists_published_posts_to_anonymous_visitors() {
		$draft_page = self::factory()->post->create(
			array(
				'post_type'   => 'page',
				'post_status' => 'draft',
			)
		);
		$station    = $this->factory_rpp->station(
			'Hidden Station',
			array(
				'stream_url'  => 'https://stream.example.com/live.mp3',
				'player_page' => $draft_page,
			)
		);
		$this->factory_rpp->station( 'Draft Station', array( 'status' => 'draft' ) );
		$program = $this->factory_rpp->program( 'Show' );
		wp_set_current_user( 0 );

		$stations = rest_do_request( new \WP_REST_Request( 'GET', '/wp/v2/radplapag_station' ) );
		$programs = rest_do_request( new \WP_REST_Request( 'GET', '/wp/v2/radplapag_program' ) );

		$this->assertSame( 200, $stations->get_status() );
		$this->assertSame( array( $station ), array_column( $stations->get_data(), 'id' ) );
		$this->assertSame( 'Hidden Station', $stations->get_data()[0]['title']['rendered'] );
		$this->assertArrayNotHasKey( 'meta', $stations->get_data()[0] );
		$this->assertSame( 200, $programs->get_status() );
		$this->assertSame( array( $program ), array_column( $programs->get_data(), 'id' ) );
	}

	/**
	 * `current_user_can( 'edit_post', $post )` with a WP_Post (core accepts an
	 * object or an ID): the map_meta_cap filter maps it to manage_options without
	 * any PHP notice/warning, as with the ID. K25 of docs/known-issues.md.
	 */
	public function test_map_meta_cap_accepts_a_post_object() {
		$station = get_post( $this->factory_rpp->station( 'Station' ) );
		$errors  = array();
		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_set_error_handler -- Captures any notice/warning instead of failing the test.
		set_error_handler(
			static function ( $errno, $errstr ) use ( &$errors ) {
				$errors[] = $errstr;
				return true;
			}
		);
		try {
			$caps = radplapag_map_cpt_meta_cap( array( 'x' ), 'edit_post', 1, array( $station ) );
		} finally {
			restore_error_handler();
		}

		$this->assertSame( array( 'manage_options' ), $caps );
		$this->assertSame( array(), $errors );
	}
}
