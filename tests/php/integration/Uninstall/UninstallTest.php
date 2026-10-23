<?php
/**
 * Characterization of uninstall.php on a single site (3.4.2).
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Uninstall;

use RadioPlayerPage\Tests\Integration\Support\Factory;
use WP_UnitTestCase;

/**
 * Pins what uninstalling removes (both post types with their meta, the options, the
 * transients and the pending migration meta) and what it leaves behind.
 */
final class UninstallTest extends WP_UnitTestCase {

	const TRANSIENTS = array(
		'radplapag_migrating',
		'radplapag_migration_success_notice',
		'radplapag_migration_error_notice',
	);

	/**
	 * Fixture factory.
	 *
	 * @var Factory
	 */
	private $factory_rpp;

	/**
	 * Creates the fixture factory.
	 */
	public function set_up() {
		parent::set_up();

		$this->factory_rpp = new Factory();
	}

	/**
	 * Published, draft and private stations and programs go, with their meta.
	 */
	public function test_deletes_stations_and_programs_with_their_meta() {
		$ids = array(
			$this->factory_rpp->station( 'Published', array( 'stream_url' => 'https://example.com/a.mp3' ) ),
			$this->factory_rpp->station( 'Draft', array( 'status' => 'draft' ) ),
			$this->factory_rpp->program( 'Morning', array( 'description' => 'Wake up' ) ),
			$this->factory_rpp->program( 'Private', array(), 'private' ),
		);

		self::uninstall();

		foreach ( $ids as $id ) {
			$this->assertNull( get_post( $id ), "Post $id" );
			$this->assertSame( array(), self::meta_rows( $id ), "Meta of post $id" );
		}
	}

	/**
	 * K7 (docs/known-issues.md, fixed in spec 0008): trashed, auto-draft and inherit
	 * posts go too, with their meta.
	 */
	public function test_deletes_trashed_and_auto_draft_posts() {
		$ids = array(
			$this->factory_rpp->station(
				'Trashed',
				array(
					'status'     => 'trash',
					'stream_url' => 'https://example.com/a.mp3',
				)
			),
			$this->factory_rpp->station( 'Auto draft', array( 'status' => 'auto-draft' ) ),
			$this->factory_rpp->station( 'Inherit', array( 'status' => 'inherit' ) ),
			$this->factory_rpp->program( 'Trashed', array( 'description' => 'Text' ), 'trash' ),
			$this->factory_rpp->program( 'Auto draft', array(), 'auto-draft' ),
		);

		self::uninstall();

		foreach ( $ids as $id ) {
			$this->assertNull( get_post( $id ), "Post $id" );
			$this->assertSame( array(), self::meta_rows( $id ), "Meta of post $id" );
		}
	}

	/**
	 * Other post types stay, even with a meta key of the plugin.
	 */
	public function test_does_not_touch_other_posts() {
		$page = $this->factory_rpp->page( 'Player' );
		update_post_meta( $page, 'radplapag_station_stream_url', 'https://example.com/a.mp3' );
		$post = self::factory()->post->create();

		self::uninstall();

		$this->assertNotNull( get_post( $page ) );
		$this->assertNotNull( get_post( $post ) );
		$this->assertSame( 'https://example.com/a.mp3', get_post_meta( $page, 'radplapag_station_stream_url', true ) );
	}

	/**
	 * The two options of the upgrade flow go.
	 */
	public function test_deletes_the_schema_and_conflict_options() {
		update_option( 'radplapag_db_version', '3.3.0' );
		update_option( 'radplapag_migration_skipped_cpt_conflict', '1' );

		self::uninstall();

		$this->assertFalse( get_option( 'radplapag_db_version' ) );
		$this->assertFalse( get_option( 'radplapag_migration_skipped_cpt_conflict' ) );
	}

	/**
	 * C11 (docs/known-issues.md, fixed in spec 0008): the legacy option, the migration
	 * lock, every transient (the legacy one and those of a trashed station included)
	 * and the pending migration meta go too.
	 */
	public function test_deletes_the_legacy_settings_and_the_transients() {
		$station = $this->factory_rpp->station( 'Station' );
		$trashed = $this->factory_rpp->station( 'Trashed', array( 'status' => 'trash' ) );
		$post    = self::factory()->post->create();
		update_option( 'radplapag_settings', array( 'stations' => array() ) );
		update_option( 'radplapag_migrating', time() + 120 );
		foreach ( self::TRANSIENTS as $transient ) {
			set_transient( $transient, '1', 60 );
		}
		foreach ( array( $station, $trashed ) as $id ) {
			set_transient( 'radplapag_station_field_errors_' . $id, 'Error', 45 );
			set_transient( 'radplapag_station_schedule_errors_' . $id, 'Error', 45 );
		}
		update_post_meta( $post, '_radplapag_migration_pending', '1' );

		self::uninstall();

		$this->assertFalse( get_option( 'radplapag_settings' ) );
		$this->assertFalse( get_option( 'radplapag_migrating' ) );
		foreach ( self::TRANSIENTS as $transient ) {
			$this->assertFalse( get_transient( $transient ), $transient );
		}
		foreach ( array( $station, $trashed ) as $id ) {
			$this->assertFalse( get_transient( 'radplapag_station_field_errors_' . $id ), "Station $id" );
			$this->assertFalse( get_transient( 'radplapag_station_schedule_errors_' . $id ), "Station $id" );
		}
		$this->assertNotNull( get_post( $post ) );
		$this->assertNotContains( '_radplapag_migration_pending', self::meta_rows( $post ) );
	}

	/**
	 * Uninstalling flushes the object cache, so no cached copy of the deleted data survives.
	 */
	public function test_flushes_the_object_cache() {
		wp_cache_set( 'probe', 'cached', 'radplapag_uninstall_test' );

		self::uninstall();

		$this->assertFalse( wp_cache_get( 'probe', 'radplapag_uninstall_test' ) );
	}

	/**
	 * Loaded outside an uninstall (no WP_UNINSTALL_PLUGIN), the file exits before doing
	 * anything. Run in a separate PHP process without WordPress: past the guard it would
	 * die on the first WordPress function.
	 */
	public function test_exits_without_wp_uninstall_plugin() {
		$output = array();
		$status = null;
		exec( escapeshellarg( PHP_BINARY ) . ' ' . escapeshellarg( dirname( __DIR__, 4 ) . '/uninstall.php' ) . ' 2>&1', $output, $status ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.system_calls_exec

		$this->assertSame( 0, $status );
		$this->assertSame( array(), $output );
	}

	/**
	 * Deactivating removes nothing: the plugin hooks nothing on deactivation.
	 */
	public function test_nothing_is_hooked_on_deactivation() {
		global $wp_filter;

		$deactivation = array_filter(
			array_keys( $wp_filter ),
			static function ( $hook ) {
				return 0 === strpos( $hook, 'deactivate_' );
			}
		);

		$this->assertSame( array(), array_values( $deactivation ) );
	}

	/**
	 * Runs uninstall.php as WordPress does. The file declares functions, so it is
	 * loaded once per process; later calls run its entry point again.
	 */
	public static function uninstall() {
		if ( function_exists( 'radplapag_uninstall_plugin' ) ) {
			radplapag_uninstall_plugin();
			return;
		}
		if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
			define( 'WP_UNINSTALL_PLUGIN', 'radio-player-page/radio-player-page.php' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- WordPress core constant.
		}
		require dirname( __DIR__, 4 ) . '/uninstall.php';
	}

	/**
	 * Raw postmeta rows of a post, bypassing the meta cache.
	 *
	 * @param int $id Post ID.
	 * @return array
	 */
	public static function meta_rows( $id ) {
		global $wpdb;

		return $wpdb->get_col( $wpdb->prepare( "SELECT meta_key FROM $wpdb->postmeta WHERE post_id = %d", $id ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
	}
}
