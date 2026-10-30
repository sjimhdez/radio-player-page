<?php
/**
 * Smoke test for the unit suite (no WordPress loaded).
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit;

use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * Proves that plugin files can be loaded and exercised without WordPress.
 */
final class SmokeTest extends TestCase {

	/**
	 * The program config value object loads without WordPress.
	 *
	 * @group no-wordpress
	 */
	public function test_program_config_class_loads_without_wordpress() {
		require_once RADPLAPAG_TESTS_PLUGIN_DIR . '/includes/class-radplapag-program-config.php';

		$this->assertTrue( class_exists( 'Radplapag_Program_Config', false ) );
		$this->assertFalse( function_exists( 'add_action' ), 'WordPress must not be loaded in the unit suite.' );
	}
}
