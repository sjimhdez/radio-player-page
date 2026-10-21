<?php
/**
 * Characterization of includes/radplapag-upgrade.php (3.4.2): schema version, guards and
 * lock of the legacy migration, CPT conflict, outcome notices, dismissal and the
 * upgrader hook.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Migration;

use RadioPlayerPage\Tests\Integration\Support\Factory;
use RuntimeException;
use WP_UnitTestCase;

/**
 * Pins the flow around Radplapag_Migrator_Settings_To_Cpt::run(); the migrated content
 * itself is pinned by MigrationGoldenTest.
 */
final class UpgradeFlowTest extends WP_UnitTestCase {

	const REQUEST_URI = '/wp-admin/index.php?foo=bar';

	/**
	 * Fixture factory.
	 *
	 * @var Factory
	 */
	private $factory_rpp;

	/**
	 * Logged-in administrator.
	 *
	 * @var int
	 */
	private $admin;

	/**
	 * Previous error_log ini value.
	 *
	 * @var string|false
	 */
	private $error_log;

	/**
	 * Previous REQUEST_URI.
	 *
	 * @var string|null
	 */
	private $request_uri;

	/**
	 * Logs in an administrator on an admin screen, with no schema version recorded.
	 */
	public function set_up() {
		parent::set_up();

		$this->admin = self::factory()->user->create( array( 'role' => 'administrator' ) );
		wp_set_current_user( $this->admin );
		set_current_screen( 'dashboard' );
		$this->factory_rpp = new Factory();
		$this->error_log   = ini_set( 'error_log', '/dev/null' ); // phpcs:ignore WordPress.PHP.IniSet.Risky -- Restored in tear_down().
		$this->request_uri = isset( $_SERVER['REQUEST_URI'] ) ? $_SERVER['REQUEST_URI'] : null; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- Restored in tear_down().

		$_SERVER['REQUEST_URI'] = self::REQUEST_URI;
		$_GET                   = array();
		delete_option( 'radplapag_db_version' );
	}

	/**
	 * Restores the request and the error log.
	 */
	public function tear_down() {
		$_GET = array();
		if ( null === $this->request_uri ) {
			unset( $_SERVER['REQUEST_URI'] );
		} else {
			$_SERVER['REQUEST_URI'] = $this->request_uri;
		}
		ini_set( 'error_log', (string) $this->error_log ); // phpcs:ignore WordPress.PHP.IniSet.Risky -- Restores set_up().

		parent::tear_down();
	}

	/**
	 * Stores a 3.2-style option with one station and one scheduled program.
	 *
	 * @return array The stored settings.
	 */
	private function legacy_settings() {
		$settings = array(
			'stations' => array(
				array(
					'stream_url'    => 'https://stream.example.test/one.mp3',
					'player_page'   => $this->factory_rpp->page( 'Player 1' ),
					'station_title' => 'One',
					'programs'      => array(
						array(
							'id'      => 'prog_morning01',
							'name'    => 'Morning',
							'logo_id' => 0,
						),
					),
					'schedule'      => array(
						'monday' => array(
							array(
								'program_id' => 'prog_morning01',
								'start'      => '07:00',
								'end'        => '09:00',
							),
						),
					),
				),
			),
		);
		update_option( 'radplapag_settings', $settings );

		return $settings;
	}

	/**
	 * Number of posts of a type, in any status.
	 *
	 * @param string $type Post type.
	 * @return int
	 */
	private function count_posts( $type ) {
		return count(
			get_posts(
				array(
					'post_type'   => $type,
					'post_status' => 'any',
					'numberposts' => -1,
					'fields'      => 'ids',
				)
			)
		);
	}

	/**
	 * Asserts that nothing was migrated and no outcome was recorded.
	 *
	 * @param array $settings Legacy option that must remain.
	 */
	private function assert_not_migrated( array $settings ) {
		$this->assertSame( $settings, get_option( 'radplapag_settings' ) );
		$this->assertFalse( get_option( 'radplapag_db_version' ) );
		$this->assertSame( 0, $this->count_posts( 'radplapag_program' ) );
		$this->assertFalse( get_transient( 'radplapag_migration_success_notice' ) );
		$this->assertFalse( get_transient( 'radplapag_migration_error_notice' ) );
	}

	/**
	 * Expiration in seconds of a transient stored in the options table.
	 *
	 * @param string $name Transient name.
	 * @return int
	 */
	private function transient_ttl( $name ) {
		if ( wp_using_ext_object_cache() ) {
			$this->markTestSkipped( 'Transient timeouts are not stored in the options table.' );
		}

		return (int) get_option( '_transient_timeout_' . $name ) - time();
	}

	/**
	 * Output of radplapag_migration_admin_notices().
	 *
	 * @return string
	 */
	private function notices() {
		ob_start();
		radplapag_migration_admin_notices();

		return (string) ob_get_clean();
	}

	/**
	 * Runs radplapag_handle_migration_notice_dismiss() and returns the redirect target,
	 * or null when it returns without redirecting. The redirect is stopped with an
	 * exception before the function's `exit`.
	 *
	 * @param array $get Query args.
	 * @return string|null
	 */
	private function dismiss( array $get ) {
		$_GET     = $get;
		$redirect = null;
		add_filter(
			'wp_redirect',
			static function ( $location ) use ( &$redirect ) {
				$redirect = $location;
				throw new RuntimeException( 'Redirect stopped before exit.' );
			}
		);

		try {
			radplapag_handle_migration_notice_dismiss();
		} catch ( RuntimeException $e ) {
			return $redirect;
		}

		return null;
	}

	// Schema version.

	/**
	 * Without a legacy option, the schema version is recorded.
	 */
	public function test_ensure_schema_version_sets_it_without_legacy_option() {
		radplapag_ensure_schema_version_option();

		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
	}

	/**
	 * A legacy option with an empty stations list does not block the schema version.
	 */
	public function test_ensure_schema_version_sets_it_with_empty_legacy_stations() {
		update_option( 'radplapag_settings', array( 'stations' => array() ) );

		radplapag_ensure_schema_version_option();

		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
	}

	/**
	 * An older schema version is replaced when nothing is left to migrate.
	 */
	public function test_ensure_schema_version_replaces_an_older_one() {
		update_option( 'radplapag_db_version', '320' );

		radplapag_ensure_schema_version_option();

		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
	}

	/**
	 * With legacy stations pending, the schema version is not recorded.
	 */
	public function test_ensure_schema_version_waits_for_pending_legacy_stations() {
		$this->legacy_settings();
		update_option( 'radplapag_db_version', '320' );

		radplapag_ensure_schema_version_option();

		$this->assertSame( '320', get_option( 'radplapag_db_version' ) );
	}

	// Guards of the migration.

	/**
	 * Off the admin side, nothing runs.
	 */
	public function test_migration_does_not_run_off_admin() {
		$settings = $this->legacy_settings();
		set_current_screen( 'front' );

		radplapag_run_legacy_migration_if_needed();

		$this->assert_not_migrated( $settings );
	}

	/**
	 * Logged out, nothing runs.
	 */
	public function test_migration_does_not_run_logged_out() {
		$settings = $this->legacy_settings();
		wp_set_current_user( 0 );

		radplapag_run_legacy_migration_if_needed();

		$this->assert_not_migrated( $settings );
	}

	/**
	 * Without manage_options (an editor), nothing runs.
	 */
	public function test_migration_does_not_run_without_manage_options() {
		$settings = $this->legacy_settings();
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );

		radplapag_run_legacy_migration_if_needed();

		$this->assert_not_migrated( $settings );
	}

	/**
	 * With the schema version already recorded, the legacy option is left alone.
	 */
	public function test_migration_does_not_run_when_already_migrated() {
		$settings = $this->legacy_settings();
		update_option( 'radplapag_db_version', '330' );

		radplapag_run_legacy_migration_if_needed();

		$this->assertSame( $settings, get_option( 'radplapag_settings' ) );
		$this->assertSame( 0, $this->count_posts( 'radplapag_station' ) );
		$this->assertFalse( get_transient( 'radplapag_migration_success_notice' ) );
	}

	/**
	 * Without legacy stations, nothing runs and no version is written.
	 */
	public function test_migration_does_not_run_without_legacy_stations() {
		radplapag_run_legacy_migration_if_needed();

		$this->assertFalse( get_option( 'radplapag_db_version' ) );
		$this->assertFalse( get_transient( 'radplapag_migrating' ) );
		$this->assertFalse( get_transient( 'radplapag_migration_error_notice' ) );
	}

	/**
	 * While another request holds the lock, nothing runs and the lock stays.
	 */
	public function test_migration_does_not_run_while_locked() {
		$settings = $this->legacy_settings();
		set_transient( 'radplapag_migrating', '1', 120 );

		radplapag_run_legacy_migration_if_needed();

		$this->assert_not_migrated( $settings );
		$this->assertSame( '1', get_transient( 'radplapag_migrating' ) );
	}

	// Conflict with published stations.

	/**
	 * A published station skips the migration and raises the conflict flag.
	 */
	public function test_published_station_skips_migration_and_flags_conflict() {
		$settings = $this->legacy_settings();
		$this->factory_rpp->station( 'Existing' );

		radplapag_run_legacy_migration_if_needed();

		$this->assert_not_migrated( $settings );
		$this->assertSame( 1, $this->count_posts( 'radplapag_station' ) );
		$this->assertSame( '1', get_option( 'radplapag_migration_skipped_cpt_conflict' ) );
		$this->assertFalse( get_transient( 'radplapag_migrating' ) );
	}

	/**
	 * A draft station is not a conflict: the migration runs.
	 */
	public function test_draft_station_does_not_block_migration() {
		$this->legacy_settings();
		$this->factory_rpp->station( 'Draft', array( 'status' => 'draft' ) );

		radplapag_run_legacy_migration_if_needed();

		$this->assertFalse( get_option( 'radplapag_settings' ) );
		$this->assertSame( 2, $this->count_posts( 'radplapag_station' ) );
		$this->assertFalse( get_option( 'radplapag_migration_skipped_cpt_conflict' ) );
	}

	/**
	 * Once no station is published, the flag is cleared and the migration runs.
	 */
	public function test_conflict_flag_is_cleared_and_migration_runs_without_published_stations() {
		$this->legacy_settings();
		update_option( 'radplapag_migration_skipped_cpt_conflict', '1' );

		radplapag_run_legacy_migration_if_needed();

		$this->assertFalse( get_option( 'radplapag_migration_skipped_cpt_conflict' ) );
		$this->assertSame( '1', get_transient( 'radplapag_migration_success_notice' ) );
	}

	/**
	 * Clearing the conflict flag deletes it without published stations.
	 */
	public function test_clear_conflict_flag_deletes_it_without_published_stations() {
		update_option( 'radplapag_migration_skipped_cpt_conflict', '1' );
		$this->factory_rpp->station( 'Draft', array( 'status' => 'draft' ) );

		radplapag_maybe_clear_migration_conflict_flag();

		$this->assertFalse( get_option( 'radplapag_migration_skipped_cpt_conflict' ) );
	}

	/**
	 * Clearing the conflict flag keeps it while a station is published.
	 */
	public function test_clear_conflict_flag_keeps_it_with_published_stations() {
		update_option( 'radplapag_migration_skipped_cpt_conflict', '1' );
		$this->factory_rpp->station( 'Existing' );

		radplapag_maybe_clear_migration_conflict_flag();

		$this->assertSame( '1', get_option( 'radplapag_migration_skipped_cpt_conflict' ) );
	}

	// Outcome.

	/**
	 * Success: content created, option removed, version recorded, lock released and a
	 * success notice for 60 s. The current user is restored after running as the author.
	 */
	public function test_successful_migration_records_outcome_and_releases_lock() {
		$this->legacy_settings();

		radplapag_run_legacy_migration_if_needed();

		$this->assertFalse( get_option( 'radplapag_settings' ) );
		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
		$this->assertSame( 1, $this->count_posts( 'radplapag_station' ) );
		$this->assertSame( 1, $this->count_posts( 'radplapag_program' ) );
		$this->assertFalse( get_transient( 'radplapag_migrating' ) );
		$this->assertFalse( get_transient( 'radplapag_migration_error_notice' ) );
		$this->assertSame( '1', get_transient( 'radplapag_migration_success_notice' ) );
		$this->assertSame( 60, $this->transient_ttl( 'radplapag_migration_success_notice' ) );
		$this->assertSame( $this->admin, get_current_user_id() );
	}

	/**
	 * The lock is taken for 120 s while the migration runs, so a request that dies
	 * mid-migration does not block it for good.
	 */
	public function test_migration_lock_expires_in_120_seconds() {
		$this->legacy_settings();
		$expirations = array();
		$capture     = static function ( $value, $expiration ) use ( &$expirations ) {
			$expirations[] = $expiration;
		};
		add_action( 'set_transient_radplapag_migrating', $capture, 10, 2 );

		radplapag_run_legacy_migration_if_needed();

		remove_action( 'set_transient_radplapag_migrating', $capture, 10 );
		$this->assertSame( array( 120 ), $expirations );
		$this->assertFalse( get_transient( 'radplapag_migrating' ) );
	}

	/**
	 * The created posts belong to the lowest-ID administrator, not to the current user.
	 */
	public function test_migrated_posts_belong_to_the_first_administrator() {
		$this->legacy_settings();
		$first = (int) get_users(
			array(
				'role'    => 'administrator',
				'orderby' => 'ID',
				'order'   => 'ASC',
				'number'  => 1,
				'fields'  => 'ID',
			)
		)[0];
		$this->assertNotSame( $this->admin, $first, 'Precondition: another administrator has a lower ID.' );

		radplapag_run_legacy_migration_if_needed();

		$station = get_posts( array( 'post_type' => 'radplapag_station' ) )[0];
		$this->assertSame( $first, (int) $station->post_author );
	}

	/**
	 * A failing insert rolls back the posts already created, keeps the option, records
	 * no version, releases the lock and leaves the error for the notice (120 s).
	 */
	public function test_failed_migration_rolls_back_and_records_error() {
		$settings = $this->legacy_settings();
		add_filter(
			'wp_insert_post_empty_content',
			static function ( $maybe_empty, $postarr ) {
				return 'radplapag_station' === $postarr['post_type'] ? true : $maybe_empty;
			},
			10,
			2
		);

		radplapag_run_legacy_migration_if_needed();

		$this->assertSame( $settings, get_option( 'radplapag_settings' ) );
		$this->assertFalse( get_option( 'radplapag_db_version' ) );
		$this->assertSame( 0, $this->count_posts( 'radplapag_program' ), 'The program created before the failure is deleted.' );
		$this->assertSame( 0, $this->count_posts( 'radplapag_station' ) );
		$this->assertFalse( get_transient( 'radplapag_migrating' ) );
		$this->assertFalse( get_transient( 'radplapag_migration_success_notice' ) );
		$this->assertSame( 'Content, title, and excerpt are empty.', get_transient( 'radplapag_migration_error_notice' ) );
		$this->assertSame( 120, $this->transient_ttl( 'radplapag_migration_error_notice' ) );
		$this->assertSame( $this->admin, get_current_user_id() );
	}

	/**
	 * After a failure, the next request tries again.
	 */
	public function test_failed_migration_is_retried_on_next_request() {
		$this->legacy_settings();
		$fail = static function () {
			return true;
		};
		add_filter( 'wp_insert_post_empty_content', $fail );
		radplapag_run_legacy_migration_if_needed();
		remove_filter( 'wp_insert_post_empty_content', $fail );

		radplapag_run_legacy_migration_if_needed();

		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
		$this->assertSame( 1, $this->count_posts( 'radplapag_station' ) );
	}

	/**
	 * K4: a 1.0.x–1.1.x flat option has no `stations`, so the schema version is recorded,
	 * nothing is migrated, the option is orphaned and no notice is shown.
	 *
	 * @see docs/known-issues.md K4
	 */
	public function test_currently_flat_1x_settings_are_orphaned_without_notice() {
		$json     = file_get_contents( dirname( __DIR__, 3 ) . '/fixtures/legacy-settings/v1.1-flat.json' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file.
		$page     = (string) $this->factory_rpp->page( 'Player 1' );
		$settings = json_decode( str_replace( '{{PAGE:Player 1}}', $page, $json ), true )['settings'];
		update_option( 'radplapag_settings', $settings );

		radplapag_ensure_schema_version_option();
		radplapag_run_legacy_migration_if_needed();

		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
		$this->assertSame( $settings, get_option( 'radplapag_settings' ) );
		$this->assertSame( 0, $this->count_posts( 'radplapag_station' ) );
		$this->assertSame( '', $this->notices() );
	}

	/**
	 * 3.1.x and 3.2.x saved a slot crossing midnight that overlaps the next day (3.2.0
	 * only warned). The schedule sanitizer rejects it, so every admin request creates
	 * and deletes the posts and shows the error again; the site never migrates.
	 *
	 * @see docs/known-issues.md K30
	 */
	public function test_currently_cross_day_overlap_from_3_2_never_migrates() {
		$settings                                       = $this->legacy_settings();
		$settings['stations'][0]['programs'][]          = array(
			'id'      => 'prog_early0001',
			'name'    => 'Early',
			'logo_id' => 0,
		);
		$settings['stations'][0]['schedule']['monday']  = array(
			array(
				'program_id' => 'prog_morning01',
				'start'      => '23:00',
				'end'        => '02:00',
			),
		);
		$settings['stations'][0]['schedule']['tuesday'] = array(
			array(
				'program_id' => 'prog_early0001',
				'start'      => '01:00',
				'end'        => '03:00',
			),
		);
		update_option( 'radplapag_settings', $settings );

		radplapag_run_legacy_migration_if_needed();
		$this->assertStringContainsString( 'overlaps with "Early" on Tuesday', (string) get_transient( 'radplapag_migration_error_notice' ) );
		delete_transient( 'radplapag_migration_error_notice' );
		radplapag_run_legacy_migration_if_needed();

		$this->assertSame( $settings, get_option( 'radplapag_settings' ) );
		$this->assertFalse( get_option( 'radplapag_db_version' ) );
		$this->assertSame( 0, $this->count_posts( 'radplapag_program' ) );
		$this->assertSame( 0, $this->count_posts( 'radplapag_station' ) );
		$this->assertStringContainsString( 'overlaps with "Early" on Tuesday', (string) get_transient( 'radplapag_migration_error_notice' ) );
	}

	/**
	 * Dismissing the conflict notice deletes the flag, but the next admin request (the
	 * redirect itself) raises it again: the notice cannot be dismissed.
	 *
	 * @see docs/known-issues.md K29
	 */
	public function test_currently_conflict_notice_reappears_after_dismissal() {
		$this->legacy_settings();
		$this->factory_rpp->station( 'Existing' );
		radplapag_run_legacy_migration_if_needed();
		$this->dismiss(
			array(
				'radplapag_dismiss' => 'migration_conflict',
				'_wpnonce'          => wp_create_nonce( 'radplapag_dismiss_migration_conflict' ),
			)
		);
		$this->assertFalse( get_option( 'radplapag_migration_skipped_cpt_conflict' ) );

		radplapag_maybe_clear_migration_conflict_flag();
		radplapag_run_legacy_migration_if_needed();

		$this->assertSame( '1', get_option( 'radplapag_migration_skipped_cpt_conflict' ) );
		$this->assertStringContainsString( 'notice-warning', $this->notices() );
	}

	/**
	 * The migration switches to the first administrator, which re-runs kses_init: if
	 * that user lacks unfiltered_html (a site administrator in a network, or with
	 * DISALLOW_UNFILTERED_HTML), titles go through kses and `&` is stored as `&amp;`.
	 *
	 * @see docs/known-issues.md K21
	 */
	public function test_currently_migration_without_unfiltered_html_stores_entities() {
		add_filter(
			'map_meta_cap',
			static function ( $caps, $cap ) {
				return 'unfiltered_html' === $cap ? array( 'do_not_allow' ) : $caps;
			},
			10,
			2
		);
		$settings                                       = $this->legacy_settings();
		$settings['stations'][0]['station_title']       = 'Rock & Roll';
		$settings['stations'][0]['programs'][0]['name'] = 'Drum & Bass';
		update_option( 'radplapag_settings', $settings );

		radplapag_run_legacy_migration_if_needed();

		$this->assertSame( 'Rock &amp; Roll', get_posts( array( 'post_type' => 'radplapag_station' ) )[0]->post_title );
		$this->assertSame( 'Drum &amp; Bass', get_posts( array( 'post_type' => 'radplapag_program' ) )[0]->post_title );
	}

	/**
	 * The migrator passes the legacy values to wp_insert_post() and update_post_meta()
	 * without wp_slash(), and both unslash them: backslashes are lost.
	 *
	 * @see docs/known-issues.md K31
	 */
	public function test_currently_migration_strips_backslashes() {
		$settings                                       = $this->legacy_settings();
		$settings['stations'][0]['station_title']       = 'AC\\DC';
		$settings['stations'][0]['programs'][0]['name'] = '\\o/';
		$settings['stations'][0]['programs'][0]['description'] = 'C:\\x';
		update_option( 'radplapag_settings', $settings );

		radplapag_run_legacy_migration_if_needed();

		$program = get_posts( array( 'post_type' => 'radplapag_program' ) )[0];
		$this->assertSame( 'ACDC', get_posts( array( 'post_type' => 'radplapag_station' ) )[0]->post_title );
		$this->assertSame( 'o/', $program->post_title );
		$this->assertSame( 'C:x', get_post_meta( $program->ID, 'radplapag_program_description', true ) );
	}

	/**
	 * A legacy option whose `stations` holds no array migrates nothing, but the option
	 * is deleted, the version recorded and the success notice shown.
	 *
	 * @see docs/known-issues.md K32
	 */
	public function test_currently_stations_without_any_station_report_success() {
		update_option( 'radplapag_settings', array( 'stations' => array( 'x' ) ) );

		radplapag_run_legacy_migration_if_needed();

		$this->assertSame( 0, $this->count_posts( 'radplapag_station' ) );
		$this->assertFalse( get_option( 'radplapag_settings' ) );
		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
		$this->assertSame( '1', get_transient( 'radplapag_migration_success_notice' ) );
	}

	/**
	 * After an update (an automatic one runs from cron, off the admin), the migration
	 * waits for an administrator to open the admin; meanwhile the station page no longer
	 * serves the player, because only the CPT is read.
	 *
	 * @see docs/known-issues.md K33
	 */
	public function test_currently_station_page_is_not_served_until_an_admin_visits() {
		$settings = $this->legacy_settings();
		wp_set_current_user( 0 );
		set_current_screen( 'front' );

		radplapag_ensure_schema_version_option();
		radplapag_run_legacy_migration_if_needed();
		$this->go_to( get_permalink( $settings['stations'][0]['player_page'] ) );

		$this->assertTrue( is_page() );
		$this->assertFalse( radplapag_get_station_for_current_page() );
		$this->assertSame( $settings, get_option( 'radplapag_settings' ) );
	}

	// Debug log and schedule translation.

	/**
	 * Legacy station with its programs and schedule.
	 *
	 * @param string $title    Station title.
	 * @param array  $programs Legacy programs.
	 * @param array  $schedule Legacy schedule: day => slots.
	 * @return array
	 */
	private function legacy_station( $title, array $programs, array $schedule ) {
		return array(
			'stream_url'    => 'https://stream.example.test/' . strtolower( $title ) . '.mp3',
			'station_title' => $title,
			'programs'      => $programs,
			'schedule'      => $schedule,
		);
	}

	/**
	 * Legacy slot.
	 *
	 * @param string $program_id Legacy program id.
	 * @param string $start      Start time.
	 * @param string $end        End time.
	 * @return array
	 */
	private function slot( $program_id, $start = '07:00', $end = '08:00' ) {
		return array(
			'program_id' => $program_id,
			'start'      => $start,
			'end'        => $end,
		);
	}

	/**
	 * Stores the legacy stations, runs the migration with error_log() sent to a temporary
	 * file (WP_DEBUG is on in the test environment) and returns the logged messages,
	 * without their date prefix.
	 *
	 * @param array $stations Legacy stations.
	 * @return string[]
	 */
	private function migration_log( array $stations ) {
		$this->assertTrue( defined( 'WP_DEBUG' ) && WP_DEBUG, 'Precondition: WP_DEBUG is on.' );
		update_option( 'radplapag_settings', array( 'stations' => $stations ) );
		$file = (string) wp_tempnam( 'radplapag-migration-log' );
		ini_set( 'error_log', $file ); // phpcs:ignore WordPress.PHP.IniSet.Risky -- tear_down() restores it.

		try {
			radplapag_run_legacy_migration_if_needed();
		} finally {
			ini_set( 'error_log', '/dev/null' ); // phpcs:ignore WordPress.PHP.IniSet.Risky -- tear_down() restores it.
			$lines = file( $file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES );
			wp_delete_file( $file );
		}

		return array_map(
			static function ( $line ) {
				return (string) preg_replace( '/^\[[^\]]+\] /', '', $line );
			},
			false === $lines ? array() : $lines
		);
	}

	/**
	 * A legacy program id reused with different data logs one line before any skipped
	 * slot; the last occurrence wins.
	 */
	public function test_duplicate_program_id_with_differing_data_is_logged_before_skipped_slots() {
		$log = $this->migration_log(
			array(
				$this->legacy_station(
					'One',
					array(
						array(
							'id'   => 'prog_shared01',
							'name' => 'First',
						),
					),
					array( 'monday' => array( $this->slot( 'prog_gone0001' ) ) )
				),
				$this->legacy_station(
					'Two',
					array(
						array(
							'id'   => 'prog_shared01',
							'name' => 'Second',
						),
					),
					array()
				),
			)
		);

		$this->assertSame(
			array(
				'Radio Player Page migration: duplicate legacy program id "prog_shared01" with differing data; using the last occurrence.',
				'Radio Player Page migration: skipping schedule slot with unknown program id "prog_gone0001".',
			),
			$log
		);
		$this->assertSame( 'Second', get_posts( array( 'post_type' => 'radplapag_program' ) )[0]->post_title );
	}

	/**
	 * A legacy program id reused with the same data logs nothing.
	 */
	public function test_duplicate_program_id_with_same_data_is_not_logged() {
		$program = array(
			'id'          => 'prog_shared01',
			'name'        => 'Shared',
			'description' => 'Same',
		);

		$log = $this->migration_log(
			array(
				$this->legacy_station( 'One', array( $program ), array( 'monday' => array( $this->slot( 'prog_shared01' ) ) ) ),
				$this->legacy_station( 'Two', array( $program ), array( 'monday' => array( $this->slot( 'prog_shared01' ) ) ) ),
			)
		);

		$this->assertSame( array(), $log );
		$this->assertSame( 1, $this->count_posts( 'radplapag_program' ) );
	}

	/**
	 * Slots with an unknown program are logged station by station, in schedule order, and
	 * left out of the migrated schedule.
	 */
	public function test_skipped_slots_are_logged_in_station_order() {
		$log = $this->migration_log(
			array(
				$this->legacy_station(
					'One',
					array(),
					array(
						'monday'  => array( $this->slot( 'prog_gone0001' ) ),
						'tuesday' => array( $this->slot( 'prog_gone0002' ) ),
					)
				),
				$this->legacy_station( 'Two', array(), array( 'monday' => array( $this->slot( 'prog_gone0003' ) ) ) ),
			)
		);

		$this->assertSame(
			array(
				'Radio Player Page migration: skipping schedule slot with unknown program id "prog_gone0001".',
				'Radio Player Page migration: skipping schedule slot with unknown program id "prog_gone0002".',
				'Radio Player Page migration: skipping schedule slot with unknown program id "prog_gone0003".',
			),
			$log
		);
		$this->assertSame( 2, $this->count_posts( 'radplapag_station' ) );
	}

	/**
	 * Skipped slots are logged just before each station is validated: when the first
	 * station fails, those of the second are never logged.
	 */
	public function test_skipped_slots_of_stations_after_a_failing_one_are_not_logged() {
		$programs = array(
			array(
				'id'   => 'prog_known001',
				'name' => 'Known',
			),
		);

		$log = $this->migration_log(
			array(
				$this->legacy_station(
					'One',
					$programs,
					array(
						'monday' => array(
							$this->slot( 'prog_gone0001' ),
							$this->slot( 'prog_known001', 'abc', '08:00' ),
						),
					)
				),
				$this->legacy_station( 'Two', $programs, array( 'monday' => array( $this->slot( 'prog_gone0002' ) ) ) ),
			)
		);

		$this->assertSame(
			array( 'Radio Player Page migration: skipping schedule slot with unknown program id "prog_gone0001".' ),
			$log
		);
		$this->assertSame( 0, $this->count_posts( 'radplapag_station' ) );
		$this->assertStringStartsWith( 'Schedule migration failed: ', (string) get_transient( 'radplapag_migration_error_notice' ) );
	}

	/**
	 * The schedule translation keeps only program, start and end: a legacy rerun slot is
	 * migrated as a first broadcast.
	 *
	 * @see docs/known-issues.md K79
	 */
	public function test_currently_migrated_slot_loses_is_rerun() {
		$slot             = $this->slot( 'prog_known001' );
		$slot['is_rerun'] = true;
		update_option(
			'radplapag_settings',
			array(
				'stations' => array(
					$this->legacy_station(
						'One',
						array(
							array(
								'id'   => 'prog_known001',
								'name' => 'Known',
							),
						),
						array( 'monday' => array( $slot ) )
					),
				),
			)
		);

		radplapag_run_legacy_migration_if_needed();

		$station  = get_posts( array( 'post_type' => 'radplapag_station' ) )[0];
		$schedule = json_decode( (string) get_post_meta( $station->ID, 'radplapag_station_schedule', true ), true );
		$this->assertFalse( $schedule['monday'][0]['is_rerun'] );
	}

	// Admin notices.

	/**
	 * Without manage_options, no notice is printed and the transients stay.
	 */
	public function test_notices_need_manage_options() {
		set_transient( 'radplapag_migration_success_notice', '1', 60 );
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );

		$this->assertSame( '', $this->notices() );
		$this->assertSame( '1', get_transient( 'radplapag_migration_success_notice' ) );
	}

	/**
	 * The success notice is printed once.
	 */
	public function test_success_notice_is_printed_once() {
		set_transient( 'radplapag_migration_success_notice', '1', 60 );

		$this->assertSame(
			'<div class="notice notice-success is-dismissible"><p>Radio Player Page: Your radio stations and radio shows were migrated from the previous storage format to the new editor. The old settings entry was removed.</p></div>',
			$this->notices()
		);
		$this->assertFalse( get_transient( 'radplapag_migration_success_notice' ) );
		$this->assertSame( '', $this->notices() );
	}

	/**
	 * The error notice is printed once, with the message escaped.
	 */
	public function test_error_notice_is_printed_once_and_escaped() {
		set_transient( 'radplapag_migration_error_notice', 'Bad <b>row</b>', 120 );

		$this->assertSame(
			'<div class="notice notice-error is-dismissible"><p><strong>Radio Player Page migration error</strong></p><p>Bad &lt;b&gt;row&lt;/b&gt;</p></div>',
			$this->notices()
		);
		$this->assertFalse( get_transient( 'radplapag_migration_error_notice' ) );
		$this->assertSame( '', $this->notices() );
	}

	/**
	 * An empty error message prints nothing.
	 */
	public function test_empty_error_message_prints_nothing() {
		set_transient( 'radplapag_migration_error_notice', '', 120 );

		$this->assertSame( '', $this->notices() );
	}

	/**
	 * The conflict notice stays while the flag is set and links to a nonced dismiss URL
	 * built on the current URL.
	 */
	public function test_conflict_notice_links_to_nonced_dismiss_url() {
		update_option( 'radplapag_migration_skipped_cpt_conflict', '1' );
		$nonce = wp_create_nonce( 'radplapag_dismiss_migration_conflict' );

		$expected = '<div class="notice notice-warning"><p>Radio Player Page: Legacy settings were found, but there are already published radio stations. Automatic migration was skipped to avoid duplicates. Remove or unpublish extra radio stations if you want to import legacy data, or dismiss this message.</p>'
			. '<p><a href="/wp-admin/index.php?foo=bar&#038;radplapag_dismiss=migration_conflict&#038;_wpnonce=' . $nonce . '">Dismiss This Notice</a></p></div>';

		$this->assertSame( $expected, $this->notices() );
		$this->assertSame( $expected, $this->notices(), 'The conflict notice is not one-shot.' );
	}

	/**
	 * Success, error and conflict print in that order.
	 */
	public function test_notices_print_in_order_success_error_conflict() {
		set_transient( 'radplapag_migration_success_notice', '1', 60 );
		set_transient( 'radplapag_migration_error_notice', 'Oops', 120 );
		update_option( 'radplapag_migration_skipped_cpt_conflict', '1' );

		$html = $this->notices();

		$success = strpos( $html, 'notice-success' );
		$error   = strpos( $html, 'notice-error' );
		$warning = strpos( $html, 'notice-warning' );
		$this->assertNotFalse( $success );
		$this->assertGreaterThan( $success, $error );
		$this->assertGreaterThan( $error, $warning );
	}

	// Dismissing the conflict notice.

	/**
	 * A valid nonce deletes the conflict flag and redirects to the URL without the args.
	 */
	public function test_dismiss_with_valid_nonce_deletes_flag_and_redirects() {
		update_option( 'radplapag_migration_skipped_cpt_conflict', '1' );
		$_SERVER['REQUEST_URI'] = '/wp-admin/index.php?foo=bar&radplapag_dismiss=migration_conflict&_wpnonce=x';

		$location = $this->dismiss(
			array(
				'radplapag_dismiss' => 'migration_conflict',
				'_wpnonce'          => wp_create_nonce( 'radplapag_dismiss_migration_conflict' ),
			)
		);

		$this->assertSame( '/wp-admin/index.php?foo=bar', $location );
		$this->assertFalse( get_option( 'radplapag_migration_skipped_cpt_conflict' ) );
	}

	/**
	 * Another dismiss key with its own valid nonce redirects but keeps the flag.
	 */
	public function test_dismiss_of_another_key_redirects_and_keeps_flag() {
		update_option( 'radplapag_migration_skipped_cpt_conflict', '1' );

		$location = $this->dismiss(
			array(
				'radplapag_dismiss' => 'other',
				'_wpnonce'          => wp_create_nonce( 'radplapag_dismiss_other' ),
			)
		);

		$this->assertSame( '/wp-admin/index.php?foo=bar', $location );
		$this->assertSame( '1', get_option( 'radplapag_migration_skipped_cpt_conflict' ) );
	}

	/**
	 * An invalid nonce neither redirects nor deletes the flag.
	 */
	public function test_dismiss_with_invalid_nonce_does_nothing() {
		update_option( 'radplapag_migration_skipped_cpt_conflict', '1' );

		$location = $this->dismiss(
			array(
				'radplapag_dismiss' => 'migration_conflict',
				'_wpnonce'          => 'invalid',
			)
		);

		$this->assertNull( $location );
		$this->assertSame( '1', get_option( 'radplapag_migration_skipped_cpt_conflict' ) );
	}

	/**
	 * Without the nonce arg, nothing happens.
	 */
	public function test_dismiss_without_nonce_does_nothing() {
		update_option( 'radplapag_migration_skipped_cpt_conflict', '1' );

		$this->assertNull( $this->dismiss( array( 'radplapag_dismiss' => 'migration_conflict' ) ) );
		$this->assertSame( '1', get_option( 'radplapag_migration_skipped_cpt_conflict' ) );
	}

	/**
	 * Without manage_options, a valid nonce does nothing.
	 */
	public function test_dismiss_needs_manage_options() {
		update_option( 'radplapag_migration_skipped_cpt_conflict', '1' );
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );

		$location = $this->dismiss(
			array(
				'radplapag_dismiss' => 'migration_conflict',
				'_wpnonce'          => wp_create_nonce( 'radplapag_dismiss_migration_conflict' ),
			)
		);

		$this->assertNull( $location );
		$this->assertSame( '1', get_option( 'radplapag_migration_skipped_cpt_conflict' ) );
	}

	/**
	 * Off the admin side, a valid nonce does nothing.
	 */
	public function test_dismiss_does_nothing_off_admin() {
		update_option( 'radplapag_migration_skipped_cpt_conflict', '1' );
		$nonce = wp_create_nonce( 'radplapag_dismiss_migration_conflict' );
		set_current_screen( 'front' );

		$location = $this->dismiss(
			array(
				'radplapag_dismiss' => 'migration_conflict',
				'_wpnonce'          => $nonce,
			)
		);

		$this->assertNull( $location );
		$this->assertSame( '1', get_option( 'radplapag_migration_skipped_cpt_conflict' ) );
	}

	// Upgrader hook.

	/**
	 * Options of an upgrader run.
	 *
	 * @return array<string, array{array}>
	 */
	public function ignored_upgrader_options() {
		$self = plugin_basename( RADPLAPAG_PLUGIN_FILE );

		return array(
			'install, not update' => array(
				array(
					'action'  => 'install',
					'type'    => 'plugin',
					'plugins' => array( $self ),
				),
			),
			'theme update'        => array(
				array(
					'action' => 'update',
					'type'   => 'theme',
					'themes' => array( 'twentytwentyfour' ),
				),
			),
			'no action'           => array( array( 'type' => 'plugin' ) ),
			'no plugins'          => array(
				array(
					'action' => 'update',
					'type'   => 'plugin',
				),
			),
			'plugins not array'   => array(
				array(
					'action'  => 'update',
					'type'    => 'plugin',
					'plugins' => $self,
				),
			),
			'another plugin'      => array(
				array(
					'action'  => 'update',
					'type'    => 'plugin',
					'plugins' => array( 'akismet/akismet.php' ),
				),
			),
		);
	}

	/**
	 * Other upgrader runs do not touch the legacy data.
	 *
	 * @dataProvider ignored_upgrader_options
	 *
	 * @param array $options Hook arguments.
	 */
	public function test_upgrader_ignores_other_runs( array $options ) {
		$settings = $this->legacy_settings();

		radplapag_on_upgrader_process_complete( null, $options );

		$this->assert_not_migrated( $settings );
		$this->assertFalse( has_action( 'init', 'radplapag_run_legacy_migration_if_needed' ) );
	}

	/**
	 * Updating this plugin (among others) runs the migration right away when the post
	 * type is registered.
	 */
	public function test_upgrader_runs_migration_for_this_plugin() {
		$this->legacy_settings();

		radplapag_on_upgrader_process_complete(
			null,
			array(
				'action'  => 'update',
				'type'    => 'plugin',
				'plugins' => array( 'akismet/akismet.php', plugin_basename( RADPLAPAG_PLUGIN_FILE ) ),
			)
		);

		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
		$this->assertSame( 1, $this->count_posts( 'radplapag_station' ) );
	}

	/**
	 * Before the post type is registered, the migration is deferred to init at 100.
	 */
	public function test_upgrader_defers_migration_to_init_before_post_type_exists() {
		$settings = $this->legacy_settings();
		$saved    = $GLOBALS['wp_post_types']['radplapag_station'];
		unset( $GLOBALS['wp_post_types']['radplapag_station'] );

		try {
			radplapag_on_upgrader_process_complete(
				null,
				array(
					'action'  => 'update',
					'type'    => 'plugin',
					'plugins' => array( plugin_basename( RADPLAPAG_PLUGIN_FILE ) ),
				)
			);
		} finally {
			$GLOBALS['wp_post_types']['radplapag_station'] = $saved; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Restores the registered post type.
		}

		$this->assert_not_migrated( $settings );
		$this->assertSame( 100, has_action( 'init', 'radplapag_run_legacy_migration_if_needed' ) );
	}
}
