<?php
/**
 * Characterization of uninstall.php on a multisite network (3.4.2).
 *
 * Runs only with `npm run test:php:integration:ms`.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Uninstall;

use RadioPlayerPage\Tests\Integration\Support\Factory;
use WP_UnitTestCase;

/**
 * Pins that uninstalling cleans every site of the network.
 *
 * @group ms-required
 */
final class UninstallMultisiteTest extends WP_UnitTestCase {

	/**
	 * Skips the test outside a multisite run.
	 */
	public function set_up() {
		parent::set_up();

		$this->skipWithoutMultisite();
	}

	/**
	 * The main site and every subsite are cleaned.
	 */
	public function test_deletes_stations_programs_and_options_on_every_site() {
		$sites = array( get_current_blog_id(), self::factory()->blog->create(), self::factory()->blog->create() );
		$posts = array();
		foreach ( $sites as $site ) {
			switch_to_blog( $site );
			$factory        = new Factory();
			$posts[ $site ] = array(
				$factory->station( 'Station', array( 'stream_url' => 'https://example.com/a.mp3' ) ),
				$factory->program( 'Program', array( 'description' => 'Text' ) ),
			);
			update_option( 'radplapag_db_version', '3.3.0' );
			update_option( 'radplapag_migration_skipped_cpt_conflict', '1' );
			restore_current_blog();
		}

		UninstallTest::uninstall();

		foreach ( $sites as $site ) {
			switch_to_blog( $site );
			foreach ( $posts[ $site ] as $id ) {
				$this->assertNull( get_post( $id ), "Post $id of site $site" );
				$this->assertSame( array(), UninstallTest::meta_rows( $id ), "Meta of post $id of site $site" );
			}
			$this->assertFalse( get_option( 'radplapag_db_version' ), "Site $site" );
			$this->assertFalse( get_option( 'radplapag_migration_skipped_cpt_conflict' ), "Site $site" );
			restore_current_blog();
		}
	}

	/**
	 * K7 (docs/known-issues.md, fixed in spec 0008): trashed, auto-draft and inherit
	 * posts of a subsite go too, with their meta.
	 */
	public function test_deletes_trashed_and_auto_draft_posts_on_a_subsite() {
		$site = self::factory()->blog->create();
		switch_to_blog( $site );
		$factory = new Factory();
		$ids     = array(
			$factory->station(
				'Trashed',
				array(
					'status'     => 'trash',
					'stream_url' => 'https://example.com/a.mp3',
				)
			),
			$factory->station( 'Auto draft', array( 'status' => 'auto-draft' ) ),
			$factory->station( 'Inherit', array( 'status' => 'inherit' ) ),
			$factory->program( 'Trashed', array( 'description' => 'Text' ), 'trash' ),
			$factory->program( 'Auto draft', array(), 'auto-draft' ),
		);
		restore_current_blog();

		UninstallTest::uninstall();

		switch_to_blog( $site );
		foreach ( $ids as $id ) {
			$this->assertNull( get_post( $id ), "Post $id" );
			$this->assertSame( array(), UninstallTest::meta_rows( $id ), "Meta of post $id" );
		}
		restore_current_blog();
	}

	/**
	 * Other post types of a subsite stay.
	 */
	public function test_does_not_touch_other_posts_on_a_subsite() {
		$site = self::factory()->blog->create();
		switch_to_blog( $site );
		$post = self::factory()->post->create();
		restore_current_blog();

		UninstallTest::uninstall();

		switch_to_blog( $site );
		$this->assertNotNull( get_post( $post ) );
		restore_current_blog();
	}

	/**
	 * C11 (docs/known-issues.md, fixed in spec 0008): the legacy option, the migration
	 * lock, every transient (the legacy one and those of a trashed station included)
	 * and the pending migration meta go on every site.
	 */
	public function test_deletes_the_legacy_settings_and_the_transients_on_a_subsite() {
		$site = self::factory()->blog->create();
		switch_to_blog( $site );
		$station = ( new Factory() )->station( 'Trashed', array( 'status' => 'trash' ) );
		$post    = self::factory()->post->create();
		update_option( 'radplapag_settings', array( 'stations' => array() ) );
		update_option( 'radplapag_migrating', time() + 120 );
		foreach ( UninstallTest::TRANSIENTS as $transient ) {
			set_transient( $transient, '1', 60 );
		}
		set_transient( 'radplapag_station_field_errors_' . $station, 'Error', 45 );
		set_transient( 'radplapag_station_schedule_errors_' . $station, 'Error', 45 );
		update_post_meta( $post, '_radplapag_migration_pending', '1' );
		restore_current_blog();

		UninstallTest::uninstall();

		switch_to_blog( $site );
		$this->assertFalse( get_option( 'radplapag_settings' ) );
		$this->assertFalse( get_option( 'radplapag_migrating' ) );
		foreach ( UninstallTest::TRANSIENTS as $transient ) {
			$this->assertFalse( get_transient( $transient ), $transient );
		}
		$this->assertFalse( get_transient( 'radplapag_station_field_errors_' . $station ) );
		$this->assertFalse( get_transient( 'radplapag_station_schedule_errors_' . $station ) );
		$this->assertNotContains( '_radplapag_migration_pending', UninstallTest::meta_rows( $post ) );
		restore_current_blog();
	}
}
