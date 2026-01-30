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
 *                     'logo_id' => int, 'theme_color' => string, 'visualizer' => string], ...]]
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
 * whitelist for security. Invalid entries are filtered out.
 *
 * @since 1.0.0
 *
 * @param array $input Raw settings input from form submission. Expected structure:
 *                     ['stations' => [['stream_url' => string, 'player_page' => int|string,
 *                     'station_title' => string, 'background_id' => int|string, 'logo_id' => int|string,
 *                     'theme_color' => string, 'visualizer' => string], ...]]
 * @return array Sanitized settings array with validated and cleaned data. Structure:
 *              ['stations' => [['stream_url' => string (escaped URL), 'player_page' => int,
 *              'station_title' => string (sanitized text), 'background_id' => int, 'logo_id' => int,
 *              'theme_color' => string (sanitized key), 'visualizer' => string (validated)], ...]]
 */
function radplapag_sanitize_settings( $input ) {
    // Verify nonce for security
    if ( ! isset( $_POST['_wpnonce'] ) || ! wp_verify_nonce( $_POST['_wpnonce'], 'radplapag_settings' ) ) {
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
        
        $output['stations'][] = [
            'stream_url'    => esc_url_raw( $url ),
            'player_page'   => $page,
            'station_title' => $title,
            'background_id' => $bg_id,
            'logo_id'       => $logo_id,
            'theme_color'   => $theme,
            'visualizer'    => $visualizer,
        ];
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
        $stations[] = [ 'stream_url' => '', 'player_page' => '', 'station_title' => '', 'background_id' => '', 'logo_id' => '', 'theme_color' => 'neutral', 'visualizer' => 'oscilloscope' ];
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
            wp_nonce_field( 'radplapag_settings' );
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
                                        <?php echo ( ! $is_empty || $index === 0 ) ? 'required' : ''; ?>
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
                                        <?php echo ( ! $is_empty || $index === 0 ) ? 'required' : ''; ?>
                                    >
                                </td>
                            </tr>
                            <tr>
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
                urlInput.required = false;
                
                pageSelect.value = '';
                pageSelect.required = false;

                if (titleInput) {
                    titleInput.value = '';
                }

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
                row.querySelector('.radplapag-stream-url').required = true;
                row.querySelector('.radplapag-player-page').required = true;
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

                    file_frame = wp.media.frames.file_frame = wp.media({
                        title: '<?php echo esc_js( __( 'Select Image', 'radio-player-page' ) ); ?>',
                        button: {
                            text: '<?php echo esc_js( __( 'Select Image', 'radio-player-page' ) ); ?>',
                        },
                        multiple: false
                    });

                    file_frame.on('select', function() {
                        var attachment = file_frame.state().get('selection').first().toJSON();
                        inputId.value = attachment.id;
                        preview.innerHTML = '<img src="' + attachment.url + '" alt="" style="max-width:150px;max-height:150px;display:block;">';
                        removeBtn.style.display = 'inline-block';
                        
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
        
        // Initialize
        updateAddButton();
        updatePageOptions();
        initImageUpload();
    })();
    </script>
    <?php
}
