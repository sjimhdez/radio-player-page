<?php
/**
 * Plugin Name: Radio Player Page
 * Description: Create dedicated listening pages for your radio stations with integrated radio schedules and reliable playback.
 * Version: 3.4.2
 * Author: Santiago Jiménez H.
 * Author URI: https://santiagojimenez.dev
 * Tags: radio player, radio station, radio, icecast, shoutcast
 * Requires at least: 6.6
 * Requires PHP: 7.4
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: radio-player-page
 *
 * @package radio-player-page
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'RADPLAPAG_PLUGIN_FILE' ) ) {
	define( 'RADPLAPAG_PLUGIN_FILE', __FILE__ );
}

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

require_once plugin_dir_path( __FILE__ ) . 'includes/src/class-autoloader.php';
RadioPlayerPage\Autoloader::register();

require_once plugin_dir_path( __FILE__ ) . 'includes/radplapag-stations.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/radplapag-station-cpt.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/radplapag-program-cpt.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/data/class-radplapag-program-config.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/radplapag-upgrade.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/radplapag-schedule-block.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/radplapag-programs-list-block.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/radplapag-now-playing-block.php';
require_once plugin_dir_path( __FILE__ ) . 'blocks/schedule/render.php';
require_once plugin_dir_path( __FILE__ ) . 'blocks/programs-list/render.php';

if ( is_admin() ) {
	require_once plugin_dir_path( __FILE__ ) . 'admin/admin.php';
}

/**
 * Maps meta capabilities for station/program CPTs to manage_options so admins can create, edit, delete, and move to draft.
 *
 * @since 3.3.0
 * @param array  $caps    Required capabilities (returned by map_meta_cap).
 * @param string $cap     Meta capability being checked (e.g. edit_post, delete_post).
 * @param int    $user_id User ID.
 * @param array  $args    Optional args; [0] is the post (ID or WP_Post) for post meta caps.
 * @return array Mapped capabilities.
 */
function radplapag_map_cpt_meta_cap( array $caps, string $cap, int $user_id, array $args ): array {
	$post_meta_caps = array( 'edit_post', 'delete_post', 'read_post', 'publish_post' );
	if ( ! in_array( $cap, $post_meta_caps, true ) ) {
		return $caps;
	}
	// Without a post, get_post() would fall back to the global post.
	$post = empty( $args[0] ) ? null : get_post( $args[0] );
	if ( ! $post ) {
		return $caps;
	}
	$post_type = $post->post_type;
	if ( 'radplapag_station' !== $post_type && 'radplapag_program' !== $post_type ) {
		return $caps;
	}
	return array( 'manage_options' );
}
add_filter( 'map_meta_cap', 'radplapag_map_cpt_meta_cap', 10, 4 );

add_action( 'init', 'radplapag_register_schedule_block' );
add_action( 'init', 'radplapag_register_programs_list_block' );
add_action( 'init', 'radplapag_register_now_playing_block' );
add_action( 'enqueue_block_editor_assets', 'radplapag_enqueue_schedule_block_editor_assets' );
add_action( 'enqueue_block_editor_assets', 'radplapag_enqueue_programs_list_block_editor_assets' );
add_action( 'enqueue_block_editor_assets', 'radplapag_enqueue_now_playing_block_editor_assets' );

/**
 * Registers the Radio Schedule WordPress block.
 *
 * @since 3.3.0
 */
function radplapag_register_schedule_block() {
	register_block_type(
		plugin_dir_path( __FILE__ ) . 'blocks/schedule',
		array(
			'render_callback' => 'radplapag_render_schedule_block',
		)
	);
}

/**
 * Enqueues the Radio Schedule block editor script and localizes station list.
 *
 * @since 3.3.0
 */
function radplapag_enqueue_schedule_block_editor_assets() {
	$handle = 'radplapag-schedule-editor-script';
	if ( ! wp_script_is( $handle, 'registered' ) ) {
		return;
	}
	$config         = radplapag_get_config();
	$stations       = is_array( $config['stations'] ?? null ) ? $config['stations'] : array();
	$station_labels = array();
	foreach ( $stations as $index => $station ) {
		$title            = (string) ( $station['station_title'] ?? '' );
		$station_labels[] = array(
			'label' => '' !== $title ? $title : ( __( 'Radio Station', 'radio-player-page' ) . ' ' . ( $index + 1 ) ),
		);
	}
	wp_localize_script( $handle, 'radplapagScheduleBlock', array( 'stations' => $station_labels ) );
}

/**
 * Registers the Programs List WordPress block.
 *
 * @since 3.3.0
 */
function radplapag_register_programs_list_block() {
	register_block_type(
		plugin_dir_path( __FILE__ ) . 'blocks/programs-list',
		array(
			'render_callback' => 'radplapag_render_programs_list_block',
		)
	);
}

/**
 * Enqueues the Programs List block editor script and localizes station list.
 *
 * @since 3.3.0
 */
function radplapag_enqueue_programs_list_block_editor_assets() {
	$handle = 'radplapag-programs-list-editor-script';
	if ( ! wp_script_is( $handle, 'registered' ) ) {
		return;
	}
	$config         = radplapag_get_config();
	$stations       = is_array( $config['stations'] ?? null ) ? $config['stations'] : array();
	$station_labels = array();
	foreach ( $stations as $index => $station ) {
		$title            = (string) ( $station['station_title'] ?? '' );
		$station_labels[] = array(
			'label' => '' !== $title ? $title : ( __( 'Radio Station', 'radio-player-page' ) . ' ' . ( $index + 1 ) ),
		);
	}
	wp_localize_script( $handle, 'radplapagProgramsListBlock', array( 'stations' => $station_labels ) );
}

/**
 * Registers the Now Playing WordPress block.
 *
 * Server rendering is wired via the "render" key in blocks/now-playing/block.json, so no
 * render_callback is passed here.
 *
 * @since 3.4.0
 */
function radplapag_register_now_playing_block() {
	register_block_type( plugin_dir_path( __FILE__ ) . 'blocks/now-playing' );
}

/**
 * Enqueues the Now Playing block editor script and localizes station list.
 *
 * @since 3.4.0
 */
function radplapag_enqueue_now_playing_block_editor_assets() {
	$handle = 'radplapag-now-playing-editor-script';
	if ( ! wp_script_is( $handle, 'registered' ) ) {
		return;
	}
	$config         = radplapag_get_config();
	$stations       = is_array( $config['stations'] ?? null ) ? $config['stations'] : array();
	$station_labels = array();
	foreach ( $stations as $index => $station ) {
		$title            = (string) ( $station['station_title'] ?? '' );
		$station_labels[] = array(
			'label' => '' !== $title ? $title : ( __( 'Radio Station', 'radio-player-page' ) . ' ' . ( $index + 1 ) ),
		);
	}
	wp_localize_script( $handle, 'radplapagNowPlayingBlock', array( 'stations' => $station_labels ) );
}

/**
 * Retrieves the station configuration for the currently displayed page.
 *
 * Searches through all configured stations to find one that matches the current
 * page ID. Returns the complete station configuration array if a match is found,
 * including stream URL, page ID, title, theme color, visualizer type, and media IDs.
 *
 * @since 1.0.0
 * @since 3.5.0 Delegates to RadioPlayerPage\Data\Stations::for_page().
 * @since 3.5.0 Returns false when the request is not a page (K24).
 *
 * @return array|false Station configuration array with keys: 'stream_url', 'player_page',
 *                     'station_title', 'background_id', 'logo_id', 'theme_color', 'visualizer'.
 *                     Returns false if no matching station is found for the current page.
 */
function radplapag_get_station_for_current_page() {
	if ( ! is_page() ) {
		return false;
	}

	return \RadioPlayerPage\Data\Stations::for_page( radplapag_get_config()['stations'], get_queried_object_id() );
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
 * - window.RADPLAPAG_SCHEDULE: weekly schedule as { day: [ { program_id (string ID), start, end, is_rerun }, ... ] } (relational).
 * The React app resolves program name/logo from RADPLAPAG_PROGRAMS by matching program_id (unique string ID) to avoid duplicating data.
 *
 * It intentionally bypasses WordPress's enqueue system by outputting directly and
 * calling exit() to prevent theme loading.
 *
 * @since 1.0.0
 * @since 3.5.0 Delegates the three globals to RadioPlayerPage\Player\Globals_Builder, with the time of RadioPlayerPage\WP\Clock.
 *
 * @return void Exits execution after outputting HTML.
 */
function radplapag_output_clean_page() {
	if ( ! is_page() || is_feed() || is_embed() || is_trackback() ) {
		return;
	}

	$page_id = get_queried_object_id();
	if ( $page_id <= 0 ) {
		return;
	}

	$page = get_post( $page_id );
	if ( ! $page || 'page' !== $page->post_type ) {
		return;
	}
	if ( 'publish' !== $page->post_status || post_password_required( $page ) ) {
		return;
	}

	$station = radplapag_get_station_for_current_page();

	if ( ! $station ) {
		return;
	}

	$background_id  = isset( $station['background_id'] ) ? intval( $station['background_id'] ) : 0;
	$logo_id        = isset( $station['logo_id'] ) ? intval( $station['logo_id'] ) : 0;
	$intro_audio_id = isset( $station['intro_audio_id'] ) ? intval( $station['intro_audio_id'] ) : 0;

	$background_url  = $background_id ? wp_get_attachment_image_url( $background_id, 'full' ) : '';
	$logo_url        = $logo_id ? wp_get_attachment_image_url( $logo_id, 'full' ) : '';
	$intro_audio_url = $intro_audio_id ? wp_get_attachment_url( $intro_audio_id ) : '';

	$config = \RadioPlayerPage\Player\Globals_Builder::config(
		$station,
		array(
			'background_url'  => $background_url,
			'logo_url'        => $logo_url,
			'intro_audio_url' => $intro_audio_url,
		),
		get_bloginfo( 'name' ),
		\RadioPlayerPage\WP\Clock::now(),
		'sanitize_key'
	);

	$manifest_path = plugin_dir_path( __FILE__ ) . 'player/dist/manifest.json';
	if ( ! file_exists( $manifest_path ) ) {
		wp_die( esc_html__( 'The player compilation file (manifest.json) could not be found.', 'radio-player-page' ) );
	}

	$manifest   = json_decode( file_get_contents( $manifest_path ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file inside the plugin, not a remote URL.
	$main_entry = isset( $manifest['src/main.tsx'] ) ? $manifest['src/main.tsx'] : null;
	$main_js    = isset( $main_entry['file'] ) ? $main_entry['file'] : null;
	$main_css   = isset( $main_entry['css'][0] ) ? $main_entry['css'][0] : null;

	if ( ! $main_js ) {
		wp_die( esc_html__( 'The main JS file was not found in the Vite manifest.', 'radio-player-page' ) );
	}

	$favicon_url = function_exists( 'get_site_icon_url' ) ? get_site_icon_url() : '';
	if ( ! $favicon_url && get_option( 'site_icon' ) ) {
		$favicon_url = wp_get_attachment_image_url( get_option( 'site_icon' ), 'full' );
	}

	$dist_url = plugin_dir_url( __FILE__ ) . 'player/dist/';

	$display_title = $config['siteTitle'];

	echo '<!DOCTYPE html>';
	echo '<html lang="' . esc_html( get_bloginfo( 'language' ) ) . '"' . ( is_rtl() ? ' dir="rtl"' : '' ) . '>';
	echo '<head>';
	echo '<meta charset="utf-8">';
	echo '<meta name="viewport" content="width=device-width, initial-scale=1">';
	// Printed directly, without wp_robots() or its filter (ADR 0043).
	if ( '0' === (string) get_option( 'blog_public' ) ) {
		echo '<meta name="robots" content="noindex, nofollow">';
	}
	echo '<title>' . esc_html( $display_title ) . '</title>';
	if ( $favicon_url ) {
		echo '<link rel="icon" href="' . esc_url( $favicon_url ) . '" />';
	}

	// Meta description (SEO + social fallback).
	/* translators: %s: station or page title for meta description */
	$meta_description = sprintf( __( 'Listen to %s live', 'radio-player-page' ), $display_title );
	echo '<meta name="description" content="' . esc_attr( $meta_description ) . '">';

	// Open Graph.
	echo '<meta property="og:title" content="' . esc_attr( $display_title ) . '">';
	echo '<meta property="og:description" content="' . esc_attr( $meta_description ) . '">';
	echo '<meta property="og:url" content="' . esc_url( get_permalink( $page_id ) ) . '">';
	echo '<meta property="og:type" content="website">';
	echo '<meta property="og:site_name" content="' . esc_attr( get_bloginfo( 'name' ) ) . '">';
	echo '<meta property="og:locale" content="' . esc_attr( str_replace( '-', '_', get_bloginfo( 'language' ) ) ) . '">';

	// Social image: logo first, then background, then favicon.
	$social_image_url = $logo_url ? $logo_url : ( $background_url ? $background_url : ( $favicon_url ? $favicon_url : '' ) );
	if ( $social_image_url ) {
		echo '<meta property="og:image" content="' . esc_url( $social_image_url ) . '">';
		echo '<meta name="twitter:card" content="summary_large_image">';
		echo '<meta name="twitter:image" content="' . esc_url( $social_image_url ) . '">';
	} else {
		echo '<meta name="twitter:card" content="summary">';
	}

	// Twitter Card (title and description shared with OG).
	echo '<meta name="twitter:title" content="' . esc_attr( $display_title ) . '">';
	echo '<meta name="twitter:description" content="' . esc_attr( $meta_description ) . '">';

	$schedule_raw = isset( $station['schedule'] ) && is_array( $station['schedule'] ) ? $station['schedule'] : array();
	$program_data = array();
	foreach ( \RadioPlayerPage\Player\Globals_Builder::program_ids( $schedule_raw ) as $post_id ) {
		$program_data[ $post_id ] = radplapag_get_program_data( $post_id, true );
	}
	$programs_for_player = \RadioPlayerPage\Player\Globals_Builder::programs( $program_data );
	$schedule_for_player = \RadioPlayerPage\Player\Globals_Builder::schedule( $schedule_raw, 'sanitize_text_field' );

	$json_flags = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT;
	echo '<script>';
	echo 'window.RADPLAPAG_CONFIG = ' . wp_json_encode( $config, $json_flags ) . ';';
	echo 'window.RADPLAPAG_PROGRAMS = ' . wp_json_encode( $programs_for_player, $json_flags ) . ';';
	echo 'window.RADPLAPAG_SCHEDULE = ' . wp_json_encode( $schedule_for_player, $json_flags ) . ';';
	echo '</script>';
	if ( $main_css ) {
		echo '<link rel="stylesheet" href="' . esc_url( $dist_url . $main_css ) . '">'; // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedStylesheet -- Clean page without wp_head(), ADR 0008.
	}
	echo '</head>';
	echo '<body>';
	echo '<div id="root"></div>';
	echo '<script type="module" src="' . esc_url( $dist_url . $main_js ) . '"></script>'; // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript -- Clean page without wp_footer(), ADR 0008.
	echo '</body>';
	echo '</html>';

	exit;
}
add_action( 'template_redirect', 'radplapag_output_clean_page' );
