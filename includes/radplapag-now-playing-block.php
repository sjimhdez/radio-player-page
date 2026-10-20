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
 * @since 3.5.0 Delegates to RadioPlayerPage\Schedule\Now_Playing_Resolver, with the time of RadioPlayerPage\WP\Clock.
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
	$schedule_raw = isset( $station['schedule'] ) && is_array( $station['schedule'] ) ? $station['schedule'] : array();

	$station_page_url = '';
	if ( isset( $station['player_page'] ) && $station['player_page'] ) {
		$page_id = (int) $station['player_page'];
		if ( $page_id > 0 ) {
			$station_page_url = get_permalink( $page_id );
			$station_page_url = is_string( $station_page_url ) ? $station_page_url : '';
		}
	}

	// Published programs the slots use (a draft gives a null entry: C10 in docs/known-issues.md).
	$programs = array();
	foreach ( $schedule_raw as $entries ) {
		if ( ! is_array( $entries ) ) {
			continue;
		}
		foreach ( $entries as $entry ) {
			$program_id = is_array( $entry ) && isset( $entry['program_id'] ) && is_numeric( $entry['program_id'] ) ? (int) $entry['program_id'] : 0;
			if ( $program_id <= 0 || isset( $programs[ $program_id ] ) ) {
				continue;
			}
			$data = radplapag_get_program_data( $program_id, true );
			if ( $data ) {
				$programs[ $program_id ] = array(
					'name'    => $data['name'],
					'logo_id' => $data['logo_id'],
				);
			}
		}
	}

	$day_data = radplapag_get_schedule_day_keys_and_labels();
	$result   = \RadioPlayerPage\Schedule\Now_Playing_Resolver::resolve(
		$schedule_raw,
		$programs,
		$day_data['day_labels'],
		\RadioPlayerPage\WP\Clock::now(),
		RADPLAPAG_NOW_PLAYING_UPCOMING_WINDOW_MINUTES
	);

	return array(
		'current'          => $result['current'],
		'upcoming'         => $result['upcoming'],
		'station_page_url' => $station_page_url,
	);
}
