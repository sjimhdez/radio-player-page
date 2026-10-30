<?php
/**
 * Station row built from raw post meta.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\Data;

defined( 'ABSPATH' ) || exit;

/**
 * The station row of radplapag_get_stations() and the theme and visualizer whitelists.
 *
 * @since 3.5.0
 */
final class Station {

	/**
	 * Allowed theme colors; the first one is the default.
	 */
	const THEMES = array( 'neutral', 'blue', 'green', 'red', 'orange', 'yellow', 'purple', 'pink' );

	/**
	 * Allowed visualizers; the first one is the default.
	 */
	const VISUALIZERS = array( 'oscilloscope', 'bars', 'particles', 'waterfall' );

	/**
	 * Builds the row of Radplapag_Station_Config::to_array() from raw meta.
	 *
	 * A missing key reads as '', like get_post_meta( ..., true ). The schedule
	 * is decoded only from a non-empty string that gives an array, and is
	 * returned as decoded; theme and visualizer off the whitelist fall back
	 * to the default; the stream URL is kept only if it is a string; hide_title
	 * and show_song are the meta cast with (bool) (ADR 0054, 0068).
	 *
	 * @since 3.5.0
	 * @since 3.6.0 Adds show_song (ADR 0068).
	 *
	 * @param int                  $id    Station post ID.
	 * @param string               $title Station post title.
	 * @param array<string, mixed> $meta  Single meta values by meta key (radplapag_station_*).
	 * @return array{id: int, stream_url: string, player_page: int, station_title: string, hide_title: bool, show_song: bool, background_id: int, logo_id: int, intro_audio_id: int, theme_color: string, visualizer: string, schedule: array<mixed>}
	 */
	public static function row( int $id, string $title, array $meta ): array {
		$schedule_json = $meta['radplapag_station_schedule'] ?? '';
		$schedule      = array();
		if ( is_string( $schedule_json ) && '' !== $schedule_json ) {
			$decoded = json_decode( $schedule_json, true );
			if ( is_array( $decoded ) ) {
				$schedule = $decoded;
			}
		}

		$stream_url = $meta['radplapag_station_stream_url'] ?? '';

		return array(
			'id'             => $id,
			'stream_url'     => is_string( $stream_url ) ? $stream_url : '',
			'player_page'    => self::to_int( $meta, 'radplapag_station_player_page' ),
			'station_title'  => $title,
			'hide_title'     => (bool) ( $meta['radplapag_station_hide_title'] ?? false ),
			'show_song'      => (bool) ( $meta['radplapag_station_show_song'] ?? false ),
			'background_id'  => self::to_int( $meta, 'radplapag_station_background_id' ),
			'logo_id'        => self::to_int( $meta, 'radplapag_station_logo_id' ),
			'intro_audio_id' => self::to_int( $meta, 'radplapag_station_intro_audio_id' ),
			'theme_color'    => self::allowed( $meta['radplapag_station_theme_color'] ?? '', self::THEMES ),
			'visualizer'     => self::allowed( $meta['radplapag_station_visualizer'] ?? '', self::VISUALIZERS ),
			'schedule'       => $schedule,
		);
	}

	/**
	 * Returns the value if it is a whitelisted string, or the first allowed value.
	 *
	 * @since 3.5.0
	 *
	 * @param mixed         $value   Raw value.
	 * @param array<string> $allowed Whitelist; its first item is the default.
	 * @return string
	 */
	private static function allowed( $value, array $allowed ): string {
		return is_string( $value ) && in_array( $value, $allowed, true ) ? $value : $allowed[0];
	}

	/**
	 * Casts a meta value with (int), as 3.4.2 does; a missing key is 0.
	 *
	 * @since 3.5.0
	 *
	 * @param array<string, mixed> $meta Single meta values by meta key.
	 * @param string               $key  Meta key.
	 * @return int
	 */
	private static function to_int( array $meta, string $key ): int {
		return (int) ( $meta[ $key ] ?? '' );
	}
}
