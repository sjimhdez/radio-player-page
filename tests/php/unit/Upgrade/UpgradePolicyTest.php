<?php
/**
 * Tests for RadioPlayerPage\Upgrade\Upgrade_Policy.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Upgrade;

use RadioPlayerPage\Upgrade\Upgrade_Policy;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * The decisions of the upgrade callbacks of 3.4.2 (radplapag-upgrade.php), as pure
 * predicates over the values the callbacks read.
 */
final class UpgradePolicyTest extends TestCase {

	/**
	 * Basename of the plugin in the upgrader tests.
	 */
	const BASENAME = 'radio-player-page/radio-player-page.php';

	/**
	 * An option with a non-empty stations list has migratable stations.
	 *
	 * @dataProvider data_migratable
	 *
	 * @param mixed $raw Value of radplapag_settings.
	 */
	public function test_has_migratable_stations( $raw ) {
		$this->assertTrue( Upgrade_Policy::has_migratable_stations( $raw ) );
	}

	/**
	 * Inputs for test_has_migratable_stations().
	 *
	 * @return array<string, array{mixed}>
	 */
	public function data_migratable() {
		return array(
			'one station'            => array( array( 'stations' => array( array( 'title' => 'One' ) ) ) ),
			'no array station (K32)' => array( array( 'stations' => array( 'x' ) ) ),
		);
	}

	/**
	 * Anything else has no migratable stations.
	 *
	 * @dataProvider data_not_migratable
	 *
	 * @param mixed $raw Value of radplapag_settings.
	 */
	public function test_has_no_migratable_stations( $raw ) {
		$this->assertFalse( Upgrade_Policy::has_migratable_stations( $raw ) );
	}

	/**
	 * Inputs for test_has_no_migratable_stations().
	 *
	 * @return array<string, array{mixed}>
	 */
	public function data_not_migratable() {
		return array(
			'missing option'      => array( null ),
			'false'               => array( false ),
			'string'              => array( 'stations' ),
			'stations not a list' => array( array( 'stations' => 'nope' ) ),
			'stations null'       => array( array( 'stations' => null ) ),
			'empty stations'      => array( array( 'stations' => array() ) ),
		);
	}

	/**
	 * The flat 1.0.x–1.1.x option has no stations key, so nothing is migrated.
	 *
	 * @see docs/known-issues.md K4
	 */
	public function test_currently_flat_1x_settings_have_no_migratable_stations() {
		$this->assertFalse(
			Upgrade_Policy::has_migratable_stations(
				array(
					'stream_url'  => 'https://stream.example.test/live.mp3',
					'player_page' => '12',
				)
			)
		);
	}

	/**
	 * The stored schema version is current only when it is the same string.
	 */
	public function test_is_current() {
		$this->assertTrue( Upgrade_Policy::is_current( '330', '330' ) );
		$this->assertFalse( Upgrade_Policy::is_current( 330, '330' ) );
		$this->assertFalse( Upgrade_Policy::is_current( '320', '330' ) );
		$this->assertFalse( Upgrade_Policy::is_current( false, '330' ) );
		$this->assertFalse( Upgrade_Policy::is_current( null, '330' ) );
	}

	/**
	 * The published count comes from the publish property of wp_count_posts().
	 */
	public function test_published_count() {
		$this->assertSame( 3, Upgrade_Policy::published_count( (object) array( 'publish' => '3' ) ) );
		$this->assertSame( 0, Upgrade_Policy::published_count( (object) array( 'publish' => 0 ) ) );
	}

	/**
	 * Without a publish property, the count is 0.
	 *
	 * @dataProvider data_no_count
	 *
	 * @param mixed $counts Value of wp_count_posts().
	 */
	public function test_published_count_without_counts( $counts ) {
		$this->assertSame( 0, Upgrade_Policy::published_count( $counts ) );
	}

	/**
	 * Inputs for test_published_count_without_counts().
	 *
	 * @return array<string, array{mixed}>
	 */
	public function data_no_count() {
		return array(
			'false'        => array( false ),
			'null'         => array( null ),
			'no publish'   => array( (object) array( 'draft' => 2 ) ),
			'publish null' => array( (object) array( 'publish' => null ) ),
			'array'        => array( array( 'publish' => 2 ) ),
		);
	}

	/**
	 * The conflict flag is cleared when it is set and no station is published.
	 */
	public function test_should_clear_conflict() {
		$this->assertTrue( Upgrade_Policy::should_clear_conflict( '1', 0 ) );
		$this->assertFalse( Upgrade_Policy::should_clear_conflict( '1', 1 ) );
		$this->assertFalse( Upgrade_Policy::should_clear_conflict( false, 0 ) );
		$this->assertFalse( Upgrade_Policy::should_clear_conflict( '', 0 ) );
		$this->assertFalse( Upgrade_Policy::should_clear_conflict( '0', 0 ) );
	}

	/**
	 * A plugin update that lists this plugin is this plugin's update.
	 */
	public function test_is_this_plugin_update() {
		$this->assertTrue(
			Upgrade_Policy::is_this_plugin_update(
				array(
					'action'  => 'update',
					'type'    => 'plugin',
					'plugins' => array( 'other/other.php', self::BASENAME ),
				),
				self::BASENAME
			)
		);
	}

	/**
	 * Any other upgrader run is not.
	 *
	 * @dataProvider data_not_this_plugin_update
	 *
	 * @param mixed $options Arguments of upgrader_process_complete.
	 */
	public function test_is_not_this_plugin_update( $options ) {
		$this->assertFalse( Upgrade_Policy::is_this_plugin_update( $options, self::BASENAME ) );
	}

	/**
	 * Inputs for test_is_not_this_plugin_update().
	 *
	 * @return array<string, array{mixed}>
	 */
	public function data_not_this_plugin_update() {
		$update = array(
			'action'  => 'update',
			'type'    => 'plugin',
			'plugins' => array( self::BASENAME ),
		);
		return array(
			'not an array'   => array( null ),
			'install'        => array( array( 'action' => 'install' ) + $update ),
			'theme'          => array( array( 'type' => 'theme' ) + $update ),
			'no action'      => array( array_diff_key( $update, array( 'action' => true ) ) ),
			'no type'        => array( array_diff_key( $update, array( 'type' => true ) ) ),
			'no plugins'     => array( array_diff_key( $update, array( 'plugins' => true ) ) ),
			'empty plugins'  => array( array( 'plugins' => array() ) + $update ),
			'plugins string' => array( array( 'plugins' => self::BASENAME ) + $update ),
			'other plugins'  => array( array( 'plugins' => array( 'other/other.php' ) ) + $update ),
			'loose match'    => array( array( 'plugins' => array( 0 ) ) + $update ),
		);
	}
}
