<?php
/**
 * Station CPT and meta: radplapag_station post type and metafields.
 *
 * Stations are stored as a Custom Post Type; schedule slots reference radplapag_program by post ID.
 *
 * @package radio-player-page
 * @since 3.3.0
 */

defined( 'ABSPATH' ) || exit;

/**
 * Registers the radplapag_station post type.
 *
 * @since 3.3.0
 *
 * @return void
 */
function radplapag_register_station_post_type() {
	$labels = array(
		'name'               => _x( 'Radio Stations', 'post type general name', 'radio-player-page' ),
		'singular_name'      => _x( 'Radio Station', 'post type singular name', 'radio-player-page' ),
		'menu_name'          => __( 'Radio Stations', 'radio-player-page' ),
		'add_new'            => __( 'Add Radio Station', 'radio-player-page' ),
		'add_new_item'       => __( 'Add Radio Station', 'radio-player-page' ),
		'edit_item'          => __( 'Edit Radio Station', 'radio-player-page' ),
		'new_item'           => __( 'New Radio Station', 'radio-player-page' ),
		'view_item'          => __( 'View Radio Station', 'radio-player-page' ),
		'search_items'       => __( 'Search Radio Stations', 'radio-player-page' ),
		'not_found'          => __( 'No radio stations found.', 'radio-player-page' ),
		'not_found_in_trash' => __( 'No radio stations found in Trash.', 'radio-player-page' ),
		'all_items'          => __( 'Radio Stations', 'radio-player-page' ),
	);

	$args = array(
		'labels'             => $labels,
		'public'             => false,
		'publicly_queryable' => false,
		'show_ui'            => true,
		'show_in_menu'       => 'radplapag',
		'query_var'          => false,
		'rewrite'            => false,
		'capability_type'    => array( 'radplapag_station', 'radplapag_stations' ),
		'map_meta_cap'       => true,
		'has_archive'        => false,
		'hierarchical'       => false,
		'menu_position'      => 5,
		'supports'           => array( 'title' ),
		'show_in_rest'       => true,
	);

	register_post_type( 'radplapag_station', $args );
}
add_action( 'init', 'radplapag_register_station_post_type' );

/**
 * Uses the classic editor for stations so meta boxes (schedule, details) are in the page and station-admin.js works.
 *
 * @since 3.3.0
 * @param bool   $use_block_editor Whether the block editor is used for this post type.
 * @param string $post_type        Post type name.
 * @return bool
 */
function radplapag_station_use_classic_editor( $use_block_editor, $post_type ) {
	if ( 'radplapag_station' === $post_type ) {
		return false;
	}
	return $use_block_editor;
}
add_filter( 'use_block_editor_for_post_type', 'radplapag_station_use_classic_editor', 10, 2 );

/**
 * Grants radplapag_station capabilities only to users who can manage_options.
 *
 * @since 3.3.0
 * @param array   $allcaps All capabilities for the user.
 * @param array   $caps    Requested capabilities.
 * @param array   $args    Optional arguments.
 * @param WP_User $user    User object.
 * @return array Filtered capabilities.
 */
function radplapag_grant_station_caps_to_manage_options( $allcaps, $caps, $args, $user ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- Signature fixed by user_has_cap (4 arguments).
	if ( ! empty( $allcaps['manage_options'] ) ) {
		$allcaps['edit_radplapag_stations']             = true;
		$allcaps['edit_others_radplapag_stations']      = true;
		$allcaps['publish_radplapag_stations']          = true;
		$allcaps['read_private_radplapag_stations']     = true;
		$allcaps['delete_radplapag_stations']           = true;
		$allcaps['delete_private_radplapag_stations']   = true;
		$allcaps['delete_published_radplapag_stations'] = true;
		$allcaps['delete_others_radplapag_stations']    = true;
		$allcaps['edit_radplapag_station']              = true;
		$allcaps['read_radplapag_station']              = true;
		$allcaps['delete_radplapag_station']            = true;
		$allcaps['create_radplapag_stations']           = true;
	}
	return $allcaps;
}
add_filter( 'user_has_cap', 'radplapag_grant_station_caps_to_manage_options', 10, 4 );

/**
 * Registers station post meta.
 *
 * @since 3.3.0
 *
 * @return void
 */
function radplapag_register_station_meta() {
	$post_type = 'radplapag_station';

	register_post_meta(
		$post_type,
		'radplapag_station_stream_url',
		array(
			'type'              => 'string',
			'description'       => __( 'Streaming URL for the station.', 'radio-player-page' ),
			'single'            => true,
			'sanitize_callback' => 'esc_url_raw',
			'auth_callback'     => function () {
				return current_user_can( 'manage_options' );
			},
			'show_in_rest'      => true,
		)
	);

	register_post_meta(
		$post_type,
		'radplapag_station_player_page',
		array(
			'type'              => 'integer',
			'description'       => __( 'Page ID where the player is displayed.', 'radio-player-page' ),
			'single'            => true,
			'sanitize_callback' => 'absint',
			'auth_callback'     => function () {
				return current_user_can( 'manage_options' );
			},
			'show_in_rest'      => true,
		)
	);

	register_post_meta(
		$post_type,
		'radplapag_station_background_id',
		array(
			'type'              => 'integer',
			'description'       => __( 'Attachment ID for background image.', 'radio-player-page' ),
			'single'            => true,
			'sanitize_callback' => function ( $value ) {
				$id = absint( $value );
				if ( $id > 0 && ! wp_attachment_is_image( $id ) ) {
					return 0;
				}
				return $id;
			},
			'auth_callback'     => function () {
				return current_user_can( 'manage_options' );
			},
			'show_in_rest'      => true,
		)
	);

	register_post_meta(
		$post_type,
		'radplapag_station_logo_id',
		array(
			'type'              => 'integer',
			'description'       => __( 'Attachment ID for station logo.', 'radio-player-page' ),
			'single'            => true,
			'sanitize_callback' => function ( $value ) {
				$id = absint( $value );
				if ( $id > 0 && ! wp_attachment_is_image( $id ) ) {
					return 0;
				}
				return $id;
			},
			'auth_callback'     => function () {
				return current_user_can( 'manage_options' );
			},
			'show_in_rest'      => true,
		)
	);

	register_post_meta(
		$post_type,
		'radplapag_station_intro_audio_id',
		array(
			'type'              => 'integer',
			'description'       => __( 'Attachment ID for the welcome audio (mp3) played before the live stream.', 'radio-player-page' ),
			'single'            => true,
			'sanitize_callback' => function ( $value ) {
				$id = absint( $value );
				if ( $id > 0 && get_post_mime_type( $id ) !== 'audio/mpeg' ) {
					return 0;
				}
				return $id;
			},
			'auth_callback'     => function () {
				return current_user_can( 'manage_options' );
			},
			'show_in_rest'      => true,
		)
	);

	register_post_meta(
		$post_type,
		'radplapag_station_theme_color',
		array(
			'type'              => 'string',
			'description'       => __( 'Theme color key.', 'radio-player-page' ),
			'single'            => true,
			'sanitize_callback' => 'sanitize_key',
			'auth_callback'     => function () {
				return current_user_can( 'manage_options' );
			},
			'show_in_rest'      => true,
		)
	);

	register_post_meta(
		$post_type,
		'radplapag_station_visualizer',
		array(
			'type'              => 'string',
			'description'       => __( 'Visualizer type key.', 'radio-player-page' ),
			'single'            => true,
			'sanitize_callback' => 'sanitize_key',
			'auth_callback'     => function () {
				return current_user_can( 'manage_options' );
			},
			'show_in_rest'      => true,
		)
	);

	register_post_meta(
		$post_type,
		'radplapag_station_schedule',
		array(
			'type'          => 'string',
			'description'   => __( 'Weekly schedule as JSON (day => array of program_id, start, end, is_rerun).', 'radio-player-page' ),
			'single'        => true,
			'auth_callback' => function () {
				return current_user_can( 'manage_options' );
			},
			'show_in_rest'  => false,
		)
	);

	register_post_meta(
		$post_type,
		'radplapag_station_hide_title',
		array(
			'type'              => 'boolean',
			'description'       => __( 'Whether the player hides the station name visually.', 'radio-player-page' ),
			'single'            => true,
			'sanitize_callback' => 'rest_sanitize_boolean',
			'auth_callback'     => function () {
				return current_user_can( 'manage_options' );
			},
			'show_in_rest'      => true,
		)
	);

	register_post_meta(
		$post_type,
		'radplapag_station_show_song',
		array(
			'type'              => 'boolean',
			'description'       => __( 'Whether the player shows the song playing on the stream.', 'radio-player-page' ),
			'single'            => true,
			'sanitize_callback' => 'rest_sanitize_boolean',
			'auth_callback'     => function () {
				return current_user_can( 'manage_options' );
			},
			'show_in_rest'      => true,
		)
	);
}
add_action( 'init', 'radplapag_register_station_meta', 20 );

/**
 * Sanitizes and validates a single station's schedule array (for CPT save).
 *
 * Validates and sanitizes one station's schedule (time format, overlaps, program_id).
 * Returns sanitized schedule array or WP_Error with messages.
 *
 * @since 3.3.0
 * @since 3.5.0 Delegates to RadioPlayerPage\Schedule\Slot_Validator and RadioPlayerPage\WP\Schedule_Messages.
 * @since 3.6.0 Delegates to RadioPlayerPage\WP\Schedule_Sanitizer::sanitize(), which the station save
 *              calls with the program IDs of the saved schedule (K106, ADR 0062).
 * @param array $schedule_input Raw schedule array: day => [ [ program_id, start, end, is_rerun ], ... ].
 * @return array|WP_Error Sanitized schedule array keyed by day, or WP_Error on validation failure.
 */
function radplapag_sanitize_station_schedule( $schedule_input ) {
	return \RadioPlayerPage\WP\Schedule_Sanitizer::sanitize( $schedule_input );
}

/**
 * Adds meta boxes for station edit screen.
 *
 * @since 3.3.0
 *
 * @return void
 */
function radplapag_add_station_meta_boxes() {
	add_meta_box(
		'radplapag_station_details',
		__( 'Details', 'radio-player-page' ),
		'radplapag_render_station_details_meta_box',
		'radplapag_station',
		'normal'
	);
	add_meta_box(
		'radplapag_station_schedule',
		__( 'Weekly Schedule', 'radio-player-page' ),
		'radplapag_render_station_schedule_meta_box',
		'radplapag_station',
		'normal'
	);
}

/**
 * Renders the station details meta box (stream URL, player page, theme, visualizer, logo, background).
 *
 * @since 3.3.0
 * @since 3.6.0 Adds the show song checkbox, below the hide title one (ADR 0068).
 * @param WP_Post $post Current post.
 * @return void
 */
function radplapag_render_station_details_meta_box( $post ) {
	wp_nonce_field( 'radplapag_station_meta', 'radplapag_station_meta_nonce' );

	$stream_url     = get_post_meta( $post->ID, 'radplapag_station_stream_url', true );
	$player_page    = (int) get_post_meta( $post->ID, 'radplapag_station_player_page', true );
	$background_id  = (int) get_post_meta( $post->ID, 'radplapag_station_background_id', true );
	$logo_id        = (int) get_post_meta( $post->ID, 'radplapag_station_logo_id', true );
	$intro_audio_id = (int) get_post_meta( $post->ID, 'radplapag_station_intro_audio_id', true );
	$theme          = get_post_meta( $post->ID, 'radplapag_station_theme_color', true );
	$visualizer     = get_post_meta( $post->ID, 'radplapag_station_visualizer', true );
	$hide_title     = (bool) get_post_meta( $post->ID, 'radplapag_station_hide_title', true );
	$show_song      = (bool) get_post_meta( $post->ID, 'radplapag_station_show_song', true );

	// Mixed content (C13). The notice is printed hidden too, so the JS can show it while typing.
	$stream_url   = is_string( $stream_url ) ? esc_url( $stream_url ) : '';
	$site_scheme  = (string) wp_parse_url( home_url(), PHP_URL_SCHEME );
	$mixed        = 'https' === $site_scheme && 'http' === wp_parse_url( $stream_url, PHP_URL_SCHEME );
	$valid_themes = array( 'neutral', 'blue', 'green', 'red', 'orange', 'yellow', 'purple', 'pink' );
	$theme        = in_array( $theme, $valid_themes, true ) ? $theme : 'neutral';
	$valid_viz    = array( 'oscilloscope', 'bars', 'particles', 'waterfall' );
	$visualizer   = in_array( $visualizer, $valid_viz, true ) ? $visualizer : 'oscilloscope';

	$pages = get_pages( array( 'post_status' => 'publish' ) );
	$pages = is_array( $pages ) ? $pages : array();

	// The posts page never shows the player, so it is left out unless already assigned (K27).
	$posts_page = 'page' === get_option( 'show_on_front' ) ? (int) get_option( 'page_for_posts' ) : 0;
	if ( $posts_page > 0 && $posts_page !== $player_page ) {
		$pages = array_values(
			array_filter(
				$pages,
				function ( $page ) use ( $posts_page ) {
					return $posts_page !== $page->ID;
				}
			)
		);
	}
	$is_posts_page = $posts_page > 0 && $posts_page === $player_page;

	// An assigned page that is not published stays listed, with its status (K36).
	$unpublished_page  = null;
	$unpublished_label = '';
	if ( $player_page > 0 && ! in_array( $player_page, wp_list_pluck( $pages, 'ID' ), true ) ) {
		$assigned = get_post( $player_page );
		if ( $assigned && 'page' === $assigned->post_type ) {
			$unpublished_page = $assigned;
			/* translators: 1: page title, 2: page status, such as Draft or Private. */
			$unpublished_label = sprintf( __( '%1$s (%2$s)', 'radio-player-page' ), $assigned->post_title, \RadioPlayerPage\WP\Post_Status_Label::of( $assigned->post_status ) );
		}
	}

	$bg_url          = $background_id > 0 ? wp_get_attachment_image_url( $background_id, 'medium' ) : '';
	$logo_url        = $logo_id > 0 ? wp_get_attachment_image_url( $logo_id, 'medium' ) : '';
	$intro_audio_url = $intro_audio_id > 0 ? wp_get_attachment_url( $intro_audio_id ) : '';

	$colors = array(
		'neutral' => __( 'Neutral', 'radio-player-page' ),
		'blue'    => __( 'Blue', 'radio-player-page' ),
		'green'   => __( 'Green', 'radio-player-page' ),
		'red'     => __( 'Red', 'radio-player-page' ),
		'orange'  => __( 'Orange', 'radio-player-page' ),
		'yellow'  => __( 'Yellow', 'radio-player-page' ),
		'purple'  => __( 'Purple', 'radio-player-page' ),
		'pink'    => __( 'Pink', 'radio-player-page' ),
	);
	?>
	<div class="radplapag-form-row">
		<div class="radplapag-stream-column">
			<p class="radplapag-field-wrap" data-field="stream_url" data-site-scheme="<?php echo esc_attr( $site_scheme ); ?>">
				<label for="radplapag_station_stream_url"><strong><?php esc_html_e( 'Streaming URL', 'radio-player-page' ); ?> <span class="required">*</span></strong></label><br>
				<input type="url" name="radplapag_station_stream_url" id="radplapag_station_stream_url" value="<?php echo esc_attr( $stream_url ); ?>" class="large-text radplapag-field-input radplapag-stream-url" placeholder="<?php esc_attr_e( 'https://example.com:8000/stream', 'radio-player-page' ); ?>"<?php echo $mixed ? ' aria-describedby="radplapag_station_stream_url_notice"' : ''; ?>>
				<span class="radplapag-field-error-message" role="alert" aria-live="polite"></span>
				<span id="radplapag_station_stream_url_notice" class="radplapag-field-notice"<?php echo $mixed ? '' : ' hidden'; ?>><?php esc_html_e( 'This stream uses http:// and this site uses https://; browsers block it, so it will not play.', 'radio-player-page' ); ?></span>
				<button type="button" class="button radplapag-stream-test" aria-describedby="radplapag_stream_test_result"><?php esc_html_e( 'Test Stream', 'radio-player-page' ); ?></button>
			</p>
			<div id="radplapag_stream_test_result" class="radplapag-stream-test-result" role="status"></div>
			<details class="radplapag-stream-help">
				<summary><?php esc_html_e( 'Which URL do I use?', 'radio-player-page' ); ?></summary>
				<p><?php esc_html_e( 'Use the address of the audio stream itself, not your station\'s website. It often ends in a mount point or a file name, such as /stream, /live, or /radio.mp3.', 'radio-player-page' ); ?></p>
				<p><?php esc_html_e( 'Icecast: open the server\'s status page (for example, http://example.com:8000/) and copy your mount point\'s URL.', 'radio-player-page' ); ?></p>
				<p><?php esc_html_e( 'Shoutcast: version 1 servers need /; after the port (for example, http://example.com:8000/;). Version 2 servers use /stream or /;.', 'radio-player-page' ); ?></p>
				<p><?php esc_html_e( 'AzuraCast: copy a mount point URL from the Streams list on the station\'s Profile page. Centova Cast and other control panels: copy the stream address from the Listen or Tune in links.', 'radio-player-page' ); ?></p>
				<p><?php esc_html_e( 'Not sure? Paste the playlist link of your Listen button (.pls or .m3u) or the address of your server\'s page, and click Test Stream. It suggests the URL to use.', 'radio-player-page' ); ?></p>
			</details>
		</div>
		<p class="radplapag-field-wrap" data-field="player_page">
			<label for="radplapag_station_player_page"><strong><?php esc_html_e( 'Player Page', 'radio-player-page' ); ?> <span class="required">*</span></strong></label><br>
			<select name="radplapag_station_player_page" id="radplapag_station_player_page" class="radplapag-field-select radplapag-player-page" aria-describedby="radplapag_station_player_page_description">
				<option value=""><?php esc_html_e( 'Select a Page', 'radio-player-page' ); ?></option>
				<?php foreach ( $pages as $page ) : ?>
					<option value="<?php echo esc_attr( $page->ID ); ?>" <?php selected( $player_page, $page->ID ); ?>><?php echo esc_html( $page->post_title ); ?></option>
				<?php endforeach; ?>
				<?php if ( $unpublished_page ) : ?>
					<option value="<?php echo esc_attr( (string) $unpublished_page->ID ); ?>" selected='selected'><?php echo esc_html( $unpublished_label ); ?></option>
				<?php endif; ?>
			</select>
			<span id="radplapag_station_player_page_description" class="description"><?php esc_html_e( 'The player replaces this whole page, so an empty page works best. Each page can be used by only one radio station.', 'radio-player-page' ); ?></span>
			<span class="radplapag-field-error-message" role="alert" aria-live="polite"></span>
			<?php if ( $unpublished_page ) : ?>
				<span class="radplapag-field-notice"><?php esc_html_e( 'This page is not published; the player is not shown until it is.', 'radio-player-page' ); ?></span>
			<?php endif; ?>
			<?php if ( $is_posts_page ) : ?>
				<span class="radplapag-field-notice"><?php esc_html_e( 'This page is the posts page; the player is not shown on it.', 'radio-player-page' ); ?></span>
			<?php endif; ?>
		</p>
	</div>
	<div class="radplapag-form-row">
		<p class="radplapag-field-wrap">
			<label for="radplapag_station_theme_color"><strong><?php esc_html_e( 'Color Scheme', 'radio-player-page' ); ?></strong></label><br>
			<select name="radplapag_station_theme_color" id="radplapag_station_theme_color" class="radplapag-field-select">
				<?php foreach ( $colors as $value => $label ) : ?>
					<option value="<?php echo esc_attr( $value ); ?>" <?php selected( $theme, $value ); ?>><?php echo esc_html( $label ); ?></option>
				<?php endforeach; ?>
			</select>
		</p>
		<p class="radplapag-field-wrap">
			<label for="radplapag_station_visualizer"><strong><?php esc_html_e( 'Visualizer', 'radio-player-page' ); ?></strong></label><br>
			<select name="radplapag_station_visualizer" id="radplapag_station_visualizer" class="radplapag-field-select">
				<option value="oscilloscope" <?php selected( $visualizer, 'oscilloscope' ); ?>><?php esc_html_e( 'Oscilloscope', 'radio-player-page' ); ?></option>
				<option value="bars" <?php selected( $visualizer, 'bars' ); ?>><?php esc_html_e( 'Bars Spectrum', 'radio-player-page' ); ?></option>
				<option value="waterfall" <?php selected( $visualizer, 'waterfall' ); ?>><?php esc_html_e( 'Amplitude Waterfall', 'radio-player-page' ); ?></option>
				<option value="particles" <?php selected( $visualizer, 'particles' ); ?>><?php esc_html_e( 'Spectral Particles', 'radio-player-page' ); ?></option>
			</select>
		</p>
	</div>
	<div class="radplapag-form-row">
		<div class="radplapag-field-wrap">
			<label><strong><?php esc_html_e( 'Logo Image (Optional)', 'radio-player-page' ); ?></strong></label>
			<div class="radplapag-program-logo-wrapper">
				<input type="hidden" name="radplapag_station_logo_id" value="<?php echo esc_attr( $logo_id ); ?>" class="radplapag-program-logo-id">
				<div class="radplapag-program-logo-preview">
					<?php if ( $logo_url ) : ?>
						<img src="<?php echo esc_url( $logo_url ); ?>" alt="">
					<?php endif; ?>
				</div>
				<button type="button" class="button radplapag-program-logo-select"><?php esc_html_e( 'Select Image', 'radio-player-page' ); ?></button>
				<button type="button" class="button radplapag-program-logo-remove" <?php echo $logo_id > 0 ? '' : ' style="display:none;"'; ?>><?php esc_html_e( 'Remove Image', 'radio-player-page' ); ?></button>
			</div>
		</div>
		<div class="radplapag-field-wrap">
			<label><strong><?php esc_html_e( 'Background Image (Optional)', 'radio-player-page' ); ?></strong></label>
			<div class="radplapag-program-logo-wrapper">
				<input type="hidden" name="radplapag_station_background_id" value="<?php echo esc_attr( $background_id ); ?>" class="radplapag-program-logo-id">
				<div class="radplapag-program-logo-preview">
					<?php if ( $bg_url ) : ?>
						<img src="<?php echo esc_url( $bg_url ); ?>" alt="">
					<?php endif; ?>
				</div>
				<button type="button" class="button radplapag-program-logo-select"><?php esc_html_e( 'Select Image', 'radio-player-page' ); ?></button>
				<button type="button" class="button radplapag-program-logo-remove" <?php echo $background_id > 0 ? '' : ' style="display:none;"'; ?>><?php esc_html_e( 'Remove Image', 'radio-player-page' ); ?></button>
			</div>
		</div>
	</div>
	<div class="radplapag-form-row">
		<div class="radplapag-field-wrap">
			<label><strong><?php esc_html_e( 'Welcome Audio (Optional)', 'radio-player-page' ); ?></strong></label>
			<p class="description"><?php esc_html_e( 'An MP3 that plays once before the live stream, the first time a listener presses Play. It cannot be paused or skipped.', 'radio-player-page' ); ?></p>
			<div class="radplapag-station-audio-wrapper">
				<input type="hidden" name="radplapag_station_intro_audio_id" value="<?php echo esc_attr( $intro_audio_id ); ?>" class="radplapag-station-audio-id">
				<div class="radplapag-station-audio-preview">
					<?php if ( $intro_audio_url ) : ?>
						<audio controls src="<?php echo esc_url( $intro_audio_url ); ?>"></audio>
					<?php endif; ?>
				</div>
				<button type="button" class="button radplapag-station-audio-select"><?php esc_html_e( 'Select Audio', 'radio-player-page' ); ?></button>
				<button type="button" class="button radplapag-station-audio-remove" <?php echo $intro_audio_id > 0 ? '' : ' style="display:none;"'; ?>><?php esc_html_e( 'Remove Audio', 'radio-player-page' ); ?></button>
			</div>
		</div>
		<div class="radplapag-field-wrap" role="group" aria-labelledby="radplapag_station_display_title">
			<label id="radplapag_station_display_title"><strong><?php esc_html_e( 'Player Display', 'radio-player-page' ); ?></strong></label>
			<p class="radplapag-field-wrap" data-field="hide_title">
				<input type="checkbox" name="radplapag_station_hide_title" id="radplapag_station_hide_title" value="1" <?php checked( $hide_title ); ?>>
				<label for="radplapag_station_hide_title"><?php esc_html_e( 'Hide station name in the player', 'radio-player-page' ); ?></label>
			</p>
			<p class="radplapag-field-wrap" data-field="show_song">
				<input type="checkbox" name="radplapag_station_show_song" id="radplapag_station_show_song" value="1" aria-describedby="radplapag_station_show_song_description" <?php checked( $show_song ); ?>>
				<label for="radplapag_station_show_song"><?php esc_html_e( 'Show current song', 'radio-player-page' ); ?></label>
			</p>
			<p id="radplapag_station_show_song_description" class="description"><?php esc_html_e( 'Shows the song that is playing below the station name, if your streaming server provides it (Icecast, some hosting providers, or HLS streams with ID3 tags). On some servers, each song lookup counts as one more listener.', 'radio-player-page' ); ?></p>
		</div>
	</div>
	<?php
}

/**
 * Renders the station schedule meta box (one station; schedule slots per day: program_id, start, end, is_rerun).
 *
 * @since 3.3.0
 * @param WP_Post $post Current post.
 * @return void
 */
function radplapag_render_station_schedule_meta_box( $post ) {
	$schedule_json = get_post_meta( $post->ID, 'radplapag_station_schedule', true );
	$schedule      = array();
	if ( is_string( $schedule_json ) && '' !== $schedule_json ) {
		$decoded = json_decode( $schedule_json, true );
		if ( is_array( $decoded ) ) {
			$schedule = $decoded;
		}
	}

	$days = array(
		'monday'    => __( 'Monday', 'radio-player-page' ),
		'tuesday'   => __( 'Tuesday', 'radio-player-page' ),
		'wednesday' => __( 'Wednesday', 'radio-player-page' ),
		'thursday'  => __( 'Thursday', 'radio-player-page' ),
		'friday'    => __( 'Friday', 'radio-player-page' ),
		'saturday'  => __( 'Saturday', 'radio-player-page' ),
		'sunday'    => __( 'Sunday', 'radio-player-page' ),
	);

	$cpt_programs      = radplapag_get_station_programs_for_select( $post->ID );
	$public_by_program = wp_list_pluck( $cpt_programs, 'public', 'id' );
	?>
	<div id="radplapag-station-cpt-container">
		<div class="radplapag-schedule-wrapper">
			<?php
			foreach ( $days as $day_key => $day_label ) :
				$day_programs = isset( $schedule[ $day_key ] ) && is_array( $schedule[ $day_key ] ) ? $schedule[ $day_key ] : array();
				uasort(
					$day_programs,
					function ( $a, $b ) {
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
					}
				);
				?>
				<fieldset class="radplapag-schedule-day" data-day="<?php echo esc_attr( $day_key ); ?>">
					<legend class="radplapag-schedule-day-legend"><?php echo esc_html( $day_label ); ?></legend>
					<div class="radplapag-programs-list">
						<?php
						foreach ( $day_programs as $prog_index => $program ) :
							$prog_id       = isset( $program['program_id'] ) ? $program['program_id'] : '';
							$prog_id_int   = is_numeric( $prog_id ) ? (int) $prog_id : 0;
							$prog_start    = isset( $program['start'] ) ? esc_attr( $program['start'] ) : '';
							$prog_end      = isset( $program['end'] ) ? esc_attr( $program['end'] ) : '';
							$prog_is_rerun = ! empty( $program['is_rerun'] );
							$field_id      = 'radplapag-slot-' . $day_key . '-' . $prog_index . '-';
							?>
							<div class="radplapag-program-row" data-program-index="<?php echo esc_attr( $prog_index ); ?>">
								<label class="screen-reader-text" for="<?php echo esc_attr( $field_id . 'program' ); ?>"><?php esc_html_e( 'Radio Show', 'radio-player-page' ); ?></label>
								<select name="radplapag_station_schedule[<?php echo esc_attr( $day_key ); ?>][<?php echo esc_attr( $prog_index ); ?>][program_id]" class="radplapag-program-id" style="width: 200px; margin-right: 24px;" id="<?php echo esc_attr( $field_id . 'program' ); ?>">
									<option value=""><?php esc_html_e( 'Select a Radio Show', 'radio-player-page' ); ?></option>
									<?php
									foreach ( $cpt_programs as $p ) :
										$p_id = (int) $p['id'];
										?>
										<option value="<?php echo esc_attr( $p_id ); ?>" <?php selected( $prog_id_int > 0 && $prog_id_int === $p_id ); ?>><?php echo esc_html( $p['label'] ); ?></option>
									<?php endforeach; ?>
								</select>
								<label class="screen-reader-text" for="<?php echo esc_attr( $field_id . 'start' ); ?>"><?php esc_html_e( 'Start time', 'radio-player-page' ); ?></label>
								<input type="time" name="radplapag_station_schedule[<?php echo esc_attr( $day_key ); ?>][<?php echo esc_attr( $prog_index ); ?>][start]" value="<?php echo esc_attr( $prog_start ); ?>" class="radplapag-program-start" style="width: 100px; margin-right: 5px;" id="<?php echo esc_attr( $field_id . 'start' ); ?>">
								<span style="margin-right: 5px;"> <?php esc_html_e( 'to', 'radio-player-page' ); ?> </span>
								<label class="screen-reader-text" for="<?php echo esc_attr( $field_id . 'end' ); ?>"><?php esc_html_e( 'End time', 'radio-player-page' ); ?></label>
								<input type="time" name="radplapag_station_schedule[<?php echo esc_attr( $day_key ); ?>][<?php echo esc_attr( $prog_index ); ?>][end]" value="<?php echo esc_attr( $prog_end ); ?>" class="radplapag-program-end" style="width: 100px; margin-right: 10px;" id="<?php echo esc_attr( $field_id . 'end' ); ?>">
								<label class="radplapag-program-is-rerun-label" style="margin-right: 10px;">
									<input type="checkbox" name="radplapag_station_schedule[<?php echo esc_attr( $day_key ); ?>][<?php echo esc_attr( $prog_index ); ?>][is_rerun]" value="1" <?php checked( $prog_is_rerun ); ?> class="radplapag-program-is-rerun">
									<?php esc_html_e( 'Rerun', 'radio-player-page' ); ?>
								</label>
								<div class="radplapag-schedule-remove-cell">
									<a href="#" class="submitdelete radplapag-remove-program" aria-label="<?php esc_attr_e( 'Remove Time Slot', 'radio-player-page' ); ?>"><?php echo esc_html_x( 'Remove', 'time slot link', 'radio-player-page' ); ?></a>
								</div>
								<div class="radplapag-program-error-message" style="display: none;"></div>
								<?php if ( isset( $public_by_program[ $prog_id_int ] ) && ! $public_by_program[ $prog_id_int ] ) : ?>
									<div class="radplapag-program-notice"><?php esc_html_e( 'This radio show is not published; this time slot is not shown on the site.', 'radio-player-page' ); ?></div>
								<?php endif; ?>
							</div>
						<?php endforeach; ?>
					</div>
					<button type="button" class="button radplapag-add-program" data-day="<?php echo esc_attr( $day_key ); ?>" style="margin-top: 5px; margin-bottom: 15px;">
						<?php esc_html_e( 'Add Time Slot', 'radio-player-page' ); ?>
					</button>
				</fieldset>
			<?php endforeach; ?>
		</div>
	</div>
	<?php
}

/**
 * Saves station meta on post save.
 *
 * @since 3.3.0
 * @since 3.5.0 Keeps the guards and the form reads; delegates the save to RadioPlayerPage\WP\Station_Meta_Saver::save().
 * @param int $post_id Post ID.
 * @return void
 */
function radplapag_save_station_meta( $post_id ) {
	if ( ! isset( $_POST['radplapag_station_meta_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['radplapag_station_meta_nonce'] ) ), 'radplapag_station_meta' ) ) {
		return;
	}
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}
	if ( get_post_type( $post_id ) !== 'radplapag_station' ) {
		return;
	}

	$stream_url = filter_input( INPUT_POST, 'radplapag_station_stream_url', FILTER_UNSAFE_RAW );
	$input      = array(
		'stream_url'     => is_string( $stream_url ) ? wp_unslash( $stream_url ) : '',
		'player_page'    => isset( $_POST['radplapag_station_player_page'] ) ? absint( $_POST['radplapag_station_player_page'] ) : 0,
		'background_id'  => isset( $_POST['radplapag_station_background_id'] ) ? absint( $_POST['radplapag_station_background_id'] ) : 0,
		'logo_id'        => isset( $_POST['radplapag_station_logo_id'] ) ? absint( $_POST['radplapag_station_logo_id'] ) : 0,
		'intro_audio_id' => isset( $_POST['radplapag_station_intro_audio_id'] ) ? absint( $_POST['radplapag_station_intro_audio_id'] ) : 0,
		'theme_color'    => isset( $_POST['radplapag_station_theme_color'] ) ? sanitize_key( wp_unslash( $_POST['radplapag_station_theme_color'] ) ) : '',
		'visualizer'     => isset( $_POST['radplapag_station_visualizer'] ) ? sanitize_key( wp_unslash( $_POST['radplapag_station_visualizer'] ) ) : '',
		'hide_title'     => isset( $_POST['radplapag_station_hide_title'] ),
		'show_song'      => isset( $_POST['radplapag_station_show_song'] ),
		'schedule'       => array(),
	);
	if ( isset( $_POST['radplapag_station_schedule'] ) ) {
		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Sanitized by RadioPlayerPage\WP\Schedule_Sanitizer::sanitize() in Station_Meta_Saver::save().
		$input['schedule'] = wp_unslash( $_POST['radplapag_station_schedule'] );
	}

	\RadioPlayerPage\WP\Station_Meta_Saver::save( (int) $post_id, $input );
}

/**
 * Displays schedule validation errors after save (transient).
 *
 * @since 3.3.0
 *
 * @return void
 */
function radplapag_station_schedule_errors_notice() {
	$screen = get_current_screen();
	if ( ! $screen || 'radplapag_station' !== $screen->id ) {
		return;
	}
	$post_id = filter_input( INPUT_GET, 'post', FILTER_SANITIZE_NUMBER_INT );
	$post_id = $post_id ? absint( $post_id ) : 0;
	if ( $post_id <= 0 ) {
		return;
	}
	$field_message = get_transient( 'radplapag_station_field_errors_' . $post_id );
	if ( is_string( $field_message ) && '' !== $field_message ) {
		delete_transient( 'radplapag_station_field_errors_' . $post_id );
		?>
		<div class="notice notice-error is-dismissible">
			<p><strong><?php esc_html_e( 'Some fields were not saved:', 'radio-player-page' ); ?></strong> <?php echo esc_html( $field_message ); ?></p>
		</div>
		<?php
	}
	$message = get_transient( 'radplapag_station_schedule_errors_' . $post_id );
	if ( ! is_string( $message ) || '' === $message ) {
		return;
	}
	delete_transient( 'radplapag_station_schedule_errors_' . $post_id );
	?>
	<div class="notice notice-error is-dismissible">
		<p><strong><?php esc_html_e( 'The Weekly Schedule was not saved:', 'radio-player-page' ); ?></strong> <?php echo esc_html( $message ); ?></p>
	</div>
	<?php
}

/**
 * Drops core's "Post published." / "Post updated." from the redirect after saving a
 * station that left an error notice (ADR 0048).
 *
 * The station is still published or updated; only the notice changes.
 *
 * @since 3.5.0
 * @param string $location The destination URL.
 * @param int    $post_id  The saved post ID.
 * @return string
 */
function radplapag_station_redirect_without_message( $location, $post_id ) {
	if ( get_post_type( $post_id ) !== 'radplapag_station' ) {
		return $location;
	}
	if ( false === get_transient( 'radplapag_station_field_errors_' . $post_id ) && false === get_transient( 'radplapag_station_schedule_errors_' . $post_id ) ) {
		return $location;
	}

	return remove_query_arg( 'message', $location );
}

/**
 * Returns page IDs that are assigned as Player Page by other stations (excluding the given post).
 *
 * Used by admin to disable those options in the Player Page select and validate on submit.
 *
 * @since 3.3.0
 * @since 3.5.0 Delegates to RadioPlayerPage\WP\Station_Repository::player_pages_except().
 * @param int $exclude_post_id Station post ID to exclude (current station being edited).
 * @return int[] Array of page IDs assigned to other stations.
 */
function radplapag_get_player_pages_assigned_to_other_stations( $exclude_post_id = 0 ) {
	return \RadioPlayerPage\WP\Station_Repository::player_pages_except( (int) $exclude_post_id );
}

/**
 * Enqueues media for station edit screen. Logo/background image logic is in station-admin.js.
 *
 * @since 3.3.0
 * @return void
 */
function radplapag_station_edit_scripts() {
	$screen = get_current_screen();
	if ( ! $screen || 'radplapag_station' !== $screen->id ) {
		return;
	}
	wp_enqueue_media();
}

if ( is_admin() ) {
	add_action( 'add_meta_boxes', 'radplapag_add_station_meta_boxes' );
	add_action( 'save_post_radplapag_station', 'radplapag_save_station_meta' );
	add_action( 'admin_notices', 'radplapag_station_schedule_errors_notice' );
	add_action( 'admin_enqueue_scripts', 'radplapag_station_edit_scripts' );
	add_filter( 'redirect_post_location', 'radplapag_station_redirect_without_message', 10, 2 );
}
