<?php
/**
 * Tests of the lang attribute of the clean page printed by
 * radplapag_output_clean_page().
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Station;

use RadioPlayerPage\Tests\Integration\Support\Factory;
use RuntimeException;
use WP_UnitTestCase;

/**
 * Pins that the lang attribute is escaped as an attribute (K94).
 *
 * The clean page ends in exit, so the blog_public read that follows the <html> tag
 * throws to stop it first.
 */
final class CleanPageLangTest extends WP_UnitTestCase {

	const STREAM = 'https://stream.example.com/live.mp3';

	/**
	 * The site language goes through esc_attr() (the attribute_escape filter).
	 *
	 * @see docs/known-issues.md K94
	 */
	public function test_lang_is_escaped_as_an_attribute() {
		$factory = new Factory();
		$page    = $factory->page( 'Player' );
		$factory->station(
			'Station',
			array(
				'stream_url'  => self::STREAM,
				'player_page' => $page,
			)
		);
		$this->go_to( get_permalink( $page ) );

		$escaped = array();
		add_filter(
			'attribute_escape',
			static function ( $safe_text, $text ) use ( &$escaped ) {
				$escaped[] = $text;
				return $safe_text;
			},
			10,
			2
		);
		add_filter(
			'pre_option_blog_public',
			static function () {
				throw new RuntimeException( 'Clean page stopped before exit.' );
			}
		);

		ob_start();
		try {
			radplapag_output_clean_page();
		} catch ( RuntimeException $e ) {
			unset( $e );
		}
		$html = (string) ob_get_clean();

		$language = get_bloginfo( 'language' );
		$this->assertStringContainsString( '<html lang="' . $language . '"', $html );
		$this->assertContains( $language, $escaped );
	}
}
