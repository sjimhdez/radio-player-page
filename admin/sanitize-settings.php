<?php
defined( 'ABSPATH' ) || exit;

/**
 * Settings sanitization and validation.
 *
 * @package radio-player-page
 * @since 1.0.0
 */

/**
 * Validates and sanitizes settings input before saving to database.
 *
 * Processes the submitted form data, validates all fields, and sanitizes them
 * according to their data types. Only stations with both a valid streaming URL and
 * a selected player page are saved. Visualizer values are validated against a
 * whitelist for security. Program schedules are validated for time format, non-overlapping
 * intervals, and proper time ordering. Invalid entries are filtered out.
 *
 * @since 1.0.0
 *
 * @param array $input Raw settings input from form submission. Expected structure:
 *                     ['stations' => [['stream_url' => string, 'player_page' => int|string,
 *                     'station_title' => string, 'background_id' => int|string, 'logo_id' => int|string,
 *                     'theme_color' => string, 'visualizer' => string, 'programs' => array (with 'id' field),
 *                     'schedule' => array], ...]]
 * @return array Sanitized settings array with validated and cleaned data. Structure:
 *              ['stations' => [['stream_url' => string (escaped URL), 'player_page' => int,
 *              'station_title' => string (sanitized text), 'background_id' => int, 'logo_id' => int,
 *              'theme_color' => string (sanitized key), 'visualizer' => string (validated),
 *              'programs' => array (with unique 'id' strings), 'schedule' => array (optional, weekly schedule
 *              with programs referenced by unique ID strings)], ...]]
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

        // Sanitize and validate program definitions (id + name + logo_id per station)
        $programs_list = [];
        if ( isset( $station['programs'] ) && is_array( $station['programs'] ) ) {
            foreach ( $station['programs'] as $prog_def ) {
                if ( ! is_array( $prog_def ) ) {
                    continue;
                }
                $prog_id = isset( $prog_def['id'] ) ? sanitize_text_field( $prog_def['id'] ) : '';
                $prog_name = isset( $prog_def['name'] ) ? sanitize_text_field( $prog_def['name'] ) : '';
                $prog_description = isset( $prog_def['description'] ) ? sanitize_text_field( $prog_def['description'] ) : '';
                $prog_extended_description = isset( $prog_def['extended_description'] ) ? sanitize_textarea_field( $prog_def['extended_description'] ) : '';
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
                if ( strlen( $prog_description ) > 256 ) {
                    $prog_description = substr( $prog_description, 0, 256 );
                }
                if ( strlen( $prog_extended_description ) > 512 ) {
                    $prog_extended_description = substr( $prog_extended_description, 0, 512 );
                }
                // Generate unique ID if not provided
                if ( empty( $prog_id ) ) {
                    $prog_id = 'prog_' . wp_generate_password( 12, false );
                }
                // Validate ID format (must start with 'prog_' and be alphanumeric + underscore)
                if ( ! preg_match( '/^prog_[a-zA-Z0-9_]+$/', $prog_id ) ) {
                    $prog_id = 'prog_' . wp_generate_password( 12, false );
                }
                $programs_list[] = [
                    'id'                  => $prog_id,
                    'name'                => $prog_name,
                    'description'         => $prog_description,
                    'extended_description' => $prog_extended_description,
                    'logo_id'             => $prog_logo_id,
                ];
            }
        }

        // Sanitize and validate schedule if present (schedule entries use program_id (unique string ID) + start + end)
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
                // Schedule entries use program_id (unique string ID)
                $programs_data = [];
                foreach ( $station['schedule'][ $day ] as $prog_idx => $program ) {
                    if ( ! is_array( $program ) ) {
                        continue;
                    }

                    $program_id = isset( $program['program_id'] ) ? sanitize_text_field( $program['program_id'] ) : '';
                    $program_start = isset( $program['start'] ) ? trim( $program['start'] ) : '';
                    $program_end = isset( $program['end'] ) ? trim( $program['end'] ) : '';

                    // Filter out completely empty programs (no program selection, no start, no end)
                    if ( empty( $program_id ) && empty( $program_start ) && empty( $program_end ) ) {
                        continue;
                    }

                    // Validate that all fields are required if any field is filled
                    $has_program = ! empty( $program_id );
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

                    // Find program by ID (not by index)
                    $found_program = null;
                    foreach ( $programs_list as $prog ) {
                        if ( isset( $prog['id'] ) && $prog['id'] === $program_id ) {
                            $found_program = $prog;
                            break;
                        }
                    }

                    if ( ! $found_program ) {
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

                    $program_name = isset( $found_program['name'] ) ? $found_program['name'] : '';

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
                        'index' => $prog_idx, // Index in schedule array (for sorting), not program ID
                        'program_id' => $program_id, // Unique string ID
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

                    $program_id = isset( $program['program_id'] ) ? sanitize_text_field( $program['program_id'] ) : '';
                    // Find program by ID
                    $found_program = null;
                    foreach ( $programs_list as $prog ) {
                        if ( isset( $prog['id'] ) && $prog['id'] === $program_id ) {
                            $found_program = $prog;
                            break;
                        }
                    }
                    $program_name = $found_program ? ( isset( $found_program['name'] ) ? $found_program['name'] : '' ) : '';
                    $program_start = isset( $program['start'] ) ? trim( $program['start'] ) : '';
                    $program_end = isset( $program['end'] ) ? trim( $program['end'] ) : '';

                    if ( empty( $program_start ) || empty( $program_end ) || empty( $program_id ) || ! $found_program ) {
                        continue;
                    }

                    $start_time = strtotime( '2000-01-01 ' . $program_start . ':00' );
                    $end_time = strtotime( '2000-01-01 ' . $program_end . ':00' );

                    // If program crosses midnight
                    if ( $end_time <= $start_time ) {
                        // Get next day
                        $next_day_idx = ( $day_idx + 1 ) % 7;
                        $next_day = $days_array[ $next_day_idx ];

                        // Check for overlaps with programs on the next day
                        if ( isset( $schedule[ $next_day ] ) && is_array( $schedule[ $next_day ] ) ) {
                            foreach ( $schedule[ $next_day ] as $next_program ) {
                                if ( ! is_array( $next_program ) ) {
                                    continue;
                                }

                                $next_program_id = isset( $next_program['program_id'] ) ? sanitize_text_field( $next_program['program_id'] ) : '';
                                // Find next program by ID
                                $found_next_program = null;
                                foreach ( $programs_list as $prog ) {
                                    if ( isset( $prog['id'] ) && $prog['id'] === $next_program_id ) {
                                        $found_next_program = $prog;
                                        break;
                                    }
                                }
                                $next_program_name = $found_next_program ? ( isset( $found_next_program['name'] ) ? $found_next_program['name'] : '' ) : '';
                                $next_program_start = isset( $next_program['start'] ) ? trim( $next_program['start'] ) : '';
                                $next_program_end = isset( $next_program['end'] ) ? trim( $next_program['end'] ) : '';

                                if ( empty( $next_program_start ) || empty( $next_program_end ) || empty( $next_program_id ) || ! $found_next_program ) {
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

        // Add schedule if it exists (entries use program_id as unique string ID; frontend will resolve to name + logoUrl)
        if ( ! empty( $schedule ) ) {
            $station_data['schedule'] = $schedule;
        }

        $output['stations'][] = $station_data;
    }
    return $output;
}
