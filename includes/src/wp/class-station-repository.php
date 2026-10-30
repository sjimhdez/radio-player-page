<?php
/**
 * Station reads from the radplapag_station CPT.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\WP;

use RadioPlayerPage\Data\Station;
use RadioPlayerPage\Data\Stations;
use WP_Post;

defined( 'ABSPATH' ) || exit;

/**
 * Reads station posts and meta, and hands them to RadioPlayerPage\Data.
 *
 * @since 3.5.0
 */
final class Station_Repository {

	/**
	 * Meta keys read for a station row, in the order 3.4.2 reads them, then the ones added since.
	 */
	const META_KEYS = array(
		'radplapag_station_schedule',
		'radplapag_station_theme_color',
		'radplapag_station_visualizer',
		'radplapag_station_stream_url',
		'radplapag_station_player_page',
		'radplapag_station_background_id',
		'radplapag_station_logo_id',
		'radplapag_station_intro_audio_id',
		'radplapag_station_hide_title',
		'radplapag_station_show_song',
	);

	/**
	 * Returns the station row of a station post.
	 *
	 * @since 3.5.0
	 *
	 * @param WP_Post $post Station post (radplapag_station).
	 * @return array{id: int, stream_url: string, player_page: int, station_title: string, hide_title: bool, show_song: bool, background_id: int, logo_id: int, intro_audio_id: int, theme_color: string, visualizer: string, schedule: array<mixed>}
	 */
	public static function row( WP_Post $post ): array {
		$post_id = (int) $post->ID;
		$meta    = array();
		foreach ( self::META_KEYS as $key ) {
			$meta[ $key ] = get_post_meta( $post_id, $key, true );
		}

		return Station::row( $post_id, $post->post_title, $meta );
	}

	/**
	 * Returns the rows of the published stations, by menu order and then title.
	 *
	 * @since 3.5.0
	 *
	 * @return array<int, array{id: int, stream_url: string, player_page: int, station_title: string, hide_title: bool, show_song: bool, background_id: int, logo_id: int, intro_audio_id: int, theme_color: string, visualizer: string, schedule: array<mixed>}>
	 */
	public static function published_rows(): array {
		$posts = get_posts(
			array(
				'post_type'      => 'radplapag_station',
				'post_status'    => 'publish',
				'posts_per_page' => -1,
				'orderby'        => 'menu_order title',
				'order'          => 'ASC',
			)
		);
		$rows  = array();
		foreach ( $posts as $post ) {
			if ( 'radplapag_station' === $post->post_type ) {
				$rows[] = self::row( $post );
			}
		}
		return $rows;
	}

	/**
	 * Returns the player pages of the stations in any status, except the given one.
	 *
	 * @since 3.5.0
	 *
	 * @param int $exclude Station post ID to leave out; 0 or less excludes nothing.
	 * @return int[]
	 */
	public static function player_pages_except( int $exclude ): array {
		$station_ids     = get_posts(
			array(
				'post_type'      => 'radplapag_station',
				'post_status'    => 'any',
				'posts_per_page' => -1,
				'fields'         => 'ids',
			)
		);
		$page_by_station = array();
		foreach ( $station_ids as $station_id ) {
			$page_by_station[ (int) $station_id ] = get_post_meta( (int) $station_id, 'radplapag_station_player_page', true );
		}
		return Stations::player_pages( $page_by_station, $exclude );
	}
}
