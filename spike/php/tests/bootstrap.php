<?php
/**
 * Spike bootstrap: WordPress test library provided by wp-env (WP_TESTS_DIR).
 */

require_once dirname( __DIR__ ) . '/vendor/autoload.php';

$radplapag_tests_dir = getenv( 'WP_TESTS_DIR' );
if ( ! $radplapag_tests_dir || ! is_readable( $radplapag_tests_dir . '/includes/functions.php' ) ) {
	fwrite( STDERR, "WP_TESTS_DIR is not set. Run inside wp-env.\n" );
	exit( 1 );
}

require_once $radplapag_tests_dir . '/includes/functions.php';

tests_add_filter(
	'muplugins_loaded',
	static function () {
		require '/var/www/html/wp-content/plugins/radio-player-page/radio-player-page.php';
	}
);

require $radplapag_tests_dir . '/includes/bootstrap.php';
