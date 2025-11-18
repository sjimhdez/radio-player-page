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

/**
 * Gets settings with automatic migration
 *
 * @return array Settings in new format
 */
function radplapag_get_settings() {
    return radplapag_migrate_old_settings();
}

/**
 * Register settings
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
 * Validates and sanitizes the input data
 */
function radplapag_sanitize_settings( $input ) {
    $output = [ 'stations' => [] ];
    
    // Support both old and new format for backward compatibility
    if ( isset( $input['stream_url'] ) && isset( $input['player_page'] ) ) {
        // Old format - migrate to new format
        $url  = trim( $input['stream_url'] );
        $page = intval( $input['player_page'] );
        
        if ( empty( $url ) || empty( $page ) ) {
            add_settings_error(
                'radplapag_settings',
                'radplapag_settings_error',
                esc_html__( 'You must enter the stream URL and select a page.', 'radio-player-page' ),
                'error'
            );
            return radplapag_get_settings();
        }
        
        $output['stations'][] = [
            'stream_url'  => esc_url_raw( $url ),
            'player_page' => $page,
        ];
        
        return $output;
    }
    
    // New format - multiple stations
    if ( isset( $input['stations'] ) && is_array( $input['stations'] ) ) {
        $used_pages = [];
        $max_stations = 6;
        
        foreach ( $input['stations'] as $index => $station ) {
            // Skip empty stations
            if ( empty( $station['stream_url'] ) && empty( $station['player_page'] ) ) {
                continue;
            }
            
            $url  = isset( $station['stream_url'] ) ? trim( $station['stream_url'] ) : '';
            $page = isset( $station['player_page'] ) ? intval( $station['player_page'] ) : 0;
            
            // Validate required fields
            if ( empty( $url ) || empty( $page ) ) {
                add_settings_error(
                    'radplapag_settings',
                    'radplapag_settings_error',
                    sprintf(
                        esc_html__( 'Station %d: You must enter the stream URL and select a page.', 'radio-player-page' ),
                        $index + 1
                    ),
                    'error'
                );
                continue;
            }
            
            // Validate page is not already used
            if ( in_array( $page, $used_pages, true ) ) {
                add_settings_error(
                    'radplapag_settings',
                    'radplapag_settings_error',
                    sprintf(
                        esc_html__( 'Station %d: This page is already assigned to another station. Each page can only be used once.', 'radio-player-page' ),
                        $index + 1
                    ),
                    'error'
                );
                continue;
            }
            
            // Validate max stations
            if ( count( $output['stations'] ) >= $max_stations ) {
                add_settings_error(
                    'radplapag_settings',
                    'radplapag_settings_error',
                    sprintf(
                        esc_html__( 'You can add a maximum of %d stations.', 'radio-player-page' ),
                        $max_stations
                    ),
                    'error'
                );
                break;
            }
            
            $output['stations'][] = [
                'stream_url'  => esc_url_raw( $url ),
                'player_page' => $page,
            ];
            
            $used_pages[] = $page;
        }
        
        // If there are errors, return current settings
        if ( ! empty( get_settings_errors( 'radplapag_settings' ) ) ) {
            return radplapag_get_settings();
        }
        
        return $output;
    }
    
    // No valid input, return current settings
    return radplapag_get_settings();
}

/**
 * Adds the page to the settings menu
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

/**
 * Renders the options form
 */
function radplapag_render_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    $options = radplapag_get_settings();
    $stations = isset( $options['stations'] ) && is_array( $options['stations'] ) ? $options['stations'] : [];
    $pages = get_pages( [ 'post_status' => 'publish' ] );
    $max_stations = 6;
    
    // Ensure we have at least one empty station slot
    while ( count( $stations ) < $max_stations ) {
        $stations[] = [ 'stream_url' => '', 'player_page' => '' ];
    }
    ?>
    <div class="wrap">
        <h1><?php esc_html_e( 'Radio Player Page Settings', 'radio-player-page' ); ?></h1>

        <?php settings_errors( 'radplapag_settings' ); ?>

        <div>
            <h2><?php esc_html_e( 'How to use', 'radio-player-page' ); ?></h2>
            <p><?php esc_html_e( 'You can add up to 6 radio stations. For each station, enter the streaming URL (Icecast, Shoutcast, etc.) and select a different page where the player should appear.', 'radio-player-page' ); ?></p>
            <p><?php esc_html_e( 'Once configured, each selected page will display a clean, standalone audio player designed for uninterrupted listening.', 'radio-player-page' ); ?></p>
        </div>

        <form method="post" action="options.php" id="radplapag-settings-form">
            <?php
            settings_fields( 'radplapag_settings_group' );
            ?>
            
            <div id="radplapag-stations-container">
                <?php foreach ( $stations as $index => $station ) : 
                    $stream_url = isset( $station['stream_url'] ) ? esc_attr( $station['stream_url'] ) : '';
                    $player_page = isset( $station['player_page'] ) ? intval( $station['player_page'] ) : '';
                    $is_empty = empty( $stream_url ) && empty( $player_page );
                ?>
                    <div class="radplapag-station-row" data-index="<?php echo esc_attr( $index ); ?>" <?php echo $is_empty && $index > 0 ? 'style="display:none;"' : ''; ?>>
                        <h3 class="radplapag-station-title">
                            <?php 
                            if ( ! $is_empty ) {
                                printf( esc_html__( 'Station %d', 'radio-player-page' ), $index + 1 );
                            } else {
                                esc_html_e( 'New Station', 'radio-player-page' );
                            }
                            ?>
                        </h3>
                        <table class="form-table" role="presentation">
                            <tr>
                                <th scope="row">
                                    <label for="radplapag_stream_url_<?php echo esc_attr( $index ); ?>">
                                        <?php esc_html_e( 'Stream URL', 'radio-player-page' ); ?>
                                    </label>
                                </th>
                                <td>
                                    <input 
                                        name="radplapag_settings[stations][<?php echo esc_attr( $index ); ?>][stream_url]" 
                                        type="url" 
                                        id="radplapag_stream_url_<?php echo esc_attr( $index ); ?>" 
                                        value="<?php echo esc_url( $stream_url ); ?>" 
                                        class="regular-text radplapag-stream-url"
                                        placeholder="<?php esc_attr_e( 'https://my.station.com:8000/stream', 'radio-player-page' ); ?>"
                                    >
                                    <p class="description"><?php esc_html_e( 'Example: https://my.station.com:8000/stream', 'radio-player-page' ); ?></p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">
                                    <label for="radplapag_page_<?php echo esc_attr( $index ); ?>">
                                        <?php esc_html_e( 'Player page', 'radio-player-page' ); ?>
                                    </label>
                                </th>
                                <td>
                                    <select 
                                        name="radplapag_settings[stations][<?php echo esc_attr( $index ); ?>][player_page]" 
                                        id="radplapag_page_<?php echo esc_attr( $index ); ?>" 
                                        class="radplapag-player-page"
                                    >
                                        <option value=""><?php esc_html_e( 'Select a page', 'radio-player-page' ); ?></option>
                                        <?php foreach ( $pages as $page ) : 
                                            $is_selected = selected( $player_page, $page->ID, false );
                                        ?>
                                            <option value="<?php echo esc_attr( $page->ID ); ?>" <?php echo $is_selected; ?>>
                                                <?php echo esc_html( $page->post_title ); ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                    <p class="description"><?php esc_html_e( 'The page where the player will be displayed. Each page can only be used once.', 'radio-player-page' ); ?></p>
                                </td>
                            </tr>
                        </table>
                        <?php if ( $index > 0 ) : ?>
                            <p>
                                <button type="button" class="button radplapag-remove-station" data-index="<?php echo esc_attr( $index ); ?>">
                                    <?php esc_html_e( 'Remove Station', 'radio-player-page' ); ?>
                                </button>
                            </p>
                        <?php endif; ?>
                        <hr>
                    </div>
                <?php endforeach; ?>
            </div>
            
            <p>
                <button type="button" class="button radplapag-add-station" id="radplapag-add-station-btn" style="display:none;">
                    <?php esc_html_e( 'Add Another Station', 'radio-player-page' ); ?>
                </button>
            </p>

            <?php submit_button(); ?>
        </form>
    </div>
    
    <style>
        .radplapag-station-row {
            margin-bottom: 20px;
            padding: 15px;
            background: #fff;
            border: 1px solid #ccd0d4;
            box-shadow: 0 1px 1px rgba(0,0,0,.04);
        }
        .radplapag-station-title {
            margin-top: 0;
            padding-bottom: 10px;
            border-bottom: 1px solid #eee;
        }
        .radplapag-station-row hr {
            margin: 20px 0 0;
        }
    </style>
    
    <script>
    (function() {
        var maxStations = <?php echo esc_js( $max_stations ); ?>;
        var container = document.getElementById('radplapag-stations-container');
        var addBtn = document.getElementById('radplapag-add-station-btn');
        
        function updateAddButton() {
            var visibleStations = 0;
            container.querySelectorAll('.radplapag-station-row').forEach(function(row) {
                var style = window.getComputedStyle(row);
                if (style.display !== 'none') {
                    visibleStations++;
                }
            });
            
            if (visibleStations < maxStations) {
                addBtn.style.display = 'inline-block';
            } else {
                addBtn.style.display = 'none';
            }
        }
        
        function updatePageOptions() {
            var selectedPages = [];
            container.querySelectorAll('.radplapag-player-page').forEach(function(select) {
                if (select.value) {
                    selectedPages.push(select.value);
                }
            });
            
            container.querySelectorAll('.radplapag-player-page').forEach(function(select) {
                var currentValue = select.value;
                Array.from(select.options).forEach(function(option) {
                    if (option.value && option.value !== currentValue) {
                        option.disabled = selectedPages.includes(option.value);
                    } else {
                        option.disabled = false;
                    }
                });
            });
        }
        
        function removeStation(index) {
            var row = container.querySelector('.radplapag-station-row[data-index="' + index + '"]');
            if (row) {
                row.querySelector('.radplapag-stream-url').value = '';
                row.querySelector('.radplapag-player-page').value = '';
                row.style.display = 'none';
                updateAddButton();
                updatePageOptions();
            }
        }
        
        function addStation() {
            var hiddenRows = Array.prototype.slice.call(container.querySelectorAll('.radplapag-station-row')).filter(function(row) {
                return window.getComputedStyle(row).display === 'none';
            });
            
            if (hiddenRows.length > 0) {
                var row = hiddenRows[0];
                row.style.display = '';
                var title = row.querySelector('.radplapag-station-title');
                if (title) {
                    var visibleCount = 0;
                    container.querySelectorAll('.radplapag-station-row').forEach(function(r) {
                        if (window.getComputedStyle(r).display !== 'none') {
                            visibleCount++;
                        }
                    });
                    title.textContent = '<?php esc_html_e( 'Station', 'radio-player-page' ); ?> ' + visibleCount;
                }
                updateAddButton();
                updatePageOptions();
            }
        }
        
        // Event listeners
        if (addBtn) {
            addBtn.addEventListener('click', addStation);
        }
        
        container.querySelectorAll('.radplapag-remove-station').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var index = this.getAttribute('data-index');
                removeStation(index);
            });
        });
        
        container.querySelectorAll('.radplapag-player-page').forEach(function(select) {
            select.addEventListener('change', updatePageOptions);
        });
        
        // Initialize
        updateAddButton();
        updatePageOptions();
    })();
    </script>
    <?php
}
