<?php
defined( 'ABSPATH' ) || exit;

/**
 * Admin bootstrap: hooks and module loading.
 *
 * @package radio-player-page
 * @since 1.0.0
 */

/**
 * Registers the plugin settings with WordPress Settings API.
 *
 * @since 1.0.0
 *
 * @return void
 */
function radplapag_register_settings() {
    register_setting(
        'radplapag_settings_group',
        'radplapag_settings',
        [
            'sanitize_callback' => 'radplapag_sanitize_settings',
        ]
    );
}
add_action( 'admin_init', 'radplapag_register_settings' );

/**
 * Enqueues scripts and styles for the plugin admin page.
 *
 * Loads WordPress media uploader, plugin admin CSS/JS and localized strings
 * only on the plugin's settings page.
 *
 * @since 2.0.1
 *
 * @return void
 */
function radplapag_admin_scripts() {
    $screen = get_current_screen();
    if ( ! $screen || 'settings_page_radplapag' !== $screen->id ) {
        return;
    }
    wp_enqueue_media();
    $admin_url = plugin_dir_url( __FILE__ );
    wp_enqueue_style(
        'radplapag-admin',
        $admin_url . 'css/admin.css',
        [],
        '2.0.3'
    );
    wp_enqueue_script(
        'radplapag-admin',
        $admin_url . 'js/admin.js',
        [],
        '2.0.3',
        true
    );
    wp_localize_script( 'radplapag-admin', 'radplapagAdmin', radplapag_get_admin_strings() );
}
add_action( 'admin_enqueue_scripts', 'radplapag_admin_scripts' );

/**
 * Adds the plugin settings page to the WordPress Settings menu.
 *
 * @since 1.0.0
 *
 * @return void
 */
function radplapag_settings_menu() {
    add_options_page(
        __( 'Radio Player Page Settings', 'radio-player-page' ),
        __( 'Radio Player Page Settings', 'radio-player-page' ),
        'manage_options',
        'radplapag',
        'radplapag_render_settings_page'
    );
}
add_action( 'admin_menu', 'radplapag_settings_menu' );

$radplapag_admin_dir = plugin_dir_path( __FILE__ );
require_once $radplapag_admin_dir . 'sanitize-settings.php';
require_once $radplapag_admin_dir . 'settings-page.php';
