<?php
/**
 * Now Playing block helpers: resolves the on-air program and the next program starting
 * soon for a station.
 *
 * Depends on radplapag-schedule-block.php for radplapag_parse_time_to_minutes(), radplapag_is_slot_active(),
 * and radplapag_get_schedule_day_keys_and_labels().
 *
 * @package radio-player-page
 * @since 3.4.0
 */

defined( 'ABSPATH' ) || exit;

define( 'RADPLAPAG_NOW_PLAYING_UPCOMING_WINDOW_MINUTES', 10 );

/**
 * Resolves the currently on-air program and the next program starting within the upcoming
 * window for a station.
 *
 * Uses WordPress timezone for "current" time. The upcoming lookup handles the midnight
 * boundary (e.g. a show starting at 00:05 counts as "coming up" at 23:58).
 *
 * @since 3.4.0
 * @param int $station_index Zero-based index into the ordered stations list (radplapag_get_stations()).
 * @return array|null Associative array with 'current', 'upcoming', and 'station_page_url' keys.
 *                    'current'/'upcoming' are each either null or
 *                    [ 'id', 'name', 'logo_id', 'day_label', 'time_range', 'is_rerun' ] ('upcoming' never has 'logo_id').
 *                    Null if the station index is invalid.
 */
function radplapag_get_now_playing_for_station( $station_index ) {
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
	$schedule_raw = isset( $station['schedule'] ) && is_array( $station['schedule'] ) ? $station['schedule'] : [];

	$station_page_url = '';
	if ( isset( $station['player_page'] ) && $station['player_page'] ) {
		$page_id = (int) $station['player_page'];
		if ( $page_id > 0 ) {
			$station_page_url = get_permalink( $page_id );
			$station_page_url = is_string( $station_page_url ) ? $station_page_url : '';
		}
	}

	$day_data   = radplapag_get_schedule_day_keys_and_labels();
	$day_keys   = $day_data['day_keys_order'];
	$day_labels = $day_data['day_labels'];

	$tz              = wp_timezone();
	$now             = new DateTime( 'now', $tz );
	$day_of_week     = (int) $now->format( 'w' ); // 0 = Sunday ... 6 = Saturday.
	$current_minutes = (int) $now->format( 'G' ) * 60 + (int) $now->format( 'i' );

	$day_key_for_wp_day = function ( $wp_day ) use ( $day_keys ) {
		foreach ( $day_keys as $index => $day_key ) {
			$key_wp_day = ( $index === 6 ) ? 0 : $index + 1;
			if ( $key_wp_day === $wp_day ) {
				return $day_key;
			}
		}
		return null;
	};

	$today_key    = $day_key_for_wp_day( $day_of_week );
	$prev_day_key = $day_key_for_wp_day( ( $day_of_week - 1 + 7 ) % 7 );
	$tomorrow_key = $day_key_for_wp_day( ( $day_of_week + 1 ) % 7 );

	$build_entry = function ( $entry, $day_label ) {
		$program_id = $entry['program_id'] ?? '';
		if ( $program_id === '' || ! is_numeric( $program_id ) ) {
			return null;
		}
		$data = radplapag_get_program_data( (int) $program_id, true );
		if ( ! $data ) {
			return null;
		}
		$start = (string) ( $entry['start'] ?? '' );
		$end   = (string) ( $entry['end'] ?? '' );
		return [
			'id'         => (string) (int) $program_id,
			'name'       => $data['name'],
			'logo_id'    => $data['logo_id'] > 0 ? $data['logo_id'] : 0,
			'day_label'  => $day_label,
			'time_range' => $start . '-' . $end,
			'is_rerun'   => ! empty( $entry['is_rerun'] ),
		];
	};

	// Current: today's slots first, then yesterday's slots that cross midnight into now.
	$current = null;
	foreach ( [ [ $today_key, false ], [ $prev_day_key, true ] ] as $candidate ) {
		if ( $current !== null ) {
			break;
		}
		list( $day_key, $is_prev_day_crossing ) = $candidate;
		if ( $day_key === null ) {
			continue;
		}
		$entries = isset( $schedule_raw[ $day_key ] ) && is_array( $schedule_raw[ $day_key ] ) ? $schedule_raw[ $day_key ] : [];
		foreach ( $entries as $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}
			$start = (string) ( $entry['start'] ?? '' );
			$end   = (string) ( $entry['end'] ?? '' );
			if ( $start === '' || $end === '' ) {
				continue;
			}
			if ( radplapag_is_slot_active( $start, $end, $current_minutes, $is_prev_day_crossing ) ) {
				$current = $build_entry( $entry, $day_labels[ $day_key ] ?? $day_key );
				break;
			}
		}
	}

	// Upcoming: nearest slot starting within the window, later today or just after midnight tomorrow.
	$upcoming       = null;
	$upcoming_delta = null;

	$today_entries = isset( $schedule_raw[ $today_key ] ) && is_array( $schedule_raw[ $today_key ] ) ? $schedule_raw[ $today_key ] : [];
	foreach ( $today_entries as $entry ) {
		if ( ! is_array( $entry ) ) {
			continue;
		}
		$start = (string) ( $entry['start'] ?? '' );
		if ( $start === '' ) {
			continue;
		}
		$delta = radplapag_parse_time_to_minutes( $start ) - $current_minutes;
		if ( $delta > 0 && $delta <= RADPLAPAG_NOW_PLAYING_UPCOMING_WINDOW_MINUTES
			&& ( $upcoming_delta === null || $delta < $upcoming_delta ) ) {
			$upcoming       = $build_entry( $entry, $day_labels[ $today_key ] ?? $today_key );
			$upcoming_delta = $delta;
		}
	}

	$minutes_to_midnight = 1440 - $current_minutes;
	if ( $minutes_to_midnight <= RADPLAPAG_NOW_PLAYING_UPCOMING_WINDOW_MINUTES && $tomorrow_key !== null ) {
		$tomorrow_entries = isset( $schedule_raw[ $tomorrow_key ] ) && is_array( $schedule_raw[ $tomorrow_key ] ) ? $schedule_raw[ $tomorrow_key ] : [];
		foreach ( $tomorrow_entries as $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}
			$start = (string) ( $entry['start'] ?? '' );
			if ( $start === '' ) {
				continue;
			}
			$delta = $minutes_to_midnight + radplapag_parse_time_to_minutes( $start );
			if ( $delta > 0 && $delta <= RADPLAPAG_NOW_PLAYING_UPCOMING_WINDOW_MINUTES
				&& ( $upcoming_delta === null || $delta < $upcoming_delta ) ) {
				$upcoming       = $build_entry( $entry, $day_labels[ $tomorrow_key ] ?? $tomorrow_key );
				$upcoming_delta = $delta;
			}
		}
	}

	if ( $upcoming !== null ) {
		unset( $upcoming['logo_id'] );
	}

	return [
		'current'          => $current,
		'upcoming'         => $upcoming,
		'station_page_url' => $station_page_url,
	];
}
