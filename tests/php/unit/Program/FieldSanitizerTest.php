<?php
/**
 * Tests for RadioPlayerPage\Program\Field_Sanitizer.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Program;

use RadioPlayerPage\Program\Field_Sanitizer;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * The program fields of radplapag_save_program_meta(), after the WP sanitizers, as in 3.4.2.
 */
final class FieldSanitizerTest extends TestCase {

	/**
	 * Valid input is kept as is.
	 */
	public function test_valid_input() {
		$values = Field_Sanitizer::sanitize( self::input(), self::is_image( true ) );

		$this->assertSame(
			array(
				'description'          => 'Morning show',
				'extended_description' => "Line 1\nLine 2",
				'logo_id'              => 6,
			),
			$values
		);
	}

	/**
	 * Missing keys give the values of a form posted without those fields, without a lookup.
	 */
	public function test_missing_keys() {
		$calls = 0;

		$values = Field_Sanitizer::sanitize(
			array(),
			static function () use ( &$calls ) {
				++$calls;
				return true;
			}
		);

		$this->assertSame(
			array(
				'description'          => '',
				'extended_description' => '',
				'logo_id'              => 0,
			),
			$values
		);
		$this->assertSame( 0, $calls );
	}

	/**
	 * Descriptions that are not strings are read as empty.
	 */
	public function test_non_string_descriptions_are_empty() {
		$input                         = self::input();
		$input['description']          = array( 'a' );
		$input['extended_description'] = null;

		$values = Field_Sanitizer::sanitize( $input, self::is_image( true ) );

		$this->assertSame( '', $values['description'] );
		$this->assertSame( '', $values['extended_description'] );
	}

	/**
	 * The description is cut to 256 bytes and the extended one to 512; at the limit they are kept.
	 */
	public function test_descriptions_are_truncated_by_bytes() {
		$input                         = self::input();
		$input['description']          = str_repeat( 'a', 300 );
		$input['extended_description'] = str_repeat( 'b', 600 );

		$values = Field_Sanitizer::sanitize( $input, self::is_image( true ) );

		$this->assertSame( str_repeat( 'a', 256 ), $values['description'] );
		$this->assertSame( str_repeat( 'b', 512 ), $values['extended_description'] );

		$input['description']          = str_repeat( 'a', 256 );
		$input['extended_description'] = str_repeat( 'b', 512 );

		$values = Field_Sanitizer::sanitize( $input, self::is_image( true ) );

		$this->assertSame( str_repeat( 'a', 256 ), $values['description'] );
		$this->assertSame( str_repeat( 'b', 512 ), $values['extended_description'] );
	}

	/**
	 * Truncation counts bytes, not characters: 200 "é" (400 bytes) become 128.
	 */
	public function test_truncation_counts_bytes_not_characters() {
		$input                = self::input();
		$input['description'] = str_repeat( 'é', 200 );

		$values = Field_Sanitizer::sanitize( $input, self::is_image( true ) );

		$this->assertSame( str_repeat( 'é', 128 ), $values['description'] );
	}

	/**
	 * A cut inside a multibyte character keeps its first byte; the registered meta
	 * sanitizer then saves the field empty (K5).
	 */
	public function test_currently_cut_inside_a_character_keeps_half_of_it() {
		$input                         = self::input();
		$input['description']          = str_repeat( 'a', 255 ) . 'é';
		$input['extended_description'] = str_repeat( 'b', 511 ) . 'é';

		$values = Field_Sanitizer::sanitize( $input, self::is_image( true ) );

		$this->assertSame( str_repeat( 'a', 255 ) . "\xC3", $values['description'] );
		$this->assertSame( str_repeat( 'b', 511 ) . "\xC3", $values['extended_description'] );
	}

	/**
	 * A logo that is not an image goes to 0.
	 */
	public function test_logo_that_is_not_an_image_goes_to_zero() {
		$values = Field_Sanitizer::sanitize( self::input(), self::is_image( false ) );

		$this->assertSame( 0, $values['logo_id'] );
	}

	/**
	 * The image lookup runs only for a logo above 0, with its ID.
	 */
	public function test_lookup_only_for_a_positive_logo() {
		$calls    = array();
		$is_image = static function ( $id ) use ( &$calls ) {
			$calls[] = $id;
			return true;
		};

		$input            = self::input();
		$input['logo_id'] = 0;
		Field_Sanitizer::sanitize( $input, $is_image );
		$input['logo_id'] = '9';
		$values           = Field_Sanitizer::sanitize( $input, $is_image );

		$this->assertSame( array( 9 ), $calls );
		$this->assertSame( 9, $values['logo_id'] );
	}

	/**
	 * Valid input, as it comes from the WP sanitizers.
	 *
	 * @return array<string, mixed>
	 */
	private static function input() {
		return array(
			'description'          => 'Morning show',
			'extended_description' => "Line 1\nLine 2",
			'logo_id'              => 6,
		);
	}

	/**
	 * A stand-in for wp_attachment_is_image().
	 *
	 * @param bool $result What it returns.
	 * @return callable(int): bool
	 */
	private static function is_image( $result ) {
		return static function () use ( $result ) {
			return $result;
		};
	}
}
