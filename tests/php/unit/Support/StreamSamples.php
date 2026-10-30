<?php
/**
 * Real stream server samples of tests/fixtures/streams/ (spec 0018, phase 0).
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Support;

use RuntimeException;

/**
 * Reads a sample as the probe sees a response: status, lowercase headers and body.
 */
final class StreamSamples {

	/**
	 * Names of every sample, without extension.
	 *
	 * @return list<string>
	 */
	public static function names() {
		$names = array();
		foreach ( (array) glob( self::dir() . '/*.headers' ) as $path ) {
			$names[] = basename( (string) $path, '.headers' );
		}
		sort( $names );
		return $names;
	}

	/**
	 * A sample as a response.
	 *
	 * @param string $name Sample name, without extension.
	 * @return array{status: int, headers: array<string, string>, body: string}
	 * @throws RuntimeException When the sample is missing.
	 */
	public static function load( $name ) {
		$raw  = file_get_contents( self::dir() . '/' . $name . '.headers' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local fixture.
		$body = file_get_contents( self::dir() . '/' . $name . '.body' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local fixture.
		if ( false === $raw || false === $body ) {
			throw new RuntimeException( 'Missing sample.' );
		}
		$lines = preg_split( '/\r?\n/', trim( $raw ) );
		$lines = false === $lines ? array() : $lines;
		preg_match( '/^HTTP\/[\d.]+\s+(\d{3})/', (string) array_shift( $lines ), $matches );
		$headers = array();
		foreach ( $lines as $line ) {
			$colon = strpos( $line, ':' );
			if ( false !== $colon ) {
				$headers[ strtolower( trim( substr( $line, 0, $colon ) ) ) ] = trim( substr( $line, $colon + 1 ) );
			}
		}
		return array(
			'status'  => isset( $matches[1] ) ? (int) $matches[1] : 0,
			'headers' => $headers,
			'body'    => $body,
		);
	}

	/**
	 * Directory of the samples.
	 *
	 * @return string
	 */
	private static function dir() {
		return RADPLAPAG_TESTS_PLUGIN_DIR . '/tests/fixtures/streams';
	}
}
