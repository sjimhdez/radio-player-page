<?php
/**
 * Program CPT and meta: radplapag_program post type and metafields.
 *
 * Programs are stored as a Custom Post Type; schedule slots reference them by post ID.
 *
 * @package radio-player-page
 * @since 3.3.0
 */

defined( 'ABSPATH' ) || exit;

/**
 * Registers the radplapag_program post type.
 *
 * @since 3.3.0
 *
 * @return void
 */
function radplapag_register_program_post_type() {
	$labels = array(
		'name'               => _x( 'Radio Shows', 'post type general name', 'radio-player-page' ),
		'singular_name'      => _x( 'Radio Show', 'post type singular name', 'radio-player-page' ),
		'menu_name'          => __( 'Radio Shows', 'radio-player-page' ),
		'add_new'            => __( 'Add New', 'radio-player-page' ),
		'add_new_item'       => __( 'Add Radio Show', 'radio-player-page' ),
		'edit_item'          => __( 'Edit Radio Show', 'radio-player-page' ),
		'new_item'           => __( 'New Radio Show', 'radio-player-page' ),
		'view_item'          => __( 'View Radio Show', 'radio-player-page' ),
		'search_items'       => __( 'Search Radio Shows', 'radio-player-page' ),
		'not_found'          => __( 'No Radio Shows found.', 'radio-player-page' ),
		'not_found_in_trash' => __( 'No Radio Shows found in Trash.', 'radio-player-page' ),
		'all_items'          => __( 'Radio Shows', 'radio-player-page' ),
	);

	// Use custom capability type so we grant caps only via user_has_cap (manage_options).
	// Avoids WordPress 6.1+ "delete_post must be checked against a specific post" when using map_meta_cap with custom caps.
	$args = array(
		'labels'             => $labels,
		'public'             => false,
		'publicly_queryable' => false,
		'show_ui'            => true,
		'show_in_menu'       => 'radplapag',
		'query_var'          => false,
		'rewrite'            => false,
		'capability_type'    => array( 'radplapag_program', 'radplapag_programs' ),
		'map_meta_cap'       => true,
		'has_archive'        => false,
		'hierarchical'       => false,
		'menu_position'      => 10,
		'supports'           => array( 'title' ),
		'show_in_rest'       => true,
	);

	register_post_type( 'radplapag_program', $args );
}
add_action( 'init', 'radplapag_register_program_post_type' );

/**
 * Grants radplapag_program capabilities only to users who can manage_options.
 *
 * Used so the CPT does not rely on custom cap overrides that trigger WordPress 6.1+
 * "map_meta_cap delete_post must check against a specific post" notices.
 *
 * @since 3.3.0
 * @param array   $allcaps All capabilities for the user.
 * @param array   $caps    Requested capabilities.
 * @param array   $args    Optional arguments (e.g. post ID).
 * @param WP_User $user  User object.
 * @return array Filtered capabilities.
 */
function radplapag_grant_program_caps_to_manage_options( $allcaps, $caps, $args, $user ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- Signature fixed by user_has_cap (4 arguments).
	if ( ! empty( $allcaps['manage_options'] ) ) {
		$allcaps['edit_radplapag_programs']             = true;
		$allcaps['edit_others_radplapag_programs']      = true;
		$allcaps['publish_radplapag_programs']          = true;
		$allcaps['read_private_radplapag_programs']     = true;
		$allcaps['delete_radplapag_programs']           = true;
		$allcaps['delete_private_radplapag_programs']   = true;
		$allcaps['delete_published_radplapag_programs'] = true;
		$allcaps['delete_others_radplapag_programs']    = true;
		$allcaps['edit_radplapag_program']              = true;
		$allcaps['read_radplapag_program']              = true;
		$allcaps['delete_radplapag_program']            = true;
		$allcaps['create_radplapag_programs']           = true;
	}
	return $allcaps;
}
add_filter( 'user_has_cap', 'radplapag_grant_program_caps_to_manage_options', 10, 4 );

/**
 * Registers program post meta (description, extended_description, logo_id).
 *
 * @since 3.3.0
 *
 * @return void
 */
function radplapag_register_program_meta() {
	$post_type = 'radplapag_program';

	register_post_meta(
		$post_type,
		'radplapag_program_description',
		array(
			'type'              => 'string',
			'description'       => __( 'Short radio show description.', 'radio-player-page' ),
			'single'            => true,
			'sanitize_callback' => 'sanitize_text_field',
			'auth_callback'     => function () {
				return current_user_can( 'manage_options' );
			},
			'show_in_rest'      => true,
		)
	);

	register_post_meta(
		$post_type,
		'radplapag_program_extended_description',
		array(
			'type'              => 'string',
			'description'       => __( 'Extended radio show description.', 'radio-player-page' ),
			'single'            => true,
			'sanitize_callback' => 'sanitize_textarea_field',
			'auth_callback'     => function () {
				return current_user_can( 'manage_options' );
			},
			'show_in_rest'      => true,
		)
	);

	register_post_meta(
		$post_type,
		'radplapag_program_logo_id',
		array(
			'type'              => 'integer',
			'description'       => __( 'Attachment ID for radio show logo image.', 'radio-player-page' ),
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
}
add_action( 'init', 'radplapag_register_program_meta', 20 );

/**
 * Gets program data (name, description, extended_description, logo_id, logo_url) from CPT by post ID.
 *
 * @since 3.3.0
 * @since 3.5.0 Delegates to RadioPlayerPage\WP\Program_Repository::data().
 * @since 3.5.0 With $require_published, a password-protected program gives null (K88, ADR 0045).
 * @param int  $post_id          Post ID of radplapag_program.
 * @param bool $require_published Optional. Whether to require a public program: published and without password. Default false.
 * @return array{name: string, description: string, extended_description: string, logo_id: int, logo_url: string|null}|null Name, description, extended description, logo ID and logo URL; null if invalid or not found.
 */
function radplapag_get_program_data( $post_id, $require_published = false ) {
	return \RadioPlayerPage\WP\Program_Repository::data( (int) $post_id, (bool) $require_published );
}

/**
 * Gets all radplapag_program posts for use in schedule dropdowns (id and name).
 *
 * @since 3.3.0
 * @return array Array of [ 'id' => int (post ID), 'name' => string (post_title) ], ordered by title.
 */
function radplapag_get_all_programs_for_select() {
	$posts = get_posts(
		array(
			'post_type'      => 'radplapag_program',
			'post_status'    => array( 'publish', 'draft' ),
			'posts_per_page' => -1,
			'orderby'        => 'title',
			'order'          => 'ASC',
		)
	);
	$out   = array();
	foreach ( $posts as $post ) {
		$out[] = array(
			'id'   => (int) $post->ID,
			'name' => $post->post_title,
		);
	}
	return $out;
}

/**
 * Adds meta boxes for program description, extended description and logo.
 *
 * @since 3.3.0
 *
 * @return void
 */
function radplapag_add_program_meta_boxes() {
	add_meta_box(
		'radplapag_program_details',
		__( 'Details', 'radio-player-page' ),
		'radplapag_render_program_meta_boxes',
		'radplapag_program',
		'normal'
	);
}

/**
 * Renders the program meta boxes (description, extended description, logo).
 *
 * @since 3.3.0
 *
 * @param WP_Post $post Current post object.
 * @return void
 */
function radplapag_render_program_meta_boxes( $post ) {
	wp_nonce_field( 'radplapag_program_meta', 'radplapag_program_meta_nonce' );

	$description          = get_post_meta( $post->ID, 'radplapag_program_description', true );
	$extended_description = get_post_meta( $post->ID, 'radplapag_program_extended_description', true );
	$logo_id              = (int) get_post_meta( $post->ID, 'radplapag_program_logo_id', true );

	$desc_value     = is_string( $description ) ? $description : '';
	$ext_desc_value = is_string( $extended_description ) ? $extended_description : '';
	$logo_url       = $logo_id > 0 ? wp_get_attachment_image_url( $logo_id, 'medium' ) : '';
	?>
	<p class="radplapag-field-wrap">
		<label for="radplapag_program_description"><strong><?php esc_html_e( 'Description', 'radio-player-page' ); ?></strong></label><br>
		<input type="text" id="radplapag_program_description" name="radplapag_program_description" value="<?php echo esc_attr( $desc_value ); ?>" class="large-text radplapag-field-input" maxlength="256">
	</p>
	<p class="radplapag-field-wrap">
		<label for="radplapag_program_extended_description"><strong><?php esc_html_e( 'Extended Description', 'radio-player-page' ); ?></strong></label><br>
		<textarea id="radplapag_program_extended_description" name="radplapag_program_extended_description" rows="4" class="large-text radplapag-field-textarea" maxlength="512"><?php echo esc_textarea( $ext_desc_value ); ?></textarea>
	</p>
	<div class="radplapag-field-wrap">
		<label><strong><?php esc_html_e( 'Radio Show Image', 'radio-player-page' ); ?></strong></label>
		<div class="radplapag-program-logo-wrapper">
			<input type="hidden" id="radplapag_program_logo_id" name="radplapag_program_logo_id" value="<?php echo esc_attr( $logo_id ); ?>" class="radplapag-program-logo-id">
			<div class="radplapag-program-logo-preview">
				<?php if ( $logo_url ) : ?>
					<img src="<?php echo esc_url( $logo_url ); ?>" alt="">
				<?php endif; ?>
			</div>
			<button type="button" class="button radplapag-program-logo-select"><?php esc_html_e( 'Select Image', 'radio-player-page' ); ?></button>
			<button type="button" class="button radplapag-program-logo-remove" <?php echo $logo_id > 0 ? '' : ' style="display:none;"'; ?>><?php esc_html_e( 'Remove Image', 'radio-player-page' ); ?></button>
		</div>
	</div>
	<?php
}

/**
 * Saves program meta (description, extended description, logo_id).
 *
 * @since 3.3.0
 * @since 3.5.0 Keeps the guards and the form reads; delegates the save to RadioPlayerPage\WP\Program_Meta_Saver::save().
 *
 * @param int $post_id Post ID.
 * @return void
 */
function radplapag_save_program_meta( $post_id ) {
	if ( ! isset( $_POST['radplapag_program_meta_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['radplapag_program_meta_nonce'] ) ), 'radplapag_program_meta' ) ) {
		return;
	}
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}
	if ( get_post_type( $post_id ) !== 'radplapag_program' ) {
		return;
	}

	\RadioPlayerPage\WP\Program_Meta_Saver::save(
		(int) $post_id,
		array(
			'description'          => isset( $_POST['radplapag_program_description'] ) ? sanitize_text_field( wp_unslash( $_POST['radplapag_program_description'] ) ) : '',
			'extended_description' => isset( $_POST['radplapag_program_extended_description'] ) ? sanitize_textarea_field( wp_unslash( $_POST['radplapag_program_extended_description'] ) ) : '',
			'logo_id'              => isset( $_POST['radplapag_program_logo_id'] ) ? absint( $_POST['radplapag_program_logo_id'] ) : 0,
		)
	);
}

/**
 * Enqueues media and program-admin.js for program logo selector on CPT edit screen.
 *
 * @since 3.3.0
 * @return void
 */
function radplapag_program_edit_scripts() {
	$screen = get_current_screen();
	if ( ! $screen || 'radplapag_program' !== $screen->id ) {
		return;
	}
	wp_enqueue_media();
	$admin_url = plugin_dir_url( __DIR__ ) . 'admin/';
	wp_enqueue_script(
		'radplapag-program-admin',
		$admin_url . 'js/program-admin.js',
		array( 'jquery', 'media-editor' ),
		'3.4.2',
		true
	);
}

if ( is_admin() ) {
	add_action( 'add_meta_boxes', 'radplapag_add_program_meta_boxes' );
	add_action( 'save_post_radplapag_program', 'radplapag_save_program_meta' );
	add_action( 'admin_enqueue_scripts', 'radplapag_program_edit_scripts' );
}
