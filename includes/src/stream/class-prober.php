<?php
/**
 * The steps of the server stream probe.
 *
 * @package radio-player-page
 * @since 3.6.0
 */

namespace RadioPlayerPage\Stream;

defined( 'ABSPATH' ) || exit;

/**
 * Probes a URL with the request it is given and builds the report (ADR 0064 §2 and §8).
 *
 * At most three URLs: the one written; its status-json.xsl if it is an Icecast
 * page; and its https variant if it is http and the site is https. Playlist
 * entries and Shoutcast's /; and /stream are proposed without requesting them.
 * The report never carries a body.
 *
 * @since 3.6.0
 */
final class Prober {

	/**
	 * Probes a URL.
	 *
	 * @since 3.6.0
	 *
	 * @param string   $url      URL written by the administrator.
	 * @param string   $site_url The site's home URL, for Origin and the https variant.
	 * @param callable $fetch    Requests a URL: ( string $url ) => array{status: int, headers: array<string, string>, body: string}
	 *                           or array{error: string} ('unreachable' or 'blocked').
	 * @return array{kind: string, status: int|null, cors: bool|null, streams: list<string>, mounts: list<array{url: string, name: string, type: string}>, variant: array{url: string, kind: string, status: int|null}|null, notes: list<string>}
	 */
	public static function probe( string $url, string $site_url, callable $fetch ): array {
		$origin = Url_Variants::origin( $site_url );
		$report = array(
			'kind'    => '',
			'status'  => null,
			'cors'    => null,
			'streams' => array(),
			'mounts'  => array(),
			'variant' => null,
			'notes'   => array(),
		);

		$response = $fetch( $url );
		if ( isset( $response['error'] ) ) {
			$report['kind'] = (string) $response['error'];
		} else {
			$result           = Response_Classifier::classify( $response['status'], $response['headers'], $response['body'], $origin );
			$report['kind']   = $result['kind'];
			$report['status'] = self::status( $response['status'] );
			$report['cors']   = $result['cors'];
			$report['notes']  = $result['notes'];
			if ( 'playlist' === $result['kind'] ) {
				$playlist          = Playlist_Parser::parse( $response['body'] );
				$report['streams'] = $playlist['streams'];
				$report['notes']   = array_values( array_unique( array_merge( $report['notes'], $playlist['notes'] ) ) );
			} elseif ( 'shoutcast-page' === $result['kind'] ) {
				$report['streams'] = Url_Variants::shoutcast( $url );
			} elseif ( 'icecast-page' === $result['kind'] ) {
				$report['mounts'] = self::mounts( $url, $response['body'], $fetch );
			}
		}

		$https = Url_Variants::https( $url );
		if ( null !== $https && 'https' === ( Url_Variants::parse( $site_url )['scheme'] ?? '' ) ) {
			$variant           = $fetch( $https );
			$report['variant'] = array(
				'url'    => $https,
				'kind'   => isset( $variant['error'] ) ? (string) $variant['error'] : Response_Classifier::classify( $variant['status'], $variant['headers'], $variant['body'], $origin )['kind'],
				'status' => isset( $variant['error'] ) ? null : self::status( $variant['status'] ),
			);
		}

		return $report;
	}

	/**
	 * Mounts of an Icecast page, from its status-json.xsl.
	 *
	 * @param string   $url   URL of the page.
	 * @param string   $body  Body of the page.
	 * @param callable $fetch Request.
	 * @return list<array{url: string, name: string, type: string}>
	 */
	private static function mounts( string $url, string $body, callable $fetch ): array {
		$status_url = (string) Url_Variants::icecast_status( $url );
		$mounts     = Icecast_Status::mounts( $body, $url );
		if ( array() !== $mounts ) {
			return $mounts;
		}
		$response = $fetch( $status_url );
		if ( isset( $response['error'] ) || $response['status'] >= 400 ) {
			return array();
		}
		return Icecast_Status::mounts( $response['body'], $status_url );
	}

	/**
	 * A known status, or null.
	 *
	 * @param int $status Status, 0 when unknown.
	 * @return int|null
	 */
	private static function status( int $status ): ?int {
		return $status > 0 ? $status : null;
	}
}
