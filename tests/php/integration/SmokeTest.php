<?php
/**
 * Smoke test for the integration suite (WordPress test library on wp-env).
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration;

use WP_UnitTestCase;

/**
 * Proves that the plugin boots inside the WordPress test suite.
 */
final class SmokeTest extends WP_UnitTestCase {

	/**
	 * Both custom post types are registered on init.
	 */
	public function test_station_and_program_post_types_are_registered() {
		$this->assertTrue( post_type_exists( 'radplapag_station' ) );
		$this->assertTrue( post_type_exists( 'radplapag_program' ) );
	}

	/**
	 * The suite never runs on the site's own tables (spike 0001, R1).
	 */
	public function test_runs_on_isolated_tables() {
		global $wpdb;

		$this->assertSame( 'wptests_', $wpdb->prefix );
	}
}
