<?php
/**
 * Station configuration value object built from a radplapag_station post.
 *
 * @package radio-player-page
 * @since 3.3.0
 */

defined( 'ABSPATH' ) || exit;

/**
 * Represents one published station for use in radplapag_get_stations() output.
 *
 * @since 3.3.0
 */
class Radplapag_Station_Config {

	/**
	 * Station post object.
	 *
	 * @var WP_Post
	 */
	private WP_Post $post;

	/**
	 * Creates an instance from a station post.
	 *
	 * @since 3.3.0
	 * @param WP_Post $post Post object (radplapag_station).
	 */
	private function __construct( WP_Post $post ) {
		$this->post = $post;
	}

	/**
	 * Builds a config object from a post, or null if invalid.
	 *
	 * @since 3.3.0
	 * @param WP_Post|null $post Post object.
	 * @return Radplapag_Station_Config|null
	 */
	public static function from_post( $post ): ?Radplapag_Station_Config {
		if ( ! $post instanceof WP_Post || 'radplapag_station' !== $post->post_type ) {
			return null;
		}
		return new self( $post );
	}

	/**
	 * Returns the station row as an associative array (legacy shape for blocks and player).
	 *
	 * @since 3.3.0
	 * @since 3.5.0 Delegates to RadioPlayerPage\WP\Station_Repository::row(); adds hide_title (ADR 0054).
	 * @return array Keys: id, stream_url, player_page, station_title, hide_title, background_id, logo_id, intro_audio_id, theme_color, visualizer, schedule.
	 */
	public function to_array(): array {
		return \RadioPlayerPage\WP\Station_Repository::row( $this->post );
	}
}
