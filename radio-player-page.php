<?php
/**
 * Plugin Name: Radio Player Page
 * Description: A simple audio player for WordPress, serving a clean external app in a selected page.
 * Version: 1.0.1
 * Author: Santiago Jiménez H.
 * Author URI: https://santiagojimenez.dev
 * Tags: audio, streaming, radio, player, icecast, shoutcast
 * Requires at least: 5.0
 * Requires PHP: 7.4
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: radio-player-page
 */

defined( 'ABSPATH' ) || exit;

require_once plugin_dir_path( __FILE__ ) . 'admin-page.php';

/**
 * Serves the player app from a specific page, without visually loading WordPress.
 *
 * Enqueue functions are intentionally not used.
 * This plugin outputs a standalone HTML page and exits before WordPress can run enqueued assets.
 */
function radplapag_output_clean_page() {
    $options = get_option( 'radplapag_settings' );

    if (
        ! is_array( $options ) ||
        empty( $options['player_page'] ) ||
        empty( $options['stream_url'] ) ||
        ! is_page( intval( $options['player_page'] ) )
    ) {
        return;
    }

    $manifest_path = plugin_dir_path( __FILE__ ) . 'player/dist/manifest.json';
    if ( ! file_exists( $manifest_path ) ) {
        wp_die( __( 'The player compilation file (manifest.json) could not be found.', 'radio-player-page' ) );
    }

    $manifest     = json_decode( file_get_contents( $manifest_path ), true );
    $main_entry   = $manifest['src/main.tsx'] ?? null;
    $main_js      = $main_entry['file'] ?? null;
    $main_css     = $main_entry['css'][0] ?? null;

    if ( ! $main_js ) {
        wp_die( __( 'The main JS file was not found in the Vite manifest.', 'radio-player-page' ) );
    }

    $dist_url   = plugin_dir_url( __FILE__ ) . 'player/dist/';
    $stream_url = esc_url( $options['stream_url'] );

    echo '<!DOCTYPE html>';
    echo '<html lang="es">';
    echo '<head>';
    echo '<meta charset="utf-8">';
    echo '<meta name="viewport" content="width=device-width, initial-scale=1">';
    echo '<title>' . esc_html__( 'Radio Player Page', 'radio-player-page' ) . '</title>';
    echo '<script>window.STREAM_URL = "' . esc_js( $stream_url ) . '";</script>';
    echo '<script>window.SITE_TITLE = "' . esc_js( get_bloginfo( 'name' ) ) . '";</script>';
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
