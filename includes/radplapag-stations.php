<?php
defined( 'ABSPATH' ) || exit;

/**
 * Stations data: list of stations from CPT (used by blocks, player page, config).
 *
 * @package radio-player-page
 * @since 3.3.0
 */

/**
 * Retrieves all stations from the radplapag_station CPT as an indexed array.
 *
 * Used by blocks (stationIndex), player page detection, and radplapag_get_config().
 * Order: menu_order, then title.
 *
 * @since 3.3.0
 *
 * @return array Indexed array of station configs: each with id, stream_url, player_page,
 *               station_title, background_id, logo_id, theme_color, visualizer, schedule.
 */
function radplapag_get_stations() {
	$posts = get_posts( array(
		'post_type'      => 'radplapag_station',
		'post_status'    => 'publish',
		'posts_per_page' => -1,
		'orderby'        => 'menu_order title',
		'order'          => 'ASC',
	) );
	$out = array();
	foreach ( $posts as $post ) {
		$schedule_json = get_post_meta( $post->ID, 'radplapag_station_schedule', true );
		$schedule      = array();
		if ( is_string( $schedule_json ) && $schedule_json !== '' ) {
			$decoded = json_decode( $schedule_json, true );
			if ( is_array( $decoded ) ) {
				$schedule = $decoded;
			}
		}
		$theme = get_post_meta( $post->ID, 'radplapag_station_theme_color', true );
		$visualizer = get_post_meta( $post->ID, 'radplapag_station_visualizer', true );
		$valid_themes = array( 'neutral', 'blue', 'green', 'red', 'orange', 'yellow', 'purple', 'pink' );
		$valid_visualizers = array( 'oscilloscope', 'bars', 'particles', 'waterfall' );
		if ( ! is_string( $theme ) || ! in_array( $theme, $valid_themes, true ) ) {
			$theme = 'neutral';
		}
		if ( ! is_string( $visualizer ) || ! in_array( $visualizer, $valid_visualizers, true ) ) {
			$visualizer = 'oscilloscope';
		}
		$stream_url = get_post_meta( $post->ID, 'radplapag_station_stream_url', true );
		$out[] = array(
			'id'             => (int) $post->ID,
			'stream_url'     => is_string( $stream_url ) ? $stream_url : '',
			'player_page'    => (int) get_post_meta( $post->ID, 'radplapag_station_player_page', true ),
			'station_title'  => $post->post_title,
			'background_id'  => (int) get_post_meta( $post->ID, 'radplapag_station_background_id', true ),
			'logo_id'        => (int) get_post_meta( $post->ID, 'radplapag_station_logo_id', true ),
			'theme_color'    => $theme,
			'visualizer'     => $visualizer,
			'schedule'       => $schedule,
		);
	}
	return $out;
}

/**
 * Retrieves the plugin config (stations list from CPT).
 *
 * @since 3.3.0
 *
 * @return array Config array with key 'stations' (ordered list from radplapag_get_stations()).
 */
function radplapag_get_config() {
	return array( 'stations' => radplapag_get_stations() );
}
