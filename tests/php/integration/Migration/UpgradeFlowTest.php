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
		\RadioPlayerPage\WP\Migration_Lock::release();
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
	 * Value of the radplapag_migrating option row, read from the table (not the cache).
	 *
	 * @return string|null Null without the row.
	 */
	private function stored_lock() {
		global $wpdb;

		return $wpdb->get_var( $wpdb->prepare( "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s", 'radplapag_migrating' ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Reads the stored row, not the cache.
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
	 * Off the admin side, the migration runs (ADR 0041).
	 *
	 * @see docs/known-issues.md K33
	 */
	public function test_migration_runs_off_admin() {
		$this->legacy_settings();
		set_current_screen( 'front' );

		radplapag_run_legacy_migration_if_needed();

		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
		$this->assertSame( 1, $this->count_posts( 'radplapag_station' ) );
		$this->assertSame( $this->admin, get_current_user_id() );
	}

	/**
	 * Logged out, the migration runs and the visitor stays logged out, with the kses
	 * filters of user 0 (ADR 0041).
	 *
	 * @see docs/known-issues.md K33
	 */
	public function test_migration_runs_logged_out() {
		$this->legacy_settings();
		wp_set_current_user( 0 );

		radplapag_run_legacy_migration_if_needed();

		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
		$this->assertSame( 1, $this->count_posts( 'radplapag_station' ) );
		$this->assertSame( 0, get_current_user_id() );
		$this->assertSame( 10, has_filter( 'title_save_pre', 'wp_filter_kses' ) );
	}

	/**
	 * Without manage_options (an editor), the migration runs as the first administrator
	 * and the editor is restored (ADR 0041).
	 *
	 * @see docs/known-issues.md K33
	 */
	public function test_migration_runs_without_manage_options() {
		$this->legacy_settings();
		$editor = self::factory()->user->create( array( 'role' => 'editor' ) );
		wp_set_current_user( $editor );

		radplapag_run_legacy_migration_if_needed();

		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
		$this->assertSame( 1, $this->count_posts( 'radplapag_station' ) );
		$this->assertSame( $editor, get_current_user_id() );
	}

	/**
	 * The migration is hooked on init at 100, after the post types and the meta exist,
	 * and stays on admin_init at 20 (ADR 0041).
	 */
	public function test_migration_is_hooked_on_init_at_100() {
		$this->assertSame( 100, has_action( 'init', 'radplapag_run_legacy_migration_if_needed' ) );
		$this->assertSame( 20, has_action( 'admin_init', 'radplapag_run_legacy_migration_if_needed' ) );
	}

	/**
	 * On the front, with the conflict flag set, the pass returns without counting the
	 * stations: clearing the flag is left to the admin (ADR 0041).
	 */
	public function test_front_pass_with_conflict_flag_does_not_count_stations() {
		$settings = $this->legacy_settings();
		update_option( 'radplapag_migration_skipped_cpt_conflict', '1' );
		set_current_screen( 'front' );
		$counts = 0;
		add_filter(
			'wp_count_posts',
			static function ( $counts_by_status ) use ( &$counts ) {
				++$counts;
				return $counts_by_status;
			}
		);

		radplapag_run_legacy_migration_if_needed();

		$this->assertSame( 0, $counts );
		$this->assertSame( '1', get_option( 'radplapag_migration_skipped_cpt_conflict' ) );
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
		$until    = (string) ( time() + 60 );
		update_option( 'radplapag_migrating', $until, false );

		radplapag_run_legacy_migration_if_needed();

		$this->assert_not_migrated( $settings );
		$this->assertSame( $until, $this->stored_lock() );
	}

	/**
	 * An expired lock (a request that died mid-migration) is taken and the migration runs.
	 */
	public function test_expired_lock_is_taken() {
		$this->legacy_settings();
		update_option( 'radplapag_migrating', (string) ( time() - 1 ), false );

		radplapag_run_legacy_migration_if_needed();

		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
		$this->assertNull( $this->stored_lock() );
	}

	/**
	 * If another request takes an expired lock between the read and the take, the
	 * conditional update changes no row and this request does not run.
	 */
	public function test_lock_changed_between_read_and_take_is_not_taken() {
		$settings = $this->legacy_settings();
		$until    = (string) ( time() + 60 );
		update_option( 'radplapag_migrating', $until, false );
		$stale = static function () {
			return (string) ( time() - 10 );
		};
		add_filter( 'option_radplapag_migrating', $stale );

		radplapag_run_legacy_migration_if_needed();

		remove_filter( 'option_radplapag_migrating', $stale );
		$this->assert_not_migrated( $settings );
		$this->assertSame( $until, $this->stored_lock() );
	}

	/**
	 * A lock in the table is not taken even when the object cache says the option is
	 * missing (add_option() would overwrite it; ADR 0038).
	 */
	public function test_lock_in_the_table_is_not_taken_when_the_cache_says_it_is_missing() {
		global $wpdb;
		$settings = $this->legacy_settings();
		$until    = (string) ( time() + 60 );
		$wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Bypasses the cache on purpose.
			$wpdb->options,
			array(
				'option_name'  => 'radplapag_migrating',
				'option_value' => $until,
				'autoload'     => 'off',
			)
		);
		$notoptions                        = wp_cache_get( 'notoptions', 'options' );
		$notoptions                        = is_array( $notoptions ) ? $notoptions : array();
		$notoptions['radplapag_migrating'] = true;
		wp_cache_set( 'notoptions', $notoptions, 'options' );

		radplapag_run_legacy_migration_if_needed();

		$this->assert_not_migrated( $settings );
		$this->assertSame( $until, $this->stored_lock() );
	}

	/**
	 * The transient lock of earlier versions is ignored.
	 */
	public function test_legacy_lock_transient_is_ignored() {
		$this->legacy_settings();
		set_transient( 'radplapag_migrating', '1', 120 );

		radplapag_run_legacy_migration_if_needed();

		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
	}

	/**
	 * The lock is taken before counting the published stations: while it is held, a
	 * published station raises no conflict.
	 */
	public function test_lock_is_taken_before_counting_published_stations() {
		$this->legacy_settings();
		$this->factory_rpp->station( 'Existing' );
		update_option( 'radplapag_migrating', (string) ( time() + 60 ), false );

		radplapag_run_legacy_migration_if_needed();

		$this->assertFalse( get_option( 'radplapag_migration_skipped_cpt_conflict' ) );
	}

	/**
	 * A conflict releases the lock it took.
	 */
	public function test_conflict_releases_the_lock() {
		$this->legacy_settings();
		$this->factory_rpp->station( 'Existing' );
		$released = 0;
		$count    = static function () use ( &$released ) {
			++$released;
		};
		add_action( 'delete_option_radplapag_migrating', $count );

		radplapag_run_legacy_migration_if_needed();

		remove_action( 'delete_option_radplapag_migrating', $count );
		$this->assertSame( '1', get_option( 'radplapag_migration_skipped_cpt_conflict' ) );
		$this->assertSame( 1, $released );
		$this->assertNull( $this->stored_lock() );
	}

	/**
	 * The lock adapter: one take wins until it is released, and a later hold blocks it.
	 */
	public function test_migration_lock_takes_holds_and_releases() {
		$now = time();

		$this->assertTrue( \RadioPlayerPage\WP\Migration_Lock::acquire( $now, 120 ) );
		$this->assertFalse( \RadioPlayerPage\WP\Migration_Lock::acquire( $now, 120 ) );
		$this->assertSame( (string) ( $now + 120 ), $this->stored_lock() );

		\RadioPlayerPage\WP\Migration_Lock::hold_until( $now + 900 );
		$this->assertSame( (string) ( $now + 900 ), $this->stored_lock() );
		$this->assertFalse( \RadioPlayerPage\WP\Migration_Lock::acquire( $now + 899, 120 ) );
		$this->assertTrue( \RadioPlayerPage\WP\Migration_Lock::acquire( $now + 900, 120 ) );

		\RadioPlayerPage\WP\Migration_Lock::release();
		$this->assertNull( $this->stored_lock() );
		$this->assertTrue( \RadioPlayerPage\WP\Migration_Lock::acquire( $now, 120 ) );
	}

	/**
	 * The lock adapter renews only the lock it holds: a renewal to the same time keeps
	 * it, and once another request has taken it the renewal fails and changes nothing.
	 */
	public function test_migration_lock_renews_only_while_held() {
		global $wpdb;

		$this->assertTrue( \RadioPlayerPage\WP\Migration_Lock::acquire( 1000, 120 ) );
		$this->assertTrue( \RadioPlayerPage\WP\Migration_Lock::renew( 1060, 120 ) );
		$this->assertSame( '1180', $this->stored_lock() );
		$this->assertTrue( \RadioPlayerPage\WP\Migration_Lock::renew( 1060, 120 ) );
		$this->assertSame( '1180', $this->stored_lock() );

		$wpdb->update( $wpdb->options, array( 'option_value' => '5000' ), array( 'option_name' => 'radplapag_migrating' ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Another request takes the lock, bypassing the cache.

		$this->assertFalse( \RadioPlayerPage\WP\Migration_Lock::renew( 1100, 120 ) );
		$this->assertSame( '5000', $this->stored_lock() );
	}

	/**
	 * A request that passed the checks while another one was migrating takes the lock
	 * after that one finished: it checks again, releases the lock and does nothing (no
	 * error, no false conflict).
	 */
	public function test_migration_checks_again_after_taking_the_lock() {
		global $wpdb;
		$this->legacy_settings();
		$done   = false;
		$finish = function ( $query ) use ( &$done, $wpdb ) {
			if ( ! $done && false !== strpos( $query, 'INSERT IGNORE' ) ) {
				$done = true;
				$wpdb->replace( // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- The other request finishes, bypassing the cache.
					$wpdb->options,
					array(
						'option_name'  => 'radplapag_db_version',
						'option_value' => '330',
						'autoload'     => 'on',
					)
				);
				$wpdb->delete( $wpdb->options, array( 'option_name' => 'radplapag_settings' ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Same.
				$this->factory_rpp->station( 'Migrated' );
			}
			return $query;
		};
		add_filter( 'query', $finish );

		radplapag_run_legacy_migration_if_needed();

		remove_filter( 'query', $finish );
		$this->assertTrue( $done, 'Precondition: the other request finished.' );
		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
		$this->assertNull( $this->stored_lock() );
		$this->assertFalse( get_option( 'radplapag_migration_skipped_cpt_conflict' ) );
		$this->assertFalse( get_transient( 'radplapag_migration_success_notice' ) );
		$this->assertFalse( get_transient( 'radplapag_migration_error_notice' ) );
		$this->assertSame( 1, $this->count_posts( 'radplapag_station' ) );
	}

	/**
	 * If the lock expires mid-migration and another request takes it, the next renewal
	 * fails: this request deletes what it created and stops without touching the other
	 * request's lock or recording any outcome.
	 */
	public function test_lost_lock_stops_the_migration() {
		global $wpdb;
		$settings = $this->legacy_settings();
		$other    = (string) ( time() + 500 );
		$take     = static function ( $post_id, $post ) use ( $wpdb, $other ) {
			if ( 'radplapag_program' === $post->post_type ) {
				$wpdb->update( $wpdb->options, array( 'option_value' => $other ), array( 'option_name' => 'radplapag_migrating' ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Another request takes the expired lock, bypassing the cache.
			}
		};
		add_action( 'wp_insert_post', $take, 10, 2 );

		radplapag_run_legacy_migration_if_needed();

		remove_action( 'wp_insert_post', $take, 10 );
		$this->assert_not_migrated( $settings );
		$this->assertSame( 0, $this->count_posts( 'radplapag_station' ) );
		$this->assertSame( $other, $this->stored_lock() );
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
		$this->assertSame(
			array(
				'stations' => 1,
				'dropped'  => array(),
			),
			get_transient( 'radplapag_migration_success_notice' )
		);
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
	 * Success: content created, option removed, version recorded, lock released and the
	 * summary as the success notice. The current user is restored after running as the author.
	 */
	public function test_successful_migration_records_outcome_and_releases_lock() {
		$this->legacy_settings();

		radplapag_run_legacy_migration_if_needed();

		$this->assertFalse( get_option( 'radplapag_settings' ) );
		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
		$this->assertSame( 1, $this->count_posts( 'radplapag_station' ) );
		$this->assertSame( 1, $this->count_posts( 'radplapag_program' ) );
		$this->assertNull( $this->stored_lock() );
		$this->assertFalse( get_transient( 'radplapag_migration_error_notice' ) );
		$this->assertSame(
			array(
				'stations' => 1,
				'dropped'  => array(),
			),
			get_transient( 'radplapag_migration_success_notice' )
		);
		$this->assertSame( $this->admin, get_current_user_id() );
	}

	/**
	 * The success notice does not expire: it waits for an administrator to open the
	 * admin, since the migration may run on the front (ADR 0041).
	 */
	public function test_success_notice_does_not_expire() {
		$this->legacy_settings();

		radplapag_run_legacy_migration_if_needed();

		$this->assertNotFalse( get_transient( 'radplapag_migration_success_notice' ) );
		if ( ! wp_using_ext_object_cache() ) {
			$this->assertFalse( get_option( '_transient_timeout_radplapag_migration_success_notice' ) );
		}
	}

	/**
	 * The lock is taken for 120 s while the migration runs, so a request that dies
	 * mid-migration does not block it for good. It is an option without autoload and
	 * is deleted on success.
	 */
	public function test_migration_lock_expires_in_120_seconds() {
		global $wpdb;
		$this->legacy_settings();
		$rows    = array();
		$before  = time();
		$capture = static function ( $post_id, $post ) use ( &$rows, $wpdb ) {
			if ( 'radplapag_program' === $post->post_type ) {
				$rows[] = $wpdb->get_row( $wpdb->prepare( "SELECT option_value, autoload FROM {$wpdb->options} WHERE option_name = %s", 'radplapag_migrating' ), ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Reads the stored row, not the cache.
			}
		};
		add_action( 'wp_insert_post', $capture, 10, 2 );

		radplapag_run_legacy_migration_if_needed();

		remove_action( 'wp_insert_post', $capture, 10 );
		$this->assertCount( 1, $rows );
		$this->assertSame( 'off', $rows[0]['autoload'] );
		$this->assertGreaterThanOrEqual( $before + 120, (int) $rows[0]['option_value'] );
		$this->assertLessThanOrEqual( time() + 120, (int) $rows[0]['option_value'] );
		$this->assertNull( $this->stored_lock() );
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
	 * no version, holds the lock for 900 s and leaves the error for the notice for as
	 * long (ADR 0037).
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
		$this->assertSame( 900, (int) $this->stored_lock() - time() );
		$this->assertFalse( get_transient( 'radplapag_migration_success_notice' ) );
		$this->assertSame( 'Content, title, and excerpt are empty.', get_transient( 'radplapag_migration_error_notice' ) );
		$this->assertSame( 900, $this->transient_ttl( 'radplapag_migration_error_notice' ) );
		$this->assertSame( $this->admin, get_current_user_id() );
	}

	/**
	 * After a failure, the migration is not tried again until the wait expires (no loop
	 * on a deterministic failure); then the next request migrates.
	 */
	public function test_failed_migration_is_not_retried_until_the_wait_expires() {
		$this->legacy_settings();
		$fail = static function () {
			return true;
		};
		add_filter( 'wp_insert_post_empty_content', $fail );
		radplapag_run_legacy_migration_if_needed();
		remove_filter( 'wp_insert_post_empty_content', $fail );

		radplapag_run_legacy_migration_if_needed();

		$this->assertFalse( get_option( 'radplapag_db_version' ) );
		$this->assertSame( 0, $this->count_posts( 'radplapag_station' ) );

		update_option( 'radplapag_migrating', (string) ( time() - 1 ), false );
		radplapag_run_legacy_migration_if_needed();

		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
		$this->assertSame( 1, $this->count_posts( 'radplapag_station' ) );
	}

	/**
	 * While the lock is held after a failure, a visitor's front pass reads it and writes
	 * nothing: no INSERT reaches the database.
	 *
	 * @see docs/known-issues.md K86
	 */
	public function test_front_pass_while_the_lock_is_held_after_a_failure_inserts_nothing() {
		$this->legacy_settings();
		$fail = static function () {
			return true;
		};
		add_filter( 'wp_insert_post_empty_content', $fail );
		radplapag_run_legacy_migration_if_needed();
		remove_filter( 'wp_insert_post_empty_content', $fail );
		$until = $this->stored_lock();
		set_current_screen( 'front' );
		wp_set_current_user( 0 );
		$inserts = array();
		$record  = static function ( $query ) use ( &$inserts ) {
			if ( 1 === preg_match( '/^\s*INSERT/i', $query ) ) {
				$inserts[] = $query;
			}
			return $query;
		};
		add_filter( 'query', $record );

		radplapag_run_legacy_migration_if_needed();

		remove_filter( 'query', $record );
		$this->assertSame( array(), $inserts );
		$this->assertSame( $until, $this->stored_lock() );
		$this->assertFalse( get_option( 'radplapag_db_version' ) );
	}

	/**
	 * Runs the migration and cuts it as a fatal error or max_execution_time would: the
	 * hook throws and nothing after it runs, so there is no rollback and the lock is
	 * not released. Then the lock expires (its time is moved to the past) and the
	 * original user is back.
	 *
	 * @param string   $hook          Hook that cuts the migration.
	 * @param int      $accepted_args Arguments of the hook.
	 * @param callable $when          Receives the hook arguments; true cuts the migration.
	 */
	private function interrupt_migration( $hook, $accepted_args, callable $when ) {
		$cut = static function ( ...$args ) use ( $when ) {
			if ( $when( ...$args ) ) {
				throw new RuntimeException( 'Migration interrupted.' );
			}
			return $args[0];
		};
		add_filter( $hook, $cut, 10, $accepted_args );

		$interrupted = false;
		try {
			radplapag_run_legacy_migration_if_needed();
		} catch ( RuntimeException $e ) {
			$interrupted = 'Migration interrupted.' === $e->getMessage();
		}

		remove_filter( $hook, $cut, 10 );
		wp_set_current_user( $this->admin );
		$this->assertTrue( $interrupted, 'Precondition: the migration is interrupted.' );
		$this->assertNotNull( $this->stored_lock(), 'Precondition: the lock is left behind.' );
		update_option( 'radplapag_migrating', (string) ( time() - 1 ), false );
	}

	/**
	 * A migration cut after creating the programs and before any station leaves them
	 * marked as pending; once the lock expires, the retry deletes them before creating
	 * them again, so nothing is duplicated.
	 *
	 * @see docs/known-issues.md K84
	 */
	public function test_interrupted_migration_is_retried_without_duplicates() {
		$this->legacy_settings();
		$this->interrupt_migration(
			'wp_insert_post_empty_content',
			2,
			static function ( $maybe_empty, $postarr ) {
				return 'radplapag_station' === $postarr['post_type'];
			}
		);
		$this->assertSame( 1, $this->count_posts( 'radplapag_program' ), 'Precondition: the program was created.' );
		$this->assertSame( 0, $this->count_posts( 'radplapag_station' ), 'Precondition: no station was created.' );

		radplapag_run_legacy_migration_if_needed();

		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
		$this->assertFalse( get_option( 'radplapag_settings' ) );
		$this->assertSame( 1, $this->count_posts( 'radplapag_station' ) );
		$this->assertSame(
			array( 'Morning' ),
			wp_list_pluck(
				get_posts(
					array(
						'post_type'   => 'radplapag_program',
						'numberposts' => -1,
					)
				),
				'post_title'
			)
		);
	}

	/**
	 * A migration cut after publishing a station leaves it marked as pending; once the
	 * lock expires, the retry deletes it and its programs before counting the published
	 * stations, so there is no conflict and the migration completes.
	 *
	 * @see docs/known-issues.md K84
	 */
	public function test_interrupted_migration_with_a_station_is_purged_and_migrated() {
		$this->legacy_settings();
		$this->interrupt_migration(
			'added_post_meta',
			3,
			static function ( $meta_id, $post_id, $meta_key ) {
				return 'radplapag_station_stream_url' === $meta_key;
			}
		);
		$this->assertSame( 1, $this->count_posts( 'radplapag_station' ), 'Precondition: the station was published.' );

		radplapag_run_legacy_migration_if_needed();

		$this->assertFalse( get_option( 'radplapag_settings' ) );
		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
		$this->assertFalse( get_option( 'radplapag_migration_skipped_cpt_conflict' ) );
		$this->assertSame( 1, get_transient( 'radplapag_migration_success_notice' )['stations'] );
		$this->assertSame( 1, $this->count_posts( 'radplapag_station' ) );
		$this->assertSame( 1, $this->count_posts( 'radplapag_program' ) );
		$station = get_posts( array( 'post_type' => 'radplapag_station' ) )[0];
		$this->assertSame( 'https://stream.example.test/one.mp3', get_post_meta( $station->ID, 'radplapag_station_stream_url', true ) );
	}

	/**
	 * The posts left pending by a cut migration are deleted in any status (trash and
	 * auto-draft included) before migrating; posts without the meta are kept.
	 */
	public function test_pending_posts_in_any_status_are_purged_before_migrating() {
		$this->legacy_settings();
		$pending = array();
		$posts   = array(
			array( 'radplapag_program', 'trash' ),
			array( 'radplapag_program', 'auto-draft' ),
			array( 'radplapag_station', 'draft' ),
			array( 'radplapag_station', 'publish' ),
		);
		foreach ( $posts as list( $type, $status ) ) {
			$pending[] = self::factory()->post->create(
				array(
					'post_type'   => $type,
					'post_status' => $status,
					'meta_input'  => array( '_radplapag_migration_pending' => '1' ),
				)
			);
		}
		$kept = self::factory()->post->create(
			array(
				'post_type'   => 'radplapag_program',
				'post_status' => 'draft',
				'post_title'  => 'Kept',
			)
		);

		radplapag_run_legacy_migration_if_needed();

		foreach ( $pending as $post_id ) {
			$this->assertNull( get_post( $post_id ) );
		}
		$this->assertNotNull( get_post( $kept ) );
		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
		$this->assertFalse( get_option( 'radplapag_migration_skipped_cpt_conflict' ) );
	}

	/**
	 * A successful migration removes the pending meta from every post it created.
	 */
	public function test_successful_migration_leaves_no_pending_meta() {
		$this->legacy_settings();

		radplapag_run_legacy_migration_if_needed();

		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
		$this->assertSame(
			array(),
			get_posts(
				array(
					'post_type'   => array( 'radplapag_station', 'radplapag_program' ),
					'post_status' => 'any',
					'numberposts' => -1,
					'fields'      => 'ids',
					'meta_key'    => '_radplapag_migration_pending', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- Test query.
				)
			)
		);
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
	 * only warned). The migration keeps Monday's slot, drops Tuesday's, logs it and
	 * migrates the station.
	 *
	 * @see docs/known-issues.md K30
	 */
	public function test_cross_day_overlap_from_3_2_drops_the_later_slot() {
		$settings                                       = $this->legacy_settings();
		$settings['stations'][0]['programs'][]          = array(
			'id'      => 'prog_early0001',
			'name'    => 'Early',
			'logo_id' => 0,
		);
		$settings['stations'][0]['schedule']['monday']  = array( $this->slot( 'prog_morning01', '23:00', '02:00' ) );
		$settings['stations'][0]['schedule']['tuesday'] = array( $this->slot( 'prog_early0001', '01:00', '03:00' ) );

		$log = $this->migration_log( $settings['stations'] );

		$this->assertSame(
			array( 'Radio Player Page migration: dropping schedule slot "Early" on tuesday 01:00-03:00 of station "One"; it does not validate with the earlier slots.' ),
			$log
		);
		$this->assertFalse( get_option( 'radplapag_settings' ) );
		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
		$this->assertSame( 2, $this->count_posts( 'radplapag_program' ) );
		$this->assertFalse( get_transient( 'radplapag_migration_error_notice' ) );
		$station  = get_posts( array( 'post_type' => 'radplapag_station' ) )[0];
		$schedule = json_decode( (string) get_post_meta( $station->ID, 'radplapag_station_schedule', true ), true );
		$this->assertSame( array( 'monday' ), array_keys( $schedule ) );
		$this->assertSame( array( '23:00', '02:00' ), array( $schedule['monday'][0]['start'], $schedule['monday'][0]['end'] ) );
		$this->assertStringContainsString( '<li>One: Tuesday 01:00–03:00, &quot;Early&quot;</li>', $this->notices() );
	}

	/**
	 * The migrator returns the summary of the migration: the stations and the dropped
	 * slots, with their station, day, times and program.
	 *
	 * @see docs/known-issues.md K30
	 */
	public function test_migrator_returns_the_summary() {
		$programs = array(
			array(
				'id'   => 'prog_known001',
				'name' => 'Known',
			),
		);
		update_option(
			'radplapag_settings',
			array(
				'stations' => array(
					$this->legacy_station( 'One', $programs, array( 'friday' => array( $this->slot( 'prog_known001', '7:00', '25:00' ) ) ) ),
					$this->legacy_station( 'Two', $programs, array( 'monday' => array( $this->slot( 'prog_known001' ) ) ) ),
				),
			)
		);
		require_once RADPLAPAG_TESTS_PLUGIN_DIR . '/includes/migration/class-radplapag-migrator-settings-to-cpt.php';

		$this->assertSame(
			array(
				'stations' => 2,
				'dropped'  => array(
					array(
						'station' => 'One',
						'day'     => 'friday',
						'start'   => '7:00',
						'end'     => '25:00',
						'program' => 'Known',
					),
				),
			),
			\Radplapag_Migrator_Settings_To_Cpt::run( self::factory()->user->create( array( 'role' => 'administrator' ) ) )
		);
	}

	/**
	 * Dismissing the conflict notice marks the flag as dismissed, and later admin
	 * requests (the redirect itself) neither raise it again nor print the notice.
	 *
	 * @see docs/known-issues.md K29
	 */
	public function test_dismissed_conflict_notice_stays_dismissed() {
		$this->legacy_settings();
		$this->factory_rpp->station( 'Existing' );
		radplapag_run_legacy_migration_if_needed();
		$this->dismiss(
			array(
				'radplapag_dismiss' => 'migration_conflict',
				'_wpnonce'          => wp_create_nonce( 'radplapag_dismiss_migration_conflict' ),
			)
		);
		$this->assertSame( 'dismissed', get_option( 'radplapag_migration_skipped_cpt_conflict' ) );

		radplapag_maybe_clear_migration_conflict_flag();
		radplapag_run_legacy_migration_if_needed();

		$this->assertSame( 'dismissed', get_option( 'radplapag_migration_skipped_cpt_conflict' ) );
		$this->assertSame( '', $this->notices() );
	}

	/**
	 * A dismissed conflict is cleared once no station is published, and the migration runs.
	 *
	 * @see docs/known-issues.md K29
	 */
	public function test_dismissed_conflict_is_cleared_and_migration_runs_without_published_stations() {
		$this->legacy_settings();
		update_option( 'radplapag_migration_skipped_cpt_conflict', 'dismissed' );

		radplapag_run_legacy_migration_if_needed();

		$this->assertFalse( get_option( 'radplapag_migration_skipped_cpt_conflict' ) );
		$this->assertFalse( get_option( 'radplapag_settings' ) );
		$this->assertSame( 1, get_transient( 'radplapag_migration_success_notice' )['stations'] );
	}

	/**
	 * Denies unfiltered_html to the given user and grants it to everyone else.
	 *
	 * @param int $denied User without unfiltered_html.
	 */
	private function deny_unfiltered_html_to( $denied ) {
		add_filter(
			'map_meta_cap',
			static function ( $caps, $cap, $user_id ) use ( $denied ) {
				if ( 'unfiltered_html' !== $cap ) {
					return $caps;
				}
				return (int) $user_id === (int) $denied ? array( 'do_not_allow' ) : array( 'exist' );
			},
			10,
			3
		);
	}

	/**
	 * The migration switches to the first administrator; if that user lacks
	 * unfiltered_html (a site administrator in a network, or with
	 * DISALLOW_UNFILTERED_HTML), the titles are still written without kses.
	 *
	 * @see docs/known-issues.md K21
	 */
	public function test_migration_without_unfiltered_html_keeps_ampersands() {
		$this->deny_unfiltered_html_to( radplapag_migration_resolve_author_user_id() );
		wp_set_current_user( $this->admin );
		$settings                                       = $this->legacy_settings();
		$settings['stations'][0]['station_title']       = 'Rock & Roll';
		$settings['stations'][0]['programs'][0]['name'] = 'Drum & Bass';
		update_option( 'radplapag_settings', $settings );

		radplapag_run_legacy_migration_if_needed();

		$this->assertSame( 'Rock & Roll', get_posts( array( 'post_type' => 'radplapag_station' ) )[0]->post_title );
		$this->assertSame( 'Drum & Bass', get_posts( array( 'post_type' => 'radplapag_program' ) )[0]->post_title );
	}

	/**
	 * After the migration, the kses filters are those of the user who triggered it, also
	 * when that user is the first administrator (wp_set_current_user() then does nothing).
	 *
	 * @see docs/known-issues.md K21
	 */
	public function test_kses_filters_of_the_previous_user_are_restored() {
		$first = radplapag_migration_resolve_author_user_id();
		$this->deny_unfiltered_html_to( $first );
		wp_set_current_user( $first );
		kses_init();
		$this->legacy_settings();

		radplapag_run_legacy_migration_if_needed();

		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
		$this->assertSame( $first, get_current_user_id() );
		$this->assertSame( 10, has_filter( 'title_save_pre', 'wp_filter_kses' ) );

		$migrated = get_posts(
			array(
				'post_type'   => array( 'radplapag_station', 'radplapag_program' ),
				'post_status' => 'any',
				'fields'      => 'ids',
			)
		);
		foreach ( $migrated as $id ) {
			wp_delete_post( $id, true );
		}
		delete_option( 'radplapag_db_version' );
		wp_set_current_user( $this->admin );
		kses_init();
		$this->legacy_settings();

		radplapag_run_legacy_migration_if_needed();

		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
		$this->assertSame( $this->admin, get_current_user_id() );
		$this->assertFalse( has_filter( 'title_save_pre', 'wp_filter_kses' ) );
	}

	/**
	 * When the migration throws (here from another plugin's save_post), the exception
	 * leaves the function and the visitor and its kses filters are restored.
	 *
	 * @see docs/known-issues.md K87
	 */
	public function test_user_and_kses_are_restored_when_the_migration_throws() {
		$this->legacy_settings();
		wp_set_current_user( 0 );
		kses_init();
		add_action(
			'save_post_radplapag_program',
			static function () {
				throw new \RuntimeException( 'save_post failed' );
			}
		);

		$thrown = null;
		try {
			radplapag_run_legacy_migration_if_needed();
		} catch ( \RuntimeException $e ) {
			$thrown = $e;
		}

		$this->assertInstanceOf( \RuntimeException::class, $thrown );
		$this->assertSame( 'save_post failed', $thrown->getMessage() );
		$this->assertSame( 0, get_current_user_id() );
		$this->assertSame( 10, has_filter( 'title_save_pre', 'wp_filter_kses' ) );
	}

	/**
	 * The writer slashes the legacy values it passes to wp_insert_post() and
	 * update_post_meta(), which unslash them: backslashes are kept.
	 *
	 * @see docs/known-issues.md K31
	 */
	public function test_migration_keeps_backslashes() {
		$settings                                       = $this->legacy_settings();
		$settings['stations'][0]['station_title']       = 'AC\\DC';
		$settings['stations'][0]['programs'][0]['name'] = '\\o/';
		$settings['stations'][0]['programs'][0]['description'] = 'C:\\x';
		update_option( 'radplapag_settings', $settings );

		radplapag_run_legacy_migration_if_needed();

		$program = get_posts( array( 'post_type' => 'radplapag_program' ) )[0];
		$this->assertSame( 'AC\\DC', get_posts( array( 'post_type' => 'radplapag_station' ) )[0]->post_title );
		$this->assertSame( '\\o/', $program->post_title );
		$this->assertSame( 'C:\\x', get_post_meta( $program->ID, 'radplapag_program_description', true ) );
	}

	/**
	 * A legacy option whose `stations` holds no array migrates nothing: the option is
	 * deleted and the version recorded (ADR 0010), and the notice says no station was
	 * found.
	 *
	 * @see docs/known-issues.md K32
	 */
	public function test_stations_without_any_station_report_none_migrated() {
		update_option( 'radplapag_settings', array( 'stations' => array( 'x' ) ) );

		radplapag_run_legacy_migration_if_needed();

		$this->assertSame( 0, $this->count_posts( 'radplapag_station' ) );
		$this->assertFalse( get_option( 'radplapag_settings' ) );
		$this->assertSame( '330', get_option( 'radplapag_db_version' ) );
		$this->assertSame(
			array(
				'stations' => 0,
				'dropped'  => array(),
			),
			get_transient( 'radplapag_migration_success_notice' )
		);
		$this->assertSame(
			'<div class="notice notice-success is-dismissible"><p>Radio Player Page: No radio station was found to migrate; the old settings entry was removed.</p></div>',
			$this->notices()
		);
	}

	/**
	 * After an update (an automatic one runs from cron, off the admin), the first front
	 * request of a visitor migrates on init and the station page serves the player in
	 * that same request; the visitor stays logged out (ADR 0041).
	 *
	 * @see docs/known-issues.md K33
	 */
	public function test_station_page_is_served_on_the_first_front_request() {
		$settings = $this->legacy_settings();
		wp_set_current_user( 0 );
		set_current_screen( 'front' );

		radplapag_ensure_schema_version_option();
		radplapag_run_legacy_migration_if_needed();
		$this->go_to( get_permalink( $settings['stations'][0]['player_page'] ) );

		$this->assertTrue( is_page() );
		$station = radplapag_get_station_for_current_page();
		$this->assertIsArray( $station );
		$this->assertSame( 'One', $station['station_title'] );
		$this->assertFalse( get_option( 'radplapag_settings' ) );
		$this->assertSame( 0, get_current_user_id() );
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
	 * Each station logs its skipped slots and then its dropped ones; a dropped slot does
	 * not stop the migration, so the next station logs its own.
	 *
	 * @see docs/known-issues.md K30
	 */
	public function test_skipped_and_dropped_slots_are_logged_station_by_station() {
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
			array(
				'Radio Player Page migration: skipping schedule slot with unknown program id "prog_gone0001".',
				'Radio Player Page migration: dropping schedule slot "Known" on monday abc-08:00 of station "One"; it does not validate with the earlier slots.',
				'Radio Player Page migration: skipping schedule slot with unknown program id "prog_gone0002".',
			),
			$log
		);
		$this->assertSame( 2, $this->count_posts( 'radplapag_station' ) );
		$this->assertFalse( get_transient( 'radplapag_migration_error_notice' ) );
	}

	/**
	 * The schedule translation keeps only program, start and end: the legacy formats never
	 * had is_rerun, so a migrated slot is never a rerun.
	 *
	 * @see docs/adr/0039-legacy-slots-have-no-is-rerun.md
	 */
	public function test_migrated_slot_is_never_a_rerun() {
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

	// Order of the writes and of the rollback.

	/**
	 * Stores the legacy stations, runs the migration and returns its writes in order:
	 * created posts, their radplapag_ meta, deleted posts and radplapag_ options added,
	 * updated or deleted. Transients and the radplapag_migrating lock are left out, as
	 * the lock was a transient before ADR 0037. Posts are labelled by type and title.
	 *
	 * @param array $stations Legacy stations.
	 * @return string[]
	 */
	private function migration_writes( array $stations ) {
		update_option( 'radplapag_settings', array( 'stations' => $stations ) );
		$writes = array();
		$labels = array();

		add_action(
			'wp_insert_post',
			static function ( $post_id, $post ) use ( &$writes, &$labels ) {
				$labels[ $post_id ] = $post->post_type . ' ' . $post->post_title;
				$writes[]           = 'insert ' . $labels[ $post_id ];
			},
			10,
			2
		);
		add_action(
			'added_post_meta',
			static function ( $meta_id, $post_id, $meta_key ) use ( &$writes, &$labels ) {
				if ( 0 === strpos( $meta_key, 'radplapag_' ) ) {
					$writes[] = 'meta ' . $labels[ $post_id ] . ' ' . $meta_key;
				}
			},
			10,
			3
		);
		add_action(
			'deleted_post',
			static function ( $post_id ) use ( &$writes, &$labels ) {
				$writes[] = 'delete ' . $labels[ $post_id ];
			}
		);
		foreach ( array( 'added_option', 'updated_option', 'deleted_option' ) as $hook ) {
			add_action(
				$hook,
				static function ( $option ) use ( &$writes, $hook ) {
					if ( 0 === strpos( $option, 'radplapag_' ) && 'radplapag_migrating' !== $option ) {
						$writes[] = $hook . ' ' . $option;
					}
				}
			);
		}

		radplapag_run_legacy_migration_if_needed();

		return $writes;
	}

	/**
	 * Legacy stations One (programs A and B) and Two (program B again, same data).
	 *
	 * @return array
	 */
	private function two_programs_two_stations() {
		$program_a = array(
			'id'   => 'prog_aaaaaaaa',
			'name' => 'A',
		);
		$program_b = array(
			'id'   => 'prog_bbbbbbbb',
			'name' => 'B',
		);

		return array(
			$this->legacy_station(
				'One',
				array( $program_a, $program_b ),
				array( 'monday' => array( $this->slot( 'prog_aaaaaaaa' ) ) )
			),
			$this->legacy_station(
				'Two',
				array( $program_b ),
				array( 'monday' => array( $this->slot( 'prog_bbbbbbbb' ) ) )
			),
		);
	}

	/**
	 * Every program (in order of first appearance) is created with its meta before the
	 * stations (in legacy order); then the legacy option is deleted and the version added.
	 */
	public function test_migration_writes_programs_then_stations_then_options() {
		$station_meta = static function ( $label ) {
			return array_map(
				static function ( $key ) use ( $label ) {
					return 'meta radplapag_station ' . $label . ' radplapag_station_' . $key;
				},
				array( 'stream_url', 'player_page', 'background_id', 'logo_id', 'theme_color', 'visualizer', 'schedule' )
			);
		};
		$program_meta = static function ( $label ) {
			return array_map(
				static function ( $key ) use ( $label ) {
					return 'meta radplapag_program ' . $label . ' radplapag_program_' . $key;
				},
				array( 'description', 'extended_description', 'logo_id' )
			);
		};

		$writes = $this->migration_writes( $this->two_programs_two_stations() );

		$this->assertSame(
			array_merge(
				array( 'insert radplapag_program A' ),
				$program_meta( 'A' ),
				array( 'insert radplapag_program B' ),
				$program_meta( 'B' ),
				array( 'insert radplapag_station One' ),
				$station_meta( 'One' ),
				array( 'insert radplapag_station Two' ),
				$station_meta( 'Two' ),
				array( 'deleted_option radplapag_settings', 'added_option radplapag_db_version' )
			),
			$writes
		);
	}

	/**
	 * When the second station cannot be created, the posts already created are deleted
	 * newest first and no option is touched.
	 */
	public function test_failed_migration_rolls_back_newest_first_without_touching_options() {
		add_filter(
			'wp_insert_post_empty_content',
			static function ( $maybe_empty, $postarr ) {
				return 'Two' === $postarr['post_title'] ? true : $maybe_empty;
			},
			10,
			2
		);

		$writes = $this->migration_writes( $this->two_programs_two_stations() );

		$this->assertSame(
			array(
				'insert radplapag_program A',
				'insert radplapag_program B',
				'insert radplapag_station One',
				'delete radplapag_station One',
				'delete radplapag_program B',
				'delete radplapag_program A',
			),
			array_values(
				array_filter(
					$writes,
					static function ( $write ) {
						return 0 !== strpos( $write, 'meta ' );
					}
				)
			)
		);
		$this->assertSame( 'Content, title, and excerpt are empty.', get_transient( 'radplapag_migration_error_notice' ) );
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
	 * The summary prints the number of stations and, below, the dropped slots with their
	 * station, translated day, times and program, all escaped.
	 */
	public function test_success_notice_lists_the_dropped_slots() {
		set_transient(
			'radplapag_migration_success_notice',
			array(
				'stations' => 2,
				'dropped'  => array(
					array(
						'station' => 'One <b>FM</b>',
						'day'     => 'tuesday',
						'start'   => '01:00',
						'end'     => '03:00',
						'program' => 'Early',
					),
					array(
						'station' => 'Two',
						'day'     => 'sunday',
						'start'   => '7:00',
						'end'     => '25:00',
						'program' => 'Late & "Loud"',
					),
				),
			),
			60
		);

		$this->assertSame(
			'<div class="notice notice-success is-dismissible"><p>Radio Player Page: 2 radio stations and their radio shows were migrated from the previous storage format to the new editor. The old settings entry was removed.</p>'
			. '<p>These schedule slots were dropped because they overlap an earlier slot or are not valid. Add them again in their radio station if you need them:</p>'
			. '<ul><li>One &lt;b&gt;FM&lt;/b&gt;: Tuesday 01:00–03:00, &quot;Early&quot;</li><li>Two: Sunday 7:00–25:00, &quot;Late &amp; &quot;Loud&quot;&quot;</li></ul></div>',
			$this->notices()
		);
		$this->assertFalse( get_transient( 'radplapag_migration_success_notice' ) );
	}

	/**
	 * With one station and no dropped slot, the summary prints the singular and no list.
	 */
	public function test_success_notice_of_one_station_without_dropped_slots() {
		set_transient(
			'radplapag_migration_success_notice',
			array(
				'stations' => 1,
				'dropped'  => array(),
			),
			60
		);

		$this->assertSame(
			'<div class="notice notice-success is-dismissible"><p>Radio Player Page: 1 radio station and its radio shows were migrated from the previous storage format to the new editor. The old settings entry was removed.</p></div>',
			$this->notices()
		);
	}

	/**
	 * With a single dropped slot, its sentence is singular.
	 */
	public function test_success_notice_with_one_dropped_slot() {
		set_transient(
			'radplapag_migration_success_notice',
			array(
				'stations' => 1,
				'dropped'  => array(
					array(
						'station' => 'One',
						'day'     => 'monday',
						'start'   => '07:00',
						'end'     => '09:00',
						'program' => 'Morning',
					),
				),
			),
			60
		);

		$this->assertStringContainsString(
			'<p>This schedule slot was dropped because it overlaps an earlier slot or is not valid. Add it again in its radio station if you need it:</p><ul><li>One: Monday 07:00–09:00, &quot;Morning&quot;</li></ul>',
			$this->notices()
		);
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
	 * The conflict notice is dismissible, stays while the flag is '1' and links to a
	 * nonced dismiss URL built on the current URL.
	 */
	public function test_conflict_notice_links_to_nonced_dismiss_url() {
		update_option( 'radplapag_migration_skipped_cpt_conflict', '1' );
		$nonce = wp_create_nonce( 'radplapag_dismiss_migration_conflict' );

		$expected = '<div class="notice notice-warning is-dismissible"><p>Radio Player Page: Legacy settings were found, but there are already published radio stations. Automatic migration was skipped to avoid duplicates. Remove or unpublish extra radio stations if you want to import legacy data, or dismiss this message.</p>'
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
	 * A valid nonce marks the conflict flag as dismissed and redirects to the URL without
	 * the args.
	 */
	public function test_dismiss_with_valid_nonce_marks_flag_dismissed_and_redirects() {
		update_option( 'radplapag_migration_skipped_cpt_conflict', '1' );
		$_SERVER['REQUEST_URI'] = '/wp-admin/index.php?foo=bar&radplapag_dismiss=migration_conflict&_wpnonce=x';

		$location = $this->dismiss(
			array(
				'radplapag_dismiss' => 'migration_conflict',
				'_wpnonce'          => wp_create_nonce( 'radplapag_dismiss_migration_conflict' ),
			)
		);

		$this->assertSame( '/wp-admin/index.php?foo=bar', $location );
		$this->assertSame( 'dismissed', get_option( 'radplapag_migration_skipped_cpt_conflict' ) );
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
	 * Other upgrader runs do not touch the legacy data. Whether they hook init is not
	 * checked: the migration is always hooked there (ADR 0041).
	 *
	 * @dataProvider ignored_upgrader_options
	 *
	 * @param array $options Hook arguments.
	 */
	public function test_upgrader_ignores_other_runs( array $options ) {
		$settings = $this->legacy_settings();

		radplapag_on_upgrader_process_complete( null, $options );

		$this->assert_not_migrated( $settings );
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
