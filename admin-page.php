<?php
defined( 'ABSPATH' ) || exit;

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
    $output = [];

    $url  = isset( $input['stream_url'] ) ? trim( $input['stream_url'] ) : '';
    $page = isset( $input['player_page'] ) ? intval( $input['player_page'] ) : 0;

    if ( empty( $url ) || empty( $page ) ) {
        add_settings_error(
            'radplapag_settings',
            'radplapag_settings_error',
            esc_html__( 'You must enter the stream URL and select a page.', 'radio-player-page' ),
            'error'
        );
        return get_option( 'radplapag_settings' );
    }

    $output['stream_url']  = esc_url_raw( $url );
    $output['player_page'] = $page;

    return $output;
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

    $options       = get_option( 'radplapag_settings', [] );
    $stream_url    = isset( $options['stream_url'] ) ? $options['stream_url'] : '';
    $selected_page = isset( $options['player_page'] ) ? intval( $options['player_page'] ) : '';
    $pages         = get_pages( [ 'post_status' => 'publish' ] );
    ?>
    <div class="wrap">
        <h1><?php esc_html_e( 'Radio Player Page Settings', 'radio-player-page' ); ?></h1>

        <?php settings_errors( 'radplapag_settings' ); ?>

        <form method="post" action="options.php">
            <?php
            settings_fields( 'radplapag_settings_group' );
            ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">
                        <label for="radplapag_stream_url"><?php esc_html_e( 'Stream URL', 'radio-player-page' ); ?></label>
                    </th>
                    <td>
                        <input name="radplapag_settings[stream_url]" type="url" id="radplapag_stream_url" value="<?php echo esc_url($stream_url); ?>" class="regular-text" required>
                        <p class="description"><?php esc_html_e( 'Example: https://my.station.com:8000/stream', 'radio-player-page' ); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="radplapag_page"><?php esc_html_e( 'Player page', 'radio-player-page' ); ?></label>
                    </th>
                    <td>
                        <select name="radplapag_settings[player_page]" id="radplapag_page" required>
                            <option value=""><?php esc_html_e( 'Select a page', 'radio-player-page' ); ?></option>
                            <?php foreach ( $pages as $page ) : ?>
                                <option value="<?php echo esc_attr( $page->ID ); ?>" <?php selected( $selected_page, $page->ID ); ?>>
                                    <?php echo esc_html( $page->post_title ); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <p class="description"><?php esc_html_e( 'The page where the player will be displayed.', 'radio-player-page' ); ?></p>
                    </td>
                </tr>
            </table>

            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}
