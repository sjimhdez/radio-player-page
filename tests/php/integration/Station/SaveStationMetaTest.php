<?php
/**
 * Characterization of radplapag_save_station_meta(),
 * radplapag_station_redirect_without_message() and
 * radplapag_station_schedule_errors_notice() (3.4.2).
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Station;

use RadioPlayerPage\Tests\Integration\Support\Factory;
use WP_UnitTestCase;

/**
 * Pins what saving the station edit form writes: guards, field errors, whitelists,
 * attachments and the schedule.
 *
 * Limit of the CLI: the stream URL is read with filter_input( INPUT_POST ), which
 * ignores $_POST and returns null outside a real request. Here the URL is always
 * empty, so every save reports "Streaming URL is required." and never writes the
 * URL nor the player page. The successful path goes to e2e (phase 2; deviation in
 * docs/status.md).
 */
final class SaveStationMetaTest extends WP_UnitTestCase {

	const URL_REQUIRED  = 'Streaming URL is required.';
	const PAGE_REQUIRED = 'Player Page is required. Please select a page.';
	const PAGE_TAKEN    = 'This Player Page is already assigned to another station. Please choose a different page.';

	const BACKGROUND_NOT_IMAGE = 'Background Image must be an image; the previous one was kept.';
	const LOGO_NOT_IMAGE       = 'Logo Image must be an image; the previous one was kept.';
	const INTRO_NOT_MP3        = 'Welcome Audio must be an MP3 file; the previous one was kept.';

	/**
	 * Fixture factory.
	 *
	 * @var Factory
	 */
	private $factory_rpp;

	/**
	 * Station being saved.
	 *
	 * @var int
	 */
	private $station;

	/**
	 * Logs in an administrator and creates the station.
	 */
	public function set_up() {
		parent::set_up();

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$this->factory_rpp = new Factory();
		$this->station     = $this->factory_rpp->station( 'Station' );
		$_POST             = array();
		$_GET              = array();
	}

	/**
	 * Clears the request.
	 */
	public function tear_down() {
		$_POST = array();
		$_GET  = array();

		parent::tear_down();
	}

	/**
	 * Fills $_POST like the edit form, with a valid nonce, and saves.
	 *
	 * @param array    $fields  Form fields (names without the `radplapag_station_` prefix).
	 * @param int|null $post_id Post to save; the station by default.
	 */
	private function save( array $fields = array(), $post_id = null ) {
		$_POST['radplapag_station_meta_nonce'] = wp_create_nonce( 'radplapag_station_meta' );
		foreach ( $fields as $name => $value ) {
			$_POST[ 'radplapag_station_' . $name ] = wp_slash( $value );
		}

		radplapag_save_station_meta( null === $post_id ? $this->station : $post_id );
	}

	/**
	 * A station meta value of the saved station.
	 *
	 * @param string $key Meta key without the `radplapag_station_` prefix.
	 * @return mixed
	 */
	private function meta( $key ) {
		return get_post_meta( $this->station, 'radplapag_station_' . $key, true );
	}

	/**
	 * The field errors transient of the station.
	 *
	 * @return mixed
	 */
	private function field_errors() {
		return get_transient( 'radplapag_station_field_errors_' . $this->station );
	}

	/**
	 * Asserts that the save wrote nothing.
	 */
	private function assert_nothing_saved() {
		$this->assertFalse( $this->field_errors() );
		$this->assertFalse( get_transient( 'radplapag_station_schedule_errors_' . $this->station ) );
		$this->assertSame( '', $this->meta( 'theme_color' ) );
		$this->assertSame( '', $this->meta( 'schedule' ) );
	}

	// Guards.

	/**
	 * Without the nonce field nothing is saved.
	 */
	public function test_without_nonce_nothing_is_saved() {
		$_POST['radplapag_station_theme_color'] = 'blue';

		radplapag_save_station_meta( $this->station );

		$this->assert_nothing_saved();
	}

	/**
	 * With a wrong nonce nothing is saved.
	 */
	public function test_with_invalid_nonce_nothing_is_saved() {
		$_POST['radplapag_station_meta_nonce']  = wp_create_nonce( 'radplapag_program_meta' );
		$_POST['radplapag_station_theme_color'] = 'blue';

		radplapag_save_station_meta( $this->station );

		$this->assert_nothing_saved();
	}

	/**
	 * A user without manage_options saves nothing, even with a valid nonce.
	 */
	public function test_without_manage_options_nothing_is_saved() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );

		$this->save( array( 'theme_color' => 'blue' ) );

		$this->assert_nothing_saved();
	}

	/**
	 * An autosave saves nothing. DOING_AUTOSAVE cannot be undefined, so the test runs
	 * in its own process.
	 *
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_during_autosave_nothing_is_saved() {
		define( 'DOING_AUTOSAVE', true ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- WordPress core constant.

		$this->save( array( 'theme_color' => 'blue' ) );

		$this->assert_nothing_saved();
	}

	/**
	 * A post of another type is not touched.
	 */
	public function test_other_post_type_is_not_touched() {
		$page = $this->factory_rpp->page( 'Page' );

		$this->save( array( 'theme_color' => 'blue' ), $page );

		$this->assertSame( '', get_post_meta( $page, 'radplapag_station_theme_color', true ) );
		$this->assertFalse( get_transient( 'radplapag_station_field_errors_' . $page ) );
	}

	/**
	 * The callback is hooked to the station's save_post, so wp_update_post() runs it.
	 */
	public function test_runs_on_save_post_of_the_station() {
		$_POST['radplapag_station_meta_nonce']  = wp_create_nonce( 'radplapag_station_meta' );
		$_POST['radplapag_station_theme_color'] = 'blue';

		wp_update_post( array( 'ID' => $this->station ) );

		$this->assertSame( 'blue', $this->meta( 'theme_color' ) );
	}

	// Stream URL and player page.

	/**
	 * In the CLI the URL in $_POST is never read: it is reported as missing and
	 * keeps its saved value, and the valid page is still written (K42, ADR 0048).
	 */
	public function test_cli_never_reads_stream_url_so_url_is_kept_and_page_written() {
		$old_page = $this->factory_rpp->page( 'Old page' );
		$new_page = $this->factory_rpp->page( 'New page' );
		update_post_meta( $this->station, 'radplapag_station_stream_url', 'https://old.example/stream' );
		update_post_meta( $this->station, 'radplapag_station_player_page', $old_page );

		$this->save(
			array(
				'stream_url'  => 'https://new.example/stream',
				'player_page' => (string) $new_page,
			)
		);

		$this->assertSame( self::URL_REQUIRED, $this->field_errors() );
		$this->assertSame( 'https://old.example/stream', $this->meta( 'stream_url' ) );
		$this->assertSame( (string) $new_page, $this->meta( 'player_page' ) );
	}

	/**
	 * A missing or non-positive page adds its error after the URL one.
	 */
	public function test_missing_player_page_is_reported() {
		foreach ( array( null, '0', 'abc' ) as $page ) {
			$this->save( null === $page ? array() : array( 'player_page' => $page ) );

			$this->assertSame( self::URL_REQUIRED . ' ' . self::PAGE_REQUIRED, $this->field_errors(), var_export( $page, true ) ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_var_export
		}
	}

	/**
	 * A page already assigned to another station (any status) is reported.
	 */
	public function test_page_assigned_to_another_station_is_reported() {
		$page = $this->factory_rpp->page( 'Page' );
		$this->factory_rpp->station(
			'Other',
			array(
				'player_page' => $page,
				'status'      => 'draft',
			)
		);

		$this->save( array( 'player_page' => (string) $page ) );

		$this->assertSame( self::URL_REQUIRED . ' ' . self::PAGE_TAKEN, $this->field_errors() );
	}

	/**
	 * The station's own page is not "assigned to another station".
	 */
	public function test_own_page_is_not_reported() {
		$page = $this->factory_rpp->page( 'Page' );
		update_post_meta( $this->station, 'radplapag_station_player_page', $page );

		$this->save( array( 'player_page' => (string) $page ) );

		$this->assertSame( self::URL_REQUIRED, $this->field_errors() );
	}

	/**
	 * The field errors last 45 seconds.
	 */
	public function test_field_errors_expire_in_45_seconds() {
		$this->save();

		$timeout = (int) get_option( '_transient_timeout_radplapag_station_field_errors_' . $this->station );
		$this->assertEqualsWithDelta( time() + 45, $timeout, 2 );
	}

	/**
	 * Field errors do not stop the other fields from being saved.
	 */
	public function test_field_errors_do_not_block_other_fields() {
		$this->save(
			array(
				'theme_color' => 'green',
				'visualizer'  => 'bars',
				'schedule'    => array(),
			)
		);

		$this->assertSame( self::URL_REQUIRED . ' ' . self::PAGE_REQUIRED, $this->field_errors() );
		$this->assertSame( 'green', $this->meta( 'theme_color' ) );
		$this->assertSame( 'bars', $this->meta( 'visualizer' ) );
		$this->assertSame( '[]', $this->meta( 'schedule' ) );
	}

	// Theme and visualizer whitelists.

	/**
	 * Theme input → stored theme.
	 *
	 * @return array<string, array{string|null, string}>
	 */
	public function theme_cases() {
		$cases = array();
		foreach ( array( 'neutral', 'blue', 'green', 'red', 'orange', 'yellow', 'purple', 'pink' ) as $theme ) {
			$cases[ $theme ] = array( $theme, $theme );
		}
		$cases['missing']       = array( null, 'neutral' );
		$cases['unknown']       = array( 'teal', 'neutral' );
		$cases['empty']         = array( '', 'neutral' );
		$cases['uppercase']     = array( 'BLUE', 'blue' );
		$cases['key-sanitized'] = array( 'b<l>ue', 'blue' );

		return $cases;
	}

	/**
	 * The theme is sanitize_key()'d and checked against the whitelist; anything else is `neutral`.
	 *
	 * @dataProvider theme_cases
	 * @param string|null $input    Posted value, null when missing.
	 * @param string      $expected Stored value.
	 */
	public function test_theme_whitelist( $input, $expected ) {
		$this->save( null === $input ? array() : array( 'theme_color' => $input ) );

		$this->assertSame( $expected, $this->meta( 'theme_color' ) );
	}

	/**
	 * Visualizer input → stored visualizer.
	 *
	 * @return array<string, array{string|null, string}>
	 */
	public function visualizer_cases() {
		$cases = array();
		foreach ( array( 'oscilloscope', 'bars', 'particles', 'waterfall' ) as $visualizer ) {
			$cases[ $visualizer ] = array( $visualizer, $visualizer );
		}
		$cases['missing']   = array( null, 'oscilloscope' );
		$cases['unknown']   = array( 'spectrum', 'oscilloscope' );
		$cases['uppercase'] = array( 'Bars', 'bars' );

		return $cases;
	}

	/**
	 * The visualizer is sanitize_key()'d and checked against the whitelist; anything else is `oscilloscope`.
	 *
	 * @dataProvider visualizer_cases
	 * @param string|null $input    Posted value, null when missing.
	 * @param string      $expected Stored value.
	 */
	public function test_visualizer_whitelist( $input, $expected ) {
		$this->save( null === $input ? array() : array( 'visualizer' => $input ) );

		$this->assertSame( $expected, $this->meta( 'visualizer' ) );
	}

	// Attachments.

	/**
	 * Valid attachments are stored as their IDs.
	 */
	public function test_valid_attachments_are_saved() {
		$background = $this->factory_rpp->image( 'Background' );
		$logo       = $this->factory_rpp->image( 'Logo' );
		$intro      = $this->factory_rpp->audio( 'Intro' );

		$this->save(
			array(
				'background_id'  => (string) $background,
				'logo_id'        => (string) $logo,
				'intro_audio_id' => (string) $intro,
			)
		);

		$this->assertSame( (string) $background, $this->meta( 'background_id' ) );
		$this->assertSame( (string) $logo, $this->meta( 'logo_id' ) );
		$this->assertSame( (string) $intro, $this->meta( 'intro_audio_id' ) );
	}

	/**
	 * Images must be images and the welcome audio must be `audio/mpeg`; otherwise
	 * the stored value is kept and the field errors transient says so (K37, ADR 0048).
	 */
	public function test_invalid_attachments_keep_the_stored_value() {
		$ogg   = $this->factory_rpp->audio( 'Ogg', 'audio/ogg' );
		$image = $this->factory_rpp->image( 'Image' );
		$mp3   = $this->factory_rpp->audio( 'Mp3' );
		$page  = $this->factory_rpp->page( 'Page' );
		update_post_meta( $this->station, 'radplapag_station_background_id', $image );
		update_post_meta( $this->station, 'radplapag_station_logo_id', $image );
		update_post_meta( $this->station, 'radplapag_station_intro_audio_id', $mp3 );

		$this->save(
			array(
				'background_id'  => (string) $ogg,
				'logo_id'        => (string) $page,
				'intro_audio_id' => (string) $image,
			)
		);

		$this->assertSame( (string) $image, $this->meta( 'background_id' ) );
		$this->assertSame( (string) $image, $this->meta( 'logo_id' ) );
		$this->assertSame( (string) $mp3, $this->meta( 'intro_audio_id' ) );
		$this->assertSame(
			self::URL_REQUIRED . ' ' . self::PAGE_REQUIRED . ' ' . self::BACKGROUND_NOT_IMAGE . ' ' . self::LOGO_NOT_IMAGE . ' ' . self::INTRO_NOT_MP3,
			$this->field_errors()
		);
	}

	/**
	 * Missing or non-numeric attachment fields overwrite the stored ones with 0.
	 */
	public function test_missing_attachments_overwrite_with_zero() {
		$logo = $this->factory_rpp->image( 'Logo' );
		update_post_meta( $this->station, 'radplapag_station_logo_id', $logo );
		update_post_meta( $this->station, 'radplapag_station_background_id', $logo );

		$this->save( array( 'background_id' => 'abc' ) );

		$this->assertSame( '0', $this->meta( 'logo_id' ) );
		$this->assertSame( '0', $this->meta( 'background_id' ) );
		$this->assertSame( '0', $this->meta( 'intro_audio_id' ) );
	}

	/**
	 * The posted hide title checkbox stores '1' (ADR 0054).
	 */
	public function test_posted_hide_title_is_saved() {
		$this->save( array( 'hide_title' => '1' ) );

		$this->assertSame( '1', $this->meta( 'hide_title' ) );
	}

	/**
	 * Without the checkbox in the form, a stored hide title meta is deleted.
	 */
	public function test_missing_hide_title_deletes_the_meta() {
		update_post_meta( $this->station, 'radplapag_station_hide_title', '1' );

		$this->save();

		$this->assertFalse( metadata_exists( 'post', $this->station, 'radplapag_station_hide_title' ) );
	}

	/**
	 * The posted show song checkbox stores '1' (ADR 0068).
	 */
	public function test_posted_show_song_is_saved() {
		$this->save( array( 'show_song' => '1' ) );

		$this->assertSame( '1', $this->meta( 'show_song' ) );
	}

	/**
	 * Without the checkbox in the form, a stored show song meta is deleted.
	 */
	public function test_missing_show_song_deletes_the_meta() {
		update_post_meta( $this->station, 'radplapag_station_show_song', '1' );

		$this->save();

		$this->assertFalse( metadata_exists( 'post', $this->station, 'radplapag_station_show_song' ) );
	}

	/**
	 * A welcome audio that is not MP3 (the media frame offered any audio) keeps the
	 * previous one and says so. In the CLI the URL is always missing (class
	 * docblock), so its message comes first. K37 of docs/known-issues.md.
	 */
	public function test_non_mp3_welcome_audio_keeps_the_previous_one_with_a_notice() {
		$mp3 = $this->factory_rpp->audio( 'Mp3' );
		$ogg = $this->factory_rpp->audio( 'Ogg', 'audio/ogg' );
		update_post_meta( $this->station, 'radplapag_station_intro_audio_id', $mp3 );

		$this->save( array( 'intro_audio_id' => (string) $ogg ) );

		$this->assertSame( (string) $mp3, $this->meta( 'intro_audio_id' ) );
		$this->assertSame( self::URL_REQUIRED . ' ' . self::PAGE_REQUIRED . ' ' . self::INTRO_NOT_MP3, $this->field_errors() );
		$this->assertFalse( get_transient( 'radplapag_station_schedule_errors_' . $this->station ) );
	}

	// Schedule.

	/**
	 * A valid schedule is stored as the sanitized JSON and clears a previous error.
	 */
	public function test_valid_schedule_is_saved_as_json() {
		$program = $this->factory_rpp->program( 'Morning' );
		set_transient( 'radplapag_station_schedule_errors_' . $this->station, 'Old error', 45 );

		$this->save(
			array(
				'schedule' => array(
					'monday' => array(
						array(
							'program_id' => (string) $program,
							'start'      => ' 06:00 ',
							'end'        => '10:00',
							'is_rerun'   => '1',
						),
					),
				),
			)
		);

		$this->assertSame(
			wp_json_encode(
				array(
					'monday' => array(
						array(
							'program_id' => $program,
							'start'      => '06:00',
							'end'        => '10:00',
							'is_rerun'   => true,
						),
					),
				)
			),
			$this->meta( 'schedule' )
		);
		$this->assertFalse( get_transient( 'radplapag_station_schedule_errors_' . $this->station ) );
	}

	/**
	 * A missing or non-array schedule stores an empty one (`[]`), overwriting the old one.
	 */
	public function test_missing_schedule_stores_empty_json() {
		update_post_meta( $this->station, 'radplapag_station_schedule', '{"monday":[]}' );

		$this->save();
		$this->assertSame( '[]', $this->meta( 'schedule' ) );

		update_post_meta( $this->station, 'radplapag_station_schedule', '{"monday":[]}' );

		$this->save( array( 'schedule' => 'monday' ) );
		$this->assertSame( '[]', $this->meta( 'schedule' ) );
	}

	/**
	 * An invalid schedule sets the error transient (45 s) and keeps the stored schedule.
	 */
	public function test_invalid_schedule_sets_transient_and_keeps_meta() {
		update_post_meta( $this->station, 'radplapag_station_schedule', '{"monday":[]}' );

		$this->save(
			array(
				'schedule' => array(
					'monday' => array(
						array(
							'program_id' => '',
							'start'      => '06:00',
							'end'        => '10:00',
						),
					),
				),
			)
		);

		$this->assertStringStartsWith(
			'Radio show on Monday: All fields (radio show, start time, end time) are required.',
			get_transient( 'radplapag_station_schedule_errors_' . $this->station )
		);
		$timeout = (int) get_option( '_transient_timeout_radplapag_station_schedule_errors_' . $this->station );
		$this->assertEqualsWithDelta( time() + 45, $timeout, 2 );
		$this->assertSame( '{"monday":[]}', $this->meta( 'schedule' ) );
	}

	// Order of the writes (the refactor must keep it).

	/**
	 * Saves and returns the writes in order, as `<hook>:<key>`: meta added or updated
	 * and transients set or deleted. WordPress fires `deleted_transient` only when the
	 * transient existed, and the meta hooks only when the value changes: the station
	 * starts without meta, so every meta write is an `added_post_meta`.
	 *
	 * @param array $fields Form fields, as in save().
	 * @return string[]
	 */
	private function save_and_record_writes( array $fields ) {
		$writes    = array();
		$meta_hook = static function ( $meta_id, $object_id, $meta_key ) use ( &$writes ) {
			$writes[] = current_filter() . ':' . $meta_key;
		};
		$transient = static function ( $name ) use ( &$writes ) {
			$writes[] = current_filter() . ':' . $name;
		};
		// WordPress 6.8 renamed `setted_transient` to `set_transient` and listening
		// to the old name raises a deprecation notice. The label stays the same.
		$set_hook = version_compare( get_bloginfo( 'version' ), '6.8', '>=' ) ? 'set_transient' : 'setted_transient';
		$set      = static function ( $name ) use ( &$writes ) {
			$writes[] = 'setted_transient:' . $name;
		};
		add_action( 'added_post_meta', $meta_hook, 10, 3 );
		add_action( 'updated_post_meta', $meta_hook, 10, 3 );
		add_action( $set_hook, $set );
		add_action( 'deleted_transient', $transient );

		$this->save( $fields );

		remove_action( 'added_post_meta', $meta_hook, 10 );
		remove_action( 'updated_post_meta', $meta_hook, 10 );
		remove_action( $set_hook, $set );
		remove_action( 'deleted_transient', $transient );

		return $writes;
	}

	/**
	 * With field errors and a valid schedule: the field errors transient, the five
	 * metas in form order, then the schedule (its old error deleted before the meta).
	 * The successful URL path is not reachable in the CLI (see the class comment).
	 */
	public function test_writes_order_with_field_errors_and_valid_schedule() {
		$program = $this->factory_rpp->program( 'Morning' );
		set_transient( 'radplapag_station_schedule_errors_' . $this->station, 'Old error', 45 );

		$writes = $this->save_and_record_writes(
			array(
				'schedule' => array(
					'monday' => array(
						array(
							'program_id' => (string) $program,
							'start'      => '06:00',
							'end'        => '10:00',
						),
					),
				),
			)
		);

		$this->assertSame(
			array(
				'setted_transient:radplapag_station_field_errors_' . $this->station,
				'added_post_meta:radplapag_station_background_id',
				'added_post_meta:radplapag_station_logo_id',
				'added_post_meta:radplapag_station_intro_audio_id',
				'added_post_meta:radplapag_station_theme_color',
				'added_post_meta:radplapag_station_visualizer',
				'deleted_transient:radplapag_station_schedule_errors_' . $this->station,
				'added_post_meta:radplapag_station_schedule',
			),
			$writes
		);
	}

	/**
	 * With an invalid schedule: the same field writes, then only the schedule errors
	 * transient (the schedule meta is not written).
	 */
	public function test_writes_order_with_invalid_schedule() {
		$writes = $this->save_and_record_writes(
			array(
				'schedule' => array(
					'monday' => array(
						array(
							'program_id' => '',
							'start'      => '06:00',
							'end'        => '10:00',
						),
					),
				),
			)
		);

		$this->assertSame(
			array(
				'setted_transient:radplapag_station_field_errors_' . $this->station,
				'added_post_meta:radplapag_station_background_id',
				'added_post_meta:radplapag_station_logo_id',
				'added_post_meta:radplapag_station_intro_audio_id',
				'added_post_meta:radplapag_station_theme_color',
				'added_post_meta:radplapag_station_visualizer',
				'setted_transient:radplapag_station_schedule_errors_' . $this->station,
			),
			$writes
		);
	}

	// Redirect after saving: core's "Post published." / "Post updated." goes away
	// when an error notice follows (D9, ADR 0048).

	/**
	 * The edit link core redirects to after saving a post.
	 *
	 * @param int $post_id Post saved.
	 * @return string
	 */
	private static function redirect_location( $post_id ) {
		return admin_url( 'post.php?post=' . $post_id . '&action=edit&message=6' );
	}

	/**
	 * With field errors, the redirect drops core's message.
	 */
	public function test_redirect_drops_core_message_with_field_errors() {
		set_transient( 'radplapag_station_field_errors_' . $this->station, 'Field error', 45 );

		$this->assertSame(
			admin_url( 'post.php?post=' . $this->station . '&action=edit' ),
			radplapag_station_redirect_without_message( self::redirect_location( $this->station ), $this->station )
		);
	}

	/**
	 * With schedule errors, the redirect drops core's message.
	 */
	public function test_redirect_drops_core_message_with_schedule_errors() {
		set_transient( 'radplapag_station_schedule_errors_' . $this->station, 'Schedule error', 45 );

		$this->assertSame(
			admin_url( 'post.php?post=' . $this->station . '&action=edit' ),
			radplapag_station_redirect_without_message( self::redirect_location( $this->station ), $this->station )
		);
	}

	/**
	 * Without errors, the redirect keeps core's message.
	 */
	public function test_redirect_keeps_core_message_without_errors() {
		$this->assertSame(
			self::redirect_location( $this->station ),
			radplapag_station_redirect_without_message( self::redirect_location( $this->station ), $this->station )
		);
	}

	/**
	 * A post of another type keeps core's message, even with a transient of its ID.
	 */
	public function test_redirect_ignores_other_post_types() {
		$page = $this->factory_rpp->page( 'Page' );
		set_transient( 'radplapag_station_field_errors_' . $page, 'Field error', 45 );

		$this->assertSame(
			self::redirect_location( $page ),
			radplapag_station_redirect_without_message( self::redirect_location( $page ), $page )
		);
	}

	// Notice: only the early returns (filter_input( INPUT_GET ) is null in the CLI).

	/**
	 * Sets both error transients of the station.
	 */
	private function set_error_transients() {
		set_transient( 'radplapag_station_field_errors_' . $this->station, 'Field error', 45 );
		set_transient( 'radplapag_station_schedule_errors_' . $this->station, 'Schedule error', 45 );
	}

	/**
	 * Prints the notice and asserts it printed nothing and kept both transients.
	 */
	private function assert_notice_does_nothing() {
		$this->set_error_transients();
		$_GET['post'] = (string) $this->station;

		ob_start();
		radplapag_station_schedule_errors_notice();
		$this->assertSame( '', ob_get_clean() );

		$this->assertSame( 'Field error', $this->field_errors() );
		$this->assertSame( 'Schedule error', get_transient( 'radplapag_station_schedule_errors_' . $this->station ) );
	}

	/**
	 * Without a screen, nothing is printed.
	 */
	public function test_notice_without_screen_does_nothing() {
		$this->assert_notice_does_nothing();
	}

	/**
	 * On another screen, nothing is printed.
	 */
	public function test_notice_on_other_screen_does_nothing() {
		set_current_screen( 'radplapag_program' );

		$this->assert_notice_does_nothing();
	}

	/**
	 * On the station screen without `post` in the query string, nothing is printed. In
	 * the CLI that is always the case: $_GET is not read.
	 */
	public function test_notice_on_station_screen_without_post_does_nothing() {
		set_current_screen( 'radplapag_station' );

		$this->assert_notice_does_nothing();
	}
}
