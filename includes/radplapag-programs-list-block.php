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
 * Retrieves the list of programs with name, logo, extended description and schedule slots for a station.
 *
 * Uses WordPress timezone for "current" time when marking is_live on slots.
 *
 * @since 3.3.0
 * @param int $station_index Zero-based index into radplapag_settings['stations'].
 * @return array|null List of programs, each with 'id', 'name', 'logo_id' (attachment ID or 0), 'extended_description', 'slots' (array of day_label, time_range, is_live). Null if station invalid or index out of range.
 */
function radplapag_get_programs_list_for_station( $station_index ) {
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

	$programs_raw = isset( $station['programs'] ) && is_array( $station['programs'] ) ? $station['programs'] : [];
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
		$label       = isset( $day_labels[ $day_key ] ) ? $day_labels[ $day_key ] : $day_key;
		$day_num     = array_search( $day_key, $day_keys, true );
		$wp_day      = $day_num === 6 ? 0 : $day_num + 1;
		$is_today    = ( $wp_day === $day_of_week );
		$is_prev_day = ( $wp_day === ( ( $day_of_week - 1 + 7 ) % 7 ) );

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
			$is_live = false;
			if ( $is_today ) {
				$is_live = radplapag_is_slot_active( $start, $end, $current_minutes, false );
			} elseif ( $is_prev_day ) {
				$is_live = radplapag_is_slot_active( $start, $end, $current_minutes, true );
			}
			$time_range = $start . '-' . $end;
			if ( ! isset( $slots_by_program[ $program_id ] ) ) {
				$slots_by_program[ $program_id ] = [];
			}
			$slots_by_program[ $program_id ][] = [
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

	// Build output list in the same order as station['programs'].
	$out = [];
	foreach ( $programs_raw as $prog ) {
		$prog_id   = isset( $prog['id'] ) ? sanitize_text_field( $prog['id'] ) : '';
		$name      = isset( $prog['name'] ) ? $prog['name'] : '';
		$ext_desc  = isset( $prog['extended_description'] ) ? $prog['extended_description'] : '';
		$logo_id = isset( $prog['logo_id'] ) ? intval( $prog['logo_id'] ) : 0;
		if ( $prog_id === '' ) {
			continue;
		}
		$slots = isset( $slots_by_program[ $prog_id ] ) ? $slots_by_program[ $prog_id ] : [];
		$out[] = [
			'id'                   => $prog_id,
			'name'                 => $name,
			'logo_id'              => $logo_id > 0 ? $logo_id : 0,
			'extended_description' => $ext_desc ? $ext_desc : null,
			'slots'                => $slots,
		];
	}

	return $out;
}
