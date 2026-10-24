<?php
/**
 * Schedule block helpers: resolved schedule data for the WordPress block.
 *
 * @package radio-player-page
 * @since 3.3.0
 */

defined( 'ABSPATH' ) || exit;

/**
 * Day key to PHP day-of-week index (0 = Sunday).
 *
 * @since 3.3.0
 * @var array
 */
$radplapag_schedule_day_map = array(
	'sunday'    => 0,
	'monday'    => 1,
	'tuesday'   => 2,
	'wednesday' => 3,
	'thursday'  => 4,
	'friday'    => 5,
	'saturday'  => 6,
);

/**
 * Parses "HH:MM" to minutes since midnight.
 *
 * @since 3.3.0
 * @since 3.5.0 Delegates to RadioPlayerPage\Schedule\Time::to_minutes().
 * @param string $time Time string in HH:MM format.
 * @return int Minutes since midnight (0-1439), or 0 if invalid.
 */
function radplapag_parse_time_to_minutes( $time ): int {
	return \RadioPlayerPage\Schedule\Time::to_minutes( $time );
}

/**
 * Checks if a schedule slot is currently active (by start/end only).
 *
 * Mirrors the logic in player/src/utils/program-schedule.ts (isProgramActive).
 * Handles slots that cross midnight (end <= start) as intervals of the week.
 *
 * @since 3.3.0
 * @since 3.5.0 Delegates to RadioPlayerPage\Schedule\Time::is_slot_active().
 *              A slot crossing midnight is no longer active before its end on its
 *              own day, only from its start (C16, ADR 0044).
 * @param string $start              Start time HH:MM.
 * @param string $end                End time HH:MM.
 * @param int    $current_minutes    Current time as minutes since midnight (0-1439).
 * @param bool   $is_prev_day_crossing True when evaluating previous day's slot that crosses midnight.
 * @return bool True if the slot is active now.
 */
function radplapag_is_slot_active( $start, $end, int $current_minutes, bool $is_prev_day_crossing = false ): bool {
	return \RadioPlayerPage\Schedule\Time::is_slot_active( $start, $end, $current_minutes, $is_prev_day_crossing );
}

/**
 * Returns day keys in order (Monday to Sunday) and translated labels for schedule display.
 *
 * Shared by the schedule block and the programs list block so day labels are not duplicated.
 *
 * @since 3.3.0
 * @since 3.5.0 The day keys come from RadioPlayerPage\Schedule\Week::KEYS.
 * @return array Associative array with 'day_keys_order' (array of day keys) and 'day_labels' (day_key => translated label).
 */
function radplapag_get_schedule_day_keys_and_labels(): array {
	$day_keys_order = \RadioPlayerPage\Schedule\Week::KEYS;
	$day_labels     = array(
		'monday'    => __( 'Monday', 'radio-player-page' ),
		'tuesday'   => __( 'Tuesday', 'radio-player-page' ),
		'wednesday' => __( 'Wednesday', 'radio-player-page' ),
		'thursday'  => __( 'Thursday', 'radio-player-page' ),
		'friday'    => __( 'Friday', 'radio-player-page' ),
		'saturday'  => __( 'Saturday', 'radio-player-page' ),
		'sunday'    => __( 'Sunday', 'radio-player-page' ),
	);
	return array(
		'day_keys_order' => $day_keys_order,
		'day_labels'     => $day_labels,
	);
}

/**
 * Builds resolved programs array (id => name, description, logo_url) from station schedule.
 *
 * Collects program_id (post IDs) from station['schedule'] and loads each from radplapag_program CPT.
 *
 * @since 3.3.0
 * @since 3.5.0 The program IDs come from RadioPlayerPage\Schedule\Schedule_View::program_ids().
 * @since 3.5.0 Only public programs count: published and without password (ADR 0045).
 * @param array $station Station array with 'schedule' key.
 * @return array Associative array program_id (string) => [ 'name' => string, 'description' => string|null, 'extended_description' => string|null, 'logo_url' => string|null ].
 */
function radplapag_build_programs_map( array $station ): array {
	$map             = array();
	$schedule_raw    = isset( $station['schedule'] ) && is_array( $station['schedule'] ) ? $station['schedule'] : array();
	$public_programs = \RadioPlayerPage\WP\Program_Repository::public_programs( $schedule_raw );
	$schedule_raw    = \RadioPlayerPage\Schedule\Public_Slots::filter( $schedule_raw, array_keys( $public_programs ) );
	foreach ( \RadioPlayerPage\Schedule\Schedule_View::program_ids( $schedule_raw ) as $post_id ) {
		$data = radplapag_get_program_data( $post_id, true );
		if ( $data ) {
			$key         = (string) $post_id;
			$map[ $key ] = array(
				'name'                 => $data['name'],
				'description'          => '' !== $data['description'] ? $data['description'] : null,
				'extended_description' => '' !== $data['extended_description'] ? $data['extended_description'] : null,
				'logo_url'             => $data['logo_url'],
			);
		}
	}
	return $map;
}

/**
 * Retrieves resolved schedule data for a station by index (for the schedule block).
 *
 * Returns programs map and per-day slots with resolved program name and is_live flag.
 * Uses WordPress timezone for "current" time.
 *
 * @since 3.3.0
 * @since 3.5.0 Delegates to RadioPlayerPage\Schedule\Schedule_View::days(), with the time of RadioPlayerPage\WP\Clock.
 * @since 3.5.0 Leaves out the slots of programs that are not public: not published, password-protected or missing (C10, ADR 0045).
 * @since 3.5.0 Delegates the player page link to RadioPlayerPage\WP\Player_Page: empty if the page is not served (K50).
 * @param int    $station_index Zero-based index into the ordered stations list (radplapag_get_stations()).
 * @param string $day_order     Optional. 'current_first' (default) = start with today; 'natural' = Monday to Sunday.
 * @return array|null Associative array with 'programs', 'days', 'station_page_url' (permalink for station's player page, or empty string),
 *                    or null if station invalid or index out of range.
 */
function radplapag_get_schedule_for_station( $station_index, string $day_order = 'current_first' ) {
	$config = radplapag_get_config();
	if ( ! isset( $config['stations'] ) || ! is_array( $config['stations'] ) ) {
		return null;
	}
	$stations = $config['stations'];
	$idx      = (int) $station_index;
	if ( $idx < 0 || $idx >= count( $stations ) ) {
		return null;
	}
	$station         = $stations[ $idx ];
	$programs_map    = radplapag_build_programs_map( $station );
	$schedule_raw    = isset( $station['schedule'] ) && is_array( $station['schedule'] ) ? $station['schedule'] : array();
	$public_programs = \RadioPlayerPage\WP\Program_Repository::public_programs( $schedule_raw );
	$schedule_raw    = \RadioPlayerPage\Schedule\Public_Slots::filter( $schedule_raw, array_keys( $public_programs ) );

	$day_data = radplapag_get_schedule_day_keys_and_labels();
	$days_out = \RadioPlayerPage\Schedule\Schedule_View::days(
		$schedule_raw,
		$programs_map,
		$day_data['day_labels'],
		\RadioPlayerPage\WP\Clock::now(),
		$day_order,
		'sanitize_text_field'
	);

	$station_page_url = \RadioPlayerPage\WP\Player_Page::url( (int) ( $station['player_page'] ?? 0 ) );

	return array(
		'programs'         => $programs_map,
		'days'             => $days_out,
		'station_page_url' => $station_page_url,
	);
}
