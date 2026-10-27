<?php
/**
 * Programs List block helpers: list of programs with schedule slots for the WordPress block.
 *
 * Depends on radplapag-schedule-block.php for radplapag_get_schedule_day_keys_and_labels().
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
 * @since 3.5.0 Delegates to RadioPlayerPage\Schedule\Programs_List_View, with the time of RadioPlayerPage\WP\Clock.
 * @since 3.5.0 Leaves out the programs that are not public: not published, password-protected or missing (ADR 0045).
 * @param int $station_index Zero-based index into the ordered stations list (radplapag_get_stations()).
 * @return array|null List of programs, each with 'id', 'name', 'logo_id' (attachment ID or 0), 'description', 'extended_description', 'slots'. Null if station invalid or index out of range.
 */
function radplapag_get_programs_list_for_station( $station_index ) {
	$config = radplapag_get_config();
	if ( ! isset( $config['stations'] ) || ! is_array( $config['stations'] ) ) {
		return null;
	}
	$stations = $config['stations'];
	$idx      = (int) $station_index;
	if ( $idx < 0 || $idx >= count( $stations ) ) {
		return null;
	}
	$station = $stations[ $idx ];

	$schedule_raw    = isset( $station['schedule'] ) && is_array( $station['schedule'] ) ? $station['schedule'] : array();
	$public_programs = \RadioPlayerPage\WP\Program_Repository::public_programs( $schedule_raw );
	$schedule_raw    = \RadioPlayerPage\Schedule\Public_Slots::filter( $schedule_raw, array_keys( $public_programs ) );

	$programs = array();
	foreach ( \RadioPlayerPage\Schedule\Programs_List_View::program_ids_in_order( $schedule_raw ) as $post_id ) {
		$data = radplapag_get_program_data( $post_id, true );
		if ( $data ) {
			$programs[ $post_id ] = $data;
		}
	}

	$day_data = radplapag_get_schedule_day_keys_and_labels();
	return \RadioPlayerPage\Schedule\Programs_List_View::build(
		$schedule_raw,
		$programs,
		$day_data['day_labels'],
		\RadioPlayerPage\WP\Clock::now(),
		'sanitize_text_field'
	);
}
