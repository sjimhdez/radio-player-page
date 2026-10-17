<?php
/**
 * E2E seeder for Radio Player Page (spec 0002, phase 2).
 *
 * Creates one page + station per e2e variant (MP3, live, cut, HLS, DASH, no
 * CORS, intro, each visualizer, minimal), the pages the plugin must not
 * intercept, and a page with the three blocks. Every post it creates carries
 * its own tag, so a run first removes everything the previous run created.
 * scripts/fixtures/seed.php (the dev station) is left alone.
 *
 * Prints a JSON object on stdout: { "urls": { key: url }, "ids": { id: name } }.
 *
 * Usage: wp eval-file tests/e2e/fixtures/seed-e2e.php <media-origin> <media-nocors-origin>
 *
 * @package radio-player-page
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	exit( 1 );
}

if ( ! function_exists( 'radplapag_sanitize_station_schedule' ) ) {
	WP_CLI::error( 'Radio Player Page is not active.' );
}

define( 'RADPLAPAG_E2E_META', '_radplapag_e2e_batch' );
define( 'RADPLAPAG_E2E_TAG', 'radplapag-e2e-fixtures' );

/**
 * Collects the URLs and the ID → name map printed at the end.
 *
 * @param string|null $key  URL key, or null to read the collected data.
 * @param string|null $url  URL to record under $key.
 * @param int|null    $id   Post ID to name.
 * @param string|null $name Stable name for $id.
 * @return array{urls: array<string, string>, ids: array<string, string>} The collected data.
 */
function radplapag_e2e_record( $key = null, $url = null, $id = null, $name = null ) {
	static $data = array(
		'urls' => array(),
		'ids'  => array(),
	);

	if ( null !== $key && null !== $url ) {
		$data['urls'][ $key ] = $url;
	}
	if ( null !== $id && null !== $name ) {
		$data['ids'][ (string) $id ] = $name;
	}

	return $data;
}

/**
 * Inserts a tagged post and records its ID under a stable name.
 *
 * @param array  $postarr wp_insert_post() arguments.
 * @param string $name    Stable name for the ID map.
 * @return int Post ID.
 */
function radplapag_e2e_insert( array $postarr, $name ) {
	$post_id = wp_insert_post(
		array_merge( array( 'post_status' => 'publish' ), $postarr ),
		true
	);

	if ( is_wp_error( $post_id ) ) {
		WP_CLI::error( "Could not create {$name}: " . $post_id->get_error_message() );
	}

	update_post_meta( $post_id, RADPLAPAG_E2E_META, RADPLAPAG_E2E_TAG );
	radplapag_e2e_record( null, null, $post_id, $name );

	return $post_id;
}

/**
 * Removes every post, page, CPT entry and attachment of the previous run.
 *
 * @return void
 */
function radplapag_e2e_reset() {
	$previous_ids = get_posts(
		array(
			'post_type'   => array( 'post', 'page', 'radplapag_station', 'radplapag_program', 'attachment' ),
			'post_status' => 'any',
			'numberposts' => -1,
			'fields'      => 'ids',
			'meta_key'    => RADPLAPAG_E2E_META, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- Seeder, run once per e2e suite.
			'meta_value'  => RADPLAPAG_E2E_TAG, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value -- Seeder, run once per e2e suite.
		)
	);

	foreach ( $previous_ids as $previous_id ) {
		wp_delete_post( $previous_id, true );
	}
}

/**
 * Uploads a local file to the media library without consuming it.
 *
 * @param string $path Absolute path of the file.
 * @param string $name Stable name for the ID map.
 * @return int Attachment ID.
 */
function radplapag_e2e_sideload( $path, $name ) {
	require_once ABSPATH . 'wp-admin/includes/image.php';
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/media.php';

	if ( ! file_exists( $path ) ) {
		WP_CLI::error( "Fixture file not found: {$path}" );
	}

	// media_handle_sideload() moves its tmp_name: hand it a copy.
	$tmp_copy = wp_tempnam( basename( $path ) );
	copy( $path, $tmp_copy );

	$attachment_id = media_handle_sideload(
		array(
			'name'     => basename( $path ),
			'tmp_name' => $tmp_copy,
		),
		0,
		$name
	);

	if ( is_wp_error( $attachment_id ) ) {
		WP_CLI::error( "Upload failed for {$name}: " . $attachment_id->get_error_message() );
	}

	update_post_meta( $attachment_id, RADPLAPAG_E2E_META, RADPLAPAG_E2E_TAG );
	radplapag_e2e_record( null, null, $attachment_id, $name );

	return $attachment_id;
}

/**
 * Creates an MP3 attachment with no file whose URL (its GUID) is $url.
 *
 * @param string $url  Remote URL that wp_get_attachment_url() returns.
 * @param string $name Stable name for the ID map.
 * @return int Attachment ID.
 */
function radplapag_e2e_remote_audio( $url, $name ) {
	$attachment_id = wp_insert_attachment(
		array(
			'post_title'     => $name,
			'post_mime_type' => 'audio/mpeg',
			'post_status'    => 'inherit',
			'guid'           => $url,
		)
	);

	if ( ! $attachment_id ) {
		WP_CLI::error( "Could not create {$name}." );
	}

	update_post_meta( $attachment_id, RADPLAPAG_E2E_META, RADPLAPAG_E2E_TAG );
	radplapag_e2e_record( null, null, $attachment_id, $name );

	return $attachment_id;
}

/**
 * Creates the grid programs of docs/known-issues.md (A, B, C, D, E, G, H).
 *
 * H has no extended description (C6).
 *
 * @param int $logo_id Attachment ID for the program logos.
 * @return array<string, int> Program IDs by letter.
 */
function radplapag_e2e_programs( $logo_id ) {
	$ids = array();

	foreach ( array( 'A', 'B', 'C', 'D', 'E', 'G', 'H' ) as $letter ) {
		$program_id = radplapag_e2e_insert(
			array(
				'post_type'  => 'radplapag_program',
				'post_title' => "E2E Program {$letter}",
			),
			"program-{$letter}"
		);

		update_post_meta( $program_id, 'radplapag_program_description', "Program {$letter} description." );
		if ( 'H' !== $letter ) {
			update_post_meta( $program_id, 'radplapag_program_extended_description', "Program {$letter} extended description." );
		}
		update_post_meta( $program_id, 'radplapag_program_logo_id', $logo_id );

		$ids[ $letter ] = $program_id;
	}

	return $ids;
}

/**
 * Builds the grid of docs/known-issues.md, validated by the plugin.
 *
 * @param array<string, int> $programs Program IDs by letter.
 * @return string Schedule meta value (JSON).
 */
function radplapag_e2e_schedule( array $programs ) {
	$slot = function ( $letter, $start, $end, $is_rerun = false ) use ( $programs ) {
		return array(
			'program_id' => $programs[ $letter ],
			'start'      => $start,
			'end'        => $end,
			'is_rerun'   => $is_rerun,
		);
	};

	$schedule = radplapag_sanitize_station_schedule(
		array(
			'monday'    => array(
				$slot( 'A', '06:00', '10:00' ),
				$slot( 'B', '10:00', '14:00', true ),
				$slot( 'C', '22:00', '02:00' ),
			),
			'tuesday'   => array( $slot( 'D', '02:00', '04:00' ) ),
			'wednesday' => array( $slot( 'H', '00:05', '01:00' ) ),
			'saturday'  => array( $slot( 'G', '23:00', '23:50' ) ),
			'sunday'    => array( $slot( 'E', '23:55', '00:30' ) ),
		)
	);

	if ( is_wp_error( $schedule ) ) {
		WP_CLI::error( 'Schedule validation failed: ' . $schedule->get_error_message() );
	}

	return wp_json_encode( $schedule );
}

/**
 * Creates a station assigned to $page_id.
 *
 * @param string $title   Station title.
 * @param string $name    Stable name for the ID map.
 * @param int    $page_id Player page ID.
 * @param array  $meta    Station meta (without the radplapag_station_ prefix).
 * @return int Station ID.
 */
function radplapag_e2e_station( $title, $name, $page_id, array $meta ) {
	$station_id = radplapag_e2e_insert(
		array(
			'post_type'  => 'radplapag_station',
			'post_title' => $title,
		),
		$name
	);

	$meta['player_page'] = $page_id;
	foreach ( $meta as $key => $value ) {
		update_post_meta( $station_id, "radplapag_station_{$key}", $value );
	}

	return $station_id;
}

/**
 * Seeds the e2e site.
 *
 * @param string $media        Origin of the media server with CORS.
 * @param string $media_nocors Origin of the media server without CORS.
 * @return void
 */
function radplapag_e2e_seed( $media, $media_nocors ) {
	radplapag_e2e_reset();

	// Fixed, without DST: timezoneOffset is 5.5 all year (C9).
	update_option( 'timezone_string', 'Asia/Kolkata' );
	// The admin bar would load the avatar from gravatar.com (no internet in e2e).
	update_option( 'show_avatars', 0 );

	$plugin_dir = dirname( __DIR__, 3 );
	$artwork_id = radplapag_e2e_sideload( $plugin_dir . '/scripts/fixtures/assets/station-artwork.jpg', 'attachment-artwork' );
	$intro_id   = radplapag_e2e_sideload( $plugin_dir . '/tests/fixtures/audio/intro.mp3', 'attachment-intro' );
	$broken_id  = radplapag_e2e_remote_audio( "{$media}/broken-intro.mp3", 'attachment-broken-intro' );
	$programs   = radplapag_e2e_programs( $artwork_id );

	$variants = array(
		'mp3'          => array(
			'title' => 'E2E MP3',
			'meta'  => array(
				'stream_url'    => "{$media}/tone.mp3",
				'theme_color'   => 'blue',
				'visualizer'    => 'bars',
				'logo_id'       => $artwork_id,
				'background_id' => $artwork_id,
				'schedule'      => radplapag_e2e_schedule( $programs ),
			),
		),
		'live'         => array(
			'title' => 'E2E Live',
			'meta'  => array( 'stream_url' => "{$media}/live.mp3" ),
		),
		'cut'          => array(
			'title' => 'E2E Cut',
			'meta'  => array( 'stream_url' => "{$media}/cut.mp3" ),
		),
		'hls'          => array(
			'title' => 'E2E HLS',
			'meta'  => array( 'stream_url' => "{$media}/hls/index.m3u8" ),
		),
		'dash'         => array(
			'title' => 'E2E DASH',
			'meta'  => array( 'stream_url' => "{$media}/dash/manifest.mpd" ),
		),
		'nocors-mp3'   => array(
			'title' => 'E2E No CORS MP3',
			'meta'  => array( 'stream_url' => "{$media_nocors}/tone.mp3" ),
		),
		'nocors-hls'   => array(
			'title' => 'E2E No CORS HLS',
			'meta'  => array( 'stream_url' => "{$media_nocors}/hls/index.m3u8" ),
		),
		'intro'        => array(
			'title' => 'E2E Intro',
			'meta'  => array(
				'stream_url'     => "{$media}/live.mp3",
				'intro_audio_id' => $intro_id,
			),
		),
		'broken-intro' => array(
			'title' => 'E2E Broken Intro',
			'meta'  => array(
				'stream_url'     => "{$media}/live.mp3",
				'intro_audio_id' => $broken_id,
			),
		),
		'minimal'      => array(
			'title' => 'E2E Minimal <>&\'"',
			'meta'  => array( 'stream_url' => "{$media}/tone.mp3" ),
		),
		// Pages the plugin must not intercept: their station is valid.
		'draft'        => array(
			'title'  => 'E2E Draft Page',
			'meta'   => array( 'stream_url' => "{$media}/tone.mp3" ),
			'status' => 'draft',
		),
		'password'     => array(
			'title'    => 'E2E Password Page',
			'meta'     => array( 'stream_url' => "{$media}/tone.mp3" ),
			'password' => 'e2e',
		),
		'not-a-page'   => array(
			'title'     => 'E2E Not A Page',
			'meta'      => array( 'stream_url' => "{$media}/tone.mp3" ),
			'post_type' => 'post',
		),
	);

	foreach ( array( 'oscilloscope', 'bars', 'particles', 'waterfall' ) as $visualizer ) {
		$variants[ "visualizer-{$visualizer}" ] = array(
			'title' => 'E2E Visualizer ' . ucfirst( $visualizer ),
			'meta'  => array(
				'stream_url' => "{$media}/live.mp3",
				'visualizer' => $visualizer,
			),
		);
	}

	foreach ( $variants as $key => $variant ) {
		$page_id = radplapag_e2e_insert(
			array(
				'post_type'     => isset( $variant['post_type'] ) ? $variant['post_type'] : 'page',
				'post_title'    => $variant['title'],
				'post_status'   => isset( $variant['status'] ) ? $variant['status'] : 'publish',
				'post_password' => isset( $variant['password'] ) ? $variant['password'] : '',
			),
			"page-{$key}"
		);
		radplapag_e2e_station( $variant['title'], "station-{$key}", $page_id, $variant['meta'] );
		radplapag_e2e_record( $key, get_permalink( $page_id ) );
	}

	$no_station_id = radplapag_e2e_insert(
		array(
			'post_type'  => 'page',
			'post_title' => 'E2E No Station',
		),
		'page-no-station'
	);
	radplapag_e2e_record( 'no-station', get_permalink( $no_station_id ) );

	// The blocks select their station by position in radplapag_get_stations().
	$mp3_id        = array_search( 'station-mp3', radplapag_e2e_record()['ids'], true );
	$station_index = array_search( (int) $mp3_id, array_column( radplapag_get_stations(), 'id' ), true );
	$attributes    = wp_json_encode( array( 'stationIndex' => $station_index ) );

	$blocks_id = radplapag_e2e_insert(
		array(
			'post_type'    => 'page',
			'post_title'   => 'E2E Blocks',
			'post_content' => "<!-- wp:radplapag/now-playing {$attributes} /-->\n\n"
				. "<!-- wp:radplapag/schedule {$attributes} /-->\n\n"
				. "<!-- wp:radplapag/programs-list {$attributes} /-->",
		),
		'page-blocks'
	);
	radplapag_e2e_record( 'blocks', get_permalink( $blocks_id ) );

	WP_CLI::line( wp_json_encode( radplapag_e2e_record(), JSON_UNESCAPED_SLASHES ) );
}

radplapag_e2e_seed( $args[0], $args[1] );
