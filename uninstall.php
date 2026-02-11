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
 * Remove plugin data from database.
 *
 * This function removes all plugin options and settings when the plugin
 * is uninstalled. It handles both single site and multisite installations.
 *
 * @package radio-player-page
 * @since 3.1.0
 *
 * @return void
 */
function radplapag_uninstall_plugin() {
	// Delete plugin settings option
	delete_option( 'radplapag_settings' );

	// Clear any cached data related to the plugin
	// (WordPress object cache, if any plugin-specific cache exists)
	wp_cache_flush();

	// For multisite installations, delete from all sites
	if ( is_multisite() ) {
		// Get all sites using WordPress API (recommended over direct database queries)
		$sites = get_sites( [ 'number' => 0 ] );
		
		foreach ( $sites as $site ) {
			// Delete option for each site
			delete_blog_option( $site->blog_id, 'radplapag_settings' );
		}
	}
}

// Run uninstall function
radplapag_uninstall_plugin();
