<?php
/**
 * Normalized snapshots for the integration tests.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Support;

use PHPUnit\Framework\TestCase;

/**
 * Compares output with a file in tests/php/integration/snapshots/ after normalizing
 * what changes between runs: the site origin, the uploads year/month and post IDs.
 *
 * Snapshots are written only with RADPLAPAG_UPDATE_SNAPSHOTS=1 inside the container:
 *
 *     npx wp-env --config .wp-env.tests.json run cli \
 *       --env-cwd=wp-content/plugins/radio-player-page \
 *       env WORDPRESS_TABLE_PREFIX=wptests_ RADPLAPAG_UPDATE_SNAPSHOTS=1 \
 *       vendor/bin/phpunit -c phpunit-integration.xml.dist --filter <Test>
 *
 * Without it, a missing snapshot fails.
 */
final class Snapshot {

	/**
	 * Path of a snapshot file.
	 *
	 * @param string $name File name, with extension.
	 * @return string
	 */
	public static function path( $name ) {
		return dirname( __DIR__ ) . '/snapshots/' . $name;
	}

	/**
	 * Normalizes the origin of home_url() (plain and JSON-escaped), `uploads/YYYY/MM`
	 * and the given IDs.
	 *
	 * An ID is replaced only where IDs appear (after `"`, `=`, `:`, `/`, `-`, `_`, `#`
	 * or a space, and before a quote, `&`, `/`, `\`, `,`, `}`, `]`, `<`, `-`, `_`, a space
	 * or the end), so times such as `07:00-10:00` and other numbers are left alone.
	 *
	 * @param string             $content Output to normalize.
	 * @param array<int, string> $names   ID → placeholder (Factory::names()).
	 * @return string
	 */
	public static function normalize( $content, array $names = array() ) {
		$parts  = wp_parse_url( home_url() );
		$origin = $parts['scheme'] . '://' . $parts['host'] . ( isset( $parts['port'] ) ? ':' . $parts['port'] : '' );

		$content = str_replace(
			array( $origin, str_replace( '/', '\/', $origin ) ),
			'{{ORIGIN}}',
			$content
		);

		$content = preg_replace( '#uploads(\\\\?/)\d{4}(\\\\?/)\d{2}(?=\\\\?/)#', 'uploads$1{{YYYY}}$2{{MM}}', $content );

		if ( $names ) {
			$content = preg_replace_callback(
				'#(?<=["=:/_\#\s-])\d+(?=["&/\\\\,}\]<\s_-]|$)#',
				static function ( $m ) use ( $names ) {
					return isset( $names[ (int) $m[0] ] ) && (string) (int) $m[0] === $m[0] ? $names[ (int) $m[0] ] : $m[0];
				},
				$content
			);
		}

		return $content;
	}

	/**
	 * Asserts that the normalized content matches the snapshot $name.
	 *
	 * @param TestCase           $test    Running test.
	 * @param string             $name    Snapshot file name, with extension.
	 * @param string             $content Output to compare.
	 * @param array<int, string> $names   ID → placeholder (Factory::names()).
	 */
	public static function assert_matches( TestCase $test, $name, $content, array $names = array() ) {
		self::assert_matches_file( $test, self::path( $name ), $content, $names );
	}

	/**
	 * Same as assert_matches(), with the full path of the file: for snapshots that other
	 * suites read, such as the fixtures in tests/fixtures/.
	 *
	 * @param TestCase           $test    Running test.
	 * @param string             $path    Absolute path of the file.
	 * @param string             $content Output to compare.
	 * @param array<int, string> $names   ID → placeholder (Factory::names()).
	 */
	public static function assert_matches_file( TestCase $test, $path, $content, array $names = array() ) {
		$name       = basename( $path );
		$normalized = self::normalize( $content, $names );

		if ( getenv( 'RADPLAPAG_UPDATE_SNAPSHOTS' ) ) {
			if ( ! is_dir( dirname( $path ) ) ) {
				mkdir( dirname( $path ), 0777, true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_mkdir -- Test helper, not shipped.
			}
			file_put_contents( $path, $normalized ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- Test helper, not shipped.
		}

		if ( ! file_exists( $path ) ) {
			$test->fail( "Missing snapshot $name. Write it with RADPLAPAG_UPDATE_SNAPSHOTS=1 and review it." );
		}

		$test->assertSame( file_get_contents( $path ), $normalized, "Snapshot $name" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file.
	}
}
