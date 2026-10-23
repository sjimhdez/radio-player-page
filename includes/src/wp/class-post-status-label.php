<?php
/**
 * The label of a post status in the admin selects.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\WP;

defined( 'ABSPATH' ) || exit;

/**
 * Names a post status for the "Title (Status)" options of the program and page selects.
 *
 * @since 3.5.0
 */
final class Post_Status_Label {

	/**
	 * The translated label of a post status.
	 *
	 * @since 3.5.0
	 *
	 * @param string $status Post status, such as draft or trash.
	 * @return string The label, or the status itself if it is not a known one.
	 */
	public static function of( string $status ): string {
		$labels = array(
			'draft'   => __( 'Draft', 'radio-player-page' ),
			'pending' => __( 'Pending', 'radio-player-page' ),
			'future'  => __( 'Scheduled', 'radio-player-page' ),
			'private' => __( 'Private', 'radio-player-page' ),
			'trash'   => __( 'Trash', 'radio-player-page' ),
		);

		return $labels[ $status ] ?? $status;
	}
}
