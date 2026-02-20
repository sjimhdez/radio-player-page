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
		'name'               => _x( 'Stations', 'post type general name', 'radio-player-page' ),
		'singular_name'      => _x( 'Station', 'post type singular name', 'radio-player-page' ),
		'menu_name'          => __( 'Stations', 'radio-player-page' ),
		'add_new'            => __( 'Add New', 'radio-player-page' ),
		'add_new_item'       => __( 'Add New Station', 'radio-player-page' ),
		'edit_item'          => __( 'Edit Station', 'radio-player-page' ),
		'new_item'           => __( 'New Station', 'radio-player-page' ),
		'view_item'          => __( 'View Station', 'radio-player-page' ),
		'search_items'       => __( 'Search Stations', 'radio-player-page' ),
		'not_found'          => __( 'No stations found.', 'radio-player-page' ),
		'not_found_in_trash' => __( 'No stations found in Trash.', 'radio-player-page' ),
		'all_items'          => __( 'Stations', 'radio-player-page' ),
	);

	$args = array(
		'labels'              => $labels,
		'public'               => false,
		'publicly_queryable'   => false,
		'show_ui'              => true,
		'show_in_menu'         => 'radplapag',
		'query_var'            => false,
		'rewrite'              => false,
		'capability_type'      => array( 'radplapag_station', 'radplapag_stations' ),
		'map_meta_cap'         => true,
		'has_archive'          => false,
		'hierarchical'         => false,
		'menu_position'        => 5,
		'supports'             => array( 'title' ),
		'show_in_rest'         => true,
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
	if ( $post_type === 'radplapag_station' ) {
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
function radplapag_grant_station_caps_to_manage_options( $allcaps, $caps, $args, $user ) {
	if ( ! empty( $allcaps['manage_options'] ) ) {
		$allcaps['edit_radplapag_stations']         = true;
		$allcaps['edit_others_radplapag_stations']  = true;
		$allcaps['publish_radplapag_stations']      = true;
		$allcaps['read_private_radplapag_stations'] = true;
		$allcaps['delete_radplapag_stations']        = true;
		$allcaps['delete_private_radplapag_stations']   = true;
		$allcaps['delete_published_radplapag_stations']  = true;
		$allcaps['delete_others_radplapag_stations']     = true;
		$allcaps['edit_radplapag_station']          = true;
		$allcaps['read_radplapag_station']          = true;
		$allcaps['delete_radplapag_station']        = true;
		$allcaps['create_radplapag_stations']       = true;
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
			'auth_callback'     => function() {
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
			'auth_callback'     => function() {
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
			'sanitize_callback' => function( $value ) {
				$id = absint( $value );
				if ( $id > 0 && ! wp_attachment_is_image( $id ) ) {
					return 0;
				}
				return $id;
			},
			'auth_callback'     => function() {
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
			'sanitize_callback' => function( $value ) {
				$id = absint( $value );
				if ( $id > 0 && ! wp_attachment_is_image( $id ) ) {
					return 0;
				}
				return $id;
			},
			'auth_callback'     => function() {
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
			'auth_callback'     => function() {
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
			'auth_callback'     => function() {
				return current_user_can( 'manage_options' );
			},
			'show_in_rest'      => true,
		)
	);

	register_post_meta(
		$post_type,
		'radplapag_station_schedule',
		array(
			'type'              => 'string',
			'description'       => __( 'Weekly schedule as JSON (day => array of program_id, start, end).', 'radio-player-page' ),
			'single'            => true,
			'auth_callback'     => function() {
				return current_user_can( 'manage_options' );
			},
			'show_in_rest'      => false,
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
 * @param array $schedule_input Raw schedule array: day => [ [ program_id, start, end ], ... ].
 * @return array|WP_Error Sanitized schedule array keyed by day, or WP_Error on validation failure.
 */
function radplapag_sanitize_station_schedule( $schedule_input ) {
	$valid_days   = array( 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday' );
	$day_labels   = array(
		'monday'    => __( 'Monday', 'radio-player-page' ),
		'tuesday'   => __( 'Tuesday', 'radio-player-page' ),
		'wednesday' => __( 'Wednesday', 'radio-player-page' ),
		'thursday'  => __( 'Thursday', 'radio-player-page' ),
		'friday'    => __( 'Friday', 'radio-player-page' ),
		'saturday'  => __( 'Saturday', 'radio-player-page' ),
		'sunday'    => __( 'Sunday', 'radio-player-page' ),
	);
	$time_regex   = '/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/';
	$schedule_out = array();
	$errors       = array();

	if ( ! is_array( $schedule_input ) ) {
		return $schedule_out;
	}

	foreach ( $valid_days as $day ) {
		if ( ! isset( $schedule_input[ $day ] ) || ! is_array( $schedule_input[ $day ] ) ) {
			continue;
		}
		$day_programs  = array();
		$day_intervals = array();

		$programs_data = array();
		foreach ( $schedule_input[ $day ] as $program ) {
			if ( ! is_array( $program ) ) {
				continue;
			}
			$program_id_raw = isset( $program['program_id'] ) ? $program['program_id'] : '';
			$program_id    = is_numeric( $program_id_raw ) ? (int) $program_id_raw : 0;
			$program_start  = isset( $program['start'] ) ? trim( $program['start'] ) : '';
			$program_end   = isset( $program['end'] ) ? trim( $program['end'] ) : '';

			if ( $program_id <= 0 && empty( $program_start ) && empty( $program_end ) ) {
				continue;
			}

			$has_program = $program_id > 0;
			$has_start   = ! empty( $program_start );
			$has_end     = ! empty( $program_end );
			if ( $has_program || $has_start || $has_end ) {
				if ( ! $has_program || ! $has_start || ! $has_end ) {
					$errors[] = sprintf(
						/* translators: 1: Day name */
						__( 'Program on %1$s: All fields (program, start time, end time) are required.', 'radio-player-page' ),
						$day_labels[ $day ]
					);
					continue;
				}
			}

			$program_data = $program_id > 0 ? radplapag_get_program_data( $program_id ) : null;
			if ( ! $program_data ) {
				$errors[] = sprintf(
					/* translators: 1: Day name */
					__( 'Program on %1$s: Please select a valid program.', 'radio-player-page' ),
					$day_labels[ $day ]
				);
				continue;
			}
			$program_name = $program_data['name'];

			if ( ! preg_match( $time_regex, $program_start ) || ! preg_match( $time_regex, $program_end ) ) {
				$errors[] = sprintf(
					/* translators: 1: Program name, 2: Day name */
					__( 'Program "%1$s" on %2$s: Invalid time format. Times must be in HH:MM format.', 'radio-player-page' ),
					$program_name,
					$day_labels[ $day ]
				);
				continue;
			}

			$start_time = strtotime( '2000-01-01 ' . $program_start . ':00' );
			$end_time   = strtotime( '2000-01-01 ' . $program_end . ':00' );
			$end_time_for_validation = $end_time;
			if ( $end_time <= $start_time ) {
				$end_time_for_validation = strtotime( '2000-01-02 ' . $program_end . ':00' );
			}
			if ( $start_time >= $end_time_for_validation ) {
				$errors[] = sprintf(
					/* translators: 1: Program name, 2: Day name */
					__( 'Program "%1$s" on %2$s: End time must be after start time.', 'radio-player-page' ),
					$program_name,
					$day_labels[ $day ]
				);
				continue;
			}

			$end_time_for_overlap = $end_time;
			if ( $end_time <= $start_time ) {
				$end_time_for_overlap = strtotime( '2000-01-02 ' . $program_end . ':00' );
			}
			$programs_data[] = array(
				'program_id' => $program_id,
				'name'       => $program_name,
				'start'      => $program_start,
				'end'        => $program_end,
				'start_time' => $start_time,
				'end_time'   => $end_time_for_overlap,
			);
		}

		usort( $programs_data, function( $a, $b ) {
			return $a['start_time'] - $b['start_time'];
		} );

		foreach ( $programs_data as $prog_data ) {
			$has_overlap = false;
			$overlapping = null;
			foreach ( $day_intervals as $interval ) {
				if ( $prog_data['start_time'] < $interval['end'] && $prog_data['end_time'] > $interval['start'] ) {
					$has_overlap = true;
					$overlapping = $interval['name'];
					break;
				}
			}
			if ( $has_overlap ) {
				$errors[] = sprintf(
					/* translators: 1: Program name, 2: Day name, 3: Overlapping program name */
					__( 'Program "%1$s" on %2$s: Time slot overlaps with "%3$s".', 'radio-player-page' ),
					$prog_data['name'],
					$day_labels[ $day ],
					$overlapping
				);
				continue;
			}
			$day_intervals[] = array(
				'start' => $prog_data['start_time'],
				'end'   => $prog_data['end_time'],
				'name'  => $prog_data['name'],
			);
			$day_programs[] = array(
				'program_id' => $prog_data['program_id'],
				'start'      => $prog_data['start'],
				'end'        => $prog_data['end'],
			);
		}
		if ( ! empty( $day_programs ) ) {
			$schedule_out[ $day ] = $day_programs;
		}
	}

	// Cross-day overlap for midnight-crossing slots
	$days_array = $valid_days;
	foreach ( $days_array as $day_idx => $day ) {
		if ( ! isset( $schedule_out[ $day ] ) || empty( $schedule_out[ $day ] ) ) {
			continue;
		}
		foreach ( $schedule_out[ $day ] as $program ) {
			$program_id    = isset( $program['program_id'] ) ? (int) $program['program_id'] : 0;
			$program_data  = $program_id > 0 ? radplapag_get_program_data( $program_id ) : null;
			$program_name  = $program_data ? $program_data['name'] : '';
			$program_start = isset( $program['start'] ) ? trim( $program['start'] ) : '';
			$program_end   = isset( $program['end'] ) ? trim( $program['end'] ) : '';
			if ( empty( $program_start ) || empty( $program_end ) || ! $program_data ) {
				continue;
			}
			$start_time = strtotime( '2000-01-01 ' . $program_start . ':00' );
			$end_time   = strtotime( '2000-01-01 ' . $program_end . ':00' );
			if ( $end_time <= $start_time ) {
				$next_day_idx = ( $day_idx + 1 ) % 7;
				$next_day     = $days_array[ $next_day_idx ];
				if ( isset( $schedule_out[ $next_day ] ) && is_array( $schedule_out[ $next_day ] ) ) {
					foreach ( $schedule_out[ $next_day ] as $next_program ) {
						$next_program_id   = isset( $next_program['program_id'] ) ? (int) $next_program['program_id'] : 0;
						$found_next        = $next_program_id > 0 ? radplapag_get_program_data( $next_program_id ) : null;
						$next_program_name = $found_next ? $found_next['name'] : '';
						$next_start        = isset( $next_program['start'] ) ? trim( $next_program['start'] ) : '';
						$next_end          = isset( $next_program['end'] ) ? trim( $next_program['end'] ) : '';
						if ( empty( $next_start ) || empty( $next_end ) || ! $found_next ) {
							continue;
						}
						$next_start_time = strtotime( '2000-01-01 ' . $next_start . ':00' );
						if ( $end_time > $next_start_time ) {
							$errors[] = sprintf(
								/* translators: 1: Program name, 2: Day name, 3: Overlapping program name, 4: Next day name */
								__( 'Program "%1$s" on %2$s (crosses midnight) overlaps with "%3$s" on %4$s.', 'radio-player-page' ),
								$program_name,
								$day_labels[ $day ],
								$next_program_name,
								$day_labels[ $next_day ]
							);
							return new WP_Error( 'radplapag_schedule_validation', implode( ' ', $errors ) );
						}
					}
				}
			}
		}
	}

	if ( ! empty( $errors ) ) {
		return new WP_Error( 'radplapag_schedule_validation', implode( ' ', $errors ) );
	}
	return $schedule_out;
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
		__( 'Station Details', 'radio-player-page' ),
		'radplapag_render_station_details_meta_box',
		'radplapag_station',
		'normal'
	);
	add_meta_box(
		'radplapag_station_schedule',
		__( 'Program Schedule', 'radio-player-page' ),
		'radplapag_render_station_schedule_meta_box',
		'radplapag_station',
		'normal'
	);
}

/**
 * Renders the station details meta box (stream URL, player page, theme, visualizer, logo, background).
 *
 * @since 3.3.0
 * @param WP_Post $post Current post.
 * @return void
 */
function radplapag_render_station_details_meta_box( $post ) {
	wp_nonce_field( 'radplapag_station_meta', 'radplapag_station_meta_nonce' );

	$stream_url   = get_post_meta( $post->ID, 'radplapag_station_stream_url', true );
	$player_page  = (int) get_post_meta( $post->ID, 'radplapag_station_player_page', true );
	$background_id = (int) get_post_meta( $post->ID, 'radplapag_station_background_id', true );
	$logo_id      = (int) get_post_meta( $post->ID, 'radplapag_station_logo_id', true );
	$theme        = get_post_meta( $post->ID, 'radplapag_station_theme_color', true );
	$visualizer   = get_post_meta( $post->ID, 'radplapag_station_visualizer', true );

	$stream_url   = is_string( $stream_url ) ? esc_url( $stream_url ) : '';
	$valid_themes = array( 'neutral', 'blue', 'green', 'red', 'orange', 'yellow', 'purple', 'pink' );
	$theme        = in_array( $theme, $valid_themes, true ) ? $theme : 'neutral';
	$valid_viz   = array( 'oscilloscope', 'bars', 'particles', 'waterfall' );
	$visualizer   = in_array( $visualizer, $valid_viz, true ) ? $visualizer : 'oscilloscope';

	$pages    = get_pages( array( 'post_status' => 'publish' ) );
	$bg_url   = $background_id > 0 ? wp_get_attachment_image_url( $background_id, 'medium' ) : '';
	$logo_url = $logo_id > 0 ? wp_get_attachment_image_url( $logo_id, 'medium' ) : '';

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
	<p>
		<label for="radplapag_station_player_page"><strong><?php esc_html_e( 'Player Page', 'radio-player-page' ); ?></strong></label><br>
		<select name="radplapag_station_player_page" id="radplapag_station_player_page" class="radplapag-player-page">
			<option value=""><?php esc_html_e( 'Select a Page', 'radio-player-page' ); ?></option>
			<?php foreach ( $pages as $page ) : ?>
				<option value="<?php echo esc_attr( $page->ID ); ?>" <?php selected( $player_page, $page->ID ); ?>><?php echo esc_html( $page->post_title ); ?></option>
			<?php endforeach; ?>
		</select>
	</p>
	<p>
		<label for="radplapag_station_stream_url"><strong><?php esc_html_e( 'Streaming URL', 'radio-player-page' ); ?></strong></label><br>
		<input type="url" name="radplapag_station_stream_url" id="radplapag_station_stream_url" value="<?php echo esc_attr( $stream_url ); ?>" class="large-text radplapag-stream-url" placeholder="<?php esc_attr_e( 'https://my.station.com:8000/stream', 'radio-player-page' ); ?>">
	</p>
	<p>
		<label for="radplapag_station_theme_color"><strong><?php esc_html_e( 'Theme Color', 'radio-player-page' ); ?></strong></label><br>
		<select name="radplapag_station_theme_color" id="radplapag_station_theme_color">
			<?php foreach ( $colors as $value => $label ) : ?>
				<option value="<?php echo esc_attr( $value ); ?>" <?php selected( $theme, $value ); ?>><?php echo esc_html( $label ); ?></option>
			<?php endforeach; ?>
		</select>
	</p>
	<p>
		<label for="radplapag_station_visualizer"><strong><?php esc_html_e( 'Visualizer', 'radio-player-page' ); ?></strong></label><br>
		<select name="radplapag_station_visualizer" id="radplapag_station_visualizer">
			<option value="oscilloscope" <?php selected( $visualizer, 'oscilloscope' ); ?>><?php esc_html_e( 'Oscilloscope', 'radio-player-page' ); ?></option>
			<option value="bars" <?php selected( $visualizer, 'bars' ); ?>><?php esc_html_e( 'Bars Spectrum', 'radio-player-page' ); ?></option>
			<option value="waterfall" <?php selected( $visualizer, 'waterfall' ); ?>><?php esc_html_e( 'Amplitude Waterfall', 'radio-player-page' ); ?></option>
			<option value="particles" <?php selected( $visualizer, 'particles' ); ?>><?php esc_html_e( 'Spectral Particles', 'radio-player-page' ); ?></option>
		</select>
	</p>
	<p>
		<label><strong><?php esc_html_e( 'Logo Image (Optional)', 'radio-player-page' ); ?></strong></label><br>
		<div class="radplapag-program-logo-wrapper">
			<input type="hidden" name="radplapag_station_logo_id" value="<?php echo esc_attr( $logo_id ); ?>" class="radplapag-program-logo-id">
			<div class="radplapag-program-logo-preview">
				<?php if ( $logo_url ) : ?>
					<img src="<?php echo esc_url( $logo_url ); ?>" alt="">
				<?php endif; ?>
			</div>
			<button type="button" class="button radplapag-program-logo-select"><?php esc_html_e( 'Select Image', 'radio-player-page' ); ?></button>
			<button type="button" class="button radplapag-program-logo-remove" <?php echo $logo_id > 0 ? '' : ' style="display:none;"'; ?>><?php esc_html_e( 'Remove', 'radio-player-page' ); ?></button>
		</div>
	</p>
	<p>
		<label><strong><?php esc_html_e( 'Background Image (Optional)', 'radio-player-page' ); ?></strong></label><br>
		<div class="radplapag-program-logo-wrapper">
			<input type="hidden" name="radplapag_station_background_id" value="<?php echo esc_attr( $background_id ); ?>" class="radplapag-program-logo-id">
			<div class="radplapag-program-logo-preview">
				<?php if ( $bg_url ) : ?>
					<img src="<?php echo esc_url( $bg_url ); ?>" alt="">
				<?php endif; ?>
			</div>
			<button type="button" class="button radplapag-program-logo-select"><?php esc_html_e( 'Select Image', 'radio-player-page' ); ?></button>
			<button type="button" class="button radplapag-program-logo-remove" <?php echo $background_id > 0 ? '' : ' style="display:none;"'; ?>><?php esc_html_e( 'Remove', 'radio-player-page' ); ?></button>
		</div>
	</p>
	<?php
}

/**
 * Renders the station schedule meta box (one station; schedule slots per day: program_id, start, end).
 *
 * @since 3.3.0
 * @param WP_Post $post Current post.
 * @return void
 */
function radplapag_render_station_schedule_meta_box( $post ) {
	$schedule_json = get_post_meta( $post->ID, 'radplapag_station_schedule', true );
	$schedule      = array();
	if ( is_string( $schedule_json ) && $schedule_json !== '' ) {
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

	$cpt_programs = radplapag_get_all_programs_for_select();
	?>
	<div id="radplapag-station-cpt-container">
		<div class="radplapag-schedule-wrapper" data-station-index="0">
			<p class="description" style="margin-bottom: 15px;">
				<?php esc_html_e( 'Assign programs (from RPP → Programs) to time slots for each day. The player displays the current and upcoming programs based on your site\'s timezone.', 'radio-player-page' ); ?>
			</p>
			<?php foreach ( $days as $day_key => $day_label ) :
				$day_programs = isset( $schedule[ $day_key ] ) && is_array( $schedule[ $day_key ] ) ? $schedule[ $day_key ] : array();
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
					<h4 style="margin: 10px 0 5px 0; font-size: 13px; font-weight: 600;"><?php echo esc_html( $day_label ); ?></h4>
					<div class="radplapag-programs-list">
						<?php foreach ( $day_programs as $prog_index => $program ) :
							$prog_id     = isset( $program['program_id'] ) ? $program['program_id'] : '';
							$prog_id_int = is_numeric( $prog_id ) ? (int) $prog_id : 0;
							$prog_start  = isset( $program['start'] ) ? esc_attr( $program['start'] ) : '';
							$prog_end    = isset( $program['end'] ) ? esc_attr( $program['end'] ) : '';
							?>
							<div class="radplapag-program-row" data-program-index="<?php echo esc_attr( $prog_index ); ?>">
								<select name="radplapag_station_schedule[<?php echo esc_attr( $day_key ); ?>][<?php echo esc_attr( $prog_index ); ?>][program_id]" class="radplapag-program-id" style="width: 200px; margin-right: 24px;">
									<option value=""><?php esc_html_e( 'Select Program', 'radio-player-page' ); ?></option>
									<?php foreach ( $cpt_programs as $p ) :
										$p_id   = (int) $p['id'];
										$pname  = isset( $p['name'] ) ? $p['name'] : '';
										?>
										<option value="<?php echo esc_attr( $p_id ); ?>" <?php selected( $prog_id_int > 0 && $prog_id_int === $p_id ); ?>><?php echo esc_html( $pname ); ?></option>
									<?php endforeach; ?>
								</select>
								<input type="time" name="radplapag_station_schedule[<?php echo esc_attr( $day_key ); ?>][<?php echo esc_attr( $prog_index ); ?>][start]" value="<?php echo esc_attr( $prog_start ); ?>" class="radplapag-program-start" style="width: 100px; margin-right: 5px;">
								<span style="margin-right: 5px;"> <?php esc_html_e( 'to', 'radio-player-page' ); ?> </span>
								<input type="time" name="radplapag_station_schedule[<?php echo esc_attr( $day_key ); ?>][<?php echo esc_attr( $prog_index ); ?>][end]" value="<?php echo esc_attr( $prog_end ); ?>" class="radplapag-program-end" style="width: 100px; margin-right: 10px;">
								<div class="radplapag-schedule-remove-cell">
									<a href="#" class="submitdelete radplapag-remove-program"><?php esc_html_e( 'Remove Time Slot', 'radio-player-page' ); ?></a>
								</div>
								<div class="radplapag-program-error-message" style="display: none;"></div>
							</div>
						<?php endforeach; ?>
					</div>
					<button type="button" class="button radplapag-add-program" data-day="<?php echo esc_attr( $day_key ); ?>" style="margin-top: 5px; margin-bottom: 15px;">
						<?php esc_html_e( 'Add Time Slot', 'radio-player-page' ); ?>
					</button>
				</div>
			<?php endforeach; ?>
		</div>
	</div>
	<?php
}

/**
 * Saves station meta on post save.
 *
 * @since 3.3.0
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

	$stream_url   = isset( $_POST['radplapag_station_stream_url'] ) ? esc_url_raw( trim( wp_unslash( $_POST['radplapag_station_stream_url'] ) ) ) : '';
	$player_page  = isset( $_POST['radplapag_station_player_page'] ) ? absint( $_POST['radplapag_station_player_page'] ) : 0;
	$background_id = isset( $_POST['radplapag_station_background_id'] ) ? absint( $_POST['radplapag_station_background_id'] ) : 0;
	$logo_id      = isset( $_POST['radplapag_station_logo_id'] ) ? absint( $_POST['radplapag_station_logo_id'] ) : 0;
	$theme        = isset( $_POST['radplapag_station_theme_color'] ) ? sanitize_key( wp_unslash( $_POST['radplapag_station_theme_color'] ) ) : 'neutral';
	$visualizer   = isset( $_POST['radplapag_station_visualizer'] ) ? sanitize_key( wp_unslash( $_POST['radplapag_station_visualizer'] ) ) : 'oscilloscope';

	$valid_themes = array( 'neutral', 'blue', 'green', 'red', 'orange', 'yellow', 'purple', 'pink' );
	if ( ! in_array( $theme, $valid_themes, true ) ) {
		$theme = 'neutral';
	}
	$valid_visualizers = array( 'oscilloscope', 'bars', 'particles', 'waterfall' );
	if ( ! in_array( $visualizer, $valid_visualizers, true ) ) {
		$visualizer = 'oscilloscope';
	}
	if ( $background_id > 0 && ! wp_attachment_is_image( $background_id ) ) {
		$background_id = 0;
	}
	if ( $logo_id > 0 && ! wp_attachment_is_image( $logo_id ) ) {
		$logo_id = 0;
	}

	update_post_meta( $post_id, 'radplapag_station_stream_url', $stream_url );
	update_post_meta( $post_id, 'radplapag_station_player_page', $player_page );
	update_post_meta( $post_id, 'radplapag_station_background_id', $background_id );
	update_post_meta( $post_id, 'radplapag_station_logo_id', $logo_id );
	update_post_meta( $post_id, 'radplapag_station_theme_color', $theme );
	update_post_meta( $post_id, 'radplapag_station_visualizer', $visualizer );

	$schedule_input = isset( $_POST['radplapag_station_schedule'] ) && is_array( $_POST['radplapag_station_schedule'] ) ? wp_unslash( $_POST['radplapag_station_schedule'] ) : array();
	$schedule_sanitized = radplapag_sanitize_station_schedule( $schedule_input );
	if ( is_wp_error( $schedule_sanitized ) ) {
		set_transient( 'radplapag_station_schedule_errors_' . $post_id, $schedule_sanitized->get_error_message(), 45 );
	} else {
		delete_transient( 'radplapag_station_schedule_errors_' . $post_id );
		$schedule_json = wp_json_encode( $schedule_sanitized );
		update_post_meta( $post_id, 'radplapag_station_schedule', $schedule_json );
	}
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
	if ( ! $screen || $screen->id !== 'radplapag_station' ) {
		return;
	}
	$post_id = isset( $_GET['post'] ) ? absint( $_GET['post'] ) : 0;
	if ( $post_id <= 0 ) {
		return;
	}
	$message = get_transient( 'radplapag_station_schedule_errors_' . $post_id );
	if ( ! is_string( $message ) || $message === '' ) {
		return;
	}
	delete_transient( 'radplapag_station_schedule_errors_' . $post_id );
	?>
	<div class="notice notice-error is-dismissible">
		<p><strong><?php esc_html_e( 'Schedule validation failed:', 'radio-player-page' ); ?></strong> <?php echo esc_html( $message ); ?></p>
	</div>
	<?php
}

/**
 * Enqueues media for station edit screen. Logo/background image logic is in station-admin.js.
 *
 * @since 3.3.0
 * @return void
 */
function radplapag_station_edit_scripts() {
	$screen = get_current_screen();
	if ( ! $screen || $screen->id !== 'radplapag_station' ) {
		return;
	}
	wp_enqueue_media();
}

if ( is_admin() ) {
	add_action( 'add_meta_boxes', 'radplapag_add_station_meta_boxes' );
	add_action( 'save_post_radplapag_station', 'radplapag_save_station_meta' );
	add_action( 'admin_notices', 'radplapag_station_schedule_errors_notice' );
	add_action( 'admin_enqueue_scripts', 'radplapag_station_edit_scripts' );
}
