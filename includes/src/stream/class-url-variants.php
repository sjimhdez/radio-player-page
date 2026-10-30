<?php
/**
 * URLs the stream probe derives from the one the administrator wrote.
 *
 * @package radio-player-page
 * @since 3.6.0
 */

namespace RadioPlayerPage\Stream;

defined( 'ABSPATH' ) || exit;

/**
 * Parses http(s) URLs and builds the variants of ADR 0064: the origin sent as
 * Origin, the https variant, Icecast's status-json.xsl, Shoutcast's /; and
 * /stream, and the target of a Location header.
 *
 * @since 3.6.0
 */
final class Url_Variants {

	/**
	 * Default port of each scheme.
	 */
	const DEFAULT_PORTS = array(
		'http'  => 80,
		'https' => 443,
	);

	/**
	 * Splits an http(s) URL into its parts. The fragment is dropped.
	 *
	 * @since 3.6.0
	 *
	 * @param string $url URL.
	 * @return array{scheme: string, host: string, port: int, path: string, query: string}|null Null if it is not an absolute http(s) URL with a host.
	 */
	public static function parse( string $url ): ?array {
		if ( ! preg_match( '!^(https?)://([a-z0-9.\-_~%]+|\[[0-9a-f:.]+\])(?::([0-9]{1,5}))?([/?#]\S*)?$!i', $url, $matches ) ) {
			return null;
		}
		$scheme = strtolower( $matches[1] );
		$port   = isset( $matches[3] ) && '' !== $matches[3] ? (int) $matches[3] : self::DEFAULT_PORTS[ $scheme ];
		if ( $port < 1 || $port > 65535 ) {
			return null;
		}
		$rest = isset( $matches[4] ) ? $matches[4] : '';
		$hash = strpos( $rest, '#' );
		if ( false !== $hash ) {
			$rest = substr( $rest, 0, $hash );
		}
		$query    = '';
		$question = strpos( $rest, '?' );
		if ( false !== $question ) {
			$query = substr( $rest, $question + 1 );
			$rest  = substr( $rest, 0, $question );
		}
		return array(
			'scheme' => $scheme,
			'host'   => strtolower( $matches[2] ),
			'port'   => $port,
			'path'   => '' === $rest ? '/' : $rest,
			'query'  => $query,
		);
	}

	/**
	 * Scheme, host and port (when not the default) of a URL.
	 *
	 * @since 3.6.0
	 *
	 * @param string $url URL.
	 * @return string The origin, or '' if the URL does not parse.
	 */
	public static function origin( string $url ): string {
		$parts = self::parse( $url );
		return null === $parts ? '' : self::authority( $parts['scheme'], $parts['host'], $parts['port'] );
	}

	/**
	 * The same URL over https. Port 80 becomes the default; another port is kept.
	 *
	 * @since 3.6.0
	 *
	 * @param string $url URL.
	 * @return string|null Null if the URL is not http.
	 */
	public static function https( string $url ): ?string {
		$parts = self::parse( $url );
		if ( null === $parts || 'http' !== $parts['scheme'] ) {
			return null;
		}
		$port = 80 === $parts['port'] ? 443 : $parts['port'];
		return self::authority( 'https', $parts['host'], $port ) . $parts['path'] . ( '' === $parts['query'] ? '' : '?' . $parts['query'] );
	}

	/**
	 * Icecast's status-json.xsl on the same scheme, host and port.
	 *
	 * @since 3.6.0
	 *
	 * @param string $url URL of the Icecast page.
	 * @return string|null Null if the URL does not parse.
	 */
	public static function icecast_status( string $url ): ?string {
		$origin = self::origin( $url );
		return '' === $origin ? null : $origin . '/status-json.xsl';
	}

	/**
	 * Shoutcast's audio paths for a browser: /; (v1 and DNAS 2) and /stream (DNAS 2).
	 *
	 * @since 3.6.0
	 *
	 * @param string $url URL of the Shoutcast page.
	 * @return list<string> Empty if the URL does not parse.
	 */
	public static function shoutcast( string $url ): array {
		$origin = self::origin( $url );
		return '' === $origin ? array() : array( $origin . '/;', $origin . '/stream' );
	}

	/**
	 * Resolves a Location header against the URL that answered.
	 *
	 * @since 3.6.0
	 *
	 * @param string $base     URL that answered.
	 * @param string $location Location header.
	 * @return string|null Absolute http(s) URL, or null.
	 */
	public static function resolve( string $base, string $location ): ?string {
		$location = trim( $location );
		$parts    = self::parse( $base );
		if ( '' === $location || null === $parts ) {
			return null;
		}
		if ( 0 === strpos( $location, '//' ) ) {
			$location = $parts['scheme'] . ':' . $location;
		} elseif ( ! preg_match( '~^[a-z][a-z0-9+.\-]*:~i', $location ) ) {
			$origin = self::authority( $parts['scheme'], $parts['host'], $parts['port'] );
			if ( '/' === $location[0] ) {
				$location = $origin . $location;
			} elseif ( '?' === $location[0] ) {
				$location = $origin . $parts['path'] . $location;
			} else {
				$location = $origin . substr( $parts['path'], 0, (int) strrpos( $parts['path'], '/' ) + 1 ) . $location;
			}
		}
		return null === self::parse( $location ) ? null : $location;
	}

	/**
	 * Whether a host is local or private: localhost names and private, loopback,
	 * link-local, shared (100.64.0.0/10), unique local (fc00::/7) or reserved
	 * IPs, also IPv4-mapped. A hostname that resolves to one is not detected.
	 *
	 * @since 3.6.0
	 *
	 * @param string $host Host, with IPv6 in brackets or without.
	 * @return bool
	 */
	public static function is_private_host( string $host ): bool {
		$host = strtolower( trim( $host, '[]' ) );
		if ( 'localhost' === $host || '.localhost' === substr( $host, -10 ) ) {
			return true;
		}
		if ( false === filter_var( $host, FILTER_VALIDATE_IP ) ) {
			return false;
		}
		if ( 0 === strpos( $host, '::ffff:' ) && false !== filter_var( substr( $host, 7 ), FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 ) ) {
			return self::is_private_host( (string) substr( $host, 7 ) );
		}
		$bytes = (string) inet_pton( $host );
		if ( 16 === strlen( $bytes ) && 0xfc === ( ord( $bytes[0] ) & 0xfe ) ) {
			return true;
		}
		if ( 4 === strlen( $bytes ) && 100 === ord( $bytes[0] ) && 64 === ( ord( $bytes[1] ) & 0xc0 ) ) {
			return true;
		}
		return false === filter_var( $host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE );
	}

	/**
	 * Scheme, host and port, leaving out the default port.
	 *
	 * @param string $scheme Scheme.
	 * @param string $host   Host.
	 * @param int    $port   Port.
	 * @return string
	 */
	private static function authority( string $scheme, string $host, int $port ): string {
		return $scheme . '://' . $host . ( self::DEFAULT_PORTS[ $scheme ] === $port ? '' : ':' . $port );
	}
}
