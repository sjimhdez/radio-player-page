<?php
defined( 'ABSPATH' ) || exit;

/**
 * Plugin settings (shared between frontend and admin).
 *
 * @package radio-player-page
 * @since 1.0.0
 */

/**
 * Retrieves the plugin settings from the database.
 *
 * Returns the complete settings array containing all configured radio stations.
 * If no settings exist, returns an empty array with a 'stations' key.
 *
 * @since 1.0.0
 *
 * @return array Settings array with structure: ['stations' => [['stream_url' => string,
 *                     'player_page' => int, 'station_title' => string, 'background_id' => int,
 *                     'logo_id' => int, 'theme_color' => string, 'visualizer' => string,
 *                     'schedule' => array (optional, weekly schedule with programs by day)], ...]]
 */
function radplapag_get_settings() {
    return get_option( 'radplapag_settings', [ 'stations' => [] ] );
}
