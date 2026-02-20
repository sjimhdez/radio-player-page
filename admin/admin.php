<?php
defined( 'ABSPATH' ) || exit;

/**
 * Admin bootstrap: hooks and module loading.
 *
 * @package radio-player-page
 * @since 1.0.0
 */

/**
 * Enqueues styles and station script only on station/program CPT screens.
 *
 * station-admin.js loads only on radplapag_station (new/edit). program-admin.js
 * loads only on radplapag_program (see radplapag-program-cpt.php).
 *
 * @since 2.0.1
 * @since 3.3.0 Split: station-admin.js on station screen only; CSS on station + program.
 *
 * @param string $hook_suffix Current admin page (e.g. post-new.php, post.php).
 * @return void
 */
function radplapag_admin_scripts( $hook_suffix ) {
    $screen = get_current_screen();
    $is_station = $screen && isset( $screen->id ) && $screen->id === 'radplapag_station';
    $is_program = $screen && isset( $screen->id ) && $screen->id === 'radplapag_program';
    if ( ! $is_station && ! $is_program ) {
        return;
    }

    $admin_url = plugin_dir_url( __FILE__ );
    wp_enqueue_style(
        'radplapag-admin',
        $admin_url . 'css/admin.css',
        array(),
        '3.3.0'
    );

    if ( $is_station ) {
        wp_enqueue_media();
        wp_enqueue_script(
            'radplapag-station-admin',
            $admin_url . 'js/station-admin.js',
            array( 'jquery', 'media-editor' ),
            '3.3.0',
            true
        );
        wp_localize_script( 'radplapag-station-admin', 'radplapagAdmin', radplapag_get_admin_strings() );
    }
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
