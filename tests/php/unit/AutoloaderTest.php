<?php
/**
 * Tests for RadioPlayerPage\Autoloader.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit;

use RadioPlayerPage\Autoloader;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * Maps RadioPlayerPage\ classes to includes/src/ with WPCS file names (ADR 0028).
 */
final class AutoloaderTest extends TestCase {

	/**
	 * Classes under the prefix map to lowercase folders and class-<name>.php files.
	 *
	 * @dataProvider data_file_for_prefixed_class
	 *
	 * @param string $class_name Fully qualified class name.
	 * @param string $relative   Expected path, relative to includes/src/.
	 */
	public function test_file_for_prefixed_class( $class_name, $relative ) {
		$this->assertSame(
			RADPLAPAG_TESTS_PLUGIN_DIR . '/includes/src/' . $relative,
			Autoloader::file_for( $class_name )
		);
	}

	/**
	 * Inputs for test_file_for_prefixed_class().
	 *
	 * @return array<string, array{string, string}>
	 */
	public function data_file_for_prefixed_class() {
		return array(
			'top level'               => array( 'RadioPlayerPage\Autoloader', 'class-autoloader.php' ),
			'one namespace segment'   => array( 'RadioPlayerPage\Schedule\Slot_Validator', 'schedule/class-slot-validator.php' ),
			'adapter namespace'       => array( 'RadioPlayerPage\WP\Schedule_Messages', 'wp/class-schedule-messages.php' ),
			'underscore in a segment' => array( 'RadioPlayerPage\Some_Zone\Deep_Name\Value', 'some-zone/deep-name/class-value.php' ),
			'leading backslash'       => array( '\RadioPlayerPage\Schedule\Time', 'schedule/class-time.php' ),
		);
	}

	/**
	 * Classes outside the prefix are not ours.
	 *
	 * @dataProvider data_file_for_foreign_class
	 *
	 * @param string $class_name Fully qualified class name.
	 */
	public function test_file_for_foreign_class_is_null( $class_name ) {
		$this->assertNull( Autoloader::file_for( $class_name ) );
	}

	/**
	 * Inputs for test_file_for_foreign_class_is_null().
	 *
	 * @return array<string, array{string}>
	 */
	public function data_file_for_foreign_class() {
		return array(
			'global class'         => array( 'Radplapag_Program_Config' ),
			'other vendor'         => array( 'Yoast\PHPUnitPolyfills\TestCases\TestCase' ),
			'longer prefix'        => array( 'RadioPlayerPageExtra\Schedule\Time' ),
			'prefix inside a name' => array( 'Other\RadioPlayerPage\Schedule\Time' ),
			'bare prefix'          => array( 'RadioPlayerPage\\' ),
			'empty'                => array( '' ),
		);
	}

	/**
	 * Registering adds the loader once, however many times it is called.
	 */
	public function test_register_is_idempotent() {
		Autoloader::register();
		Autoloader::register();

		$loader = array( Autoloader::class, 'load' );
		$count  = 0;
		foreach ( spl_autoload_functions() as $registered ) {
			if ( $registered === $loader ) {
				++$count;
			}
		}

		$this->assertSame( 1, $count );
	}

	/**
	 * A prefixed class with no file is left to the next loader, without warnings.
	 */
	public function test_missing_class_is_not_loaded() {
		$this->assertFalse( class_exists( 'RadioPlayerPage\Schedule\No_Such_Class' ) );
	}
}
