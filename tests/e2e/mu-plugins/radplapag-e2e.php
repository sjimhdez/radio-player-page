<?php
/**
 * Plugin Name: Radio Player Page E2E helpers
 * Description: Test-only switches for the e2e suite, driven by request headers. Mounted by .wp-env.tests.json; never in the zip.
 *
 * - `X-Radplapag-E2e-Rtl: 1` makes the request right-to-left without a language pack (the tests do not go to the internet).
 * - `X-Radplapag-E2e-Robots: 1` adds a directive through the wp_robots filter, so a test can tell whether a page runs it.
 * - `X-Radplapag-E2e-Translate: 1` "translates" the block titles and descriptions of block.json with a prefix, without a language pack.
 * - `X-Radplapag-E2e-Media: 1` lets the server reach the e2e media servers at localhost:8901/8902 ("Test Stream", spike R5).
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

/**
 * Prefixes the block titles and descriptions of the plugin with the translate header.
 *
 * Core translates block.json in PHP with these contexts (block-i18n.json).
 *
 * @param string $translation Translated text.
 * @param string $text        Text to translate.
 * @param string $context     Context.
 * @param string $domain      Text domain.
 * @return string
 */
function radplapag_e2e_translate( string $translation, string $text, string $context, string $domain ): string {
	if ( 'radio-player-page' === $domain && in_array( $context, array( 'block title', 'block description' ), true ) && radplapag_e2e_header_is_on( 'X_RADPLAPAG_E2E_TRANSLATE' ) ) {
		return '[E2E] ' . $translation;
	}
	return $translation;
}
add_filter( 'gettext_with_context', 'radplapag_e2e_translate', 10, 4 );

/**
 * Media ports of tests/e2e/media-server.mjs (with and without CORS).
 *
 * @return int[]
 */
function radplapag_e2e_media_port_list(): array {
	return array( 8901, 8902 );
}

/**
 * Opens the media ports on localhost to the safe HTTP API.
 *
 * The site is http://localhost:8890, so the stream probe sees localhost:8901 as
 * the site's host and never opens its port (ADR 0066 §1); this does it for the
 * e2e only.
 *
 * @param int[]  $ports Allowed ports.
 * @param string $host  Host of the URL.
 * @return int[]
 */
function radplapag_e2e_media_ports( $ports, $host ) {
	if ( 'localhost' === strtolower( (string) $host ) ) {
		return array_merge( (array) $ports, radplapag_e2e_media_port_list() );
	}
	return $ports;
}

/**
 * Marks the media hosts as external on the media ports only: host.docker.internal
 * is a private address (spike R5).
 *
 * @param bool   $external Whether the host is external.
 * @param string $host     Host.
 * @param string $url      Request URL.
 * @return bool
 */
function radplapag_e2e_media_is_external( $external, $host, $url = '' ) {
	$port = (int) wp_parse_url( (string) $url, PHP_URL_PORT );
	if ( in_array( strtolower( (string) $host ), array( 'localhost', 'host.docker.internal' ), true ) && in_array( $port, radplapag_e2e_media_port_list(), true ) ) {
		return true;
	}
	return $external;
}

/**
 * Sends the requests to localhost:8901/8902 to the Mac.
 *
 * The browser of the e2e reaches the media servers at localhost; the containers
 * reach them at host.docker.internal (spike R5). Requests runs this hook after
 * the URL has been validated, and the probe still sees the URL it asked for.
 *
 * @param string $url Request URL, changed in place.
 * @return void
 */
function radplapag_e2e_media_host( &$url ) {
	$url = (string) preg_replace( '#^(https?://)localhost:(' . implode( '|', radplapag_e2e_media_port_list() ) . ')(?=[/?\#]|$)#i', '$1host.docker.internal:$2', $url );
}

// Hooked only with the media header, so the integration suite (same mu-plugins) sees no extra hook.
if ( radplapag_e2e_header_is_on( 'X_RADPLAPAG_E2E_MEDIA' ) ) {
	add_filter( 'http_allowed_safe_ports', 'radplapag_e2e_media_ports', 10, 2 );
	add_filter( 'http_request_host_is_external', 'radplapag_e2e_media_is_external', 10, 3 );
	add_action( 'requests-requests.before_request', 'radplapag_e2e_media_host' );
}
