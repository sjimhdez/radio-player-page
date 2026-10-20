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
 * Handles slots that cross midnight (end <= start).
 *
 * @since 3.3.0
 * @since 3.5.0 Delegates to RadioPlayerPage\Schedule\Time::is_slot_active().
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
 * @param array $station Station array with 'schedule' key.
 * @return array Associative array program_id (string) => [ 'name' => string, 'description' => string|null, 'extended_description' => string|null, 'logo_url' => string|null ].
 */
function radplapag_build_programs_map( array $station ): array {
	$map          = array();
	$schedule_raw = isset( $station['schedule'] ) && is_array( $station['schedule'] ) ? $station['schedule'] : array();
	$program_ids  = array();
	foreach ( $schedule_raw as $day_entries ) {
		if ( ! is_array( $day_entries ) ) {
			continue;
		}
		foreach ( $day_entries as $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}
			$pid = $entry['program_id'] ?? null;
			if ( null === $pid || '' === $pid ) {
				continue;
			}
			$pid_int = is_numeric( $pid ) ? (int) $pid : 0;
			if ( $pid_int > 0 ) {
				$program_ids[ $pid_int ] = true;
			}
		}
	}
	foreach ( array_keys( $program_ids ) as $post_id ) {
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
	$station      = $stations[ $idx ];
	$programs_map = radplapag_build_programs_map( $station );
	$schedule_raw = isset( $station['schedule'] ) && is_array( $station['schedule'] ) ? $station['schedule'] : array();

	// Current time in WordPress timezone (day 0=Sunday, minutes since midnight).
	$tz              = wp_timezone();
	$now             = new DateTime( 'now', $tz );
	$day_of_week     = (int) $now->format( 'w' );
	$current_minutes = (int) $now->format( 'G' ) * 60 + (int) $now->format( 'i' );

	$day_data       = radplapag_get_schedule_day_keys_and_labels();
	$day_keys_order = $day_data['day_keys_order'];
	$day_labels     = $day_data['day_labels'];

	$days_out = array();
	foreach ( $day_keys_order as $day_key ) {
		$day_entries = isset( $schedule_raw[ $day_key ] ) && is_array( $schedule_raw[ $day_key ] ) ? $schedule_raw[ $day_key ] : array();
		$slots       = array();
		foreach ( $day_entries as $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}
			$program_id = sanitize_text_field( (string) ( $entry['program_id'] ?? '' ) );
			$start      = (string) ( $entry['start'] ?? '' );
			$end        = (string) ( $entry['end'] ?? '' );
			if ( '' === $program_id || '' === $start || '' === $end ) {
				continue;
			}
			$prog    = $programs_map[ $program_id ] ?? array(
				'name'                 => '',
				'description'          => null,
				'extended_description' => null,
				'logo_url'             => null,
			);
			$day_num = array_search( $day_key, $day_keys_order, true );
			// day_num: monday=0 .. sunday=6. WordPress day_of_week: sunday=0, monday=1, ...
			$wp_day      = 6 === $day_num ? 0 : $day_num + 1;
			$is_today    = ( $wp_day === $day_of_week );
			$is_prev_day = ( ( ( $day_of_week - 1 + 7 ) % 7 ) === $wp_day );
			$is_live     = false;
			if ( $is_today ) {
				$is_live = radplapag_is_slot_active( $start, $end, $current_minutes, false );
			} elseif ( $is_prev_day ) {
				$is_live = radplapag_is_slot_active( $start, $end, $current_minutes, true );
			}
			$slots[] = array(
				'program_id'                   => $program_id,
				'program_name'                 => $prog['name'],
				'program_description'          => isset( $prog['description'] ) && is_string( $prog['description'] ) ? $prog['description'] : '',
				'program_extended_description' => isset( $prog['extended_description'] ) && is_string( $prog['extended_description'] ) ? $prog['extended_description'] : '',
				'start'                        => $start,
				'end'                          => $end,
				'time_range'                   => $start . '-' . $end,
				'is_live'                      => $is_live,
				'is_rerun'                     => ! empty( $entry['is_rerun'] ),
			);
		}
		// Sort by start time.
		usort(
			$slots,
			function ( $a, $b ) {
				return radplapag_parse_time_to_minutes( $a['start'] ) - radplapag_parse_time_to_minutes( $b['start'] );
			}
		);
		$days_out[] = array(
			'day_key' => $day_key,
			'label'   => $day_labels[ $day_key ] ?? $day_key,
			'slots'   => $slots,
		);
	}

	// Reorder days: current day first (default) or keep Monday–Sunday.
	if ( 'current_first' === $day_order && count( $days_out ) === 7 ) {
		// WordPress day_of_week: 0=Sunday, 1=Monday, ..., 6=Saturday. days_out: 0=Monday, ..., 6=Sunday.
		$start_index = ( 0 === $day_of_week ) ? 6 : ( $day_of_week - 1 );
		$reordered   = array();
		for ( $i = 0; $i < 7; $i++ ) {
			$reordered[] = $days_out[ ( $start_index + $i ) % 7 ];
		}
		$days_out = $reordered;
	}

	$station_page_url = '';
	if ( isset( $station['player_page'] ) && $station['player_page'] ) {
		$page_id = (int) $station['player_page'];
		if ( $page_id > 0 ) {
			$station_page_url = get_permalink( $page_id );
			$station_page_url = is_string( $station_page_url ) ? $station_page_url : '';
		}
	}

	return array(
		'programs'         => $programs_map,
		'days'             => $days_out,
		'station_page_url' => $station_page_url,
	);
}
