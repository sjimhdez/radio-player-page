<?php
defined( 'ABSPATH' ) || exit;

/**
 * Compatibility functions for backward compatibility.
 *
 * @package radio-player-page
 * @since 1.2.0
 */

/**
 * Migrates old settings format (v1.1) to new format (v1.2.0) for backward compatibility.
 *
 * Handles the transition from single streaming support (v1.1) to multiple streamings support (v1.2.0).
 *
 * Old format: ['stream_url' => 'url', 'player_page' => 123]
 * New format: ['stations' => [['stream_url' => 'url', 'player_page' => 123], ...]]
 *
 * @since 1.2.0
 *
 * @return array Migrated settings in new format
 */
function radplapag_migrate_old_settings() {
    $old_settings = get_option( 'radplapag_settings', [] );
    
    // If already in new format, return as is
    if ( isset( $old_settings['stations'] ) && is_array( $old_settings['stations'] ) ) {
        return $old_settings;
    }
    
    // If old format exists, migrate it
    if ( ! empty( $old_settings['stream_url'] ) && ! empty( $old_settings['player_page'] ) ) {
        $new_settings = [
            'stations' => [
                [
                    'stream_url'    => $old_settings['stream_url'],
                    'player_page'   => intval( $old_settings['player_page'] ),
                    'station_title' => '',
                ],
            ],
        ];
        
        // Save migrated settings
        update_option( 'radplapag_settings', $new_settings );
        
        return $new_settings;
    }
    
    // Return empty new format
    return [ 'stations' => [] ];
}

/**
 * Ensure the DB version option exists.
 *
 * @since 1.2.0
 */
function radplapag_ensure_db_version_option() {
    $current = get_option( 'radplapag_db_version', false );
    if ( false === $current ) {
        add_option( 'radplapag_db_version', '0.0.0' );
    }
}

/**
 * Checks if a database migration is needed based on version.
 *
 * @since 1.2.0
 */
function radplapag_check_version() {
    radplapag_ensure_db_version_option();
    $installed_ver = get_option( 'radplapag_db_version' );

    if ( version_compare( $installed_ver, RADPLAPAG_DB_VERSION, '<' ) ) {
        radplapag_migrate_old_settings();
        update_option( 'radplapag_db_version', RADPLAPAG_DB_VERSION );
    }
}
add_action( 'admin_init', 'radplapag_check_version' );
add_action( 'plugins_loaded', 'radplapag_check_version' );
