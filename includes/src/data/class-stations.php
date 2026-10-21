<?php
/**
 * Lookups over the station list.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\Data;

defined( 'ABSPATH' ) || exit;

/**
 * The station of a player page and the player pages already assigned.
 *
 * @since 3.5.0
 */
final class Stations {

	/**
	 * Returns the first station whose player page is the page and that has a stream URL.
	 *
	 * The player page is compared with intval() and the stream URL with
	 * empty(), as 3.4.2 does: with page 0, a station without page matches (K24).
	 *
	 * @since 3.5.0
	 *
	 * @param array<mixed> $stations Station rows, in list order.
	 * @param int          $page_id  Page ID.
	 * @return array<mixed>|false The station row as given, or false.
	 */
	public static function for_page( array $stations, int $page_id ) {
		foreach ( $stations as $station ) {
			if (
				is_array( $station ) &&
				isset( $station['player_page'] ) &&
				isset( $station['stream_url'] ) &&
				intval( $station['player_page'] ) === $page_id &&
				! empty( $station['stream_url'] )
			) {
				return $station;
			}
		}

		return false;
	}

	/**
	 * Returns the unique player pages, without empty ones or the excluded station's.
	 *
	 * Pages are cast with (int) and kept in first-seen order; an exclude of 0
	 * or less excludes nothing.
	 *
	 * @since 3.5.0
	 *
	 * @param array<int, mixed> $page_by_station Raw player page meta by station ID.
	 * @param int               $exclude         Station ID to leave out.
	 * @return int[]
	 */
	public static function player_pages( array $page_by_station, int $exclude ): array {
		$page_ids = array();
		foreach ( $page_by_station as $station_id => $page ) {
			if ( $exclude > 0 && (int) $station_id === $exclude ) {
				continue;
			}
			$page_id = (int) $page;
			if ( $page_id > 0 ) {
				$page_ids[] = $page_id;
			}
		}

		return array_values( array_unique( $page_ids ) );
	}
}
