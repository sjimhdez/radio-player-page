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
 * Pins what uninstalling removes (both post types with their meta, two options) and
 * what it leaves behind.
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
	 * K7 (docs/known-issues.md): `post_status => 'any'` leaves out the statuses
	 * excluded from search, so trashed and auto-draft posts survive with their meta.
	 */
	public function test_currently_keeps_trashed_and_auto_draft_posts() {
		$ids = array(
			$this->factory_rpp->station(
				'Trashed',
				array(
					'status'     => 'trash',
					'stream_url' => 'https://example.com/a.mp3',
				)
			),
			$this->factory_rpp->station( 'Auto draft', array( 'status' => 'auto-draft' ) ),
			$this->factory_rpp->program( 'Trashed', array( 'description' => 'Text' ), 'trash' ),
			$this->factory_rpp->program( 'Auto draft', array(), 'auto-draft' ),
		);

		self::uninstall();

		foreach ( $ids as $id ) {
			$this->assertNotNull( get_post( $id ), "Post $id" );
		}
		$this->assertSame( 'https://example.com/a.mp3', get_post_meta( $ids[0], 'radplapag_station_stream_url', true ) );
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
	 * C11 (docs/known-issues.md): the legacy option and the transients survive.
	 */
	public function test_currently_keeps_the_legacy_settings_and_the_transients() {
		$station = $this->factory_rpp->station( 'Station' );
		update_option( 'radplapag_settings', array( 'stations' => array() ) );
		foreach ( self::TRANSIENTS as $transient ) {
			set_transient( $transient, '1', 60 );
		}
		set_transient( 'radplapag_station_field_errors_' . $station, 'Error', 45 );
		set_transient( 'radplapag_station_schedule_errors_' . $station, 'Error', 45 );

		self::uninstall();

		$this->assertSame( array( 'stations' => array() ), get_option( 'radplapag_settings' ) );
		foreach ( self::TRANSIENTS as $transient ) {
			$this->assertSame( '1', get_transient( $transient ), $transient );
		}
		$this->assertSame( 'Error', get_transient( 'radplapag_station_field_errors_' . $station ) );
		$this->assertSame( 'Error', get_transient( 'radplapag_station_schedule_errors_' . $station ) );
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
