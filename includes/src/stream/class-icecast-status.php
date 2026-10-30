<?php
/**
 * The mounts of an Icecast server.
 *
 * @package radio-player-page
 * @since 3.6.0
 */

namespace RadioPlayerPage\Stream;

defined( 'ABSPATH' ) || exit;

/**
 * Reads Icecast's status-json.xsl (ADR 0064 §8).
 *
 * `icestats.source` is an object with one source and a list with several. The
 * listenurl carries the hostname the server was set up with, which may not be
 * public, so each URL is rebuilt on the scheme, host and port that answered.
 * A mount without server_type has no source connected (Icecast 2.5.0) and is
 * left out.
 *
 * @since 3.6.0
 */
final class Icecast_Status {

	/**
	 * Mounts with a source, in order.
	 *
	 * @since 3.6.0
	 *
	 * @param string $json     Body of status-json.xsl.
	 * @param string $base_url URL that answered.
	 * @return list<array{url: string, name: string, type: string}>
	 */
	public static function mounts( string $json, string $base_url ): array {
		$origin = Url_Variants::origin( $base_url );
		$data   = json_decode( $json, true );
		if ( '' === $origin || ! is_array( $data ) || ! isset( $data['icestats']['source'] ) || ! is_array( $data['icestats']['source'] ) ) {
			return array();
		}
		$sources = $data['icestats']['source'];
		if ( isset( $sources['listenurl'] ) ) {
			$sources = array( $sources );
		}
		$mounts = array();
		foreach ( $sources as $source ) {
			if ( ! is_array( $source ) || ! is_string( $source['listenurl'] ?? null ) || ! is_string( $source['server_type'] ?? null ) ) {
				continue;
			}
			$parts = Url_Variants::parse( $source['listenurl'] );
			if ( null === $parts ) {
				continue;
			}
			$mounts[] = array(
				'url'  => $origin . $parts['path'] . ( '' === $parts['query'] ? '' : '?' . $parts['query'] ),
				'name' => is_string( $source['server_name'] ?? null ) ? trim( $source['server_name'] ) : '',
				'type' => $source['server_type'],
			);
		}
		return $mounts;
	}
}
