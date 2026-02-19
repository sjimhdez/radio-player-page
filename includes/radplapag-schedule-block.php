<?php
/**
 * Schedule block helpers: resolved schedule data for the Gutenberg block.
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
$radplapag_schedule_day_map = [
	'sunday'    => 0,
	'monday'    => 1,
	'tuesday'   => 2,
	'wednesday' => 3,
	'thursday'  => 4,
	'friday'    => 5,
	'saturday'  => 6,
];

/**
 * Parses "HH:MM" to minutes since midnight.
 *
 * @since 3.3.0
 * @param string $time Time string in HH:MM format.
 * @return int Minutes since midnight (0-1439), or 0 if invalid.
 */
function radplapag_parse_time_to_minutes( $time ) {
	if ( ! is_string( $time ) || $time === '' ) {
		return 0;
	}
	$parts = array_map( 'intval', explode( ':', $time, 2 ) );
	$hour  = isset( $parts[0] ) ? $parts[0] : 0;
	$min   = isset( $parts[1] ) ? $parts[1] : 0;
	return $hour * 60 + $min;
}

/**
 * Checks if a schedule slot is currently active (by start/end only).
 *
 * Mirrors the logic in player/src/utils/program-schedule.ts (isProgramActive).
 * Handles slots that cross midnight (end <= start).
 *
 * @since 3.3.0
 * @param string $start              Start time HH:MM.
 * @param string $end                End time HH:MM.
 * @param int    $current_minutes    Current time as minutes since midnight (0-1439).
 * @param bool   $is_prev_day_crossing True when evaluating previous day's slot that crosses midnight.
 * @return bool True if the slot is active now.
 */
function radplapag_is_slot_active( $start, $end, $current_minutes, $is_prev_day_crossing = false ) {
	$start_min = radplapag_parse_time_to_minutes( $start );
	$end_min   = radplapag_parse_time_to_minutes( $end );

	if ( $is_prev_day_crossing ) {
		return $end_min <= $start_min && $current_minutes < $end_min;
	}

	if ( $end_min <= $start_min ) {
		return $current_minutes >= $start_min || $current_minutes < $end_min;
	}

	return $current_minutes >= $start_min && $current_minutes < $end_min;
}

/**
 * Builds resolved programs array (id => name, description, logo_url) from station raw programs.
 *
 * @since 3.3.0
 * @param array $station Station array with 'programs' key.
 * @return array Associative array program_id => [ 'name' => string, 'description' => string|null, 'logo_url' => string|null ].
 */
function radplapag_build_programs_map( $station ) {
	$map = [];
	if ( ! isset( $station['programs'] ) || ! is_array( $station['programs'] ) ) {
		return $map;
	}
	foreach ( $station['programs'] as $prog ) {
		$prog_id   = isset( $prog['id'] ) ? sanitize_text_field( $prog['id'] ) : '';
		$name      = isset( $prog['name'] ) ? $prog['name'] : '';
		$desc      = isset( $prog['description'] ) ? $prog['description'] : '';
		$logo_id   = isset( $prog['logo_id'] ) ? intval( $prog['logo_id'] ) : 0;
		$logo_url  = ( $logo_id > 0 ) ? wp_get_attachment_image_url( $logo_id, 'full' ) : null;
		if ( $prog_id !== '' ) {
			$map[ $prog_id ] = [
				'name'        => $name,
				'description' => $desc ? $desc : null,
				'logo_url'    => $logo_url ? $logo_url : null,
			];
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
 * @param int    $station_index Zero-based index into radplapag_settings['stations'].
 * @param string $day_order     Optional. 'current_first' (default) = start with today; 'natural' = Monday to Sunday.
 * @return array|null Associative array with 'programs' (id => name, description, logo_url),
 *                    'days' (array of [ 'day_key' => string, 'label' => string, 'slots' => [...] ]),
 *                    or null if station invalid or index out of range.
 */
function radplapag_get_schedule_for_station( $station_index, $day_order = 'current_first' ) {
	$options = radplapag_get_settings();
	if ( ! isset( $options['stations'] ) || ! is_array( $options['stations'] ) ) {
		return null;
	}
	$stations = $options['stations'];
	$idx      = (int) $station_index;
	if ( $idx < 0 || $idx >= count( $stations ) ) {
		return null;
	}
	$station = $stations[ $idx ];
	$programs_map = radplapag_build_programs_map( $station );
	$schedule_raw = isset( $station['schedule'] ) && is_array( $station['schedule'] ) ? $station['schedule'] : [];

	// Current time in WordPress timezone (day 0=Sunday, minutes since midnight).
	$tz       = wp_timezone();
	$now      = new DateTime( 'now', $tz );
	$day_of_week = (int) $now->format( 'w' );
	$current_minutes = (int) $now->format( 'G' ) * 60 + (int) $now->format( 'i' );

	$day_keys_order = [ 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday' ];
	$day_labels = [
		'monday'    => __( 'Monday', 'radio-player-page' ),
		'tuesday'   => __( 'Tuesday', 'radio-player-page' ),
		'wednesday' => __( 'Wednesday', 'radio-player-page' ),
		'thursday'  => __( 'Thursday', 'radio-player-page' ),
		'friday'    => __( 'Friday', 'radio-player-page' ),
		'saturday'  => __( 'Saturday', 'radio-player-page' ),
		'sunday'    => __( 'Sunday', 'radio-player-page' ),
	];

	$days_out = [];
	foreach ( $day_keys_order as $day_key ) {
		$day_entries = isset( $schedule_raw[ $day_key ] ) && is_array( $schedule_raw[ $day_key ] ) ? $schedule_raw[ $day_key ] : [];
		$slots = [];
		foreach ( $day_entries as $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}
			$program_id = isset( $entry['program_id'] ) ? sanitize_text_field( $entry['program_id'] ) : '';
			$start      = isset( $entry['start'] ) ? $entry['start'] : '';
			$end        = isset( $entry['end'] ) ? $entry['end'] : '';
			if ( $program_id === '' || $start === '' || $end === '' ) {
				continue;
			}
			$prog  = isset( $programs_map[ $program_id ] ) ? $programs_map[ $program_id ] : [ 'name' => '', 'description' => null, 'logo_url' => null ];
			$day_num = array_search( $day_key, $day_keys_order, true );
			// day_num: monday=0 .. sunday=6. WordPress day_of_week: sunday=0, monday=1, ...
			$wp_day = $day_num === 6 ? 0 : $day_num + 1;
			$is_today = ( $wp_day === $day_of_week );
			$is_prev_day = ( $wp_day === ( $day_of_week - 1 + 7 ) % 7 );
			$is_live = false;
			if ( $is_today ) {
				$is_live = radplapag_is_slot_active( $start, $end, $current_minutes, false );
			} elseif ( $is_prev_day ) {
				$is_live = radplapag_is_slot_active( $start, $end, $current_minutes, true );
			}
			$slots[] = [
				'program_id'   => $program_id,
				'program_name' => $prog['name'],
				'start'        => $start,
				'end'          => $end,
				'time_range'   => $start . '-' . $end,
				'is_live'      => $is_live,
			];
		}
		// Sort by start time.
		usort( $slots, function ( $a, $b ) {
			return radplapag_parse_time_to_minutes( $a['start'] ) - radplapag_parse_time_to_minutes( $b['start'] );
		} );
		$days_out[] = [
			'day_key' => $day_key,
			'label'   => isset( $day_labels[ $day_key ] ) ? $day_labels[ $day_key ] : $day_key,
			'slots'   => $slots,
		];
	}

	// Reorder days: current day first (default) or keep Monday–Sunday.
	if ( $day_order === 'current_first' && count( $days_out ) === 7 ) {
		// WordPress day_of_week: 0=Sunday, 1=Monday, ..., 6=Saturday. days_out: 0=Monday, ..., 6=Sunday.
		$start_index = ( $day_of_week === 0 ) ? 6 : ( $day_of_week - 1 );
		$reordered = array();
		for ( $i = 0; $i < 7; $i++ ) {
			$reordered[] = $days_out[ ( $start_index + $i ) % 7 ];
		}
		$days_out = $reordered;
	}

	return [
		'programs' => $programs_map,
		'days'     => $days_out,
	];
}
