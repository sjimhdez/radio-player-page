<?php
defined( 'ABSPATH' ) || exit;

/**
 * Admin bootstrap: hooks and module loading.
 *
 * @package radio-player-page
 * @since 1.0.0
 */

/**
 * Enqueues scripts and styles for the plugin admin (always).
 *
 * admin.js runs on every admin page; it only attaches behavior when the matching
 * container exists (station CPT or settings). Localized data sets stationCpt when
 * on post-new.php/post.php for radplapag_station.
 *
 * @since 2.0.1
 * @since 3.3.0 Enqueue always; stationCpt set by hook suffix and post type.
 *
 * @param string $hook_suffix Current admin page (e.g. post-new.php, post.php).
 * @return void
 */
function radplapag_admin_scripts( $hook_suffix ) {
    wp_enqueue_media();
    $admin_url = plugin_dir_url( __FILE__ );
    wp_enqueue_style(
        'radplapag-admin',
        $admin_url . 'css/admin.css',
        array(),
        '3.3.0'
    );
    wp_enqueue_script(
        'radplapag-admin',
        $admin_url . 'js/admin.js',
        array( 'jquery', 'media-editor' ),
        '3.3.0',
        true
    );
    $l10n = radplapag_get_admin_strings();
    $l10n['stationCpt'] = false;
    if ( $hook_suffix === 'post-new.php' && isset( $_GET['post_type'] ) && sanitize_key( wp_unslash( $_GET['post_type'] ) ) === 'radplapag_station' ) {
        $l10n['stationCpt'] = true;
    } elseif ( $hook_suffix === 'post.php' && isset( $_GET['post'] ) ) {
        $post_id = absint( $_GET['post'] );
        if ( $post_id > 0 && get_post_type( $post_id ) === 'radplapag_station' ) {
            $l10n['stationCpt'] = true;
        }
    }
    wp_localize_script( 'radplapag-admin', 'radplapagAdmin', $l10n );
}
add_action( 'admin_enqueue_scripts', 'radplapag_admin_scripts', 10, 1 );

/**
 * Adds the RPP top-level menu; Stations and Programs CPTs attach under it.
 *
 * Parent slug is 'radplapag'. WordPress replaces the parent link with the first submenu
 * (Stations list) so clicking RPP goes to the stations list. Duplicate first submenu
 * removed. Two submenus: Stations and Programs.
 *
 * @since 1.0.0
 * @since 3.3.0 RPP menu only; Settings → Radio Player Page removed (CPT-only).
 *
 * @return void
 */
function radplapag_admin_menu() {
    add_menu_page(
        __( 'Stations', 'radio-player-page' ),
        __( 'RPP', 'radio-player-page' ),
        'manage_options',
        'radplapag',
        'radplapag_menu_redirect_to_stations',
        'dashicons-microphone',
        30
    );
}
add_action( 'admin_menu', 'radplapag_admin_menu', 5 );

/**
 * Removes the duplicate first submenu "RPP" (admin.php?page=radplapag) so only Stations and Programs remain.
 *
 * Runs at priority 99 so it runs after CPTs have added their submenus under radplapag.
 *
 * @since 3.3.0
 * @return void
 */
function radplapag_remove_duplicate_rpp_submenu() {
    remove_submenu_page( 'radplapag', 'radplapag' );
}
add_action( 'admin_menu', 'radplapag_remove_duplicate_rpp_submenu', 99 );

/**
 * Redirects to the Stations list when opening admin.php?page=radplapag directly (e.g. bookmark).
 *
 * @since 3.3.0
 * @return void
 */
function radplapag_menu_redirect_to_stations() {
    wp_safe_redirect( admin_url( 'edit.php?post_type=radplapag_station' ) );
    exit;
}

$radplapag_admin_dir = plugin_dir_path( __FILE__ );
require_once $radplapag_admin_dir . 'admin-strings.php';
