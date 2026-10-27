<?php
/**
 * The link to a station's player page.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\WP;

defined( 'ABSPATH' ) || exit;

/**
 * Links a player page only when it serves the clean player page (spec 0013, D6).
 *
 * @since 3.5.0
 */
final class Player_Page {

	/**
	 * The permalink of a player page that is served.
	 *
	 * A page is served when it is a published page without a password and,
	 * with a static front page, it is not the posts page, where is_page() is
	 * false (K27). This mirrors radplapag_output_clean_page().
	 *
	 * @since 3.5.0
	 *
	 * @param int $page_id Player page ID.
	 * @return string The permalink, or an empty string if the page is not served.
	 */
	public static function url( int $page_id ): string {
		if ( $page_id <= 0 ) {
			return '';
		}

		$page = get_post( $page_id );
		if ( ! $page || 'page' !== $page->post_type || 'publish' !== $page->post_status || '' !== $page->post_password ) {
			return '';
		}

		if ( 'page' === get_option( 'show_on_front' ) && (int) get_option( 'page_for_posts' ) === $page_id ) {
			return '';
		}

		return get_permalink( $page );
	}
}
