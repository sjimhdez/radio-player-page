<?php
defined( 'ABSPATH' ) || exit;

/**
 * Settings page render and admin strings for JS localization.
 *
 * @package radio-player-page
 * @since 1.0.0
 */

/**
 * Returns admin strings and config for JavaScript localization.
 *
 * @since 1.0.0
 *
 * @return array Array with 'maxStations' and 'strings' (translated strings for admin.js).
 */
function radplapag_get_admin_strings() {
    return [
        'maxStations' => 10,
        'strings'     => [
            'stationNumberFormat'      => __( 'Station %d', 'radio-player-page' ),
            'addProgramImage'          => __( 'Add Program Image', 'radio-player-page' ),
            'selectImage'              => __( 'Select Image', 'radio-player-page' ),
            'changeImage'              => __( 'Change Image', 'radio-player-page' ),
            'streamUrlRequired'        => __( 'This field is required.', 'radio-player-page' ),
            'streamUrlInvalid'         => __( 'Please enter a valid URL.', 'radio-player-page' ),
            'playerPageRequired'       => __( 'This field is required.', 'radio-player-page' ),
            'stationTitleMax'          => __( 'Station name must be 64 characters or less.', 'radio-player-page' ),
            'monday'                   => __( 'Monday', 'radio-player-page' ),
            'tuesday'                  => __( 'Tuesday', 'radio-player-page' ),
            'wednesday'                => __( 'Wednesday', 'radio-player-page' ),
            'thursday'                 => __( 'Thursday', 'radio-player-page' ),
            'friday'                   => __( 'Friday', 'radio-player-page' ),
            'saturday'                 => __( 'Saturday', 'radio-player-page' ),
            'sunday'                   => __( 'Sunday', 'radio-player-page' ),
            'invalidTimeFormat'        => __( 'Invalid time format. Times must be in HH:MM format.', 'radio-player-page' ),
            'completeTimeFields'       => __( 'Please complete all time fields.', 'radio-player-page' ),
            'startEndSame'             => __( 'Start and end times cannot be the same', 'radio-player-page' ),
            'unnamedProgram'           => __( 'Unnamed program', 'radio-player-page' ),
            'timeSlotOverlapsWith'     => __( 'This time slot overlaps with', 'radio-player-page' ),
            'timeSlotOverlapsWithMessage' => __( 'This time slot overlaps with: %s', 'radio-player-page' ),
            'pleaseSelectProgram'      => __( 'Please select a program.', 'radio-player-page' ),
            'pleaseSelectProgramWithName' => __( 'Please select a program and enter a name. Program name is required for the schedule.', 'radio-player-page' ),
            'allFieldsRequired'        => __( 'All fields are required.', 'radio-player-page' ),
            'selectProgram'            => __( 'Select Program', 'radio-player-page' ),
            'to'                       => __( 'to', 'radio-player-page' ),
            'removeTimeSlot'           => __( 'Remove Time Slot', 'radio-player-page' ),
            'showProgramSchedule'      => __( 'Show Program Schedule', 'radio-player-page' ),
            'hideProgramSchedule'      => __( 'Hide Program Schedule', 'radio-player-page' ),
            'programName'              => __( 'Program name', 'radio-player-page' ),
            'removeImage'              => __( 'Remove Image', 'radio-player-page' ),
            'removeProgram'            => __( 'Remove Program', 'radio-player-page' ),
            'programNameRequired'      => __( 'Program name is required. Enter a name to use this program in the schedule.', 'radio-player-page' ),
        ],
    ];
}

/**
 * Renders the complete settings page interface.
 *
 * Outputs the HTML form for configuring radio stations. CSS and JS are enqueued
 * via admin_enqueue_scripts in admin.php.
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
            <h2><?php esc_html_e( 'How to Use', 'radio-player-page' ); ?></h2>
            <p><?php esc_html_e( 'Configure up to ten stations. For each station, enter the streaming URL (Icecast, Shoutcast, or MP3) and select the WordPress page where the player will appear. You can optionally set a station name, logo image, and background image, and choose a theme color and visualizer. Optionally, define a weekly program schedule with time slots; the player will display the current and next program based on your site timezone.', 'radio-player-page' ); ?></p>
        </div>

        <form method="post" action="options.php" id="radplapag-settings-form">
            <?php settings_fields( 'radplapag_settings_group' ); ?>

            <div id="radplapag-stations-container">
                <?php foreach ( $stations as $index => $station ) :
                    $stream_url = isset( $station['stream_url'] ) ? esc_attr( $station['stream_url'] ) : '';
                    $player_page = isset( $station['player_page'] ) ? intval( $station['player_page'] ) : '';
                    $station_title = isset( $station['station_title'] ) ? esc_attr( $station['station_title'] ) : '';
                    $background_id = isset( $station['background_id'] ) ? intval( $station['background_id'] ) : '';
                    $logo_id = isset( $station['logo_id'] ) ? intval( $station['logo_id'] ) : '';
                    $theme_color = isset( $station['theme_color'] ) ? esc_attr( $station['theme_color'] ) : 'neutral';
                    $visualizer = isset( $station['visualizer'] ) ? esc_attr( $station['visualizer'] ) : 'oscilloscope';

                    $background_url = $background_id ? wp_get_attachment_image_url( $background_id, 'medium' ) : '';
                    $logo_url = $logo_id ? wp_get_attachment_image_url( $logo_id, 'medium' ) : '';

                    $is_empty = empty( $stream_url ) && empty( $player_page );
                    ?>
                    <div class="radplapag-station-row" data-index="<?php echo esc_attr( $index ); ?>" <?php echo $is_empty && $index > 0 ? 'style="display:none;"' : ''; ?>>
                        <h3 class="radplapag-station-title">
                            <?php
                            if ( ! $is_empty ) {
                                /* translators: %d: Station number */
                                echo esc_html( sprintf( __( 'Station %d', 'radio-player-page' ), $index + 1 ) );
                            } else {
                                esc_html_e( 'New Station', 'radio-player-page' );
                            }
                            ?>
                        </h3>
                        <table class="form-table" role="presentation">
                            <tr data-field="player_page">
                                <th scope="row">
                                    <label for="radplapag_page_<?php echo esc_attr( $index ); ?>">
                                        <?php esc_html_e( 'Player Page', 'radio-player-page' ); ?>
                                    </label>
                                </th>
                                <td>
                                    <select
                                        name="radplapag_settings[stations][<?php echo esc_attr( $index ); ?>][player_page]"
                                        id="radplapag_page_<?php echo esc_attr( $index ); ?>"
                                        class="radplapag-player-page"
                                    >
                                        <option value=""><?php esc_html_e( 'Select a Page', 'radio-player-page' ); ?></option>
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
                                        <?php esc_html_e( 'Streaming URL', 'radio-player-page' ); ?>
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
                                        <?php esc_html_e( 'Station Name (Optional)', 'radio-player-page' ); ?>
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
                            <tr>
                                <th scope="row">
                                    <label><?php esc_html_e( 'Logo Image (Optional)', 'radio-player-page' ); ?></label>
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
                                            <?php esc_html_e( 'Recommended size: 512x512 pixels or larger.', 'radio-player-page' ); ?>
                                        </p>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">
                                    <label><?php esc_html_e( 'Background Image (Optional)', 'radio-player-page' ); ?></label>
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
                            <tr>
                                <th scope="row">
                                    <label><?php esc_html_e( 'Program Schedule (Optional)', 'radio-player-page' ); ?></label>
                                </th>
                                <td>
                                    <?php
                                    $programs = isset( $station['programs'] ) && is_array( $station['programs'] ) ? $station['programs'] : [];
                                    $has_programs = ! empty( $programs );
                                    $schedule = isset( $station['schedule'] ) && is_array( $station['schedule'] ) ? $station['schedule'] : [];
                                    $days = [
                                        'monday'    => __( 'Monday', 'radio-player-page' ),
                                        'tuesday'   => __( 'Tuesday', 'radio-player-page' ),
                                        'wednesday' => __( 'Wednesday', 'radio-player-page' ),
                                        'thursday'  => __( 'Thursday', 'radio-player-page' ),
                                        'friday'    => __( 'Friday', 'radio-player-page' ),
                                        'saturday'  => __( 'Saturday', 'radio-player-page' ),
                                        'sunday'    => __( 'Sunday', 'radio-player-page' ),
                                    ];
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
                                                                <button type="button" class="button radplapag-upload-btn"><?php echo $prog_logo_id ? esc_html__( 'Change Image', 'radio-player-page' ) : esc_html__( 'Add Program Image', 'radio-player-page' ); ?></button>
                                                                <button type="button" class="button radplapag-remove-image-btn" <?php echo empty( $prog_logo_id ) ? 'style="display:none;"' : ''; ?>><?php esc_html_e( 'Remove Image', 'radio-player-page' ); ?></button>
                                                            </div>
                                                        </div>
                                                        <div class="radplapag-program-definition-remove-cell">
                                                            <a href="#" class="submitdelete radplapag-remove-program-definition" data-station-index="<?php echo esc_attr( $index ); ?>" data-program-def-index="<?php echo esc_attr( $prog_idx ); ?>"><?php esc_html_e( 'Remove Program', 'radio-player-page' ); ?></a>
                                                        </div>
                                                    </div>
                                                </div>
                                            <?php endforeach; ?>
                                        </div>
                                        <button type="button" class="button radplapag-add-program-definition" data-station-index="<?php echo esc_attr( $index ); ?>" style="margin-top: 5px; margin-bottom: 15px;">
                                            <?php esc_html_e( 'Add Program', 'radio-player-page' ); ?>
                                        </button>
                                        <hr style="margin: 10px 0;">
                                        <h3 style="margin: 10px 0;">
                                            <?php esc_html_e( 'Schedule', 'radio-player-page' ); ?>
                                        </h3>
                                        <p class="description" style="margin-bottom: 20px;">
                                            <?php esc_html_e( 'Define weekly program schedule. Programs are displayed automatically in the player based on current time.', 'radio-player-page' ); ?>
                                        </p>
                                        <?php foreach ( $days as $day_key => $day_label ) :
                                            $day_programs = isset( $schedule[ $day_key ] ) && is_array( $schedule[ $day_key ] ) ? $schedule[ $day_key ] : [];
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
                                                                    <option value=""><?php esc_html_e( 'Select Program', 'radio-player-page' ); ?></option>
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
                                                                    <a href="#" class="submitdelete radplapag-remove-program"><?php esc_html_e( 'Remove Time Slot', 'radio-player-page' ); ?></a>
                                                                </div>
                                                                <div class="radplapag-program-error-message" style="display: none;"></div>
                                                            </div>
                                                        <?php endforeach; ?>
                                                    <?php endif; ?>
                                                </div>
                                                <button type="button" class="button radplapag-add-program" data-day="<?php echo esc_attr( $day_key ); ?>" style="margin-top: 5px; margin-bottom: 15px;">
                                                    <?php esc_html_e( 'Add Time Slot', 'radio-player-page' ); ?>
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
                                <a href="#" class="submitdelete radplapag-remove-station" data-index="<?php echo esc_attr( $index ); ?>"><?php esc_html_e( 'Remove Station', 'radio-player-page' ); ?></a>
                            </p>
                        <?php endif; ?>
                    </div>
                <?php endforeach; ?>
            </div>

            <p>
                <button type="button" class="button radplapag-add-station" id="radplapag-add-station-btn" style="display:none;">
                    <?php esc_html_e( 'Add Station', 'radio-player-page' ); ?>
                </button>
            </p>

            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}
