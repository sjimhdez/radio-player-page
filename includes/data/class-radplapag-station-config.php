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
	private $post;

	/**
	 * Creates an instance from a station post.
	 *
	 * @since 3.3.0
	 * @param WP_Post $post Post object (radplapag_station).
	 */
	private function __construct( $post ) {
		$this->post = $post;
	}

	/**
	 * Builds a config object from a post, or null if invalid.
	 *
	 * @since 3.3.0
	 * @param WP_Post|null $post Post object.
	 * @return Radplapag_Station_Config|null
	 */
	public static function from_post( $post ) {
		if ( ! $post instanceof WP_Post || $post->post_type !== 'radplapag_station' ) {
			return null;
		}
		return new self( $post );
	}

	/**
	 * Returns the station row as an associative array (legacy shape for blocks and player).
	 *
	 * @since 3.3.0
	 * @return array Keys: id, stream_url, player_page, station_title, background_id, logo_id, theme_color, visualizer, schedule.
	 */
	public function to_array() {
		$post_id = (int) $this->post->ID;

		$schedule_json = get_post_meta( $post_id, 'radplapag_station_schedule', true );
		$schedule      = array();
		if ( is_string( $schedule_json ) && $schedule_json !== '' ) {
			$decoded = json_decode( $schedule_json, true );
			if ( is_array( $decoded ) ) {
				$schedule = $decoded;
			}
		}

		$theme             = get_post_meta( $post_id, 'radplapag_station_theme_color', true );
		$visualizer        = get_post_meta( $post_id, 'radplapag_station_visualizer', true );
		$valid_themes      = array( 'neutral', 'blue', 'green', 'red', 'orange', 'yellow', 'purple', 'pink' );
		$valid_visualizers = array( 'oscilloscope', 'bars', 'particles', 'waterfall' );
		if ( ! is_string( $theme ) || ! in_array( $theme, $valid_themes, true ) ) {
			$theme = 'neutral';
		}
		if ( ! is_string( $visualizer ) || ! in_array( $visualizer, $valid_visualizers, true ) ) {
			$visualizer = 'oscilloscope';
		}

		$stream_url = get_post_meta( $post_id, 'radplapag_station_stream_url', true );

		return array(
			'id'              => $post_id,
			'stream_url'      => is_string( $stream_url ) ? $stream_url : '',
			'player_page'     => (int) get_post_meta( $post_id, 'radplapag_station_player_page', true ),
			'station_title'   => $this->post->post_title,
			'background_id'   => (int) get_post_meta( $post_id, 'radplapag_station_background_id', true ),
			'logo_id'         => (int) get_post_meta( $post_id, 'radplapag_station_logo_id', true ),
			'theme_color'     => $theme,
			'visualizer'      => $visualizer,
			'schedule'        => $schedule,
		);
	}
}
