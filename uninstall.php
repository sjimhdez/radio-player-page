<?php
/**
 * Fired when the plugin is uninstalled.
 *
 * This file removes all plugin data from the database when the plugin
 * is uninstalled. It only runs when the user explicitly chooses to
 * uninstall the plugin (not just deactivate it).
 *
 * @package radio-player-page
 * @since      3.1.0
 *
 * @package    radio-player-page
 */

// If uninstall not called from WordPress, then exit.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

/**
 * Deletes all radplapag_program posts (and their meta) for the current blog.
 *
 * @since 3.3.0
 *
 * @return void
 */
function radplapag_uninstall_delete_programs() {
	$posts = get_posts( array(
		'post_type'      => 'radplapag_program',
		'post_status'    => 'any',
		'posts_per_page' => -1,
		'fields'         => 'ids',
	) );
	foreach ( $posts as $post_id ) {
		wp_delete_post( (int) $post_id, true );
	}
}

/**
 * Deletes all radplapag_station posts (and their meta) for the current blog.
 *
 * @since 3.3.0
 *
 * @return void
 */
function radplapag_uninstall_delete_stations() {
	$posts = get_posts( array(
		'post_type'      => 'radplapag_station',
		'post_status'    => 'any',
		'posts_per_page' => -1,
		'fields'         => 'ids',
	) );
	foreach ( $posts as $post_id ) {
		wp_delete_post( (int) $post_id, true );
	}
}

/**
 * Remove plugin data from database.
 *
 * Deletes all station and program CPT posts (and their meta) and flushes cache.
 * Handles both single site and multisite installations.
 *
 * @package radio-player-page
 * @since 3.1.0
 * @since 3.3.0 Deletes radplapag_program and radplapag_station posts.
 *
 * @return void
 */
function radplapag_uninstall_plugin() {
	radplapag_uninstall_delete_stations();
	radplapag_uninstall_delete_programs();
	wp_cache_flush();

	if ( is_multisite() ) {
		$sites = get_sites( array( 'number' => 0 ) );
		foreach ( $sites as $site ) {
			switch_to_blog( $site->blog_id );
			radplapag_uninstall_delete_stations();
			radplapag_uninstall_delete_programs();
			restore_current_blog();
		}
	}
}

// Run uninstall function
radplapag_uninstall_plugin();
