<?php
/**
 * Dev fixture seeder for Radio Player Page.
 *
 * Creates one full working example (page + station + 5 radio shows + a
 * complete weekly schedule with reruns and a midnight-crossing slot) so a
 * fresh local WordPress install has something real to test against.
 *
 * Usage: wp eval-file scripts/fixtures/seed.php
 * Full docs: scripts/fixtures/README.md
 *
 * @package radio-player-page
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	echo "This script must be run via WP-CLI: wp eval-file scripts/fixtures/seed.php\n";
	exit( 1 );
}

if ( ! function_exists( 'radplapag_sanitize_station_schedule' ) ) {
	WP_CLI::error( 'Radio Player Page is not active. Run: wp plugin activate radio-player-page' );
}

define( 'RADPLAPAG_FIXTURE_META', '_radplapag_fixture_batch' );
define( 'RADPLAPAG_FIXTURE_TAG', 'radplapag-dev-fixtures' );

/**
 * Tags a post/attachment as a fixture so a later run can find and remove it.
 *
 * @param int $post_id Post or attachment ID.
 */
function radplapag_fixture_tag( $post_id ) {
	update_post_meta( $post_id, RADPLAPAG_FIXTURE_META, RADPLAPAG_FIXTURE_TAG );
}

/**
 * Sideloads a fixture asset into the media library without consuming the
 * source file (media_handle_sideload() moves/deletes its tmp_name).
 *
 * @param string $path        Absolute path of the asset.
 * @param string $description Attachment description.
 * @return int Attachment ID.
 */
function radplapag_fixture_sideload( $path, $description ) {
	if ( ! file_exists( $path ) ) {
		WP_CLI::error( "Fixture asset not found: {$path}" );
	}

	require_once ABSPATH . 'wp-admin/includes/image.php';
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/media.php';

	$tmp_copy = wp_tempnam( basename( $path ) );
	copy( $path, $tmp_copy );

	$attachment_id = media_handle_sideload(
		array(
			'name'     => basename( $path ),
			'tmp_name' => $tmp_copy,
		),
		0,
		$description
	);

	if ( is_wp_error( $attachment_id ) ) {
		WP_CLI::error( 'Media upload failed for ' . basename( $path ) . ': ' . $attachment_id->get_error_message() );
	}

	radplapag_fixture_tag( $attachment_id );
	return $attachment_id;
}

// -----------------------------------------------------------------------
// 1. Remove fixtures left over from a previous run (idempotent reset).
// -----------------------------------------------------------------------
WP_CLI::log( 'Removing fixtures from a previous run (if any)...' );

$radplapag_previous_fixture_ids = get_posts(
	array(
		'post_type'   => array( 'page', 'radplapag_station', 'radplapag_program', 'attachment' ),
		'post_status' => 'any',
		'numberposts' => -1,
		'fields'      => 'ids',
		'meta_key'    => RADPLAPAG_FIXTURE_META, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- Seeder, run once per dev or e2e setup.
		'meta_value'  => RADPLAPAG_FIXTURE_TAG, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value -- Seeder, run once per dev or e2e setup.
	)
);

foreach ( $radplapag_previous_fixture_ids as $radplapag_previous_id ) {
	wp_delete_post( $radplapag_previous_id, true );
}

WP_CLI::log( sprintf( 'Removed %d fixture post(s) from a previous run.', count( $radplapag_previous_fixture_ids ) ) );

// -----------------------------------------------------------------------
// 2. Upload fixture media (one image, one mp3).
// -----------------------------------------------------------------------
$radplapag_assets_dir = __DIR__ . '/assets';
$radplapag_image_id   = radplapag_fixture_sideload( $radplapag_assets_dir . '/station-artwork.jpg', 'Fixture station artwork' );
$radplapag_audio_id   = radplapag_fixture_sideload( $radplapag_assets_dir . '/intro.mp3', 'Fixture intro audio' );

WP_CLI::log( "Uploaded artwork (attachment #{$radplapag_image_id}) and intro audio (attachment #{$radplapag_audio_id})." );

// -----------------------------------------------------------------------
// 3. Create the WP page the station will be assigned to.
// -----------------------------------------------------------------------
$radplapag_page_id = wp_insert_post(
	array(
		'post_type'   => 'page',
		'post_title'  => 'Fixture Radio Station',
		'post_status' => 'publish',
	),
	true
);

if ( is_wp_error( $radplapag_page_id ) ) {
	WP_CLI::error( 'Could not create player page: ' . $radplapag_page_id->get_error_message() );
}
radplapag_fixture_tag( $radplapag_page_id );
WP_CLI::log( "Created player page (post #{$radplapag_page_id})." );

// -----------------------------------------------------------------------
// 4. Create 5 radio shows with full content.
// -----------------------------------------------------------------------
$radplapag_programs_input = array(
	array(
		'title'       => 'Morning Drive',
		'description' => 'Wake up with news, traffic and the best music to start your day.',
		'extended'    => 'Morning Drive is our flagship breakfast show, mixing top headlines, live traffic updates and a curated mix of hits to get you out the door. Hosted live every weekday.',
	),
	array(
		'title'       => 'Indie Waves',
		'description' => 'The best independent and alternative tracks, hand-picked weekly.',
		'extended'    => "Indie Waves digs into the alternative and indie scene, spotlighting emerging artists alongside genre staples. Expect deep cuts you won't hear anywhere else.",
	),
	array(
		'title'       => 'Late Night Jazz',
		'description' => 'Smooth jazz and soul to wind down your evening.',
		'extended'    => 'Late Night Jazz is a slow, warm mix of classic and contemporary jazz, perfect for unwinding after a long day.',
	),
	array(
		'title'       => 'Weekend Sports Hour',
		'description' => "Scores, highlights and analysis from the weekend's biggest games.",
		'extended'    => "Weekend Sports Hour breaks down the week's biggest sporting moments with live analysis, interviews and listener call-ins.",
	),
	array(
		'title'       => 'Sunday Chill',
		'description' => 'Slow tempo, feel-good tracks for a relaxed Sunday.',
		'extended'    => 'Sunday Chill closes out the week with mellow, feel-good tracks and no news, no traffic, just music.',
	),
);

$radplapag_program_ids = array();
foreach ( $radplapag_programs_input as $radplapag_program ) {
	$radplapag_program_id = wp_insert_post(
		array(
			'post_type'   => 'radplapag_program',
			'post_title'  => $radplapag_program['title'],
			'post_status' => 'publish',
		),
		true
	);

	if ( is_wp_error( $radplapag_program_id ) ) {
		WP_CLI::error( 'Could not create radio show "' . $radplapag_program['title'] . '": ' . $radplapag_program_id->get_error_message() );
	}

	radplapag_fixture_tag( $radplapag_program_id );
	update_post_meta( $radplapag_program_id, 'radplapag_program_description', $radplapag_program['description'] );
	update_post_meta( $radplapag_program_id, 'radplapag_program_extended_description', $radplapag_program['extended'] );
	update_post_meta( $radplapag_program_id, 'radplapag_program_logo_id', $radplapag_image_id );

	$radplapag_program_ids[] = $radplapag_program_id;
	WP_CLI::log( "Created radio show \"{$radplapag_program['title']}\" (post #{$radplapag_program_id})." );
}

[ $radplapag_morning_drive, $radplapag_indie_waves, $radplapag_late_night_jazz, $radplapag_weekend_sports, $radplapag_sunday_chill ] = $radplapag_program_ids;

// -----------------------------------------------------------------------
// 5. Create the station and set every field.
// -----------------------------------------------------------------------
$radplapag_station_id = wp_insert_post(
	array(
		'post_type'   => 'radplapag_station',
		'post_title'  => 'Fixture Radio Station',
		'post_status' => 'publish',
	),
	true
);

if ( is_wp_error( $radplapag_station_id ) ) {
	WP_CLI::error( 'Could not create station: ' . $radplapag_station_id->get_error_message() );
}
radplapag_fixture_tag( $radplapag_station_id );

// The intro audio doubles as a local, always-reachable "stream" so the
// player has something real to play without an external Icecast server.
update_post_meta( $radplapag_station_id, 'radplapag_station_stream_url', wp_get_attachment_url( $radplapag_audio_id ) );
update_post_meta( $radplapag_station_id, 'radplapag_station_theme_color', 'blue' );
update_post_meta( $radplapag_station_id, 'radplapag_station_visualizer', 'bars' );
update_post_meta( $radplapag_station_id, 'radplapag_station_background_id', $radplapag_image_id );
update_post_meta( $radplapag_station_id, 'radplapag_station_logo_id', $radplapag_image_id );
update_post_meta( $radplapag_station_id, 'radplapag_station_intro_audio_id', $radplapag_audio_id );
update_post_meta( $radplapag_station_id, 'radplapag_station_player_page', $radplapag_page_id );

WP_CLI::log( "Created station \"Fixture Radio Station\" (post #{$radplapag_station_id})." );

// -----------------------------------------------------------------------
// 6. Build a complete weekly schedule: every day filled, several reruns,
// and one slot that crosses midnight (Sunday 23:00 -> Monday 01:00).
// -----------------------------------------------------------------------
$radplapag_schedule_input = array(
	'monday'    => array(
		array(
			'program_id' => $radplapag_morning_drive,
			'start'      => '07:00',
			'end'        => '09:00',
			'is_rerun'   => false,
		),
		array(
			'program_id' => $radplapag_weekend_sports,
			'start'      => '20:00',
			'end'        => '21:00',
			'is_rerun'   => true,
		),
	),
	'tuesday'   => array(
		array(
			'program_id' => $radplapag_morning_drive,
			'start'      => '07:00',
			'end'        => '09:00',
			'is_rerun'   => false,
		),
		array(
			'program_id' => $radplapag_indie_waves,
			'start'      => '19:00',
			'end'        => '21:00',
			'is_rerun'   => false,
		),
	),
	'wednesday' => array(
		array(
			'program_id' => $radplapag_morning_drive,
			'start'      => '07:00',
			'end'        => '09:00',
			'is_rerun'   => false,
		),
		array(
			'program_id' => $radplapag_late_night_jazz,
			'start'      => '22:00',
			'end'        => '23:30',
			'is_rerun'   => false,
		),
	),
	'thursday'  => array(
		array(
			'program_id' => $radplapag_morning_drive,
			'start'      => '07:00',
			'end'        => '09:00',
			'is_rerun'   => false,
		),
		array(
			'program_id' => $radplapag_indie_waves,
			'start'      => '19:00',
			'end'        => '21:00',
			'is_rerun'   => true,
		),
	),
	'friday'    => array(
		array(
			'program_id' => $radplapag_morning_drive,
			'start'      => '07:00',
			'end'        => '09:00',
			'is_rerun'   => false,
		),
		array(
			'program_id' => $radplapag_late_night_jazz,
			'start'      => '22:00',
			'end'        => '23:30',
			'is_rerun'   => true,
		),
	),
	'saturday'  => array(
		array(
			'program_id' => $radplapag_weekend_sports,
			'start'      => '10:00',
			'end'        => '12:00',
			'is_rerun'   => false,
		),
	),
	'sunday'    => array(
		array(
			'program_id' => $radplapag_indie_waves,
			'start'      => '10:00',
			'end'        => '12:00',
			'is_rerun'   => true,
		),
		// Crosses midnight into Monday. radplapag_sanitize_station_schedule()
		// treats end <= start as "ends the next day" and checks it against
		// Monday's slots below (07:00, 20:00) -- neither starts before 01:00,
		// so this validates cleanly instead of failing as an overlap.
		array(
			'program_id' => $radplapag_sunday_chill,
			'start'      => '23:00',
			'end'        => '01:00',
			'is_rerun'   => false,
		),
	),
);

$radplapag_schedule_sanitized = radplapag_sanitize_station_schedule( $radplapag_schedule_input );

if ( is_wp_error( $radplapag_schedule_sanitized ) ) {
	WP_CLI::error( 'Schedule validation failed: ' . $radplapag_schedule_sanitized->get_error_message() );
}

update_post_meta( $radplapag_station_id, 'radplapag_station_schedule', wp_json_encode( $radplapag_schedule_sanitized ) );
WP_CLI::log( 'Weekly schedule saved (7 days, includes reruns and a midnight-crossing slot).' );

// -----------------------------------------------------------------------
// 7. Summary.
// -----------------------------------------------------------------------
WP_CLI::success( 'Fixtures ready.' );
WP_CLI::log( '' );
WP_CLI::log( 'Player page:   ' . get_permalink( $radplapag_page_id ) );
WP_CLI::log( 'Edit station:  ' . admin_url( "post.php?post={$radplapag_station_id}&action=edit" ) );
WP_CLI::log( 'Radio shows:   ' . implode( ', ', $radplapag_program_ids ) );
