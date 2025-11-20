<?php
defined( 'ABSPATH' ) || exit;

/**
 * Migrates old settings format to new format for backward compatibility
 *
 * Old format: ['stream_url' => 'url', 'player_page' => 123]
 * New format: ['stations' => [['stream_url' => 'url', 'player_page' => 123], ...]]
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
                    'stream_url'  => $old_settings['stream_url'],
                    'player_page' => intval( $old_settings['player_page'] ),
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
add_action( 'admin_init', 'radplapag_migrate_old_settings' );
