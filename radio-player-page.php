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
 * This file handles plugin initialization and page rendering for radio player pages.
 * It serves standalone HTML pages for configured radio stations without loading
 * the full WordPress theme.
 *
 * @package radio-player-page
 * @since 1.2.0
 */

require_once plugin_dir_path( __FILE__ ) . 'includes/radplapag-settings.php';

if ( is_admin() ) {
    require_once plugin_dir_path( __FILE__ ) . 'admin/admin.php';
}

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
 * The function sets global JavaScript variables for the React app:
 * - window.RADPLAPAG_CONFIG: stream URL, site title, theme, visualizer, media URLs, timezone (no schedule).
 * - window.RADPLAPAG_PROGRAMS: array of { id, name, logoUrl } for relational resolution.
 * - window.RADPLAPAG_SCHEDULE: weekly schedule as { day: [ { program_id (string ID), start, end }, ... ] } (relational).
 * The React app resolves program name/logo from RADPLAPAG_PROGRAMS by matching program_id (unique string ID) to avoid duplicating data.
 *
 * It intentionally bypasses WordPress's enqueue system by outputting directly and
 * calling exit() to prevent theme loading.
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
    
    // Validate theme color against whitelist for security
    $valid_themes = [ 'neutral', 'blue', 'green', 'red', 'orange', 'yellow', 'purple', 'pink' ];
    if ( ! in_array( $theme_color, $valid_themes, true ) ) {
        $theme_color = 'neutral';
    }
    
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

    // Meta description (SEO + social fallback)
    /* translators: %s: station or page title for meta description */
    $meta_description = sprintf( __( 'Listen to %s live streaming radio', 'radio-player-page' ), $display_title );
    echo '<meta name="description" content="' . esc_attr( $meta_description ) . '">';

    // Open Graph
    echo '<meta property="og:title" content="' . esc_attr( $display_title ) . '">';
    echo '<meta property="og:description" content="' . esc_attr( $meta_description ) . '">';
    echo '<meta property="og:url" content="' . esc_url( get_permalink( get_queried_object_id() ) ) . '">';
    echo '<meta property="og:type" content="website">';
    echo '<meta property="og:site_name" content="' . esc_attr( get_bloginfo( 'name' ) ) . '">';
    echo '<meta property="og:locale" content="' . esc_attr( str_replace( '-', '_', get_bloginfo( 'language' ) ) ) . '">';

    // Social image: logo first, then background, then favicon
    $social_image_url = $logo_url ? $logo_url : ( $background_url ? $background_url : ( $favicon_url ? $favicon_url : '' ) );
    if ( $social_image_url ) {
        echo '<meta property="og:image" content="' . esc_url( $social_image_url ) . '">';
        echo '<meta name="twitter:card" content="summary_large_image">';
        echo '<meta name="twitter:image" content="' . esc_url( $social_image_url ) . '">';
    } else {
        echo '<meta name="twitter:card" content="summary">';
    }

    // Twitter Card (title and description shared with OG)
    echo '<meta name="twitter:title" content="' . esc_attr( $display_title ) . '">';
    echo '<meta name="twitter:description" content="' . esc_attr( $meta_description ) . '">';
    
    // Get WordPress timezone object and calculate numeric offset
    // This ensures we always have a numeric value (handles DST automatically)
    $timezone_obj = wp_timezone();
    
    // Calculate current offset in hours (numeric, handles DST)
    // getOffset() returns seconds, convert to hours
    $now = new DateTime();
    $offset_seconds = $timezone_obj->getOffset( $now );
    $timezone_offset = $offset_seconds / 3600; // Convert to hours (float)
    
    // Build configuration object (no schedule or programs; those are passed separately)
    $config = [
        'streamUrl' => $stream_url,
        'siteTitle' => $display_title,
        'backgroundImage' => $background_url ? $background_url : null,
        'logoImage' => $logo_url ? $logo_url : null,
        'themeColor' => $theme_color,
        'visualizer' => $visualizer,
        'timezoneOffset' => $timezone_offset, // Numeric offset in hours from UTC
    ];

    // Programs list: id + name + logoUrl (relational, no duplication in schedule)
    $programs_for_player = [];
    if ( isset( $station['programs'] ) && is_array( $station['programs'] ) ) {
        foreach ( $station['programs'] as $prog ) {
            $prog_id = isset( $prog['id'] ) ? sanitize_text_field( $prog['id'] ) : '';
            $name = isset( $prog['name'] ) ? $prog['name'] : '';
            $prog_logo_id = isset( $prog['logo_id'] ) ? intval( $prog['logo_id'] ) : 0;
            $prog_logo_url = ( $prog_logo_id > 0 ) ? wp_get_attachment_image_url( $prog_logo_id, 'full' ) : '';
            // Generate ID if missing (should not happen after sanitization, but safety check)
            if ( empty( $prog_id ) ) {
                $prog_id = 'prog_' . wp_generate_password( 12, false );
            }
            $programs_for_player[] = [
                'id'      => $prog_id,
                'name'    => $name,
                'logoUrl' => $prog_logo_url ? $prog_logo_url : null,
            ];
        }
    }

    // Schedule: relational entries (program_id, start, end) — resolve name/logo in React via programs
    $schedule_for_player = [];
    if ( isset( $station['schedule'] ) && is_array( $station['schedule'] ) && ! empty( $station['schedule'] ) ) {
        foreach ( $station['schedule'] as $day => $day_programs ) {
            if ( ! is_array( $day_programs ) ) {
                continue;
            }
            $day_entries = [];
            foreach ( $day_programs as $entry ) {
                if ( ! is_array( $entry ) ) {
                    continue;
                }
                $program_id = isset( $entry['program_id'] ) ? sanitize_text_field( $entry['program_id'] ) : '';
                $start = isset( $entry['start'] ) ? $entry['start'] : '';
                $end = isset( $entry['end'] ) ? $entry['end'] : '';
                if ( empty( $program_id ) || empty( $start ) || empty( $end ) ) {
                    continue;
                }
                $day_entries[] = [
                    'program_id' => $program_id,
                    'start'      => $start,
                    'end'        => $end,
                ];
            }
            if ( ! empty( $day_entries ) ) {
                $schedule_for_player[ $day ] = $day_entries;
            }
        }
    }

    $json_flags = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT;
    echo '<script>';
    echo 'window.RADPLAPAG_CONFIG = ' . wp_json_encode( $config, $json_flags ) . ';';
    echo 'window.RADPLAPAG_PROGRAMS = ' . wp_json_encode( $programs_for_player, $json_flags ) . ';';
    echo 'window.RADPLAPAG_SCHEDULE = ' . wp_json_encode( $schedule_for_player, $json_flags ) . ';';
    echo '</script>';
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
