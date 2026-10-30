<?php
/**
 * The streams a playlist proposes.
 *
 * @package radio-player-page
 * @since 3.6.0
 */

namespace RadioPlayerPage\Stream;

defined( 'ABSPATH' ) || exit;

/**
 * Reads .pls, .m3u and .xspf playlists (ADR 0064 §8; spike proposal 4).
 *
 * Only absolute http(s) entries count, without repeats. Entries on a local or
 * private host are not proposed (note playlist-private-entry: a panel set up
 * with its internal address). When every entry is the same path on different
 * hosts, the first one stands for the rest (note playlist-mirrors).
 *
 * @since 3.6.0
 */
final class Playlist_Parser {

	/**
	 * Streams and notes of a playlist.
	 *
	 * @since 3.6.0
	 *
	 * @param string $body Playlist body.
	 * @return array{streams: list<string>, notes: list<string>}
	 */
	public static function parse( string $body ): array {
		$streams = array();
		$notes   = array();
		$paths   = array();
		foreach ( self::entries( $body ) as $entry ) {
			$parts = Url_Variants::parse( $entry );
			if ( null === $parts || in_array( $entry, $streams, true ) ) {
				continue;
			}
			if ( Url_Variants::is_private_host( $parts['host'] ) ) {
				$notes[] = 'playlist-private-entry';
				continue;
			}
			$streams[] = $entry;
			$paths[]   = $parts['path'] . '?' . $parts['query'];
		}
		if ( count( $streams ) > 1 && 1 === count( array_unique( $paths ) ) ) {
			$streams = array( $streams[0] );
			$notes[] = 'playlist-mirrors';
		}
		return array(
			'streams' => $streams,
			'notes'   => array_values( array_unique( $notes ) ),
		);
	}

	/**
	 * Raw entries, in order.
	 *
	 * @param string $body Playlist body.
	 * @return list<string>
	 */
	private static function entries( string $body ): array {
		if ( ! Response_Classifier::is_playlist( $body ) ) {
			return array();
		}
		if ( preg_match_all( '/<location>\s*([^<]*?)\s*<\/location>/i', $body, $matches ) ) {
			return array_map(
				static function ( $location ) {
					return html_entity_decode( $location, ENT_QUOTES | ENT_XML1, 'UTF-8' );
				},
				$matches[1]
			);
		}
		$entries = array();
		$is_pls  = 0 === stripos( ltrim( $body, "\xEF\xBB\xBF \t\r\n" ), '[playlist]' );
		foreach ( (array) preg_split( '/\r\n|\r|\n/', $body ) as $line ) {
			$line = trim( (string) $line );
			if ( $is_pls ) {
				if ( preg_match( '/^File\d+\s*=\s*(.+)$/i', $line, $match ) ) {
					$entries[] = trim( $match[1] );
				}
			} elseif ( '' !== $line && '#' !== $line[0] ) {
				$entries[] = $line;
			}
		}
		return $entries;
	}
}
