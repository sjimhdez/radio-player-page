<?php
/**
 * What a stream server answered.
 *
 * @package radio-player-page
 * @since 3.6.0
 */

namespace RadioPlayerPage\Stream;

defined( 'ABSPATH' ) || exit;

/**
 * Classifies a response from its status, headers and first bytes (ADR 0064 §7).
 *
 * The order matters because the MIME type often lies: an .m3u comes as
 * application/octet-stream or audio/x-mpegurl, and Icecast's root as text/xml.
 *
 * @since 3.6.0
 */
final class Response_Classifier {

	/**
	 * Types that name a playlist or a manifest, not audio.
	 */
	const LIST_TYPES = array( 'audio/x-scpls', 'audio/scpls', 'audio/x-mpegurl', 'audio/mpegurl', 'application/vnd.apple.mpegurl', 'application/x-mpegurl', 'application/xspf+xml', 'application/dash+xml' );

	/**
	 * Classifies a response.
	 *
	 * @since 3.6.0
	 *
	 * @param int                   $status  HTTP status, or 0 when unknown (cut without headers).
	 * @param array<string, string> $headers Headers with lowercase names; empty when unknown.
	 * @param string                $body    First bytes of the body.
	 * @param string                $origin  The site's origin, sent as Origin.
	 * @return array{kind: string, cors: bool|null, notes: list<string>} Kind: http-error, hls, dash, playlist, audio, shoutcast-page, icecast-page or html (anything else).
	 */
	public static function classify( int $status, array $headers, string $body, string $origin ): array {
		$kind  = self::kind( $status, $headers, $body );
		$notes = array();
		if ( 'audio' === $kind && false !== stripos( $headers['icy-notice2'] ?? '', 'shoutcast' ) ) {
			$notes[] = 'shoutcast-server';
		}
		return array(
			'kind'  => $kind,
			'cors'  => self::cors( $headers, $origin ),
			'notes' => $notes,
		);
	}

	/**
	 * Whether the body is a playlist: .pls, .m3u without #EXT-X- lines, .xspf, or bare URL lines.
	 *
	 * @since 3.6.0
	 *
	 * @param string $body Body.
	 * @return bool
	 */
	public static function is_playlist( string $body ): bool {
		$text = self::text( $body );
		if ( '' === $text || false !== strpos( $text, "\0" ) ) {
			return false;
		}
		if ( 0 === stripos( $text, '[playlist]' ) ) {
			return true;
		}
		if ( 0 === strpos( $text, '#EXTM3U' ) ) {
			return false === strpos( $text, '#EXT-X-' );
		}
		if ( preg_match( '/<playlist\b[^>]*xspf/i', $text ) ) {
			return true;
		}
		return (bool) preg_match( '/^https?:\/\/\S+$/i', trim( (string) strtok( $text, "\n" ) ) );
	}

	/**
	 * Kind of the response.
	 *
	 * @param int                   $status  Status.
	 * @param array<string, string> $headers Headers.
	 * @param string                $body    Body.
	 * @return string
	 */
	private static function kind( int $status, array $headers, string $body ): string {
		if ( $status >= 400 ) {
			return 'http-error';
		}
		$text = self::text( $body );
		if ( 0 === strpos( $text, '#EXTM3U' ) && false !== strpos( $text, '#EXT-X-' ) ) {
			return 'hls';
		}
		if ( preg_match( '/^(<\?xml[^>]*>\s*)?<MPD\b/', $text ) ) {
			return 'dash';
		}
		if ( self::is_playlist( $body ) ) {
			return 'playlist';
		}
		if ( self::is_audio( $headers, $body ) ) {
			return 'audio';
		}
		if ( preg_match( '/<title>\s*shoutcast|shoutcast d\.n\.a\.s|shoutcast administrator/i', $body ) ) {
			return 'shoutcast-page';
		}
		if ( 0 === stripos( $headers['server'] ?? '', 'icecast' ) || preg_match( '/<title>[^<]*icecast/i', $body ) ) {
			return 'icecast-page';
		}
		return 'html';
	}

	/**
	 * Whether the response is audio: its type, an icy-* header or its first bytes.
	 *
	 * @param array<string, string> $headers Headers.
	 * @param string                $body    Body.
	 * @return bool
	 */
	private static function is_audio( array $headers, string $body ): bool {
		$type = strtolower( trim( explode( ';', $headers['content-type'] ?? '' )[0] ) );
		if ( ( 0 === strpos( $type, 'audio/' ) || 'application/ogg' === $type ) && ! in_array( $type, self::LIST_TYPES, true ) ) {
			return true;
		}
		foreach ( array_keys( $headers ) as $name ) {
			if ( 0 === strpos( $name, 'icy-' ) ) {
				return true;
			}
		}
		if ( in_array( substr( $body, 0, 4 ), array( 'OggS', 'fLaC' ), true ) || 0 === strpos( $body, 'ID3' ) ) {
			return true;
		}
		// MPEG audio frame sync, which also covers AAC in ADTS (FF F1, FF F9).
		return strlen( $body ) >= 2 && "\xFF" === $body[0] && ( ord( $body[1] ) & 0xE0 ) === 0xE0;
	}

	/**
	 * Whether Access-Control-Allow-Origin lets the site's origin read the response.
	 *
	 * @param array<string, string> $headers Headers.
	 * @param string                $origin  Origin.
	 * @return bool|null Null when the headers are unknown.
	 */
	private static function cors( array $headers, string $origin ): ?bool {
		if ( array() === $headers ) {
			return null;
		}
		$allowed = rtrim( strtolower( trim( $headers['access-control-allow-origin'] ?? '' ) ), '/' );
		return '*' === $allowed || ( '' !== $allowed && rtrim( strtolower( $origin ), '/' ) === $allowed );
	}

	/**
	 * The body without a byte order mark and leading whitespace.
	 *
	 * @param string $body Body.
	 * @return string
	 */
	private static function text( string $body ): string {
		if ( 0 === strpos( $body, "\xEF\xBB\xBF" ) ) {
			$body = substr( $body, 3 );
		}
		return ltrim( $body );
	}
}
