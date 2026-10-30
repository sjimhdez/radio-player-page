<?php
/**
 * Tests of RADPLAPAG_CONFIG.adminDiagnostics on the clean page printed by
 * radplapag_output_clean_page().
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Player;

use RadioPlayerPage\Tests\Integration\Support\Factory;
use RuntimeException;
use WP_UnitTestCase;

/**
 * Pins that only users who can manage_options get the edit URL of the station, and
 * that the page then sends the no-cache headers (ADR 0065).
 *
 * The clean page ends in exit, so the first URL escaped after the globals throws to
 * stop it first. Each test runs in its own process: in the main one PHPUnit has
 * printed already, and nocache_headers() does nothing once headers are sent.
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
final class CleanPageAdminDiagnosticsTest extends WP_UnitTestCase {

	const STREAM = 'https://stream.example.com/live.mp3';

	/**
	 * Station post ID of the test.
	 *
	 * @var int
	 */
	private $station = 0;

	/**
	 * Whether nocache_headers() ran during the page.
	 *
	 * @var bool
	 */
	private $nocache = false;

	/**
	 * Creates a station on a page and opens that page.
	 */
	public function set_up() {
		parent::set_up();
		$factory       = new Factory();
		$page          = $factory->page( 'Player' );
		$this->station = $factory->station(
			'Station',
			array(
				'stream_url'  => self::STREAM,
				'player_page' => $page,
			)
		);
		$this->go_to( get_permalink( $page ) );
		add_filter(
			'nocache_headers',
			function ( $headers ) {
				$this->nocache = true;
				return $headers;
			}
		);
	}

	/**
	 * A visitor gets null and the headers of always.
	 */
	public function test_visitor_gets_null() {
		wp_set_current_user( 0 );

		$config = $this->config();

		$this->assertArrayHasKey( 'adminDiagnostics', $config );
		$this->assertNull( $config['adminDiagnostics'] );
		$this->assertFalse( $this->nocache );
	}

	/**
	 * An administrator gets the edit URL of the station and the no-cache headers.
	 */
	public function test_administrator_gets_the_edit_url() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );

		$config = $this->config();

		$this->assertSame( array( 'editUrl' => get_edit_post_link( $this->station, 'raw' ) ), $config['adminDiagnostics'] );
		$this->assertStringContainsString( 'post=' . $this->station . '&action=edit', $config['adminDiagnostics']['editUrl'] );
		$this->assertTrue( $this->nocache );
	}

	/**
	 * An editor, without manage_options, gets null.
	 */
	public function test_editor_gets_null() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );

		$this->assertNull( $this->config()['adminDiagnostics'] );
		$this->assertFalse( $this->nocache );
	}

	/**
	 * A filtered edit link that is not a string gives null, not a TypeError.
	 */
	public function test_non_string_edit_link_gives_null() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		add_filter(
			'get_edit_post_link',
			static function () {
				return array( 'not', 'a', 'url' );
			}
		);

		$this->assertNull( $this->config()['adminDiagnostics'] );
		$this->assertFalse( $this->nocache );
	}

	/**
	 * A filtered edit link with an unsafe scheme is dropped by esc_url_raw().
	 */
	public function test_unsafe_edit_link_gives_null() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		add_filter(
			'get_edit_post_link',
			static function () {
				return 'javascript:alert(1)';
			}
		);

		$this->assertNull( $this->config()['adminDiagnostics'] );
		$this->assertFalse( $this->nocache );
	}

	/**
	 * RADPLAPAG_CONFIG of the page, decoded.
	 *
	 * @return array<string, mixed>
	 */
	private function config() {
		add_filter(
			'clean_url',
			static function ( $url ) {
				if ( false !== strpos( (string) ob_get_contents(), 'window.RADPLAPAG_SCHEDULE' ) ) {
					throw new RuntimeException( 'Clean page stopped before exit.' );
				}
				return $url;
			}
		);

		ob_start();
		try {
			radplapag_output_clean_page();
		} catch ( RuntimeException $e ) {
			unset( $e );
		}
		$html = (string) ob_get_clean();

		$this->assertSame( 1, preg_match( '/window\.RADPLAPAG_CONFIG = (.*?);window\./', $html, $m ) );

		return json_decode( $m[1], true );
	}
}
