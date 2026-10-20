<?php
/**
 * Stations data: list of stations from CPT (used by blocks, player page, config).
 *
 * @package radio-player-page
 * @since 3.3.0
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/data/class-radplapag-station-config.php';

/**
 * Retrieves all stations from the radplapag_station CPT as an indexed array.
 *
 * Used by blocks (stationIndex), player page detection, and radplapag_get_config().
 * Order: menu_order, then title.
 *
 * @since 3.3.0
 * @since 3.5.0 Delegates to RadioPlayerPage\WP\Station_Repository::published_rows().
 *
 * @return array Indexed array of station configs: each with id, stream_url, player_page,
 *               station_title, background_id, logo_id, theme_color, visualizer, schedule.
 */
function radplapag_get_stations(): array {
	return \RadioPlayerPage\WP\Station_Repository::published_rows();
}

/**
 * Retrieves the plugin config (stations list from CPT).
 *
 * @since 3.3.0
 *
 * @return array Config array with key 'stations' (ordered list from radplapag_get_stations()).
 */
function radplapag_get_config(): array {
	return array( 'stations' => radplapag_get_stations() );
}
