<?php
/**
 * Station fields of the save, after the WordPress sanitizers.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\Station;

use RadioPlayerPage\Data\Station;

defined( 'ABSPATH' ) || exit;

/**
 * Applies the whitelists and the attachment checks of radplapag_save_station_meta()
 * and validates the required fields.
 *
 * Error codes, in the order of 3.4.2: stream_url_required, player_page_required
 * and player_page_taken; the adapter turns them into messages.
 *
 * @since 3.5.0
 */
final class Field_Sanitizer {

	/**
	 * Sanitizes and validates the station fields.
	 *
	 * The input comes from esc_url_raw( trim() ), absint() and sanitize_key();
	 * a missing key reads as a form posted without that field. Background and
	 * logo that are not images, and an intro that is not audio/mpeg, go to 0
	 * without an error (K37); the lookups run only for IDs above 0. The values
	 * are returned even when there are errors.
	 *
	 * @since 3.5.0
	 *
	 * @param array<string, mixed>          $input       Fields by key (stream_url, player_page, background_id, logo_id, intro_audio_id, theme_color, visualizer).
	 * @param callable(int): bool           $is_image    Whether an attachment is an image (wp_attachment_is_image()).
	 * @param callable(int): (string|false) $mime_type   MIME type of an attachment (get_post_mime_type()).
	 * @param array<mixed>                  $taken_pages Player pages assigned to other stations.
	 * @return array{values: array{stream_url: string, player_page: int, background_id: int, logo_id: int, intro_audio_id: int, theme_color: string, visualizer: string}, errors: list<string>}
	 */
	public static function sanitize( array $input, callable $is_image, callable $mime_type, array $taken_pages ): array {
		$stream_url     = $input['stream_url'] ?? '';
		$stream_url     = is_string( $stream_url ) ? $stream_url : '';
		$player_page    = (int) ( $input['player_page'] ?? 0 );
		$background_id  = (int) ( $input['background_id'] ?? 0 );
		$logo_id        = (int) ( $input['logo_id'] ?? 0 );
		$intro_audio_id = (int) ( $input['intro_audio_id'] ?? 0 );

		if ( $background_id > 0 && ! $is_image( $background_id ) ) {
			$background_id = 0;
		}
		if ( $logo_id > 0 && ! $is_image( $logo_id ) ) {
			$logo_id = 0;
		}
		if ( $intro_audio_id > 0 && 'audio/mpeg' !== $mime_type( $intro_audio_id ) ) {
			$intro_audio_id = 0;
		}

		$errors = array();
		if ( '' === $stream_url ) {
			$errors[] = 'stream_url_required';
		}
		if ( $player_page <= 0 ) {
			$errors[] = 'player_page_required';
		} elseif ( in_array( $player_page, $taken_pages, true ) ) {
			$errors[] = 'player_page_taken';
		}

		return array(
			'values' => array(
				'stream_url'     => $stream_url,
				'player_page'    => $player_page,
				'background_id'  => $background_id,
				'logo_id'        => $logo_id,
				'intro_audio_id' => $intro_audio_id,
				'theme_color'    => self::allowed( $input['theme_color'] ?? '', Station::THEMES ),
				'visualizer'     => self::allowed( $input['visualizer'] ?? '', Station::VISUALIZERS ),
			),
			'errors' => $errors,
		);
	}

	/**
	 * Returns the value if it is a whitelisted string, or the first allowed value.
	 *
	 * @since 3.5.0
	 *
	 * @param mixed         $value   Sanitized value.
	 * @param array<string> $allowed Whitelist; its first item is the default.
	 * @return string
	 */
	private static function allowed( $value, array $allowed ): string {
		return is_string( $value ) && in_array( $value, $allowed, true ) ? $value : $allowed[0];
	}
}
