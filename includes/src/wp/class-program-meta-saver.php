<?php
/**
 * Program meta writes of the program edit form.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\WP;

use RadioPlayerPage\Program\Field_Sanitizer;

defined( 'ABSPATH' ) || exit;

/**
 * Sanitizes and writes the program fields of radplapag_save_program_meta(),
 * once its guards have passed and the form has been read.
 *
 * @since 3.5.0
 */
final class Program_Meta_Saver {

	/**
	 * Saves the program fields.
	 *
	 * Writes in the order of 3.4.2: description, extended description and logo.
	 * The descriptions are slashed, since update_post_meta() unslashes them (K34).
	 *
	 * @since 3.5.0
	 *
	 * @param int                  $post_id Program post ID.
	 * @param array<string, mixed> $input   Form fields by key: description and extended_description already through sanitize_text_field() and sanitize_textarea_field() (they are not idempotent, so they run once, where $_POST is read), and logo_id; a missing key reads as a form without that field.
	 * @return void
	 */
	public static function save( int $post_id, array $input ): void {
		$values = Field_Sanitizer::sanitize(
			array(
				'description'          => $input['description'] ?? '',
				'extended_description' => $input['extended_description'] ?? '',
				'logo_id'              => absint( $input['logo_id'] ?? 0 ),
			),
			'wp_attachment_is_image'
		);

		update_post_meta( $post_id, 'radplapag_program_description', wp_slash( $values['description'] ) );
		update_post_meta( $post_id, 'radplapag_program_extended_description', wp_slash( $values['extended_description'] ) );
		update_post_meta( $post_id, 'radplapag_program_logo_id', $values['logo_id'] );
	}
}
