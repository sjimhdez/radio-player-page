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

tests_add_filter(
	'muplugins_loaded',
	static function () {
		require dirname( __DIR__, 3 ) . '/radio-player-page.php';
	}
);

require $radplapag_tests_dir . '/includes/bootstrap.php';
