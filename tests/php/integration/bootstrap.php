<?php
/**
 * Bootstrap for the integration suite: WordPress test library provided by wp-env.
 *
 * Run it through `npm run test:php:integration`, which uses the separate test
 * environment (.wp-env.tests.json) and the `wptests_` table prefix, so neither
 * the development site nor the e2e site is touched.
 *
 * @package radio-player-page
 */

$radplapag_tests_dir = getenv( 'WP_TESTS_DIR' );

if ( ! $radplapag_tests_dir || ! is_readable( $radplapag_tests_dir . '/includes/functions.php' ) ) {
	fwrite( STDERR, "WP_TESTS_DIR is not set. Run `npm run test:php:integration`.\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
	exit( 1 );
}

require_once dirname( __DIR__, 3 ) . '/vendor/yoast/phpunit-polyfills/phpunitpolyfills-autoload.php';
require_once $radplapag_tests_dir . '/includes/functions.php';

/*
 * Admin code (admin/admin.php, meta boxes, save and notice callbacks) is loaded only
 * when is_admin() is true while the plugin loads. To hook every callback of SPEC.md
 * §3.4, the plugin is loaded on an admin screen and the screen is cleared right after:
 * tests start on the public side and set their own screen with set_current_screen().
 * WP_ADMIN is not defined because it would make is_admin() true for the whole run.
 */
tests_add_filter(
	'muplugins_loaded',
	static function () {
		require_once ABSPATH . 'wp-admin/includes/class-wp-screen.php';
		require_once ABSPATH . 'wp-admin/includes/screen.php';

		set_current_screen( 'dashboard' );
		require dirname( __DIR__, 3 ) . '/radio-player-page.php';
		$GLOBALS['current_screen'] = null; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Reset, as WP_UnitTestCase does.
	}
);

require $radplapag_tests_dir . '/includes/bootstrap.php';

require __DIR__ . '/Support/Clock.php';
require __DIR__ . '/Support/Factory.php';
require __DIR__ . '/Support/Snapshot.php';
