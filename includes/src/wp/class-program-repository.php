<?php
/**
 * Program reads from the radplapag_program CPT.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\WP;

use RadioPlayerPage\Data\Program;

defined( 'ABSPATH' ) || exit;

/**
 * Reads program posts and meta, and hands them to RadioPlayerPage\Data.
 *
 * @since 3.5.0
 */
final class Program_Repository {

	/**
	 * Returns the program data of a program post.
	 *
	 * @since 3.5.0
	 *
	 * @param int  $post_id           Post ID of radplapag_program.
	 * @param bool $require_published Whether to require published status.
	 * @return array{name: string, description: string, extended_description: string, logo_id: int, logo_url: string|null}|null Null if the ID is not positive, the post is missing or of another type, or it is not published and publication is required.
	 */
	public static function data( int $post_id, bool $require_published ): ?array {
		if ( $post_id <= 0 ) {
			return null;
		}
		$post = get_post( $post_id );
		if ( ! $post || 'radplapag_program' !== $post->post_type ) {
			return null;
		}
		if ( $require_published && 'publish' !== $post->post_status ) {
			return null;
		}
		$description = get_post_meta( $post_id, 'radplapag_program_description', true );
		$extended    = get_post_meta( $post_id, 'radplapag_program_extended_description', true );
		$logo_id     = (int) get_post_meta( $post_id, 'radplapag_program_logo_id', true );
		$logo_url    = $logo_id > 0 ? wp_get_attachment_image_url( $logo_id, 'full' ) : false;

		return Program::data( $post->post_title, $description, $extended, $logo_id, $logo_url );
	}
}
