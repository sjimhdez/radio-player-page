<?php
/**
 * Plugin Name: Radio Player Page
 * Description: Create a dedicated page for your Icecast, Shoutcast, or MP3 radio. Continuous playback without interruptions.
 * Version: 2.0.2
 * Author: Santiago Jiménez H.
 * Author URI: https://santiagojimenez.dev
 * Tags: audio, icecast, radio player, shoutcast, streaming
 * Requires at least: 5.0
 * Requires PHP: 5.6
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: radio-player-page
 */

defined( 'ABSPATH' ) || exit;

/**
 * Main plugin file.
 *
 * This file handles plugin initialization, activation hooks, and page rendering
 * for radio player pages. It serves standalone HTML pages for configured radio
 * stations without loading the full WordPress theme.
 *
 * @package radio-player-page
 * @since 1.2.0
 */

define( 'RADPLAPAG_DB_VERSION', '1.2.0' );

/**
 * Sets the initial database version option when the plugin is activated.
 *
 * This function runs during plugin activation and creates the database version
 * option to track the current schema version. This is used for migration
 * purposes when updating the plugin.
 *
 * @since 1.2.0
 *
 * @return void
 */
function radplapag_activate() {
    add_option( 'radplapag_db_version', RADPLAPAG_DB_VERSION );
}
register_activation_hook( __FILE__, 'radplapag_activate' );

require_once plugin_dir_path( __FILE__ ) . 'compatibility.php';
require_once plugin_dir_path( __FILE__ ) . 'admin-page.php';

/**
 * Retrieves the station configuration for the currently displayed page.
 *
 * Searches through all configured stations to find one that matches the current
 * page ID. Returns the complete station configuration array if a match is found,
 * including stream URL, page ID, title, theme color, visualizer type, and media IDs.
 *
 * @since 1.0.0
 *
 * @return array|false Station configuration array with keys: 'stream_url', 'player_page',
 *                     'station_title', 'background_id', 'logo_id', 'theme_color', 'visualizer'.
 *                     Returns false if no matching station is found for the current page.
 */
function radplapag_get_station_for_current_page() {
    $options = radplapag_get_settings();
    $current_page_id = get_queried_object_id();

    // New format: multiple streamings
    if ( isset( $options['stations'] ) && is_array( $options['stations'] ) ) {
        foreach ( $options['stations'] as $station ) {
            if (
                isset( $station['player_page'] ) &&
                isset( $station['stream_url'] ) &&
                intval( $station['player_page'] ) === $current_page_id &&
                ! empty( $station['stream_url'] )
            ) {
                return $station;
            }
        }
    }

    return false;
}

/**
 * Outputs a standalone HTML page for the radio player without loading WordPress theme.
 *
 * This function intercepts page requests and serves a minimal HTML page containing
 * the React-based radio player application. It reads the Vite manifest to determine
 * the correct asset paths, extracts station configuration, and outputs a complete
 * HTML document with all necessary scripts and styles.
 *
 * The function sets global JavaScript variables (window.STREAM_URL, window.SITE_TITLE,
 * etc.) that the React app uses for configuration. It intentionally bypasses WordPress's
 * enqueue system by outputting directly and calling exit() to prevent theme loading.
 *
 * @since 1.0.0
 *
 * @return void Exits execution after outputting HTML.
 */
function radplapag_output_clean_page() {
    if ( ! is_page() ) {
        return;
    }

    $station = radplapag_get_station_for_current_page();

    if ( ! $station ) {
        return;
    }

    $stream_url = $station['stream_url'];
    $station_title = isset( $station['station_title'] ) ? $station['station_title'] : '';
    $background_id = isset( $station['background_id'] ) ? intval( $station['background_id'] ) : 0;
    $logo_id = isset( $station['logo_id'] ) ? intval( $station['logo_id'] ) : 0;
    $theme_color = isset( $station['theme_color'] ) ? sanitize_key( $station['theme_color'] ) : 'neutral';
    $visualizer = isset( $station['visualizer'] ) ? sanitize_key( $station['visualizer'] ) : 'oscilloscope';
    
    // Validate visualizer against whitelist for security
    $valid_visualizers = [ 'oscilloscope', 'bars', 'particles', 'waterfall' ];
    if ( ! in_array( $visualizer, $valid_visualizers, true ) ) {
        $visualizer = 'oscilloscope';
    }

    $background_url = $background_id ? wp_get_attachment_image_url( $background_id, 'full' ) : '';
    $logo_url = $logo_id ? wp_get_attachment_image_url( $logo_id, 'full' ) : '';

    $manifest_path = plugin_dir_path( __FILE__ ) . 'player/dist/manifest.json';
    if ( ! file_exists( $manifest_path ) ) {
        wp_die( esc_html__( 'The player compilation file (manifest.json) could not be found.', 'radio-player-page' ) );
    }

    $manifest     = json_decode( file_get_contents( $manifest_path ), true );
    $main_entry   = isset( $manifest['src/main.tsx'] ) ? $manifest['src/main.tsx'] : null;
    $main_js      = isset( $main_entry['file'] ) ? $main_entry['file'] : null;
    $main_css     = isset( $main_entry['css'][0] ) ? $main_entry['css'][0] : null;

    if ( ! $main_js ) {
        wp_die( esc_html__( 'The main JS file was not found in the Vite manifest.', 'radio-player-page' ) );
    }

    $favicon_url = function_exists('get_site_icon_url') ? get_site_icon_url() : '';
    if (!$favicon_url && get_option('site_icon')) {
        $favicon_url = wp_get_attachment_image_url(get_option('site_icon'), 'full');
    }

    $dist_url   = plugin_dir_url( __FILE__ ) . 'player/dist/';
    
    // Determine the title to display
    $display_title = ! empty( $station_title ) ? $station_title : get_bloginfo( 'name' );

    echo '<!DOCTYPE html>';
    echo '<html lang="' . esc_html( get_bloginfo( 'language' ) ) . '">';
    echo '<head>';
    echo '<meta charset="utf-8">';
    echo '<meta name="viewport" content="width=device-width, initial-scale=1">';
    echo '<title>' . esc_html( $display_title ) . '</title>';
    if ($favicon_url) {
        echo '<link rel="icon" href="' . esc_url( $favicon_url ) . '" />';
    }
    echo '<script>window.STREAM_URL = "' . esc_js( $stream_url ) . '";</script>';
    echo '<script>window.SITE_TITLE = "' . esc_js( $display_title ) . '";</script>';
    echo '<script>window.BACKGROUND_IMAGE = "' . esc_js( $background_url ) . '";</script>';
    echo '<script>window.LOGO_IMAGE = "' . esc_js( $logo_url ) . '";</script>';
    echo '<script>window.THEME_COLOR = "' . esc_js( $theme_color ) . '";</script>';
    echo '<script>window.VISUALIZER = "' . esc_js( $visualizer ) . '";</script>';
    if ( $main_css ) {
        echo '<link rel="stylesheet" href="' . esc_url( $dist_url . $main_css ) . '">';
    }
    echo '</head>';
    echo '<body>';
    echo '<div id="root"></div>';
    echo '<script type="module" src="' . esc_url( $dist_url . $main_js ) . '"></script>';
    echo '</body>';
    echo '</html>';

    exit;
}
add_action( 'template_redirect', 'radplapag_output_clean_page' );
