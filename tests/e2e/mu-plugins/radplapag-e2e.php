<?php
/**
 * Plugin Name: Radio Player Page E2E helpers
 * Description: Test-only switches for the e2e suite, driven by request headers. Mounted by .wp-env.tests.json; never in the zip.
 *
 * - `X-Radplapag-E2e-Rtl: 1` makes the request right-to-left without a language pack (the tests do not go to the internet).
 * - `X-Radplapag-E2e-Robots: 1` adds a directive through the wp_robots filter, so a test can tell whether a page runs it.
 *
 * @package RadioPlayerPage
 */

defined( 'ABSPATH' ) || exit;

/**
 * Whether the request carries an e2e switch header.
 *
 * @param string $name Header name as in $_SERVER, without the HTTP_ prefix.
 * @return bool
 */
function radplapag_e2e_header_is_on( string $name ): bool {
	return isset( $_SERVER[ 'HTTP_' . $name ] ) && '1' === $_SERVER[ 'HTTP_' . $name ]; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Compared with a literal.
}

/**
 * Switches the request to right-to-left with the RTL header.
 *
 * @return void
 */
function radplapag_e2e_maybe_rtl(): void {
	if ( radplapag_e2e_header_is_on( 'X_RADPLAPAG_E2E_RTL' ) ) {
		$GLOBALS['wp_locale']->text_direction = 'rtl';
	}
}
add_action( 'init', 'radplapag_e2e_maybe_rtl' );

/**
 * Adds a marker directive to wp_robots with the robots header.
 *
 * @param array<string, bool|string> $robots Directives.
 * @return array<string, bool|string>
 */
function radplapag_e2e_robots( array $robots ): array {
	if ( radplapag_e2e_header_is_on( 'X_RADPLAPAG_E2E_ROBOTS' ) ) {
		$robots['radplapag-e2e'] = true;
	}
	return $robots;
}
add_filter( 'wp_robots', 'radplapag_e2e_robots' );
