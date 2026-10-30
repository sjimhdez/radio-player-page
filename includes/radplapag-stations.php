<?php
/**
 * Stations data: list of stations from CPT (used by blocks, player page, config).
 *
 * @package radio-player-page
 * @since 3.3.0
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/class-radplapag-station-config.php';

/**
 * Retrieves all stations from the radplapag_station CPT as an indexed array.
 *
 * Used by blocks (stationIndex), player page detection, and radplapag_get_config().
 * Order: menu_order, then title.
 *
 * @since 3.3.0
 * @since 3.5.0 Delegates to RadioPlayerPage\WP\Station_Repository::published_rows().
 * @since 3.5.0 Adds hide_title (ADR 0054).
 * @since 3.6.0 Adds show_song (ADR 0068).
 *
 * @return array<int, array{id: int, stream_url: string, player_page: int, station_title: string, hide_title: bool, show_song: bool, background_id: int, logo_id: int, intro_audio_id: int, theme_color: string, visualizer: string, schedule: array<mixed>}> Station configs, each with id, stream_url,
 *         player_page, station_title, hide_title, show_song, background_id, logo_id, intro_audio_id,
 *         theme_color, visualizer and schedule.
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
