<?php
/**
 * Program data built from raw post meta.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\Data;

defined( 'ABSPATH' ) || exit;

/**
 * The program data of radplapag_get_program_data().
 *
 * @since 3.5.0
 */
final class Program {

	/**
	 * Builds the program data of radplapag_get_program_data() from raw meta.
	 *
	 * Descriptions that are not strings read as ''; a falsy logo URL is null.
	 *
	 * @since 3.5.0
	 *
	 * @param string       $title       Program post title.
	 * @param mixed        $description Raw radplapag_program_description meta.
	 * @param mixed        $extended    Raw radplapag_program_extended_description meta.
	 * @param int          $logo_id     Logo attachment ID.
	 * @param string|false $logo_url    Logo URL from wp_get_attachment_image_url(), or false.
	 * @return array{name: string, description: string, extended_description: string, logo_id: int, logo_url: string|null}
	 */
	public static function data( string $title, $description, $extended, int $logo_id, $logo_url ): array {
		return array(
			'name'                 => $title,
			'description'          => is_string( $description ) ? $description : '',
			'extended_description' => is_string( $extended ) ? $extended : '',
			'logo_id'              => $logo_id,
			'logo_url'             => $logo_url ? $logo_url : null,
		);
	}
}
