<?php
/**
 * Tests for RadioPlayerPage\Data\Program.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Data;

use RadioPlayerPage\Data\Program;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * The program data of radplapag_get_program_data(), built from raw meta as in 3.4.2.
 */
final class ProgramTest extends TestCase {

	/**
	 * A fully saved program gives every key, in the order of 3.4.2.
	 */
	public function test_data_with_saved_meta() {
		$this->assertSame(
			array(
				'name'                 => 'Morning',
				'description'          => 'Short',
				'extended_description' => "Long\ntext",
				'logo_id'              => 5,
				'logo_url'             => 'https://example.com/logo.jpg',
			),
			Program::data( 'Morning', 'Short', "Long\ntext", 5, 'https://example.com/logo.jpg' )
		);
	}

	/**
	 * A program without meta has empty strings, logo 0 and a null logo URL.
	 */
	public function test_data_without_meta() {
		$this->assertSame(
			array(
				'name'                 => 'Bare',
				'description'          => '',
				'extended_description' => '',
				'logo_id'              => 0,
				'logo_url'             => null,
			),
			Program::data( 'Bare', '', '', 0, false )
		);
	}

	/**
	 * The title is kept as given, '0' and '' included.
	 */
	public function test_title_is_kept() {
		$this->assertSame( '0', Program::data( '0', '', '', 0, false )['name'] );
		$this->assertSame( '', Program::data( '', '', '', 0, false )['name'] );
	}

	/**
	 * Descriptions that are not strings read as ''; strings are kept untrimmed.
	 *
	 * @dataProvider non_string_values
	 *
	 * @param mixed $value Raw meta value.
	 */
	public function test_non_string_descriptions_read_as_empty( $value ) {
		$data = Program::data( 'P', $value, $value, 0, false );

		$this->assertSame( '', $data['description'] );
		$this->assertSame( '', $data['extended_description'] );
	}

	/**
	 * Raw meta values that are not strings.
	 *
	 * @return array<string, array{mixed}>
	 */
	public static function non_string_values(): array {
		return array(
			'false' => array( false ),
			'null'  => array( null ),
			'int'   => array( 7 ),
			'array' => array( array( 'Short' ) ),
		);
	}

	/**
	 * The descriptions are not trimmed or sanitized.
	 */
	public function test_descriptions_are_kept_as_given() {
		$data = Program::data( 'P', ' <b>Short</b> ', '0', 0, false );

		$this->assertSame( ' <b>Short</b> ', $data['description'] );
		$this->assertSame( '0', $data['extended_description'] );
	}

	/**
	 * The logo ID is passed through, even without a logo URL.
	 */
	public function test_logo_id_is_kept_without_url() {
		$data = Program::data( 'P', '', '', 9, false );

		$this->assertSame( 9, $data['logo_id'] );
		$this->assertNull( $data['logo_url'] );
	}

	/**
	 * A falsy logo URL is null, as `$logo_url ? $logo_url : null` in 3.4.2.
	 *
	 * @dataProvider falsy_urls
	 *
	 * @param string|false $url Logo URL from wp_get_attachment_image_url().
	 */
	public function test_falsy_logo_url_is_null( $url ) {
		$this->assertNull( Program::data( 'P', '', '', 5, $url )['logo_url'] );
	}

	/**
	 * Falsy logo URLs.
	 *
	 * @return array<string, array{string|false}>
	 */
	public static function falsy_urls(): array {
		return array(
			'false'        => array( false ),
			'empty string' => array( '' ),
			'zero string'  => array( '0' ),
		);
	}
}
