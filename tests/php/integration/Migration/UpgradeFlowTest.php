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
