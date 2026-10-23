<?php
/**
 * Tests for RadioPlayerPage\Station\Field_Sanitizer.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Station;

use RadioPlayerPage\Station\Field_Sanitizer;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * The station fields of radplapag_save_station_meta(), after the WP sanitizers, as in 3.4.2.
 */
final class FieldSanitizerTest extends TestCase {

	/**
	 * Valid input is kept as is, without errors.
	 */
	public function test_valid_input() {
		$result = Field_Sanitizer::sanitize( self::input(), self::is_image( true ), self::mime_type( 'audio/mpeg' ), array( 40, 41 ) );

		$this->assertSame(
			array(
				'values' => array(
					'stream_url'     => 'https://example.com/live.mp3',
					'player_page'    => 34,
					'background_id'  => 5,
					'logo_id'        => 6,
					'intro_audio_id' => 7,
					'theme_color'    => 'blue',
					'visualizer'     => 'bars',
				),
				'errors' => array(),
			),
			$result
		);
	}

	/**
	 * Missing keys give the defaults of a form posted without those fields.
	 */
	public function test_missing_keys() {
		$result = Field_Sanitizer::sanitize( array(), self::is_image( true ), self::mime_type( 'audio/mpeg' ), array() );

		$this->assertSame(
			array(
				'stream_url'     => '',
				'player_page'    => 0,
				'background_id'  => 0,
				'logo_id'        => 0,
				'intro_audio_id' => 0,
				'theme_color'    => 'neutral',
				'visualizer'     => 'oscilloscope',
			),
			$result['values']
		);
		$this->assertSame( array( 'stream_url_required', 'player_page_required' ), $result['errors'] );
	}

	/**
	 * Theme and visualizer off the whitelist fall back to the first allowed value.
	 *
	 * @dataProvider provide_off_whitelist
	 *
	 * @param mixed $value Theme and visualizer.
	 */
	public function test_off_whitelist( $value ) {
		$input                = self::input();
		$input['theme_color'] = $value;
		$input['visualizer']  = $value;

		$values = Field_Sanitizer::sanitize( $input, self::is_image( true ), self::mime_type( 'audio/mpeg' ), array() )['values'];

		$this->assertSame( 'neutral', $values['theme_color'] );
		$this->assertSame( 'oscilloscope', $values['visualizer'] );
	}

	/**
	 * Values that are not whitelisted.
	 *
	 * @return array<string, array{mixed}>
	 */
	public function provide_off_whitelist() {
		return array(
			'unknown'    => array( 'rainbow' ),
			'empty'      => array( '' ),
			'upper case' => array( 'Blue' ),
			'not string' => array( 3 ),
		);
	}

	/**
	 * Every whitelisted theme and visualizer is kept.
	 */
	public function test_whitelisted_values_are_kept() {
		$themes = array( 'neutral', 'blue', 'green', 'red', 'orange', 'yellow', 'purple', 'pink' );
		foreach ( $themes as $theme ) {
			$input                = self::input();
			$input['theme_color'] = $theme;
			$this->assertSame( $theme, Field_Sanitizer::sanitize( $input, self::is_image( true ), self::mime_type( 'audio/mpeg' ), array() )['values']['theme_color'] );
		}
		foreach ( array( 'oscilloscope', 'bars', 'particles', 'waterfall' ) as $visualizer ) {
			$input               = self::input();
			$input['visualizer'] = $visualizer;
			$this->assertSame( $visualizer, Field_Sanitizer::sanitize( $input, self::is_image( true ), self::mime_type( 'audio/mpeg' ), array() )['values']['visualizer'] );
		}
	}

	/**
	 * Background and logo that are not images are not written (null) and each one
	 * reports its error, after the required field codes (K37, ADR 0048).
	 */
	public function test_non_image_attachments_are_kept_with_an_error() {
		$input               = self::input();
		$input['stream_url'] = '';
		$result              = Field_Sanitizer::sanitize( $input, self::is_image( false ), self::mime_type( 'audio/mpeg' ), array() );

		$this->assertNull( $result['values']['background_id'] );
		$this->assertNull( $result['values']['logo_id'] );
		$this->assertSame( 7, $result['values']['intro_audio_id'] );
		$this->assertSame( array( 'stream_url_required', 'background_not_image', 'logo_not_image' ), $result['errors'] );
	}

	/**
	 * Only an audio/mpeg intro is written; anything else is not written (null) and
	 * reports its error (K37, ADR 0048).
	 *
	 * @dataProvider provide_non_mp3_mime
	 *
	 * @param mixed $mime What get_post_mime_type() returns.
	 */
	public function test_non_mp3_intro_is_kept_with_an_error( $mime ) {
		$result = Field_Sanitizer::sanitize( self::input(), self::is_image( true ), self::mime_type( $mime ), array() );

		$this->assertNull( $result['values']['intro_audio_id'] );
		$this->assertSame( 5, $result['values']['background_id'] );
		$this->assertSame( array( 'intro_not_mp3' ), $result['errors'] );
	}

	/**
	 * MIME types that are not audio/mpeg.
	 *
	 * @return array<string, array{mixed}>
	 */
	public function provide_non_mp3_mime() {
		return array(
			'ogg'        => array( 'audio/ogg' ),
			'image'      => array( 'image/png' ),
			'upper case' => array( 'AUDIO/MPEG' ),
			'missing'    => array( false ),
		);
	}

	/**
	 * The callables get the attachment IDs in the order of 3.4.2, and only those above 0.
	 */
	public function test_lookups_only_for_positive_ids() {
		$calls     = array();
		$is_image  = static function ( $id ) use ( &$calls ) {
			$calls[] = array( 'is_image', $id );
			return true;
		};
		$mime_type = static function ( $id ) use ( &$calls ) {
			$calls[] = array( 'mime_type', $id );
			return 'audio/mpeg';
		};

		Field_Sanitizer::sanitize( self::input(), $is_image, $mime_type, array() );
		$this->assertSame( array( array( 'is_image', 5 ), array( 'is_image', 6 ), array( 'mime_type', 7 ) ), $calls );

		$calls                   = array();
		$input                   = self::input();
		$input['background_id']  = 0;
		$input['logo_id']        = 0;
		$input['intro_audio_id'] = 0;
		$values                  = Field_Sanitizer::sanitize( $input, $is_image, $mime_type, array() )['values'];
		$this->assertSame( array(), $calls );
		$this->assertSame( array( 0, 0, 0 ), array( $values['background_id'], $values['logo_id'], $values['intro_audio_id'] ) );
	}

	/**
	 * An empty stream URL is required.
	 */
	public function test_stream_url_required() {
		$input               = self::input();
		$input['stream_url'] = '';

		$result = Field_Sanitizer::sanitize( $input, self::is_image( true ), self::mime_type( 'audio/mpeg' ), array() );

		$this->assertSame( array( 'stream_url_required' ), $result['errors'] );
		$this->assertSame( '', $result['values']['stream_url'] );
	}

	/**
	 * The stream URL is not trimmed or checked here: the adapter applies esc_url_raw( trim() ).
	 */
	public function test_stream_url_kept_as_given() {
		$input               = self::input();
		$input['stream_url'] = ' not a url ';

		$result = Field_Sanitizer::sanitize( $input, self::is_image( true ), self::mime_type( 'audio/mpeg' ), array() );

		$this->assertSame( ' not a url ', $result['values']['stream_url'] );
		$this->assertSame( array(), $result['errors'] );
	}

	/**
	 * A player page of 0 or below is required, and is not looked up in the taken pages.
	 */
	public function test_player_page_required() {
		foreach ( array( 0, -3 ) as $page ) {
			$input                = self::input();
			$input['player_page'] = $page;

			$result = Field_Sanitizer::sanitize( $input, self::is_image( true ), self::mime_type( 'audio/mpeg' ), array( 0, -3 ) );

			$this->assertSame( array( 'player_page_required' ), $result['errors'] );
			$this->assertSame( $page, $result['values']['player_page'] );
		}
	}

	/**
	 * A player page assigned to another station is taken; the comparison is strict, as in 3.4.2.
	 */
	public function test_player_page_taken() {
		$result = Field_Sanitizer::sanitize( self::input(), self::is_image( true ), self::mime_type( 'audio/mpeg' ), array( 12, 34 ) );
		$this->assertSame( array( 'player_page_taken' ), $result['errors'] );
		$this->assertSame( 34, $result['values']['player_page'] );

		$result = Field_Sanitizer::sanitize( self::input(), self::is_image( true ), self::mime_type( 'audio/mpeg' ), array( '34' ) );
		$this->assertSame( array(), $result['errors'] );
	}

	/**
	 * The errors keep the order of 3.4.2: stream URL, then player page.
	 */
	public function test_error_order() {
		$input               = self::input();
		$input['stream_url'] = '';

		$this->assertSame(
			array( 'stream_url_required', 'player_page_taken' ),
			Field_Sanitizer::sanitize( $input, self::is_image( true ), self::mime_type( 'audio/mpeg' ), array( 34 ) )['errors']
		);

		$input['player_page'] = 0;
		$this->assertSame(
			array( 'stream_url_required', 'player_page_required' ),
			Field_Sanitizer::sanitize( $input, self::is_image( true ), self::mime_type( 'audio/mpeg' ), array( 34 ) )['errors']
		);
	}

	/**
	 * The values are returned even when there are errors.
	 */
	public function test_values_with_errors() {
		$input                = self::input();
		$input['stream_url']  = '';
		$input['theme_color'] = 'rainbow';

		$result = Field_Sanitizer::sanitize( $input, self::is_image( false ), self::mime_type( 'audio/ogg' ), array( 34 ) );

		$this->assertSame(
			array(
				'stream_url'     => '',
				'player_page'    => 34,
				'background_id'  => null,
				'logo_id'        => null,
				'intro_audio_id' => null,
				'theme_color'    => 'neutral',
				'visualizer'     => 'bars',
			),
			$result['values']
		);
	}

	/**
	 * Input after the WP sanitizers (esc_url_raw, absint, sanitize_key).
	 *
	 * @return array<string, mixed>
	 */
	private static function input() {
		return array(
			'stream_url'     => 'https://example.com/live.mp3',
			'player_page'    => 34,
			'background_id'  => 5,
			'logo_id'        => 6,
			'intro_audio_id' => 7,
			'theme_color'    => 'blue',
			'visualizer'     => 'bars',
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

	/**
	 * A stand-in for get_post_mime_type().
	 *
	 * @param mixed $result What it returns.
	 * @return callable(int): (string|false)
	 */
	private static function mime_type( $result ) {
		return static function () use ( $result ) {
			return $result;
		};
	}
}
