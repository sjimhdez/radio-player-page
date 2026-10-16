<?php
/**
 * Bootstrap for the unit suite: plain PHP, no WordPress.
 *
 * Plugin files start with `defined( 'ABSPATH' ) || exit;`, so ABSPATH is defined
 * to a path that is never used. Anything that needs WordPress belongs in
 * tests/php/integration/.
 *
 * @package radio-player-page
 */

define( 'RADPLAPAG_TESTS_PLUGIN_DIR', dirname( __DIR__, 3 ) );

if ( ! defined( 'ABSPATH' ) ) {
	// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- WordPress core constant, stubbed.
	define( 'ABSPATH', sys_get_temp_dir() . '/radplapag-no-wordpress/' );
}

require_once RADPLAPAG_TESTS_PLUGIN_DIR . '/vendor/autoload.php';
