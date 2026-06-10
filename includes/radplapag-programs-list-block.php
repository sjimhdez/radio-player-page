<?php
/**
 * Programs List block helpers: list of programs with schedule slots for the Gutenberg block.
 *
 * Depends on radplapag-schedule-block.php for radplapag_parse_time_to_minutes(), radplapag_is_slot_active(),
 * and radplapag_get_schedule_day_keys_and_labels().
 *
 * @package radio-player-page
 * @since 3.3.0
 */

defined( 'ABSPATH' ) || exit;

/**
 * Retrieves the list of programs with name, descriptions, logo, and schedule slots for a station.
 *
 * Builds from schedule program_id (post IDs) by loading radplapag_program CPT, in order of first appearance in schedule.
 *
 * Uses WordPress timezone for "current" time when marking is_live on slots.
 *
 * @since 3.3.0
 * @param int $station_index Zero-based index into the ordered stations list (radplapag_get_stations()).
 * @return array|null List of programs, each with 'id', 'name', 'logo_id' (attachment ID or 0), 'description', 'extended_description', 'slots'. Null if station invalid or index out of range.
 */
function radplapag_get_programs_list_for_station( $station_index ) {
	$config  = radplapag_get_config();
	if ( ! isset( $config['stations'] ) || ! is_array( $config['stations'] ) ) {
		return null;
	}
	$stations = $config['stations'];
	$idx      = (int) $station_index;
	if ( $idx < 0 || $idx >= count( $stations ) ) {
		return null;
	}
	$station = $stations[ $idx ];

	$schedule_raw = isset( $station['schedule'] ) && is_array( $station['schedule'] ) ? $station['schedule'] : [];

	$day_data   = radplapag_get_schedule_day_keys_and_labels();
	$day_keys   = $day_data['day_keys_order'];
	$day_labels = $day_data['day_labels'];

	$tz               = wp_timezone();
	$now              = new DateTime( 'now', $tz );
	$day_of_week      = (int) $now->format( 'w' );
	$current_minutes  = (int) $now->format( 'G' ) * 60 + (int) $now->format( 'i' );

	// Build slots per program_id: collect from schedule, then attach to each program.
	$slots_by_program = [];
	foreach ( $day_keys as $day_key ) {
		$day_entries = isset( $schedule_raw[ $day_key ] ) && is_array( $schedule_raw[ $day_key ] ) ? $schedule_raw[ $day_key ] : [];
		$label       = $day_labels[ $day_key ] ?? $day_key;
		$day_num     = array_search( $day_key, $day_keys, true );
		$wp_day      = $day_num === 6 ? 0 : $day_num + 1;
		$is_today    = ( $wp_day === $day_of_week );
		$is_prev_day = ( $wp_day === ( ( $day_of_week - 1 + 7 ) % 7 ) );

		foreach ( $day_entries as $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}
			$program_id = $entry['program_id'] ?? '';
			if ( $program_id === '' ) {
				continue;
			}
			$program_id_key = is_numeric( $program_id ) ? (string) (int) $program_id : sanitize_text_field( $program_id );
			$start          = (string) ( $entry['start'] ?? '' );
			$end            = (string) ( $entry['end'] ?? '' );
			if ( $start === '' || $end === '' ) {
				continue;
			}
			$is_live = false;
			if ( $is_today ) {
				$is_live = radplapag_is_slot_active( $start, $end, $current_minutes, false );
			} elseif ( $is_prev_day ) {
				$is_live = radplapag_is_slot_active( $start, $end, $current_minutes, true );
			}
			$time_range = $start . '-' . $end;
			if ( ! isset( $slots_by_program[ $program_id_key ] ) ) {
				$slots_by_program[ $program_id_key ] = [];
			}
			$slots_by_program[ $program_id_key ][] = [
				'day_key'    => $day_key,
				'day_label'  => $label,
				'time_range' => $time_range,
				'is_live'    => $is_live,
			];
		}
	}

	// Sort slots within each program: by day order then by start time.
	foreach ( array_keys( $slots_by_program ) as $pid ) {
		usort( $slots_by_program[ $pid ], function ( $a, $b ) use ( $day_keys ) {
			$pos_a = array_search( $a['day_key'], $day_keys, true );
			$pos_b = array_search( $b['day_key'], $day_keys, true );
			if ( $pos_a !== $pos_b ) {
				return $pos_a - $pos_b;
			}
			$start_a = substr( $a['time_range'], 0, 5 );
			$start_b = substr( $b['time_range'], 0, 5 );
			return radplapag_parse_time_to_minutes( $start_a ) - radplapag_parse_time_to_minutes( $start_b );
		} );
	}

	// Get unique program IDs in order of first appearance in schedule (Monday–Sunday).
	$program_ids_ordered = [];
	foreach ( $day_keys as $day_key ) {
		$day_entries = isset( $schedule_raw[ $day_key ] ) && is_array( $schedule_raw[ $day_key ] ) ? $schedule_raw[ $day_key ] : [];
		foreach ( $day_entries as $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}
			$pid = $entry['program_id'] ?? null;
			if ( $pid !== null && $pid !== '' && is_numeric( $pid ) ) {
				$pid_int = (int) $pid;
				if ( $pid_int > 0 && ! in_array( $pid_int, $program_ids_ordered, true ) ) {
					$program_ids_ordered[] = $pid_int;
				}
			}
		}
	}

	$out = [];
	foreach ( $program_ids_ordered as $post_id ) {
		$data = radplapag_get_program_data( $post_id, true );
		if ( ! $data ) {
			continue;
		}
		$key  = (string) $post_id;
		$slots = $slots_by_program[ $key ] ?? [];
		$out[] = [
			'id'                   => $key,
			'name'                 => $data['name'],
			'logo_id'              => $data['logo_id'] > 0 ? $data['logo_id'] : 0,
			'description'          => $data['description'] !== '' ? $data['description'] : null,
			'extended_description' => $data['extended_description'] !== '' ? $data['extended_description'] : null,
			'slots'                => $slots,
		];
	}
	return $out;
}
