<?php
/**
 * R1 smoke test: the plugin loads inside the WP test suite.
 */
class SmokeTest extends WP_UnitTestCase {

	public function test_station_and_program_post_types_are_registered() {
		$this->assertTrue( post_type_exists( 'radplapag_station' ) );
		$this->assertTrue( post_type_exists( 'radplapag_program' ) );
	}

	public function test_reports_environment() {
		fwrite( STDERR, sprintf( "\n[env] PHP %s · WP %s · PHPUnit %s\n", PHP_VERSION, get_bloginfo( 'version' ), PHPUnit\Runner\Version::id() ) );
		$this->assertTrue( function_exists( 'radplapag_get_config' ) );
	}
}
