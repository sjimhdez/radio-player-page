<?php
/**
 * Program reads from the radplapag_program CPT.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\WP;

use RadioPlayerPage\Data\Program;
use RadioPlayerPage\Schedule\Schedule_View;

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
	 * @since 3.5.0 A password-protected program is not published (K88, ADR 0045).
	 *
	 * @param int  $post_id           Post ID of radplapag_program.
	 * @param bool $require_published Whether to require a public program: published and without password.
	 * @return array{name: string, description: string, extended_description: string, logo_id: int, logo_url: string|null}|null Null if the ID is not positive, the post is missing or of another type, or it is not public and publication is required.
	 */
	public static function data( int $post_id, bool $require_published ): ?array {
		if ( $post_id <= 0 ) {
			return null;
		}
		$post = get_post( $post_id );
		if ( ! $post || 'radplapag_program' !== $post->post_type ) {
			return null;
		}
		if ( $require_published && ( 'publish' !== $post->post_status || '' !== $post->post_password ) ) {
			return null;
		}
		$description = get_post_meta( $post_id, 'radplapag_program_description', true );
		$extended    = get_post_meta( $post_id, 'radplapag_program_extended_description', true );
		$logo_id     = (int) get_post_meta( $post_id, 'radplapag_program_logo_id', true );
		$logo_url    = $logo_id > 0 ? wp_get_attachment_image_url( $logo_id, 'full' ) : false;

		return Program::data( $post->post_title, $description, $extended, $logo_id, $logo_url );
	}

	/**
	 * Returns the public programs of a schedule (ADR 0045): published and without password.
	 *
	 * The public entry points pass their keys to RadioPlayerPage\Schedule\Public_Slots::filter()
	 * before resolving.
	 *
	 * @since 3.5.0
	 *
	 * @param array<mixed> $schedule Stored schedule: day => [ [ program_id, start, end, is_rerun ], ... ].
	 * @return array<int, array{name: string, description: string, extended_description: string, logo_id: int, logo_url: string|null}> Post ID => program data, in the order the programs first appear.
	 */
	public static function public_programs( array $schedule ): array {
		$programs = array();
		foreach ( Schedule_View::program_ids( $schedule ) as $post_id ) {
			$data = self::data( $post_id, true );
			if ( null !== $data ) {
				$programs[ $post_id ] = $data;
			}
		}

		return $programs;
	}
}
