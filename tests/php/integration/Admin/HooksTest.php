<?php
/**
 * Characterization of the hooked callbacks (SPEC.md §3.4, 3.4.2).
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Admin;

use ReflectionFunction;
use WP_UnitTestCase;

/**
 * Pins every radplapag_* callback in $wp_filter after the plugin loads: hook,
 * priority and number of arguments, with nothing missing and nothing extra. A third
 * party can unhook any of them with remove_action()/remove_filter(), so they are
 * contract. Only the plugin's own callbacks count: not those of tests/ or of anything
 * outside the plugin, such as the e2e mu-plugin the tests environment mounts.
 */
final class HooksTest extends WP_UnitTestCase {

	/**
	 * Hook → callback → [ priority, accepted args ], in SPEC.md §3.4 order.
	 */
	const EXPECTED = array(
		'plugins_loaded'                 => array(
			'radplapag_ensure_schema_version_option' => array( 5, 1 ),
		),
		'init'                           => array(
			'radplapag_register_station_post_type'     => array( 10, 1 ),
			'radplapag_register_program_post_type'     => array( 10, 1 ),
			'radplapag_register_station_meta'          => array( 20, 1 ),
			'radplapag_register_program_meta'          => array( 20, 1 ),
			'radplapag_register_schedule_block'        => array( 10, 1 ),
			'radplapag_register_programs_list_block'   => array( 10, 1 ),
			'radplapag_register_now_playing_block'     => array( 10, 1 ),
			'radplapag_run_legacy_migration_if_needed' => array( 100, 1 ),
		),
		'template_redirect'              => array(
			'radplapag_output_clean_page' => array( 10, 1 ),
		),
		'admin_init'                     => array(
			'radplapag_maybe_clear_migration_conflict_flag' => array( 5, 1 ),
			'radplapag_handle_migration_notice_dismiss' => array( 15, 1 ),
			'radplapag_run_legacy_migration_if_needed'  => array( 20, 1 ),
		),
		'admin_menu'                     => array(
			'radplapag_admin_menu'                   => array( 5, 1 ),
			'radplapag_remove_duplicate_rpp_submenu' => array( 99, 1 ),
		),
		'admin_notices'                  => array(
			'radplapag_migration_admin_notices'        => array( 10, 1 ),
			'radplapag_station_schedule_errors_notice' => array( 10, 1 ),
		),
		'admin_enqueue_scripts'          => array(
			'radplapag_admin_scripts'        => array( 10, 1 ),
			'radplapag_station_edit_scripts' => array( 10, 1 ),
			'radplapag_program_edit_scripts' => array( 10, 1 ),
		),
		'add_meta_boxes'                 => array(
			'radplapag_add_station_meta_boxes' => array( 10, 1 ),
			'radplapag_add_program_meta_boxes' => array( 10, 1 ),
		),
		'save_post_radplapag_station'    => array(
			'radplapag_save_station_meta' => array( 10, 1 ),
		),
		'save_post_radplapag_program'    => array(
			'radplapag_save_program_meta' => array( 10, 1 ),
		),
		'enqueue_block_editor_assets'    => array(
			'radplapag_enqueue_schedule_block_editor_assets' => array( 10, 1 ),
			'radplapag_enqueue_programs_list_block_editor_assets' => array( 10, 1 ),
			'radplapag_enqueue_now_playing_block_editor_assets' => array( 10, 1 ),
		),
		'upgrader_process_complete'      => array(
			'radplapag_on_upgrader_process_complete' => array( 10, 2 ),
		),
		'map_meta_cap'                   => array(
			'radplapag_map_cpt_meta_cap' => array( 10, 4 ),
		),
		'user_has_cap'                   => array(
			'radplapag_grant_station_caps_to_manage_options' => array( 10, 4 ),
			'radplapag_grant_program_caps_to_manage_options' => array( 10, 4 ),
		),
		'use_block_editor_for_post_type' => array(
			'radplapag_station_use_classic_editor' => array( 10, 2 ),
		),
		'redirect_post_location'         => array(
			'radplapag_station_redirect_without_message' => array( 10, 2 ),
		),
		'wp_ajax_radplapag_probe_stream' => array(
			'radplapag_ajax_probe_stream' => array( 10, 1 ),
		),
	);

	/**
	 * Whether a callback is a radplapag_* function defined in the plugin's own files
	 * (outside tests/).
	 *
	 * @param mixed $callback Callback as stored in $wp_filter.
	 * @return bool
	 */
	private static function is_plugin_callback( $callback ) {
		if ( ! is_string( $callback ) || 0 !== strpos( $callback, 'radplapag_' ) || ! function_exists( $callback ) ) {
			return false;
		}
		$dir  = dirname( __DIR__, 4 ) . '/';
		$file = (string) ( new ReflectionFunction( $callback ) )->getFileName();

		return 0 === strpos( $file, $dir ) && 0 !== strpos( $file, $dir . 'tests/' );
	}

	/**
	 * Every plugin callback in $wp_filter, as hook → callback → [ priority, args ].
	 *
	 * @return array<string, array<string, array{0: int, 1: int}>>
	 */
	private static function hooked() {
		$hooked = array();
		foreach ( $GLOBALS['wp_filter'] as $hook => $wp_hook ) {
			foreach ( $wp_hook->callbacks as $priority => $callbacks ) {
				foreach ( $callbacks as $callback ) {
					if ( self::is_plugin_callback( $callback['function'] ) ) {
						$hooked[ $hook ][ $callback['function'] ] = array( $priority, $callback['accepted_args'] );
					}
				}
			}
		}

		return $hooked;
	}

	/**
	 * Sorts hooks and callbacks so the comparison does not depend on load order.
	 *
	 * @param array $table Hook → callback → [ priority, args ].
	 * @return array
	 */
	private static function sorted( array $table ) {
		ksort( $table );
		foreach ( $table as &$callbacks ) {
			ksort( $callbacks );
		}

		return $table;
	}

	/**
	 * The hooked callbacks are exactly those of the table: same hooks, priorities and
	 * number of arguments, none missing and none extra.
	 */
	public function test_hooked_callbacks_match_the_contract_exactly() {
		$this->assertSame( self::sorted( self::EXPECTED ), self::sorted( self::hooked() ) );
	}

	/**
	 * No callback is hooked twice (at two priorities) on the same hook.
	 */
	public function test_no_callback_is_hooked_twice_on_a_hook() {
		foreach ( self::EXPECTED as $hook => $callbacks ) {
			foreach ( array_keys( $callbacks ) as $callback ) {
				$count = 0;
				foreach ( $GLOBALS['wp_filter'][ $hook ]->callbacks as $by_priority ) {
					$count += isset( $by_priority[ $callback ] ) ? 1 : 0;
				}
				$this->assertSame( 1, $count, "$hook → $callback" );
			}
		}
	}

	/**
	 * Every callback is a named function a third party can unhook.
	 */
	public function test_every_callback_can_be_unhooked_by_name() {
		foreach ( self::EXPECTED as $hook => $callbacks ) {
			foreach ( $callbacks as $callback => $hooked ) {
				$this->assertTrue( function_exists( $callback ), $callback );
				$this->assertTrue( remove_filter( $hook, $callback, $hooked[0] ), "$hook → $callback" );
				$this->assertFalse( has_filter( $hook, $callback ), "$hook → $callback" );
			}
		}
	}

	/**
	 * Same-priority callbacks run in the order the plugin files load: station, program,
	 * upgrade, blocks, then admin/admin.php. So the station schedule errors notice comes
	 * before the migration notices and radplapag_admin_scripts runs last.
	 */
	public function test_same_priority_callbacks_run_in_registration_order() {
		$order = array(
			array( 'init', 10, array( 'radplapag_register_station_post_type', 'radplapag_register_program_post_type', 'radplapag_register_schedule_block', 'radplapag_register_programs_list_block', 'radplapag_register_now_playing_block' ) ),
			array( 'init', 20, array( 'radplapag_register_station_meta', 'radplapag_register_program_meta' ) ),
			array( 'admin_notices', 10, array( 'radplapag_station_schedule_errors_notice', 'radplapag_migration_admin_notices' ) ),
			array( 'admin_enqueue_scripts', 10, array( 'radplapag_station_edit_scripts', 'radplapag_program_edit_scripts', 'radplapag_admin_scripts' ) ),
			array( 'add_meta_boxes', 10, array( 'radplapag_add_station_meta_boxes', 'radplapag_add_program_meta_boxes' ) ),
		);

		foreach ( $order as list( $hook, $priority, $expected ) ) {
			$names = array_values(
				array_filter(
					array_keys( $GLOBALS['wp_filter'][ $hook ]->callbacks[ $priority ] ),
					array( self::class, 'is_plugin_callback' )
				)
			);
			$this->assertSame( $expected, $names, "$hook ($priority)" );
		}
	}
}
