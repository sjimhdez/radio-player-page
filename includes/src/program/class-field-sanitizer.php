<?php
/**
 * Program fields of the save, after the WordPress sanitizers.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\Program;

defined( 'ABSPATH' ) || exit;

/**
 * Applies the length limits and the logo check of radplapag_save_program_meta().
 *
 * @since 3.5.0
 */
final class Field_Sanitizer {

	/**
	 * Maximum length of the description, in characters.
	 */
	const DESCRIPTION_MAX_CHARS = 256;

	/**
	 * Maximum length of the extended description, in characters.
	 */
	const EXTENDED_DESCRIPTION_MAX_CHARS = 512;

	/**
	 * Sanitizes the program fields.
	 *
	 * The input comes from sanitize_text_field(), sanitize_textarea_field() and
	 * absint(); a missing key reads as a form posted without that field. The
	 * descriptions are cut by characters, never inside one (K5). A logo that is
	 * not an image goes to 0;
	 * the lookup runs only for an ID above 0.
	 *
	 * @since 3.5.0
	 *
	 * @param array<string, mixed> $input    Fields by key (description, extended_description, logo_id).
	 * @param callable(int): bool  $is_image Whether an attachment is an image (wp_attachment_is_image()).
	 * @return array{description: string, extended_description: string, logo_id: int}
	 */
	public static function sanitize( array $input, callable $is_image ): array {
		$logo_id = (int) ( $input['logo_id'] ?? 0 );
		if ( $logo_id > 0 && ! $is_image( $logo_id ) ) {
			$logo_id = 0;
		}

		return array(
			'description'          => self::truncate( $input['description'] ?? '', self::DESCRIPTION_MAX_CHARS ),
			'extended_description' => self::truncate( $input['extended_description'] ?? '', self::EXTENDED_DESCRIPTION_MAX_CHARS ),
			'logo_id'              => $logo_id,
		);
	}

	/**
	 * Returns the value cut to a number of characters, or '' if it is not a string.
	 *
	 * @since 3.5.0
	 *
	 * @param mixed $value     Sanitized value.
	 * @param int   $max_chars Maximum length in characters.
	 * @return string
	 */
	private static function truncate( $value, int $max_chars ): string {
		if ( ! is_string( $value ) ) {
			return '';
		}
		return mb_strlen( $value, 'UTF-8' ) > $max_chars ? mb_substr( $value, 0, $max_chars, 'UTF-8' ) : $value;
	}
}
