<?php
defined( 'ABSPATH' ) || exit;

/**
 * Admin interface and settings management.
 *
 * This file handles all administrative functionality for the Radio Player Page plugin,
 * including settings registration, sanitization, menu creation, and the settings page
 * rendering. It provides a user interface for configuring multiple radio stations
 * with their associated pages, themes, visualizers, and media assets.
 *
 * @package radio-player-page
 * @since 1.0.0
 */

/**
 * Retrieves the plugin settings from the database.
 *
 * Returns the complete settings array containing all configured radio stations.
 * If no settings exist, returns an empty array with a 'stations' key.
 *
 * @since 1.0.0
 *
 * @return array Settings array with structure: ['stations' => [['stream_url' => string,
 *                     'player_page' => int, 'station_title' => string, 'background_id' => int,
 *                     'logo_id' => int, 'theme_color' => string, 'visualizer' => string,
 *                     'schedule' => array (optional, weekly schedule with programs by day)], ...]]
 */
function radplapag_get_settings() {
    return get_option( 'radplapag_settings', [ 'stations' => [] ] );
}

/**
 * Registers the plugin settings with WordPress Settings API.
 *
 * Registers the 'radplapag_settings' option with a sanitization callback to ensure
 * all input data is properly validated and sanitized before being saved to the database.
 * This hook runs during admin initialization.
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
 * Loads WordPress media uploader scripts only on the plugin's settings page,
 * enabling image selection functionality for station logos and backgrounds.
 *
 * @since 2.0.1
 *
 * @return void
 */
function radplapag_admin_scripts() {
    // Only on our plugin page
    $screen = get_current_screen();
    if ( $screen && 'settings_page_radplapag' === $screen->id ) {
        wp_enqueue_media();
    }
}
add_action( 'admin_enqueue_scripts', 'radplapag_admin_scripts' );

/**
 * Validates and sanitizes settings input before saving to database.
 *
 * Processes the submitted form data, validates all fields, and sanitizes them
 * according to their data types. Only stations with both a valid stream URL and
 * a selected player page are saved. Visualizer values are validated against a
 * whitelist for security. Program schedules are validated for time format, non-overlapping
 * intervals, and proper time ordering. Invalid entries are filtered out.
 *
 * @since 1.0.0
 *
 * @param array $input Raw settings input from form submission. Expected structure:
 *                     ['stations' => [['stream_url' => string, 'player_page' => int|string,
 *                     'station_title' => string, 'background_id' => int|string, 'logo_id' => int|string,
 *                     'theme_color' => string, 'visualizer' => string, 'schedule' => array], ...]]
 * @return array Sanitized settings array with validated and cleaned data. Structure:
 *              ['stations' => [['stream_url' => string (escaped URL), 'player_page' => int,
 *              'station_title' => string (sanitized text), 'background_id' => int, 'logo_id' => int,
 *              'theme_color' => string (sanitized key), 'visualizer' => string (validated),
 *              'schedule' => array (optional, weekly schedule with programs by day)], ...]]
 */
function radplapag_sanitize_settings( $input ) {
    // Verify nonce for security (settings_fields generates nonce with action: radplapag_settings_group-options)
    if ( ! isset( $_POST['_wpnonce'] ) ) {
        // If nonce is not set, return current settings to prevent data loss
        return get_option( 'radplapag_settings', [ 'stations' => [] ] );
    }
    
    // Sanitize nonce before verification
    $nonce = isset( $_POST['_wpnonce'] ) ? sanitize_text_field( wp_unslash( $_POST['_wpnonce'] ) ) : '';
    if ( ! wp_verify_nonce( $nonce, 'radplapag_settings_group-options' ) ) {
        // If nonce fails, return current settings to prevent data loss
        return get_option( 'radplapag_settings', [ 'stations' => [] ] );
    }
    
    $output = [ 'stations' => [] ];
    $stations = isset( $input['stations'] ) && is_array( $input['stations'] ) ? $input['stations'] : [];
    
    foreach ( $stations as $index => $station ) {
        $url   = isset( $station['stream_url'] ) ? trim( $station['stream_url'] ) : '';
        $page  = isset( $station['player_page'] ) ? intval( $station['player_page'] ) : 0;
        $title = isset( $station['station_title'] ) ? sanitize_text_field( $station['station_title'] ) : '';
        $bg_id = isset( $station['background_id'] ) ? intval( $station['background_id'] ) : 0;
        $logo_id = isset( $station['logo_id'] ) ? intval( $station['logo_id'] ) : 0;
        $theme = isset( $station['theme_color'] ) ? sanitize_key( $station['theme_color'] ) : 'neutral';
        $visualizer = isset( $station['visualizer'] ) ? sanitize_key( $station['visualizer'] ) : 'oscilloscope';
        
        // Validate attachment IDs: ensure they are valid image attachments
        if ( $bg_id > 0 && ! wp_attachment_is_image( $bg_id ) ) {
            $bg_id = 0;
        }
        if ( $logo_id > 0 && ! wp_attachment_is_image( $logo_id ) ) {
            $logo_id = 0;
        }
        
        // Validate that the theme color is valid
        $valid_themes = [ 'neutral', 'blue', 'green', 'red', 'orange', 'yellow', 'purple', 'pink' ];
        if ( ! in_array( $theme, $valid_themes, true ) ) {
            $theme = 'neutral';
        }
        
        // Validate that the visualizer is valid
        $valid_visualizers = [ 'oscilloscope', 'bars', 'particles', 'waterfall' ];
        if ( ! in_array( $visualizer, $valid_visualizers, true ) ) {
            $visualizer = 'oscilloscope';
        }
        
        // Filter: Must have both URL and Page to be saved
        if ( empty( $url ) || empty( $page ) ) {
            continue;
        }
        
        // Sanitize and validate program definitions (name + logo_id per station)
        $programs_list = [];
        if ( isset( $station['programs'] ) && is_array( $station['programs'] ) ) {
            foreach ( $station['programs'] as $prog_def ) {
                if ( ! is_array( $prog_def ) ) {
                    continue;
                }
                $prog_name = isset( $prog_def['name'] ) ? sanitize_text_field( $prog_def['name'] ) : '';
                $prog_logo_id = isset( $prog_def['logo_id'] ) ? intval( $prog_def['logo_id'] ) : 0;
                if ( $prog_logo_id > 0 && ! wp_attachment_is_image( $prog_logo_id ) ) {
                    $prog_logo_id = 0;
                }
                if ( empty( $prog_name ) && empty( $prog_logo_id ) ) {
                    continue;
                }
                if ( strlen( $prog_name ) > 64 ) {
                    $prog_name = substr( $prog_name, 0, 64 );
                }
                $programs_list[] = [
                    'name'    => $prog_name,
                    'logo_id' => $prog_logo_id,
                ];
            }
        }
        
        // Sanitize and validate schedule if present (schedule entries use program_id + start + end)
        $schedule = [];
        $day_labels = [
            'monday' => __( 'Monday', 'radio-player-page' ),
            'tuesday' => __( 'Tuesday', 'radio-player-page' ),
            'wednesday' => __( 'Wednesday', 'radio-player-page' ),
            'thursday' => __( 'Thursday', 'radio-player-page' ),
            'friday' => __( 'Friday', 'radio-player-page' ),
            'saturday' => __( 'Saturday', 'radio-player-page' ),
            'sunday' => __( 'Sunday', 'radio-player-page' ),
        ];
        
        if ( isset( $station['schedule'] ) && is_array( $station['schedule'] ) ) {
            $valid_days = [ 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday' ];
            $time_regex = '/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/';
            
            foreach ( $valid_days as $day ) {
                if ( ! isset( $station['schedule'][ $day ] ) || ! is_array( $station['schedule'][ $day ] ) ) {
                    continue;
                }
                
                $day_programs = [];
                $day_intervals = [];
                
                // First pass: collect all valid programs with their data for overlap checking
                // Schedule entries use program_id (index into programs_list)
                $programs_data = [];
                foreach ( $station['schedule'][ $day ] as $prog_idx => $program ) {
                    if ( ! is_array( $program ) ) {
                        continue;
                    }
                    
                    $program_id = isset( $program['program_id'] ) ? intval( $program['program_id'] ) : -1;
                    $program_start = isset( $program['start'] ) ? trim( $program['start'] ) : '';
                    $program_end = isset( $program['end'] ) ? trim( $program['end'] ) : '';
                    
                    // Filter out completely empty programs (no program selection, no start, no end)
                    if ( $program_id < 0 && empty( $program_start ) && empty( $program_end ) ) {
                        continue;
                    }
                    
                    // Validate that all fields are required if any field is filled
                    $has_program = $program_id >= 0;
                    $has_start = ! empty( $program_start );
                    $has_end = ! empty( $program_end );
                    
                    if ( $has_program || $has_start || $has_end ) {
                        if ( ! $has_program || ! $has_start || ! $has_end ) {
                            add_settings_error(
                                'radplapag_settings',
                                'radplapag_schedule_incomplete',
                                sprintf(
                                    /* translators: 1: Day name */
                                    __( 'Program on %1$s: All fields (program, start time, end time) are required.', 'radio-player-page' ),
                                    esc_html( $day_labels[ $day ] )
                                )
                            );
                            continue;
                        }
                    }
                    
                    if ( $program_id < 0 || $program_id >= count( $programs_list ) ) {
                        add_settings_error(
                            'radplapag_settings',
                            'radplapag_schedule_invalid_program',
                            sprintf(
                                /* translators: 1: Day name */
                                __( 'Program on %1$s: Please select a valid program.', 'radio-player-page' ),
                                esc_html( $day_labels[ $day ] )
                            )
                        );
                        continue;
                    }
                    
                    $program_name = isset( $programs_list[ $program_id ]['name'] ) ? $programs_list[ $program_id ]['name'] : '';
                    
                    // Validate time format
                    if ( ! preg_match( $time_regex, $program_start ) || ! preg_match( $time_regex, $program_end ) ) {
                        add_settings_error(
                            'radplapag_settings',
                            'radplapag_schedule_time_format',
                            sprintf(
                                /* translators: 1: Program name, 2: Day name */
                                __( 'Program "%1$s" on %2$s: Invalid time format. Times must be in HH:MM format.', 'radio-player-page' ),
                                esc_html( $program_name ),
                                esc_html( $day_labels[ $day ] )
                            )
                        );
                        continue;
                    }
                    
                    // Validate time range (allow programs that cross midnight, e.g., 23:00 to 00:00)
                    $start_time = strtotime( '2000-01-01 ' . $program_start . ':00' );
                    $end_time = strtotime( '2000-01-01 ' . $program_end . ':00' );
                    
                    // If end < start, it means the program crosses midnight (ends next day)
                    // In this case, we treat end as 24:00 (end of day) for validation purposes
                    $end_time_for_validation = $end_time;
                    if ( $end_time <= $start_time ) {
                        // Program crosses midnight, end is on next day
                        $end_time_for_validation = strtotime( '2000-01-02 ' . $program_end . ':00' );
                    }
                    
                    // Validate that start < end (considering midnight crossing)
                    if ( $start_time >= $end_time_for_validation ) {
                        add_settings_error(
                            'radplapag_settings',
                            'radplapag_schedule_time_range',
                            sprintf(
                                /* translators: 1: Program name, 2: Day name */
                                __( 'Program "%1$s" on %2$s: End time must be after start time.', 'radio-player-page' ),
                                esc_html( $program_name ),
                                esc_html( $day_labels[ $day ] )
                            )
                        );
                        continue;
                    }
                    
                    // Store program data for overlap checking
                    // For programs crossing midnight, we store end_time as next day for comparison
                    $end_time_for_overlap = $end_time;
                    if ( $end_time <= $start_time ) {
                        $end_time_for_overlap = strtotime( '2000-01-02 ' . $program_end . ':00' );
                    }
                    
                    $programs_data[] = [
                        'index' => $prog_idx,
                        'program_id' => $program_id,
                        'name' => $program_name,
                        'start' => $program_start,
                        'end' => $program_end,
                        'start_time' => $start_time,
                        'end_time' => $end_time_for_overlap,
                        'crosses_midnight' => ( $end_time <= $start_time ),
                    ];
                }
                
                // Second pass: check for overlaps (sort by start time first)
                usort( $programs_data, function( $a, $b ) {
                    return $a['start_time'] - $b['start_time'];
                } );
                
                foreach ( $programs_data as $prog_data ) {
                    // Check for overlaps with already accepted programs
                    $has_overlap = false;
                    $overlapping_program = null;
                    
                    foreach ( $day_intervals as $interval ) {
                        if ( ( $prog_data['start_time'] < $interval['end'] && $prog_data['end_time'] > $interval['start'] ) ) {
                            $has_overlap = true;
                            $overlapping_program = $interval['name'];
                            break;
                        }
                    }
                    
                    if ( $has_overlap ) {
                        add_settings_error(
                            'radplapag_settings',
                            'radplapag_schedule_overlap',
                            sprintf(
                                /* translators: 1: Program name, 2: Day name, 3: Overlapping program name */
                                __( 'Program "%1$s" on %2$s: Time slot overlaps with "%3$s".', 'radio-player-page' ),
                                esc_html( $prog_data['name'] ),
                                esc_html( $day_labels[ $day ] ),
                                esc_html( $overlapping_program )
                            )
                        );
                        continue;
                    }
                    
                    // Add to intervals for overlap checking
                    $day_intervals[] = [
                        'start' => $prog_data['start_time'],
                        'end' => $prog_data['end_time'],
                        'name' => $prog_data['name'],
                    ];
                    
                    // Add valid program (store program_id for frontend resolution)
                    $day_programs[] = [
                        'program_id' => $prog_data['program_id'],
                        'start' => $prog_data['start'],
                        'end' => $prog_data['end'],
                    ];
                }
                
                // Only add day if it has programs
                if ( ! empty( $day_programs ) ) {
                    $schedule[ $day ] = $day_programs;
                }
            }
            
            // Third pass: validate cross-day overlaps for programs that cross midnight
            $days_array = array_keys( $day_labels );
            foreach ( $days_array as $day_idx => $day ) {
                if ( ! isset( $schedule[ $day ] ) || empty( $schedule[ $day ] ) ) {
                    continue;
                }
                
                // Find programs that cross midnight in this day
                foreach ( $schedule[ $day ] as $program ) {
                    if ( ! is_array( $program ) ) {
                        continue;
                    }
                    
                    $program_id = isset( $program['program_id'] ) ? intval( $program['program_id'] ) : -1;
                    $program_name = ( $program_id >= 0 && isset( $programs_list[ $program_id ]['name'] ) ) ? $programs_list[ $program_id ]['name'] : '';
                    $program_start = isset( $program['start'] ) ? trim( $program['start'] ) : '';
                    $program_end = isset( $program['end'] ) ? trim( $program['end'] ) : '';
                    
                    if ( empty( $program_start ) || empty( $program_end ) || $program_id < 0 ) {
                        continue;
                    }
                    
                    $start_time = strtotime( '2000-01-01 ' . $program_start . ':00' );
                    $end_time = strtotime( '2000-01-01 ' . $program_end . ':00' );
                    
                    // If program crosses midnight
                    if ( $end_time <= $start_time ) {
                        // Get next day
                        $next_day_idx = ( $day_idx + 1 ) % 7;
                        $next_day = $days_array[ $next_day_idx ];
                        
                        // Calculate end time on next day for overlap checking
                        $end_time_next_day = strtotime( '2000-01-02 ' . $program_end . ':00' );
                        
                        // Check for overlaps with programs on the next day
                        if ( isset( $schedule[ $next_day ] ) && is_array( $schedule[ $next_day ] ) ) {
                            foreach ( $schedule[ $next_day ] as $next_program ) {
                                if ( ! is_array( $next_program ) ) {
                                    continue;
                                }
                                
                                $next_program_id = isset( $next_program['program_id'] ) ? intval( $next_program['program_id'] ) : -1;
                                $next_program_name = ( $next_program_id >= 0 && isset( $programs_list[ $next_program_id ]['name'] ) ) ? $programs_list[ $next_program_id ]['name'] : '';
                                $next_program_start = isset( $next_program['start'] ) ? trim( $next_program['start'] ) : '';
                                $next_program_end = isset( $next_program['end'] ) ? trim( $next_program['end'] ) : '';
                                
                                if ( empty( $next_program_start ) || empty( $next_program_end ) || $next_program_id < 0 ) {
                                    continue;
                                }
                                
                                $next_start_time = strtotime( '2000-01-01 ' . $next_program_start . ':00' );
                                $next_end_time = strtotime( '2000-01-01 ' . $next_program_end . ':00' );
                                
                                // Handle next program that might also cross midnight
                                $next_end_for_overlap = $next_end_time;
                                if ( $next_end_time <= $next_start_time ) {
                                    $next_end_for_overlap = strtotime( '2000-01-02 ' . $next_program_end . ':00' );
                                }
                                
                                // Check for overlap: program from previous day crosses midnight and ends on next day
                                // The crossing program is active on the next day from 00:00 (midnight) to end_time (e.g., 01:00 = 60 minutes)
                                // The next day's program is active from next_start_time to next_end_for_overlap
                                // Overlap formula: (start1 < end2 && end1 > start2)
                                // Crossing program on next day: start = 0 (midnight), end = end_time
                                // Next day's program: start = next_start_time, end = next_end_for_overlap
                                // Overlap if: (0 < next_end_for_overlap && end_time > next_start_time)
                                // Simplified: end_time > next_start_time (since 0 is always < next_end_for_overlap for valid programs)
                                if ( $end_time > $next_start_time ) {
                                    add_settings_error(
                                        'radplapag_settings',
                                        'radplapag_schedule_cross_day_overlap',
                                        sprintf(
                                            /* translators: 1: Program name, 2: Day name, 3: Overlapping program name, 4: Next day name */
                                            __( 'Program "%1$s" on %2$s (crosses midnight) overlaps with "%3$s" on %4$s.', 'radio-player-page' ),
                                            esc_html( $program_name ),
                                            esc_html( $day_labels[ $day ] ),
                                            esc_html( $next_program_name ),
                                            esc_html( $day_labels[ $next_day ] )
                                        )
                                    );
                                    break 2; // Break both loops
                                }
                            }
                        }
                    }
                }
            }
        }
        
        $station_data = [
            'stream_url'    => esc_url_raw( $url ),
            'player_page'   => $page,
            'station_title' => $title,
            'background_id' => $bg_id,
            'logo_id'       => $logo_id,
            'theme_color'   => $theme,
            'visualizer'    => $visualizer,
        ];
        
        // Add program definitions if any
        if ( ! empty( $programs_list ) ) {
            $station_data['programs'] = $programs_list;
        }
        
        // Add schedule if it exists (entries use program_id; frontend will resolve to name + logoUrl)
        if ( ! empty( $schedule ) ) {
            $station_data['schedule'] = $schedule;
        }
        
        $output['stations'][] = $station_data;
    }  
    return $output;
}

/**
 * Adds the plugin settings page to the WordPress Settings menu.
 *
 * Creates a submenu item under Settings > Radio Player Page Settings that is
 * accessible only to users with the 'manage_options' capability (typically administrators).
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

/**
 * Renders the complete settings page interface.
 *
 * Outputs the HTML form for configuring radio stations, including fields for stream URLs,
 * page selection, station titles, theme colors, visualizers, and media uploads (logos and
 * backgrounds). The page supports up to 10 stations and includes JavaScript for dynamic
 * form management, image uploads via WordPress media library, and page selection validation.
 *
 * @since 1.0.0
 *
 * @return void Outputs HTML directly.
 */
function radplapag_render_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    $options = radplapag_get_settings();
    $stations = isset( $options['stations'] ) && is_array( $options['stations'] ) ? $options['stations'] : [];
    $pages = get_pages( [ 'post_status' => 'publish' ] );
    $max_stations = 10;
    
    // Ensure we have at least one empty streaming slot
    while ( count( $stations ) < $max_stations ) {
        $stations[] = [ 'stream_url' => '', 'player_page' => '', 'station_title' => '', 'background_id' => '', 'logo_id' => '', 'theme_color' => 'neutral', 'visualizer' => 'oscilloscope', 'programs' => [] ];
    }
    
    $colors = [
        'neutral' => __( 'Neutral', 'radio-player-page' ),
        'blue'    => __( 'Blue', 'radio-player-page' ),
        'green'   => __( 'Green', 'radio-player-page' ),
        'red'     => __( 'Red', 'radio-player-page' ),
        'orange'  => __( 'Orange', 'radio-player-page' ),
        'yellow'  => __( 'Yellow', 'radio-player-page' ),
        'purple'  => __( 'Purple', 'radio-player-page' ),
        'pink'    => __( 'Pink', 'radio-player-page' ),
    ];
    ?>
    <div class="wrap">
        <h1><?php esc_html_e( 'Radio Player Page Settings', 'radio-player-page' ); ?></h1>

        <?php settings_errors( 'radplapag_settings' ); ?>

        <div>
            <h2><?php esc_html_e( 'How to use', 'radio-player-page' ); ?></h2>
            <p><?php esc_html_e( 'Configure up to ten streams. For each stream, enter the stream URL (Icecast, Shoutcast, or MP3) and select the page where the player should appear. You can customize the theme color, visualizer, background image, and logo for each stream.', 'radio-player-page' ); ?></p>
        </div>

        <form method="post" action="options.php" id="radplapag-settings-form">
            <?php
            settings_fields( 'radplapag_settings_group' );
            ?>
            
            <div id="radplapag-stations-container">
                <?php foreach ( $stations as $index => $station ) : 
                    $stream_url = isset( $station['stream_url'] ) ? esc_attr( $station['stream_url'] ) : '';
                    $player_page = isset( $station['player_page'] ) ? intval( $station['player_page'] ) : '';
                    $station_title = isset( $station['station_title'] ) ? esc_attr( $station['station_title'] ) : '';
                    $background_id = isset( $station['background_id'] ) ? intval( $station['background_id'] ) : '';
                    $logo_id = isset( $station['logo_id'] ) ? intval( $station['logo_id'] ) : '';
                    $theme_color = isset( $station['theme_color'] ) ? esc_attr( $station['theme_color'] ) : 'neutral';
                    $visualizer = isset( $station['visualizer'] ) ? esc_attr( $station['visualizer'] ) : 'oscilloscope';

                    // Get image preview URLs
                    $background_url = $background_id ? wp_get_attachment_image_url( $background_id, 'medium' ) : '';
                    $logo_url = $logo_id ? wp_get_attachment_image_url( $logo_id, 'medium' ) : '';

                    $is_empty = empty( $stream_url ) && empty( $player_page );
                ?>
                    <div class="radplapag-station-row" data-index="<?php echo esc_attr( $index ); ?>" <?php echo $is_empty && $index > 0 ? 'style="display:none;"' : ''; ?>>
                        <h3 class="radplapag-station-title">
                            <?php 
                            if ( ! $is_empty ) {
                                /* translators: %d: Streaming number */
                                echo esc_html( sprintf( __( 'Stream %d', 'radio-player-page' ), $index + 1 ) );
                            } else {
                                esc_html_e( 'New Stream', 'radio-player-page' );
                            }
                            ?>
                        </h3>
                        <table class="form-table" role="presentation">
                            <tr data-field="player_page">
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
                                        <?php foreach ( $pages as $page ) : ?>
                                            <option value="<?php echo esc_attr( $page->ID ); ?>" <?php selected( $player_page, $page->ID ); ?>>
                                                <?php echo esc_html( $page->post_title ); ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                </td>
                            </tr>
                            <tr data-field="stream_url">
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
                                </td>
                            </tr>
                            <tr data-field="station_title">
                                <th scope="row">
                                    <label for="radplapag_station_title_<?php echo esc_attr( $index ); ?>">
                                        <?php esc_html_e( 'Stream Title', 'radio-player-page' ); ?> <?php esc_html_e( '(Optional)', 'radio-player-page' ); ?>
                                    </label>
                                </th>
                                <td>
                                    <input 
                                        name="radplapag_settings[stations][<?php echo esc_attr( $index ); ?>][station_title]" 
                                        type="text" 
                                        id="radplapag_station_title_<?php echo esc_attr( $index ); ?>" 
                                        value="<?php echo esc_attr( $station_title ); ?>" 
                                        class="regular-text radplapag-station-title-input"
                                        placeholder="<?php esc_attr_e( 'My Radio Station', 'radio-player-page' ); ?>"
                                        maxlength="64"
                                    >
                                </td>
                            </tr>
                            <!-- Theme Color -->
                            <tr>
                                <th scope="row">
                                    <label for="radplapag_theme_color_<?php echo esc_attr( $index ); ?>">
                                        <?php esc_html_e( 'Theme Color', 'radio-player-page' ); ?>
                                    </label>
                                </th>
                                <td>
                                    <select 
                                        name="radplapag_settings[stations][<?php echo esc_attr( $index ); ?>][theme_color]" 
                                        id="radplapag_theme_color_<?php echo esc_attr( $index ); ?>"
                                    >
                                        <?php foreach ( $colors as $value => $label ) : ?>
                                            <option value="<?php echo esc_attr( $value ); ?>" <?php selected( $theme_color, $value ); ?>>
                                                <?php echo esc_html( $label ); ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                </td>
                            </tr>
                            <!-- Visualizer -->
                            <tr>
                                <th scope="row">
                                    <label for="radplapag_visualizer_<?php echo esc_attr( $index ); ?>">
                                        <?php esc_html_e( 'Visualizer', 'radio-player-page' ); ?>
                                    </label>
                                </th>
                                <td>
                                    <select 
                                        name="radplapag_settings[stations][<?php echo esc_attr( $index ); ?>][visualizer]" 
                                        id="radplapag_visualizer_<?php echo esc_attr( $index ); ?>"
                                    >
                                        <option value="oscilloscope" <?php selected( $visualizer, 'oscilloscope' ); ?>>
                                            <?php esc_html_e( 'Oscilloscope', 'radio-player-page' ); ?>
                                        </option>
                                        <option value="bars" <?php selected( $visualizer, 'bars' ); ?>>
                                            <?php esc_html_e( 'Bars Spectrum', 'radio-player-page' ); ?>
                                        </option>
                                        <option value="waterfall" <?php selected( $visualizer, 'waterfall' ); ?>>
                                            <?php esc_html_e( 'Amplitude Waterfall', 'radio-player-page' ); ?>
                                        </option>
                                        <option value="particles" <?php selected( $visualizer, 'particles' ); ?>>
                                            <?php esc_html_e( 'Spectral Particles', 'radio-player-page' ); ?>
                                        </option>
                                    </select>
                                </td>
                            </tr>
                            <!-- Logo Image -->
                            <tr>
                                <th scope="row">
                                    <label><?php esc_html_e( 'Logo Image', 'radio-player-page' ); ?> <?php esc_html_e( '(Optional)', 'radio-player-page' ); ?></label>
                                </th>
                                <td>
                                    <div class="radplapag-image-upload-wrapper">
                                        <input type="hidden" name="radplapag_settings[stations][<?php echo esc_attr( $index ); ?>][logo_id]" value="<?php echo esc_attr( $logo_id ); ?>" class="radplapag-image-id">
                                        <div class="radplapag-image-preview">
                                            <?php if ( $logo_url ) : ?>
                                                <img src="<?php echo esc_url( $logo_url ); ?>" alt="" style="max-width:150px;max-height:150px;display:block;">
                                            <?php endif; ?>
                                        </div>
                                        <button type="button" class="button radplapag-upload-btn"><?php esc_html_e( 'Select Image', 'radio-player-page' ); ?></button>
                                        <button type="button" class="button radplapag-remove-image-btn" <?php echo empty( $logo_id ) ? 'style="display:none;"' : ''; ?>><?php esc_html_e( 'Remove', 'radio-player-page' ); ?></button>
                                        <p class="description">
                                            <?php esc_html_e( 'Recommended size', 'radio-player-page' ); ?>: <?php esc_html_e( '512x512 pixels or larger.', 'radio-player-page' ); ?>

                                        </p>
                                    </div>
                                </td>
                            </tr>
                            <!-- Background Image -->
                            <tr>
                                <th scope="row">
                                    <label><?php esc_html_e( 'Background Image', 'radio-player-page' ); ?> <?php esc_html_e( '(Optional)', 'radio-player-page' ); ?></label>
                                </th>
                                <td>
                                    <div class="radplapag-image-upload-wrapper">
                                        <input type="hidden" name="radplapag_settings[stations][<?php echo esc_attr( $index ); ?>][background_id]" value="<?php echo esc_attr( $background_id ); ?>" class="radplapag-image-id">
                                        <div class="radplapag-image-preview">
                                            <?php if ( $background_url ) : ?>
                                                <img src="<?php echo esc_url( $background_url ); ?>" alt="" style="max-width:150px;max-height:150px;display:block;">
                                            <?php endif; ?>
                                        </div>
                                        <button type="button" class="button radplapag-upload-btn"><?php esc_html_e( 'Select Image', 'radio-player-page' ); ?></button>
                                        <button type="button" class="button radplapag-remove-image-btn" <?php echo empty( $background_id ) ? 'style="display:none;"' : ''; ?>><?php esc_html_e( 'Remove', 'radio-player-page' ); ?></button>
                                    </div>
                                </td>
                            </tr>
                            <!-- Program Schedule (includes program definitions inside the dropdown) -->
                            <tr>
                                <th scope="row">
                                    <label><?php esc_html_e( 'Program Schedule', 'radio-player-page' ); ?> <?php esc_html_e( '(Optional)', 'radio-player-page' ); ?></label>
                                </th>
                                <td>
                                    <?php
                                    $programs = isset( $station['programs'] ) && is_array( $station['programs'] ) ? $station['programs'] : [];
                                    $has_programs = ! empty( $programs );
                                    $schedule = isset( $station['schedule'] ) && is_array( $station['schedule'] ) ? $station['schedule'] : [];
                                    $days = [
                                        'monday' => __( 'Monday', 'radio-player-page' ),
                                        'tuesday' => __( 'Tuesday', 'radio-player-page' ),
                                        'wednesday' => __( 'Wednesday', 'radio-player-page' ),
                                        'thursday' => __( 'Thursday', 'radio-player-page' ),
                                        'friday' => __( 'Friday', 'radio-player-page' ),
                                        'saturday' => __( 'Saturday', 'radio-player-page' ),
                                        'sunday' => __( 'Sunday', 'radio-player-page' ),
                                    ];
                                    // Expand dropdown if there are program definitions or schedule entries
                                    $has_schedule = $has_programs;
                                    foreach ( $days as $day_key => $day_label ) {
                                        if ( isset( $schedule[ $day_key ] ) && is_array( $schedule[ $day_key ] ) && ! empty( $schedule[ $day_key ] ) ) {
                                            foreach ( $schedule[ $day_key ] as $program ) {
                                                $has_prog_id = isset( $program['program_id'] ) && $program['program_id'] !== '' && $program['program_id'] >= 0;
                                                $has_times = ! empty( $program['start'] ) || ! empty( $program['end'] );
                                                if ( $has_prog_id || $has_times ) {
                                                    $has_schedule = true;
                                                    break 2;
                                                }
                                            }
                                        }
                                    }
                                    $schedule_collapsed_class = $has_schedule ? '' : 'radplapag-schedule-collapsed';
                                    ?>
                                    <button type="button" class="button-link radplapag-schedule-toggle" data-station-index="<?php echo esc_attr( $index ); ?>" aria-expanded="<?php echo $has_schedule ? 'true' : 'false'; ?>">
                                        <span class="toggle-indicator" aria-hidden="true"></span>
                                        <?php echo $has_schedule ? esc_html__( 'Hide Program Schedule', 'radio-player-page' ) : esc_html__( 'Show Program Schedule', 'radio-player-page' ); ?>
                                    </button>
                                    <div class="radplapag-schedule-wrapper <?php echo esc_attr( $schedule_collapsed_class ); ?>" data-station-index="<?php echo esc_attr( $index ); ?>">
                                        <!-- Program definitions (inside schedule dropdown) -->
                                        <h3 class="radplapag-schedule-subheading" style="margin: 10px 0;">
                                            <?php esc_html_e( 'Programs', 'radio-player-page' ); ?>
                                        </h3>
                                        <p class="description" style="margin-bottom: 10px;">
                                            <?php esc_html_e( 'Define programs (name and optional logo). Then assign them to time slots below.', 'radio-player-page' ); ?>
                                        </p>
                                        <div class="radplapag-program-definitions-list">
                                            <?php foreach ( $programs as $prog_idx => $prog_def ) :
                                                $prog_name = isset( $prog_def['name'] ) ? esc_attr( $prog_def['name'] ) : '';
                                                $prog_logo_id = isset( $prog_def['logo_id'] ) ? intval( $prog_def['logo_id'] ) : 0;
                                                $prog_logo_url = $prog_logo_id ? wp_get_attachment_image_url( $prog_logo_id, 'medium' ) : '';
                                            ?>
                                                <div class="radplapag-program-definition-row" data-program-def-index="<?php echo esc_attr( $prog_idx ); ?>">
                                                    <div class="radplapag-program-definition-line">
                                                        <div class="radplapag-program-definition-name-cell">
                                                            <input type="text" name="radplapag_settings[stations][<?php echo esc_attr( $index ); ?>][programs][<?php echo esc_attr( $prog_idx ); ?>][name]" value="<?php echo $prog_name; ?>" placeholder="<?php esc_attr_e( 'Program name', 'radio-player-page' ); ?>" class="radplapag-program-definition-name" maxlength="64" style="width: 200px;">
                                                            <div class="radplapag-program-error-message" style="display: none;"></div>
                                                        </div>
                                                        <div class="radplapag-program-definition-main">
                                                            <div class="radplapag-image-upload-wrapper">
                                                                <input type="hidden" name="radplapag_settings[stations][<?php echo esc_attr( $index ); ?>][programs][<?php echo esc_attr( $prog_idx ); ?>][logo_id]" value="<?php echo esc_attr( $prog_logo_id ); ?>" class="radplapag-image-id">
                                                                <div class="radplapag-image-preview">
                                                                    <?php if ( $prog_logo_url ) : ?>
                                                                        <img src="<?php echo esc_url( $prog_logo_url ); ?>" alt="" style="max-width:30px;max-height:30px;display:block;">
                                                                    <?php endif; ?>
                                                                </div>
                                                                <button type="button" class="button radplapag-upload-btn"><?php echo $prog_logo_id ? esc_html__( 'Change image', 'radio-player-page' ) : esc_html__( 'Add program image', 'radio-player-page' ); ?></button>
                                                                <button type="button" class="button radplapag-remove-image-btn" <?php echo empty( $prog_logo_id ) ? 'style="display:none;"' : ''; ?>><?php esc_html_e( 'Remove image', 'radio-player-page' ); ?></button>
                                                            </div>
                                                        </div>
                                                        <div class="radplapag-program-definition-remove-cell">
                                                            <a href="#" class="submitdelete radplapag-remove-program-definition" data-station-index="<?php echo esc_attr( $index ); ?>" data-program-def-index="<?php echo esc_attr( $prog_idx ); ?>"><?php esc_html_e( 'Remove program', 'radio-player-page' ); ?></a>
                                                        </div>
                                                    </div>
                                                </div>
                                            <?php endforeach; ?>
                                        </div>
                                        <button type="button" class="button radplapag-add-program-definition" data-station-index="<?php echo esc_attr( $index ); ?>" style="margin-top: 5px; margin-bottom: 15px;">
                                            <?php esc_html_e( 'Add Program', 'radio-player-page' ); ?>
                                        </button>
                                        <hr style="margin: 10px 0;">
                                        <!-- Weekly schedule by day -->
                                        <h3 style="margin: 10px 0;">
                                            <?php esc_html_e( 'Schedule', 'radio-player-page' ); ?>
                                        </h3>
                                        <p class="description" style="margin-bottom: 20px;">
                                            <?php esc_html_e( 'Define weekly program schedule. Programs are displayed automatically in the player based on current time.', 'radio-player-page' ); ?>
                                        </p>
                                        <?php foreach ( $days as $day_key => $day_label ) : 
                                            $day_programs = isset( $schedule[ $day_key ] ) && is_array( $schedule[ $day_key ] ) ? $schedule[ $day_key ] : [];
                                            // Sort by start time (programs without start go last).
                                            uasort( $day_programs, function( $a, $b ) {
                                                $start_a = isset( $a['start'] ) ? $a['start'] : '';
                                                $start_b = isset( $b['start'] ) ? $b['start'] : '';
                                                if ( empty( $start_a ) && empty( $start_b ) ) {
                                                    return 0;
                                                }
                                                if ( empty( $start_a ) ) {
                                                    return 1;
                                                }
                                                if ( empty( $start_b ) ) {
                                                    return -1;
                                                }
                                                return strcmp( $start_a, $start_b );
                                            } );
                                        ?>
                                            <div class="radplapag-schedule-day" data-day="<?php echo esc_attr( $day_key ); ?>">
                                                <h4 style="margin: 10px 0 5px 0; font-size: 13px; font-weight: 600;">
                                                    <?php echo esc_html( $day_label ); ?>
                                                </h4>
                                                <div class="radplapag-programs-list">
                                                    <?php if ( ! empty( $day_programs ) ) : ?>
                                                        <?php foreach ( $day_programs as $prog_index => $program ) : 
                                                            $prog_id = isset( $program['program_id'] ) ? $program['program_id'] : '';
                                                            $prog_start = isset( $program['start'] ) ? esc_attr( $program['start'] ) : '';
                                                            $prog_end = isset( $program['end'] ) ? esc_attr( $program['end'] ) : '';
                                                        ?>
                                                            <div class="radplapag-program-row" data-program-index="<?php echo esc_attr( $prog_index ); ?>">
                                                                <select 
                                                                    name="radplapag_settings[stations][<?php echo esc_attr( $index ); ?>][schedule][<?php echo esc_attr( $day_key ); ?>][<?php echo esc_attr( $prog_index ); ?>][program_id]" 
                                                                    class="radplapag-program-id"
                                                                    style="width: 200px; margin-right: 24px;"
                                                                >
                                                                    <option value=""><?php esc_html_e( 'Select program', 'radio-player-page' ); ?></option>
                                                                    <?php foreach ( $programs as $pid => $p ) : 
                                                                        $pname = isset( $p['name'] ) ? $p['name'] : '';
                                                                    ?>
                                                                        <option value="<?php echo esc_attr( $pid ); ?>" <?php selected( $prog_id !== '' && (int) $prog_id === (int) $pid ); ?>><?php echo esc_html( $pname ); ?></option>
                                                                    <?php endforeach; ?>
                                                                </select>
                                                                <input 
                                                                    type="time" 
                                                                    name="radplapag_settings[stations][<?php echo esc_attr( $index ); ?>][schedule][<?php echo esc_attr( $day_key ); ?>][<?php echo esc_attr( $prog_index ); ?>][start]" 
                                                                    value="<?php echo $prog_start; ?>" 
                                                                    class="radplapag-program-start"
                                                                    style="width: 100px; margin-right: 5px;"
                                                                >
                                                                <span style="margin-right: 5px;"> <?php esc_html_e( 'to', 'radio-player-page' ); ?> </span>
                                                                <input 
                                                                    type="time" 
                                                                    name="radplapag_settings[stations][<?php echo esc_attr( $index ); ?>][schedule][<?php echo esc_attr( $day_key ); ?>][<?php echo esc_attr( $prog_index ); ?>][end]" 
                                                                    value="<?php echo $prog_end; ?>" 
                                                                    class="radplapag-program-end"
                                                                    style="width: 100px; margin-right: 10px;"
                                                                >
                                                                <div class="radplapag-schedule-remove-cell">
                                                                    <a href="#" class="submitdelete radplapag-remove-program"><?php esc_html_e( 'Remove time slot', 'radio-player-page' ); ?></a>
                                                                </div>
                                                                <div class="radplapag-program-error-message" style="display: none;"></div>
                                                            </div>
                                                        <?php endforeach; ?>
                                                    <?php endif; ?>
                                                </div>
                                                <button type="button" class="button radplapag-add-program" data-day="<?php echo esc_attr( $day_key ); ?>" style="margin-top: 5px; margin-bottom: 15px;">
                                                    <?php esc_html_e( 'Add time slot', 'radio-player-page' ); ?>
                                                </button>
                                            </div>
                                        <?php endforeach; ?>
                                    </div>
                                    <p class="description" style="margin-top: 10px;">
                                        <?php esc_html_e( 'Assign programs to time slots for each day using 24-hour format (HH:MM). Time slots cannot overlap on the same day; programs that cross midnight are supported. The player shows listeners the name and time range of the program currently on air and, when relevant, the next program starting within 10 minutes. The display uses your site timezone and updates automatically at the start of each minute.', 'radio-player-page' ); ?>
                                    </p>
                                </td>
                            </tr>
                        </table>
                        <?php if ( $index > 0 ) : ?>
                            <p>
                                <a href="#" class="submitdelete radplapag-remove-station" data-index="<?php echo esc_attr( $index ); ?>"><?php esc_html_e( 'Remove Stream', 'radio-player-page' ); ?></a>
                            </p>
                        <?php endif; ?>
                    </div>
                <?php endforeach; ?>
            </div>
            
            <p>
                <button type="button" class="button radplapag-add-station" id="radplapag-add-station-btn" style="display:none;">
                    <?php esc_html_e( 'Add Stream', 'radio-player-page' ); ?>
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
        .radplapag-image-preview {
            margin-bottom: 10px;
        }
        .radplapag-image-preview img {
            border: 1px solid #ddd;
            padding: 4px;
            background: #fff;
        }
        .radplapag-program-definition-row .radplapag-image-upload-wrapper {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 8px;
        }
        .radplapag-program-definition-row .radplapag-image-upload-wrapper .radplapag-image-preview {
            margin-bottom: 0;
        }
        .radplapag-program-definition-row .radplapag-image-preview img {
            max-width: 30px;
            max-height: 30px;
            display: block;
        }
        .radplapag-program-row {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            padding: 8px;
            border: 1px solid #ccd0d4;
            border-radius: 3px;
            transition: border-color 0.3s ease;
        }
        .radplapag-program-row .radplapag-schedule-remove-cell {
            margin-left: auto;
        }
        .radplapag-program-row .radplapag-program-error-message {
            width: 100%;
        }
        .radplapag-program-row.radplapag-error {
            border-color: #dc3232;
            background-color: #fff5f5;
        }
        .radplapag-program-row input.radplapag-error {
            border-color: #dc3232;
            box-shadow: 0 0 2px rgba(220, 50, 50, 0.3);
        }
        .radplapag-program-error-message {
            color: #dc3232;
            font-size: 12px;
            margin-top: 4px;
            margin-left: 0;
            display: none;
        }
        .radplapag-program-error-message.show {
            display: block;
        }
        .radplapag-station-row td.radplapag-error input,
        .radplapag-station-row td.radplapag-error select {
            border-color: #dc3232;
            box-shadow: 0 0 2px rgba(220, 50, 50, 0.3);
        }
        .radplapag-field-error-message {
            color: #dc3232;
            font-size: 12px;
            margin-top: 4px;
            margin-left: 0;
            display: none;
        }
        .radplapag-field-error-message.show {
            display: block;
        }
        .radplapag-schedule-toggle {
            padding: 0;
            border: none;
            background: none;
            color: #2271b1;
            text-decoration: none;
            cursor: pointer;
            font-size: 13px;
            line-height: 2.15384615;
            margin-bottom: 10px;
        }
        .radplapag-schedule-toggle:hover {
            color: #135e96;
        }
        .radplapag-schedule-toggle:focus {
            color: #135e96;
            box-shadow: 0 0 0 1px #2271b1;
            outline: 2px solid transparent;
        }
        .radplapag-schedule-toggle .toggle-indicator {
            float: left;
            margin-top: 5px;
            margin-right: 5px;
            width: 20px;
            height: 20px;
            display: inline-block;
            position: relative;
            color: #50575e;
        }
        .radplapag-schedule-toggle .toggle-indicator:before {
            content: "\f140"; /* Dashicon for arrow-up-alt2 (collapsed) */
            font: normal 20px/1 dashicons;
            speak: never;
            display: inline-block;
            padding: 0;
            top: 0;
            left: 0;
            position: relative;
            vertical-align: top;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-decoration: none !important;
        }
        .radplapag-schedule-toggle[aria-expanded="false"] .toggle-indicator:before {
            content: "\f140"; /* Dashicon for arrow-up-alt2 (collapsed) */
        }
        .radplapag-schedule-toggle[aria-expanded="true"] .toggle-indicator:before {
            content: "\f142"; /* Dashicon for arrow-down-alt2 (expanded) */
        }
        .radplapag-schedule-wrapper {
            transition: max-height 0.3s ease, opacity 0.3s ease, margin 0.3s ease, padding 0.3s ease;
            overflow: hidden;
        }
        .radplapag-schedule-wrapper.radplapag-schedule-collapsed {
            max-height: 0;
            opacity: 0;
            margin: 0;
            padding: 0;
        }
        .radplapag-schedule-wrapper:not(.radplapag-schedule-collapsed) {
            max-height: 5000px;
            opacity: 1;
        }
        .radplapag-program-definition-row {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
            margin-bottom: 8px;
            padding: 8px;
            border: 1px solid #ccd0d4;
            border-radius: 3px;
            transition: border-color 0.3s ease;
            background: #fff;
        }
        .radplapag-program-definition-line {
            width: 100%;
            display: flex;
            flex-direction: row;
            justify-content: flex-start;
            align-items: center;
            gap: 18px;
        }
        .radplapag-program-definition-name-cell {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
        }
        .radplapag-program-definition-line .radplapag-program-definition-main {
            display: flex;
            flex-direction: row;
            align-items: flex-start;
            gap: 24px;
        }
        .radplapag-program-definition-remove-cell {
            display: flex;
            align-items: flex-start;
            margin-left: auto;
        }
        .radplapag-program-definition-row.radplapag-error {
            border-color: #dc3232;
            background-color: #fff5f5;
        }
        .radplapag-program-definition-row input.radplapag-error {
            border-color: #dc3232;
            box-shadow: 0 0 2px rgba(220, 50, 50, 0.3);
        }
        .radplapag-program-definition-row .radplapag-program-error-message {
            width: 100%;
            color: #dc3232;
            font-size: 12px;
            margin-top: 4px;
        }
        .radplapag-program-definition-row .radplapag-program-error-message.show {
            display: block !important;
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
                var urlInput = row.querySelector('.radplapag-stream-url');
                var pageSelect = row.querySelector('.radplapag-player-page');
                var titleInput = row.querySelector('.radplapag-station-title-input');
                
                urlInput.value = '';
                
                pageSelect.value = '';

                if (titleInput) {
                    titleInput.value = '';
                }

                // Clear field errors so no stale messages when row is shown again
                ['player_page', 'stream_url', 'station_title'].forEach(function(fieldName) {
                    var fieldTr = row.querySelector('tr[data-field="' + fieldName + '"]');
                    if (fieldTr) {
                        clearFieldError(fieldTr);
                    }
                });

                // Clear images
                row.querySelectorAll('.radplapag-image-upload-wrapper').forEach(function(wrapper) {
                    wrapper.querySelector('.radplapag-image-id').value = '';
                    wrapper.querySelector('.radplapag-image-preview').innerHTML = '';
                    wrapper.querySelector('.radplapag-remove-image-btn').style.display = 'none';
                });
                
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
                            title.textContent = '<?php echo esc_js( __( 'Stream', 'radio-player-page' ) ); ?> ' + visibleCount;
                        }
                        updateAddButton();
                        updatePageOptions();
                    }
                }

        // Image Upload Logic
        function initImageUpload() {
            var file_frame;

            container.addEventListener('click', function(e) {
                if (e.target.classList.contains('radplapag-upload-btn')) {
                    e.preventDefault();
                    var wrapper = e.target.closest('.radplapag-image-upload-wrapper');
                    var inputId = wrapper.querySelector('.radplapag-image-id');
                    var preview = wrapper.querySelector('.radplapag-image-preview');
                    var removeBtn = wrapper.querySelector('.radplapag-remove-image-btn');

                    // Create the media frame.
                    if ( file_frame ) {
                        file_frame.open();
                        return;
                    }

                    var isProgramDefFrame = wrapper.closest('.radplapag-program-definition-row') !== null;
                    var frameTitle = isProgramDefFrame ? '<?php echo esc_js( __( 'Add program image', 'radio-player-page' ) ); ?>' : '<?php echo esc_js( __( 'Select Image', 'radio-player-page' ) ); ?>';
                    var frameButtonText = isProgramDefFrame ? '<?php echo esc_js( __( 'Add program image', 'radio-player-page' ) ); ?>' : '<?php echo esc_js( __( 'Select Image', 'radio-player-page' ) ); ?>';
                    file_frame = wp.media.frames.file_frame = wp.media({
                        title: frameTitle,
                        button: {
                            text: frameButtonText,
                        },
                        multiple: false
                    });

                    file_frame.on('select', function() {
                        var attachment = file_frame.state().get('selection').first().toJSON();
                        inputId.value = attachment.id;
                        var isProgramDef = wrapper.closest('.radplapag-program-definition-row') !== null;
                        var sizeStyle = isProgramDef ? 'max-width:30px;max-height:30px;display:block;' : 'max-width:150px;max-height:150px;display:block;';
                        preview.innerHTML = '<img src="' + attachment.url + '" alt="" style="' + sizeStyle + '">';
                        removeBtn.style.display = 'inline-block';
                        if (isProgramDef) {
                            wrapper.querySelector('.radplapag-upload-btn').textContent = '<?php echo esc_js( __( 'Change image', 'radio-player-page' ) ); ?>';
                        }
                        
                        // We must clear the frame so next time it opens fresh (or we need to update closure vars)
                        // Actually better to just attach event per click or update vars.
                        // For simplicity in this structure, we'll just let it rely on the closure vars
                        // BUT, since file_frame is global-ish here, it will reuse the last wrapper unless we reconstruct it
                        // or unbind/rebind 'select'.
                        // Let's destroy frame reference to force recreation for correct closure capture
                         file_frame = null; 
                    });

                    file_frame.open();
                    
                    // Hack to fix the closure issue if we didn't nulify:
                    // We nulify file_frame above so it recreates with the correct 'wrapper' in scope.
                }

                if (e.target.classList.contains('radplapag-remove-image-btn')) {
                    e.preventDefault();
                    var wrapper = e.target.closest('.radplapag-image-upload-wrapper');
                    wrapper.querySelector('.radplapag-image-id').value = '';
                    wrapper.querySelector('.radplapag-image-preview').innerHTML = '';
                    e.target.style.display = 'none';
                    if (wrapper.closest('.radplapag-program-definition-row')) {
                        wrapper.querySelector('.radplapag-upload-btn').textContent = '<?php echo esc_js( __( 'Add program image', 'radio-player-page' ) ); ?>';
                    }
                }
            });
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
        
        // Station field validation: translated messages (same pattern as program validation)
        var stationFieldMessages = {
            streamUrlRequired: '<?php echo esc_js( __( 'This field is required.', 'radio-player-page' ) ); ?>',
            streamUrlInvalid: '<?php echo esc_js( __( 'Please enter a valid URL.', 'radio-player-page' ) ); ?>',
            playerPageRequired: '<?php echo esc_js( __( 'This field is required.', 'radio-player-page' ) ); ?>',
            stationTitleMax: '<?php echo esc_js( __( 'Stream title must be 64 characters or less.', 'radio-player-page' ) ); ?>'
        };
        
        function showFieldError(fieldTr, message) {
            var td = fieldTr.querySelector('td:last-child') || fieldTr.cells[1];
            if (!td) { return; }
            var input = td.querySelector('input, select');
            if (input) {
                input.classList.add('radplapag-error');
            }
            td.classList.add('radplapag-error');
            var existing = td.querySelector('.radplapag-field-error-message');
            if (existing) {
                existing.textContent = message;
                existing.classList.add('show');
            } else {
                var errorMsg = document.createElement('div');
                errorMsg.className = 'radplapag-field-error-message show';
                errorMsg.textContent = message;
                td.appendChild(errorMsg);
            }
        }
        
        function clearFieldError(fieldTr) {
            var td = fieldTr.querySelector('td:last-child') || fieldTr.cells[1];
            if (!td) { return; }
            var input = td.querySelector('input, select');
            if (input) {
                input.classList.remove('radplapag-error');
            }
            td.classList.remove('radplapag-error');
            var existing = td.querySelector('.radplapag-field-error-message');
            if (existing) {
                existing.remove();
            }
        }
        
        function validateStreamUrl(value, isRequired) {
            var trimmed = (value || '').trim();
            if (isRequired && !trimmed) {
                return { valid: false, message: stationFieldMessages.streamUrlRequired };
            }
            if (trimmed) {
                try {
                    new URL(trimmed);
                } catch (err) {
                    return { valid: false, message: stationFieldMessages.streamUrlInvalid };
                }
            }
            return { valid: true };
        }
        
        function validatePlayerPage(value, isRequired) {
            if (isRequired && (!value || value === '')) {
                return { valid: false, message: stationFieldMessages.playerPageRequired };
            }
            return { valid: true };
        }
        
        function validateStationTitle(value) {
            if (value && value.length > 64) {
                return { valid: false, message: stationFieldMessages.stationTitleMax };
            }
            return { valid: true };
        }
        
        function validateStationRow(stationRow) {
            if (window.getComputedStyle(stationRow).display === 'none') {
                return { valid: true };
            }
            var isRequired = true;
            var fields = ['player_page', 'stream_url', 'station_title'];
            for (var f = 0; f < fields.length; f++) {
                var fieldName = fields[f];
                var fieldTr = stationRow.querySelector('tr[data-field="' + fieldName + '"]');
                if (!fieldTr) { continue; }
                var td = fieldTr.querySelector('td:last-child') || fieldTr.cells[1];
                if (!td) { continue; }
                var input = td.querySelector('input, select');
                var value = input ? (input.value || '').trim() : '';
                if (fieldName === 'player_page') {
                    value = input ? input.value : '';
                }
                var result;
                if (fieldName === 'player_page') {
                    result = validatePlayerPage(value, isRequired);
                } else if (fieldName === 'stream_url') {
                    result = validateStreamUrl(value, isRequired);
                } else {
                    result = validateStationTitle(value);
                }
                if (!result.valid) {
                    showFieldError(fieldTr, result.message);
                    return { valid: false, firstErrorTr: fieldTr };
                }
                clearFieldError(fieldTr);
            }
            return { valid: true };
        }
        
        // Station field validation on focusout (event delegation for visible rows only)
        container.addEventListener('focusout', function(e) {
            var target = e.target;
            if (!target || !target.classList) { return; }
            var fieldTr = target.closest ? target.closest('tr[data-field]') : null;
            if (!fieldTr) { return; }
            var stationRow = target.closest('.radplapag-station-row');
            if (!stationRow || window.getComputedStyle(stationRow).display === 'none') { return; }
            var fieldName = fieldTr.getAttribute('data-field');
            if (!fieldName || ['player_page', 'stream_url', 'station_title'].indexOf(fieldName) === -1) { return; }
            var value = (target.value || '').trim();
            if (fieldName === 'player_page') { value = target.value || ''; }
            var result;
            if (fieldName === 'player_page') {
                result = validatePlayerPage(value, true);
            } else if (fieldName === 'stream_url') {
                result = validateStreamUrl(value, true);
            } else {
                result = validateStationTitle(value);
            }
            if (!result.valid) {
                showFieldError(fieldTr, result.message);
            } else {
                clearFieldError(fieldTr);
            }
        });
        
        // Program definition row: validate when focus leaves; sync schedule selects when name changes
        function setupProgramDefinitionGroupValidation(defRow) {
            defRow.addEventListener('focusout', function(e) {
                var relatedTarget = e.relatedTarget;
                var isStillInGroup = relatedTarget && defRow.contains(relatedTarget);
                if (!isStillInGroup) {
                    setTimeout(function() {
                        if (!defRow.parentNode) return;
                        var activeElement = document.activeElement;
                        if (!defRow.contains(activeElement)) {
                            validateProgramDefinitionRow(defRow);
                        }
                    }, 10);
                }
            });
            var nameInput = defRow.querySelector('.radplapag-program-definition-name');
            if (nameInput) {
                nameInput.addEventListener('input', function() {
                    var stationRow = defRow.closest('.radplapag-station-row');
                    var stationIndex = stationRow ? stationRow.getAttribute('data-index') : null;
                    if (stationIndex !== null) syncProgramSelects(stationIndex);
                });
            }
        }
        container.querySelectorAll('.radplapag-program-definition-row').forEach(function(defRow) {
            setupProgramDefinitionGroupValidation(defRow);
        });
        
        // Program Schedule Validation Functions
        // Day labels for error messages
        var dayLabels = {
            'monday': '<?php echo esc_js( __( 'Monday', 'radio-player-page' ) ); ?>',
            'tuesday': '<?php echo esc_js( __( 'Tuesday', 'radio-player-page' ) ); ?>',
            'wednesday': '<?php echo esc_js( __( 'Wednesday', 'radio-player-page' ) ); ?>',
            'thursday': '<?php echo esc_js( __( 'Thursday', 'radio-player-page' ) ); ?>',
            'friday': '<?php echo esc_js( __( 'Friday', 'radio-player-page' ) ); ?>',
            'saturday': '<?php echo esc_js( __( 'Saturday', 'radio-player-page' ) ); ?>',
            'sunday': '<?php echo esc_js( __( 'Sunday', 'radio-player-page' ) ); ?>'
        };
        
        // Helper function to format overlap error message with day and time
        function formatOverlapMessage(programName, dayKey, startTime, endTime) {
            var dayLabel = dayLabels[dayKey] || dayKey;
            var timeRange = startTime + ' - ' + endTime;
            return programName + ' (' + dayLabel + ', ' + timeRange + ')';
        }
        
        function validateTimeFormat(timeString) {
            // Validate time format using same regex as backend: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
            var timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
            if (!timeString || !timeRegex.test(timeString)) {
                return { valid: false, message: '<?php echo esc_js( __( 'Invalid time format. Times must be in HH:MM format.', 'radio-player-page' ) ); ?>' };
            }
            return { valid: true };
        }
        
        function validateTimeRange(startTime, endTime) {
            if (!startTime || !endTime) {
                return { valid: false, message: '<?php echo esc_js( __( 'Please complete all time fields', 'radio-player-page' ) ); ?>' };
            }
            
            // Validate time format first
            var startFormatValidation = validateTimeFormat(startTime);
            if (!startFormatValidation.valid) {
                return startFormatValidation;
            }
            
            var endFormatValidation = validateTimeFormat(endTime);
            if (!endFormatValidation.valid) {
                return endFormatValidation;
            }
            
            var start = timeToMinutes(startTime);
            var end = timeToMinutes(endTime);
            
            // Allow programs that cross midnight (e.g., 23:00 to 00:00)
            // If end <= start, it means the program crosses midnight
            // In this case, we treat it as valid (end is on next day)
            // Only invalid if start and end are exactly the same
            if (start === end) {
                return { valid: false, message: '<?php echo esc_js( __( 'Start and end times cannot be the same', 'radio-player-page' ) ); ?>' };
            }
            
            return { valid: true };
        }
        
        function timeToMinutes(timeString) {
            if (!timeString || timeString.length < 5) {
                return 0;
            }
            var parts = timeString.split(':');
            return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        }
        
        function checkOverlaps(dayWrapper, currentRow, excludeIndex) {
            var allRows = dayWrapper.querySelectorAll('.radplapag-program-row');
            var currentStart = currentRow.querySelector('.radplapag-program-start').value;
            var currentEnd = currentRow.querySelector('.radplapag-program-end').value;
            
            if (!currentStart || !currentEnd) {
                return { valid: true };
            }
            
            var currentStartMin = timeToMinutes(currentStart);
            var currentEndMin = timeToMinutes(currentEnd);
            
            for (var i = 0; i < allRows.length; i++) {
                if (i === excludeIndex) {
                    continue;
                }
                
                var row = allRows[i];
                // Skip hidden rows
                if (window.getComputedStyle(row).display === 'none') {
                    continue;
                }
                
                var otherStart = row.querySelector('.radplapag-program-start').value;
                var otherEnd = row.querySelector('.radplapag-program-end').value;
                
                if (!otherStart || !otherEnd) {
                    continue;
                }
                
                var otherStartMin = timeToMinutes(otherStart);
                var otherEndMin = timeToMinutes(otherEnd);
                
                // Handle programs that cross midnight
                // If end <= start, the program crosses midnight (ends next day)
                var currentEndForOverlap = currentEndMin;
                var otherEndForOverlap = otherEndMin;
                
                if (currentEndMin <= currentStartMin) {
                    // Current program crosses midnight, treat end as next day (24:00 = 1440 minutes)
                    currentEndForOverlap = 24 * 60;
                }
                if (otherEndMin <= otherStartMin) {
                    // Other program crosses midnight, treat end as next day
                    otherEndForOverlap = 24 * 60;
                }
                
                // Check for overlap: (start1 < end2 && end1 > start2)
                if (currentStartMin < otherEndForOverlap && currentEndForOverlap > otherStartMin) {
                    var otherSel = row.querySelector('.radplapag-program-id');
                    var otherName = (otherSel && otherSel.options[otherSel.selectedIndex]) ? otherSel.options[otherSel.selectedIndex].text : '<?php echo esc_js( __( 'Unnamed program', 'radio-player-page' ) ); ?>';
                    if (!otherName) otherName = '<?php echo esc_js( __( 'Unnamed program', 'radio-player-page' ) ); ?>';
                    // Get day from dayWrapper
                    var dayKey = dayWrapper.getAttribute('data-day');
                    var formattedMessage = formatOverlapMessage(otherName, dayKey, otherStart, otherEnd);
                    return {
                        valid: false,
                        message: '<?php echo esc_js( __( 'This time slot overlaps with', 'radio-player-page' ) ); ?>: ' + formattedMessage
                    };
                }
            }
            
            return { valid: true };
        }
        
        // Check for overlaps with programs on the next day (for programs that cross midnight)
        function checkCrossDayOverlaps(programRow) {
            var startInput = programRow.querySelector('.radplapag-program-start');
            var endInput = programRow.querySelector('.radplapag-program-end');
            var programIdSelect = programRow.querySelector('.radplapag-program-id');
            
            if (!startInput || !endInput || !programIdSelect) {
                return { valid: true };
            }
            
            var start = startInput.value;
            var end = endInput.value;
            var programId = programIdSelect.value;
            var name = (programIdSelect.options[programIdSelect.selectedIndex]) ? programIdSelect.options[programIdSelect.selectedIndex].text : '';
            
            // Only check if program has all fields filled
            if (!start || !end || !programId) {
                return { valid: true };
            }
            
            var startMin = timeToMinutes(start);
            var endMin = timeToMinutes(end);
            
            // Only check if program crosses midnight
            if (endMin > startMin) {
                return { valid: true };
            }
            
            // Program crosses midnight, check next day
            var scheduleWrapper = programRow.closest('.radplapag-schedule-wrapper');
            if (!scheduleWrapper) {
                return { valid: true };
            }
            
            var currentDayWrapper = programRow.closest('.radplapag-schedule-day');
            if (!currentDayWrapper) {
                return { valid: true };
            }
            
            var currentDay = currentDayWrapper.getAttribute('data-day');
            if (!currentDay) {
                return { valid: true };
            }
            
            // Map of days to next day
            var dayMap = {
                'monday': 'tuesday',
                'tuesday': 'wednesday',
                'wednesday': 'thursday',
                'thursday': 'friday',
                'friday': 'saturday',
                'saturday': 'sunday',
                'sunday': 'monday'
            };
            
            var nextDay = dayMap[currentDay];
            if (!nextDay) {
                return { valid: true };
            }
            
            // Find next day's wrapper
            var nextDayWrapper = scheduleWrapper.querySelector('.radplapag-schedule-day[data-day="' + nextDay + '"]');
            if (!nextDayWrapper) {
                return { valid: true };
            }
            
            // Check all programs in next day
            var nextDayRows = nextDayWrapper.querySelectorAll('.radplapag-program-row');
            for (var i = 0; i < nextDayRows.length; i++) {
                var nextRow = nextDayRows[i];
                
                // Skip hidden rows
                if (window.getComputedStyle(nextRow).display === 'none') {
                    continue;
                }
                
                var nextStartInput = nextRow.querySelector('.radplapag-program-start');
                var nextEndInput = nextRow.querySelector('.radplapag-program-end');
                var nextProgramIdSelect = nextRow.querySelector('.radplapag-program-id');
                
                if (!nextStartInput || !nextEndInput || !nextProgramIdSelect) {
                    continue;
                }
                
                var nextStart = nextStartInput.value;
                var nextEnd = nextEndInput.value;
                var nextProgramId = nextProgramIdSelect.value;
                var nextName = (nextProgramIdSelect.options[nextProgramIdSelect.selectedIndex]) ? nextProgramIdSelect.options[nextProgramIdSelect.selectedIndex].text : '';
                
                // Skip incomplete programs
                if (!nextStart || !nextEnd || !nextProgramId) {
                    continue;
                }
                
                var nextStartMin = timeToMinutes(nextStart);
                var nextEndMin = timeToMinutes(nextEnd);
                
                // Handle next program that might also cross midnight
                var nextEndForOverlap = nextEndMin;
                if (nextEndMin <= nextStartMin) {
                    nextEndForOverlap = 24 * 60;
                }
                
                // Check for overlap: crossing program ends at endMin on next day (e.g., 01:00 = 60 minutes)
                // Next day program starts at nextStartMin
                // Overlap if: endMin > nextStartMin (crossing program ends after next program starts)
                if (endMin > nextStartMin) {
                    // Format messages with day and time
                    var nextFormattedMessage = formatOverlapMessage(nextName, nextDay, nextStart, nextEnd);
                    var currentFormattedMessage = formatOverlapMessage(name, currentDay, start, end);
                    
                    // Unified error message format for both programs
                    var errorMessage = '<?php echo esc_js( __( 'This time slot overlaps with', 'radio-player-page' ) ); ?>: ' + nextFormattedMessage;
                    
                    // Mark error in the program on next day
                    showProgramError(nextRow, '<?php echo esc_js( __( 'This time slot overlaps with', 'radio-player-page' ) ); ?>: ' + currentFormattedMessage);
                    
                    return {
                        valid: false,
                        message: errorMessage
                    };
                }
            }
            
            return { valid: true };
        }
        
        function validateProgramRow(programRow) {
            var programIdSelect = programRow.querySelector('.radplapag-program-id');
            var programId = programIdSelect ? programIdSelect.value : '';
            var name = (programIdSelect && programIdSelect.options[programIdSelect.selectedIndex]) ? programIdSelect.options[programIdSelect.selectedIndex].text : '';
            var start = programRow.querySelector('.radplapag-program-start').value;
            var end = programRow.querySelector('.radplapag-program-end').value;
            
            // Step 1: Check if program is completely empty
            var hasData = programId || start || end;
            if (!hasData) {
                clearProgramError(programRow);
                return { valid: true, isEmpty: true };
            }
            
            // Step 2: Validate that program is required if times are provided
            if ((start || end) && !programId) {
                var errorMessage = '<?php echo esc_js( __( 'Please select a program.', 'radio-player-page' ) ); ?>';
                showProgramError(programRow, errorMessage);
                return { valid: false, message: errorMessage };
            }
            
            // Step 2b: If a program is selected, it must have a name (only valid programs appear in the list; re-check in case name was cleared)
            if (programId) {
                var stationRow = programRow.closest('.radplapag-station-row');
                var definitionsList = stationRow ? stationRow.querySelector('.radplapag-program-definitions-list') : null;
                var defRows = definitionsList ? definitionsList.querySelectorAll('.radplapag-program-definition-row') : [];
                var idx = parseInt(programId, 10);
                if (idx >= 0 && idx < defRows.length) {
                    var defRow = defRows[idx];
                    var nameInput = defRow ? defRow.querySelector('.radplapag-program-definition-name') : null;
                    var programName = nameInput ? nameInput.value.trim() : '';
                    if (programName === '') {
                        var errorMessage = '<?php echo esc_js( __( 'Please select a program with a name. Program name is required.', 'radio-player-page' ) ); ?>';
                        showProgramError(programRow, errorMessage);
                        return { valid: false, message: errorMessage };
                    }
                }
            }
            
            // Step 3: Validate time format (if times are provided)
            if (start || end) {
                if (start) {
                    var startFormatValidation = validateTimeFormat(start);
                    if (!startFormatValidation.valid) {
                        showProgramError(programRow, startFormatValidation.message);
                        return { valid: false, message: startFormatValidation.message };
                    }
                }
                
                if (end) {
                    var endFormatValidation = validateTimeFormat(end);
                    if (!endFormatValidation.valid) {
                        showProgramError(programRow, endFormatValidation.message);
                        return { valid: false, message: endFormatValidation.message };
                    }
                }
            }
            
            // Step 4: Validate time range (if both times are provided)
            if (start && end) {
                var timeRangeValidation = validateTimeRange(start, end);
                if (!timeRangeValidation.valid) {
                    showProgramError(programRow, timeRangeValidation.message);
                    return { valid: false, message: timeRangeValidation.message };
                }
            }
            
            // Step 5: If program is incomplete (missing program, start, or end), show error
            if (!programId || !start || !end) {
                var errorMessage = '<?php echo esc_js( __( 'All fields are required.', 'radio-player-page' ) ); ?>';
                showProgramError(programRow, errorMessage);
                return { valid: false, message: errorMessage };
            }
            
            // Step 6: Check for overlaps within the same day
            var dayWrapper = programRow.closest('.radplapag-schedule-day');
            var allRows = dayWrapper.querySelectorAll('.radplapag-program-row');
            var currentIndex = Array.prototype.indexOf.call(allRows, programRow);
            var overlapCheck = checkOverlaps(dayWrapper, programRow, currentIndex);
            
            if (!overlapCheck.valid) {
                showProgramError(programRow, overlapCheck.message);
                return { valid: false, message: overlapCheck.message };
            }
            
            // Step 7: Check for cross-day overlaps (programs that cross midnight)
            var crossDayOverlapCheck = checkCrossDayOverlaps(programRow);
            if (!crossDayOverlapCheck.valid) {
                showProgramError(programRow, crossDayOverlapCheck.message);
                return { valid: false, message: crossDayOverlapCheck.message };
            }
            
            // Step 8: Check if this program is overlapped by a program from previous day that crosses midnight
            var prevDayOverlapCheck = checkPrevDayCrossOverlaps(programRow);
            if (!prevDayOverlapCheck.valid) {
                showProgramError(programRow, prevDayOverlapCheck.message);
                return { valid: false, message: prevDayOverlapCheck.message };
            }
            
            // All validations passed
            clearProgramError(programRow);
            return { valid: true };
        }
        
        // Check if this program is overlapped by a program from previous day that crosses midnight
        function checkPrevDayCrossOverlaps(programRow) {
            var startInput = programRow.querySelector('.radplapag-program-start');
            var endInput = programRow.querySelector('.radplapag-program-end');
            var programIdSelect = programRow.querySelector('.radplapag-program-id');
            
            if (!startInput || !endInput || !programIdSelect) {
                return { valid: true };
            }
            
            var start = startInput.value;
            var end = endInput.value;
            var programId = programIdSelect.value;
            var name = (programIdSelect.options[programIdSelect.selectedIndex]) ? programIdSelect.options[programIdSelect.selectedIndex].text : '';
            
            // Only check if program has all fields filled
            if (!start || !end || !programId) {
                return { valid: true };
            }
            
            var startMin = timeToMinutes(start);
            var endMin = timeToMinutes(end);
            
            // Get schedule wrapper and current day
            var scheduleWrapper = programRow.closest('.radplapag-schedule-wrapper');
            if (!scheduleWrapper) {
                return { valid: true };
            }
            
            var currentDayWrapper = programRow.closest('.radplapag-schedule-day');
            if (!currentDayWrapper) {
                return { valid: true };
            }
            
            var currentDay = currentDayWrapper.getAttribute('data-day');
            if (!currentDay) {
                return { valid: true };
            }
            
            // Map of days to previous day
            var prevDayMap = {
                'monday': 'sunday',
                'tuesday': 'monday',
                'wednesday': 'tuesday',
                'thursday': 'wednesday',
                'friday': 'thursday',
                'saturday': 'friday',
                'sunday': 'saturday'
            };
            
            var prevDay = prevDayMap[currentDay];
            if (!prevDay) {
                return { valid: true };
            }
            
            // Find previous day's wrapper
            var prevDayWrapper = scheduleWrapper.querySelector('.radplapag-schedule-day[data-day="' + prevDay + '"]');
            if (!prevDayWrapper) {
                return { valid: true };
            }
            
            // Check all programs in previous day for ones that cross midnight
            var prevDayRows = prevDayWrapper.querySelectorAll('.radplapag-program-row');
            for (var i = 0; i < prevDayRows.length; i++) {
                var prevRow = prevDayRows[i];
                
                // Skip hidden rows
                if (window.getComputedStyle(prevRow).display === 'none') {
                    continue;
                }
                
                var prevStartInput = prevRow.querySelector('.radplapag-program-start');
                var prevEndInput = prevRow.querySelector('.radplapag-program-end');
                var prevProgramIdSelect = prevRow.querySelector('.radplapag-program-id');
                
                if (!prevStartInput || !prevEndInput || !prevProgramIdSelect) {
                    continue;
                }
                
                var prevStart = prevStartInput.value;
                var prevEnd = prevEndInput.value;
                var prevProgramId = prevProgramIdSelect.value;
                var prevName = (prevProgramIdSelect.options[prevProgramIdSelect.selectedIndex]) ? prevProgramIdSelect.options[prevProgramIdSelect.selectedIndex].text : '';
                
                // Skip incomplete programs
                if (!prevStart || !prevEnd || !prevProgramId) {
                    continue;
                }
                
                var prevStartMin = timeToMinutes(prevStart);
                var prevEndMin = timeToMinutes(prevEnd);
                
                // Only check programs that cross midnight (end <= start)
                if (prevEndMin > prevStartMin) {
                    continue;
                }
                
                // Check for overlap: previous day program crosses midnight and ends at prevEndMin on current day
                // Current day program starts at startMin
                // Overlap if: prevEndMin > startMin (previous program ends after current program starts)
                if (prevEndMin > startMin) {
                    // Format messages with day and time
                    var prevFormattedMessage = formatOverlapMessage(prevName, prevDay, prevStart, prevEnd);
                    var currentFormattedMessage = formatOverlapMessage(name, currentDay, start, end);
                    
                    // Unified error message format for both programs
                    var errorMessage = '<?php echo esc_js( __( 'This time slot overlaps with', 'radio-player-page' ) ); ?>: ' + prevFormattedMessage;
                    
                    // Mark error in the program from previous day
                    showProgramError(prevRow, '<?php echo esc_js( __( 'This time slot overlaps with', 'radio-player-page' ) ); ?>: ' + currentFormattedMessage);
                    
                    return {
                        valid: false,
                        message: errorMessage
                    };
                }
            }
            
            return { valid: true };
        }
        
        function showProgramError(programRow, message) {
            programRow.classList.add('radplapag-error');
            var startInput = programRow.querySelector('.radplapag-program-start');
            var endInput = programRow.querySelector('.radplapag-program-end');
            var programIdSelect = programRow.querySelector('.radplapag-program-id');
            if (startInput) startInput.classList.add('radplapag-error');
            if (endInput) endInput.classList.add('radplapag-error');
            if (programIdSelect) programIdSelect.classList.add('radplapag-error');
            
            // Remove existing error message if any
            var existingError = programRow.querySelector('.radplapag-program-error-message');
            if (existingError) {
                existingError.remove();
            }
            
            // Add error message
            var errorMsg = document.createElement('div');
            errorMsg.className = 'radplapag-program-error-message show';
            errorMsg.textContent = message;
            programRow.appendChild(errorMsg);
        }
        
        function clearProgramError(programRow) {
            programRow.classList.remove('radplapag-error');
            var inputs = programRow.querySelectorAll('input, select');
            inputs.forEach(function(el) {
                el.classList.remove('radplapag-error');
            });
            
            var errorMsg = programRow.querySelector('.radplapag-program-error-message');
            if (errorMsg) {
                errorMsg.remove();
            }
        }
        
        // Revalidate programs in adjacent days (for cross-day overlap detection)
        function revalidateAdjacentDays(programRow, scheduleWrapper, dayWrapper) {
            if (!scheduleWrapper || !dayWrapper) {
                return;
            }
            
            var currentDay = dayWrapper.getAttribute('data-day');
            if (!currentDay) {
                return;
            }
            
            var dayMap = {
                'monday': 'tuesday',
                'tuesday': 'wednesday',
                'wednesday': 'thursday',
                'thursday': 'friday',
                'friday': 'saturday',
                'saturday': 'sunday',
                'sunday': 'monday'
            };
            var prevDayMap = {
                'monday': 'sunday',
                'tuesday': 'monday',
                'wednesday': 'tuesday',
                'thursday': 'wednesday',
                'friday': 'thursday',
                'saturday': 'friday',
                'sunday': 'saturday'
            };
            
            // Re-validate next day (in case this program crosses midnight)
            var nextDay = dayMap[currentDay];
            if (nextDay) {
                var nextDayWrapper = scheduleWrapper.querySelector('.radplapag-schedule-day[data-day="' + nextDay + '"]');
                if (nextDayWrapper) {
                    nextDayWrapper.querySelectorAll('.radplapag-program-row').forEach(function(row) {
                        if (window.getComputedStyle(row).display !== 'none') {
                            validateProgramRow(row);
                        }
                    });
                }
            }
            
            // Re-validate previous day (in case previous day's programs cross midnight)
            var prevDay = prevDayMap[currentDay];
            if (prevDay) {
                var prevDayWrapper = scheduleWrapper.querySelector('.radplapag-schedule-day[data-day="' + prevDay + '"]');
                if (prevDayWrapper) {
                    prevDayWrapper.querySelectorAll('.radplapag-program-row').forEach(function(row) {
                        if (window.getComputedStyle(row).display !== 'none') {
                            validateProgramRow(row);
                        }
                    });
                }
            }
        }
        
        // Sync schedule selects with program definitions (only programs with a name are selectable)
        function syncProgramSelects(stationIndex) {
            var stationRow = container.querySelector('.radplapag-station-row[data-index="' + stationIndex + '"]');
            if (!stationRow) return;
            var definitionsList = stationRow.querySelector('.radplapag-program-definitions-list');
            if (!definitionsList) return;
            var defRows = definitionsList.querySelectorAll('.radplapag-program-definition-row');
            var programs = [];
            var validIndices = {};
            defRows.forEach(function(row, idx) {
                var nameInput = row.querySelector('.radplapag-program-definition-name');
                var name = nameInput ? nameInput.value.trim() : '';
                if (name !== '') {
                    programs.push({ index: idx, name: name });
                    validIndices[idx] = true;
                }
            });
            var scheduleWrapper = stationRow.querySelector('.radplapag-schedule-wrapper');
            if (!scheduleWrapper) return;
            var selects = scheduleWrapper.querySelectorAll('.radplapag-program-id');
            var maxIndex = (defRows && defRows.length) ? defRows.length - 1 : -1;
            selects.forEach(function(sel) {
                var currentVal = sel.value;
                sel.innerHTML = '<option value=""><?php echo esc_js( __( 'Select program', 'radio-player-page' ) ); ?></option>';
                programs.forEach(function(p) {
                    var opt = document.createElement('option');
                    opt.value = p.index;
                    opt.textContent = p.name;
                    sel.appendChild(opt);
                });
                var numVal = currentVal !== '' ? parseInt(currentVal, 10) : -1;
                if (numVal < 0 || numVal > maxIndex || !validIndices[numVal]) {
                    sel.value = '';
                } else {
                    sel.value = currentVal;
                }
            });
        }
        
        // Build HTML for program select (only programs with a name are included)
        function buildProgramSelectHtml(stationIndex, day, nextIndex) {
            var stationRow = container.querySelector('.radplapag-station-row[data-index="' + stationIndex + '"]');
            if (!stationRow) return '';
            var definitionsList = stationRow.querySelector('.radplapag-program-definitions-list');
            if (!definitionsList) return '';
            var defRows = definitionsList.querySelectorAll('.radplapag-program-definition-row');
            var opts = '<option value=""><?php echo esc_js( __( 'Select program', 'radio-player-page' ) ); ?></option>';
            defRows.forEach(function(row, idx) {
                var nameInput = row.querySelector('.radplapag-program-definition-name');
                var name = nameInput ? nameInput.value.trim() : '';
                if (name !== '') {
                    opts += '<option value="' + idx + '">' + name.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') + '</option>';
                }
            });
            return '<select name="radplapag_settings[stations][' + stationIndex + '][schedule][' + day + '][' + nextIndex + '][program_id]" class="radplapag-program-id" style="width: 200px; margin-right: 24px;">' + opts + '</select>';
        }
        
        // Program Schedule Management
        function initScheduleManagement() {
            // Sort program rows by start time (empty values last).
            function sortProgramsByStartTime(programsList) {
                if (!programsList || !programsList.querySelectorAll) return;
                var rows = Array.prototype.slice.call(programsList.querySelectorAll('.radplapag-program-row'));
                if (!rows || rows.length <= 1) return;

                rows.sort(function(a, b) {
                    var startA = (a.querySelector('.radplapag-program-start') || {}).value || '';
                    var startB = (b.querySelector('.radplapag-program-start') || {}).value || '';
                    if (!startA && !startB) return 0;
                    if (!startA) return 1;
                    if (!startB) return -1;
                    return startA.localeCompare(startB);
                });

                rows.forEach(function(row) {
                    programsList.appendChild(row);
                });
            }

            // Helper function to validate when focus leaves the program group
            // Each program row (name, start time, end time) is treated as a single group
            function setupGroupValidation(programRow) {
                // Use focusout on the program row container to detect when focus leaves the group
                programRow.addEventListener('focusout', function(e) {
                    var relatedTarget = e.relatedTarget;
                    
                    // Check if the next focused element is still within the group
                    // If relatedTarget is null or not in the group, focus has left the group
                    var isStillInGroup = relatedTarget && programRow.contains(relatedTarget);
                    
                    // Only validate if focus has left the group completely
                    if (!isStillInGroup) {
                        // Use setTimeout to ensure the focus change has completed
                        setTimeout(function() {
                            // Check if the programRow is still in the DOM (might have been removed)
                            if (!programRow.parentNode) {
                                return;
                            }
                            
                            // Double-check that focus is not still in the group
                            var activeElement = document.activeElement;
                            var stillInGroup = programRow.contains(activeElement);
                            
                            if (!stillInGroup) {
                                validateProgramRow(programRow);
                                
                                // Re-validate all programs in the same day to check for new overlaps
                                var dayWrapper = programRow.closest('.radplapag-schedule-day');
                                if (dayWrapper) {
                                    var allRows = dayWrapper.querySelectorAll('.radplapag-program-row');
                                    allRows.forEach(function(row) {
                                        if (row !== programRow) {
                                            validateProgramRow(row);
                                        }
                                    });
                                }
                                
                                // Re-validate programs in adjacent days for cross-day overlaps
                                var scheduleWrapper = programRow.closest('.radplapag-schedule-wrapper');
                                if (scheduleWrapper && dayWrapper) {
                                    revalidateAdjacentDays(programRow, scheduleWrapper, dayWrapper);
                                }

                                // Re-sort programs by start time
                                var programsList = dayWrapper.querySelector('.radplapag-programs-list');
                                if (programsList) {
                                    sortProgramsByStartTime(programsList);
                                }
                            }
                        }, 10);
                    }
                });
            }
            
            // Setup group validation for existing program rows
            container.querySelectorAll('.radplapag-program-row').forEach(function(programRow) {
                setupGroupValidation(programRow);
            });
            
            container.addEventListener('click', function(e) {
                // Add program
                if (e.target.classList.contains('radplapag-add-program')) {
                    e.preventDefault();
                    var day = e.target.getAttribute('data-day');
                    var dayWrapper = e.target.closest('.radplapag-schedule-day');
                    var programsList = dayWrapper ? dayWrapper.querySelector('.radplapag-programs-list') : null;
                    if (!dayWrapper || !programsList) return;
                    var stationIndex = e.target.closest('.radplapag-schedule-wrapper').getAttribute('data-station-index');
                    
                    // Find next available program index
                    var existingPrograms = programsList.querySelectorAll('.radplapag-program-row');
                    var nextIndex = existingPrograms ? existingPrograms.length : 0;
                    
                    // Always create a new program row (select + start + end)
                    var selectHtml = buildProgramSelectHtml(stationIndex, day, nextIndex);
                    var newRow = document.createElement('div');
                    newRow.className = 'radplapag-program-row';
                    newRow.setAttribute('data-program-index', nextIndex);
                    newRow.innerHTML = 
                        selectHtml +
                        '<input type="time" name="radplapag_settings[stations][' + stationIndex + '][schedule][' + day + '][' + nextIndex + '][start]" value="" class="radplapag-program-start" style="width: 100px; margin-right: 5px;">' +
                        '<span style="margin-right: 5px;"> <?php echo esc_js( __( 'to', 'radio-player-page' ) ); ?> </span>' +
                        '<input type="time" name="radplapag_settings[stations][' + stationIndex + '][schedule][' + day + '][' + nextIndex + '][end]" value="" class="radplapag-program-end" style="width: 100px; margin-right: 10px;">' +
                        '<div class="radplapag-schedule-remove-cell"><a href="#" class="submitdelete radplapag-remove-program"><?php echo esc_js( __( 'Remove time slot', 'radio-player-page' ) ); ?></a></div>' +
                        '<div class="radplapag-program-error-message" style="display: none;"></div>';
                    programsList.appendChild(newRow);
                    
                    // Setup group validation for the new program row
                    setupGroupValidation(newRow);
                }
                
                // Remove program
                if (e.target.classList.contains('radplapag-remove-program')) {
                    e.preventDefault();
                    var programRow = e.target.closest('.radplapag-program-row');
                    if (programRow) {
                        var dayWrapper = programRow.closest('.radplapag-schedule-day');
                        var scheduleWrapper = programRow.closest('.radplapag-schedule-wrapper');
                        
                        // Remove the program row from DOM
                        programRow.remove();
                        
                        // Re-validate other programs in the same day for overlaps
                        if (dayWrapper) {
                            dayWrapper.querySelectorAll('.radplapag-program-row').forEach(function(row) {
                                validateProgramRow(row);
                            });
                        }
                        
                        // Re-validate adjacent days for cross-day overlaps
                        if (scheduleWrapper && dayWrapper) {
                            // Get adjacent days
                            var currentDay = dayWrapper.getAttribute('data-day');
                            var days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                            var currentDayIndex = days.indexOf(currentDay);
                            
                            // Revalidate next day (for programs that cross midnight)
                            if (currentDayIndex < days.length - 1) {
                                var nextDay = days[currentDayIndex + 1];
                                var nextDayWrapper = scheduleWrapper.querySelector('.radplapag-schedule-day[data-day="' + nextDay + '"]');
                                if (nextDayWrapper) {
                                    nextDayWrapper.querySelectorAll('.radplapag-program-row').forEach(function(row) {
                                        validateProgramRow(row);
                                    });
                                }
                            }
                            
                            // Revalidate previous day (for programs from previous day that cross midnight)
                            if (currentDayIndex > 0) {
                                var prevDay = days[currentDayIndex - 1];
                                var prevDayWrapper = scheduleWrapper.querySelector('.radplapag-schedule-day[data-day="' + prevDay + '"]');
                                if (prevDayWrapper) {
                                    prevDayWrapper.querySelectorAll('.radplapag-program-row').forEach(function(row) {
                                        validateProgramRow(row);
                                    });
                                }
                            }
                        }
                    }
                }
            });
        }
        
        // Form submission validation
        var form = document.getElementById('radplapag-settings-form');
        if (form) {
            form.addEventListener('submit', function(e) {
                var hasErrors = false;
                var firstErrorElement = null;
                
                // Clear previous station field errors for visible stations
                container.querySelectorAll('.radplapag-station-row').forEach(function(stationRow) {
                    if (window.getComputedStyle(stationRow).display === 'none') {
                        return;
                    }
                    ['player_page', 'stream_url', 'station_title'].forEach(function(fieldName) {
                        var fieldTr = stationRow.querySelector('tr[data-field="' + fieldName + '"]');
                        if (fieldTr) {
                            clearFieldError(fieldTr);
                        }
                    });
                });
                
                // Validate visible station rows first
                container.querySelectorAll('.radplapag-station-row').forEach(function(stationRow) {
                    if (window.getComputedStyle(stationRow).display === 'none') {
                        return;
                    }
                    var validation = validateStationRow(stationRow);
                    if (!validation.valid) {
                        hasErrors = true;
                        if (!firstErrorElement && validation.firstErrorTr) {
                            firstErrorElement = validation.firstErrorTr;
                        }
                    }
                });
                
                // Validate visible program definition rows (name required)
                container.querySelectorAll('.radplapag-program-definition-row').forEach(function(defRow) {
                    var stationRow = defRow.closest('.radplapag-station-row');
                    if (!stationRow || window.getComputedStyle(stationRow).display === 'none') {
                        return;
                    }
                    var validation = validateProgramDefinitionRow(defRow);
                    if (!validation.valid) {
                        hasErrors = true;
                        if (!firstErrorElement) {
                            firstErrorElement = defRow;
                        }
                    }
                });
                
                // Validate all visible program rows
                container.querySelectorAll('.radplapag-program-row').forEach(function(row) {
                    if (window.getComputedStyle(row).display === 'none') {
                        return;
                    }
                    var validation = validateProgramRow(row);
                    if (!validation.valid) {
                        hasErrors = true;
                        if (!firstErrorElement) {
                            firstErrorElement = row;
                        }
                    }
                });
                
                if (hasErrors) {
                    e.preventDefault();
                    if (firstErrorElement) {
                        firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                    return false;
                }
            });
        }
        
        // Schedule Toggle Functionality (using event delegation for dynamically added elements)
        function initScheduleToggle() {
            // Use event delegation to handle clicks on toggle buttons (including dynamically added ones)
            container.addEventListener('click', function(e) {
                if (e.target.closest('.radplapag-schedule-toggle')) {
                    e.preventDefault();
                    var toggle = e.target.closest('.radplapag-schedule-toggle');
                    var stationIndex = toggle.getAttribute('data-station-index');
                    var scheduleWrapper = container.querySelector('.radplapag-schedule-wrapper[data-station-index="' + stationIndex + '"]');
                    
                    if (!scheduleWrapper) {
                        return;
                    }
                    
                    var isExpanded = toggle.getAttribute('aria-expanded') === 'true';
                    
                    if (isExpanded) {
                        // Collapse
                        scheduleWrapper.classList.add('radplapag-schedule-collapsed');
                        toggle.setAttribute('aria-expanded', 'false');
                        toggle.innerHTML = '<span class="toggle-indicator" aria-hidden="true"></span><?php echo esc_js( __( 'Show Program Schedule', 'radio-player-page' ) ); ?>';
                    } else {
                        // Expand
                        scheduleWrapper.classList.remove('radplapag-schedule-collapsed');
                        toggle.setAttribute('aria-expanded', 'true');
                        toggle.innerHTML = '<span class="toggle-indicator" aria-hidden="true"></span><?php echo esc_js( __( 'Hide Program Schedule', 'radio-player-page' ) ); ?>';
                    }
                }
            });
        }
        
        function initProgramsManagement() {
            container.addEventListener('click', function(e) {
                if (e.target.classList.contains('radplapag-add-program-definition')) {
                    e.preventDefault();
                    var stationIndex = e.target.getAttribute('data-station-index');
                    var stationRow = container.querySelector('.radplapag-station-row[data-index="' + stationIndex + '"]');
                    if (!stationRow) return;
                    var list = stationRow.querySelector('.radplapag-program-definitions-list');
                    if (!list) return;
                    var defRows = list.querySelectorAll('.radplapag-program-definition-row');
                    var nextIndex = defRows ? defRows.length : 0;
                    var newRow = document.createElement('div');
                    newRow.className = 'radplapag-program-definition-row';
                    newRow.setAttribute('data-program-def-index', nextIndex);
                    newRow.innerHTML = 
                        '<div class="radplapag-program-definition-line">' +
                        '<div class="radplapag-program-definition-name-cell">' +
                        '<input type="text" name="radplapag_settings[stations][' + stationIndex + '][programs][' + nextIndex + '][name]" value="" placeholder="<?php echo esc_js( __( 'Program name', 'radio-player-page' ) ); ?>" class="radplapag-program-definition-name" maxlength="64" style="width: 200px;">' +
                        '<div class="radplapag-program-error-message" style="display: none;"></div>' +
                        '</div>' +
                        '<div class="radplapag-program-definition-main">' +
                        '<div class="radplapag-image-upload-wrapper">' +
                        '<input type="hidden" name="radplapag_settings[stations][' + stationIndex + '][programs][' + nextIndex + '][logo_id]" value="0" class="radplapag-image-id">' +
                        '<div class="radplapag-image-preview"></div>' +
                        '<button type="button" class="button radplapag-upload-btn"><?php echo esc_js( __( 'Add program image', 'radio-player-page' ) ); ?></button>' +
                        '<button type="button" class="button radplapag-remove-image-btn" style="display:none;"><?php echo esc_js( __( 'Remove image', 'radio-player-page' ) ); ?></button>' +
                        '</div>' +
                        '</div>' +
                        '<div class="radplapag-program-definition-remove-cell">' +
                        '<a href="#" class="submitdelete radplapag-remove-program-definition" data-station-index="' + stationIndex + '" data-program-def-index="' + nextIndex + '"><?php echo esc_js( __( 'Remove program', 'radio-player-page' ) ); ?></a>' +
                        '</div>' +
                        '</div>';
                    list.appendChild(newRow);
                    setupProgramDefinitionGroupValidation(newRow);
                    syncProgramSelects(stationIndex);
                }
                
                if (e.target.classList.contains('radplapag-remove-program-definition')) {
                    e.preventDefault();
                    var stationIndex = e.target.getAttribute('data-station-index');
                    var stationRow = container.querySelector('.radplapag-station-row[data-index="' + stationIndex + '"]');
                    if (!stationRow) return;
                    var row = e.target.closest('.radplapag-program-definition-row');
                    if (!row) return;
                    row.remove();
                    var list = stationRow.querySelector('.radplapag-program-definitions-list');
                    if (!list) return;
                    var defRows = list.querySelectorAll('.radplapag-program-definition-row');
                    defRows.forEach(function(r, idx) {
                        r.setAttribute('data-program-def-index', idx);
                        var logoInput = r.querySelector('.radplapag-image-upload-wrapper input.radplapag-image-id');
                        var nameInput = r.querySelector('.radplapag-program-definition-name');
                        var removeBtn = r.querySelector('.radplapag-remove-program-definition');
                        if (logoInput) logoInput.name = 'radplapag_settings[stations][' + stationIndex + '][programs][' + idx + '][logo_id]';
                        if (nameInput) nameInput.name = 'radplapag_settings[stations][' + stationIndex + '][programs][' + idx + '][name]';
                        if (removeBtn) removeBtn.setAttribute('data-program-def-index', idx);
                    });
                    syncProgramSelects(stationIndex);
                }
            });
        }
        
        // Validate program definition row: name is required for a program to be valid (needed for schedule)
        function validateProgramDefinitionRow(defRow) {
            var nameInput = defRow.querySelector('.radplapag-program-definition-name');
            var logoInput = defRow.querySelector('.radplapag-image-upload-wrapper input.radplapag-image-id');
            var name = nameInput ? nameInput.value.trim() : '';
            var hasLogo = logoInput && parseInt(logoInput.value, 10) > 0;
            if (!name && !hasLogo) {
                clearProgramDefinitionError(defRow);
                return { valid: true };
            }
            if (!name) {
                showProgramDefinitionError(defRow, '<?php echo esc_js( __( 'Program name is required. Enter a name to use this program in the schedule.', 'radio-player-page' ) ); ?>');
                return { valid: false };
            }
            clearProgramDefinitionError(defRow);
            return { valid: true };
        }
        function showProgramDefinitionError(defRow, message) {
            defRow.classList.add('radplapag-error');
            var nameInput = defRow.querySelector('.radplapag-program-definition-name');
            if (nameInput) nameInput.classList.add('radplapag-error');
            var errorMsg = defRow.querySelector('.radplapag-program-error-message');
            if (errorMsg) {
                errorMsg.textContent = message;
                errorMsg.className = 'radplapag-program-error-message show';
            } else {
                errorMsg = document.createElement('div');
                errorMsg.className = 'radplapag-program-error-message show';
                errorMsg.textContent = message;
                if (nameInput && nameInput.nextSibling) {
                    defRow.insertBefore(errorMsg, nameInput.nextSibling);
                } else {
                    defRow.appendChild(errorMsg);
                }
            }
        }
        function clearProgramDefinitionError(defRow) {
            defRow.classList.remove('radplapag-error');
            var nameInput = defRow.querySelector('.radplapag-program-definition-name');
            if (nameInput) nameInput.classList.remove('radplapag-error');
            var errorMsg = defRow.querySelector('.radplapag-program-error-message');
            if (errorMsg) {
                errorMsg.textContent = '';
                errorMsg.className = 'radplapag-program-error-message';
                errorMsg.style.display = 'none';
            }
        }
        
        // Initialize
        updateAddButton();
        updatePageOptions();
        initImageUpload();
        initScheduleManagement();
        initScheduleToggle();
        initProgramsManagement();
    })();
    </script>
    <?php
}
