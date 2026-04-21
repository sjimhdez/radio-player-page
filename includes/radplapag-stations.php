<?php
defined( 'ABSPATH' ) || exit;

require_once dirname( __FILE__ ) . '/data/class-radplapag-station-config.php';

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
		$config = Radplapag_Station_Config::from_post( $post );
		if ( $config ) {
			$out[] = $config->to_array();
		}
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
