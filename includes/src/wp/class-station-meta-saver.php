<?php
/**
 * Station meta writes of the station edit form.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\WP;

use RadioPlayerPage\Schedule\Schedule_View;
use RadioPlayerPage\Station\Field_Sanitizer;

defined( 'ABSPATH' ) || exit;

/**
 * Sanitizes, validates and writes the station fields of radplapag_save_station_meta(),
 * once its guards have passed and the form has been read.
 *
 * @since 3.5.0
 */
final class Station_Meta_Saver {

	/**
	 * Saves the station fields and the schedule.
	 *
	 * Writes in the order of 3.4.2: the field errors transient (set, or deleted),
	 * the URL and the player page each one if it is valid (ADR 0048), the five
	 * other metas (a rejected attachment keeps the stored one, K37), the hide title
	 * and show song metas ('1' when checked; deleted when not, ADR 0054 and 0068),
	 * and the schedule through Schedule_Sanitizer, with the program IDs of the saved
	 * schedule so a slot of a deleted program is kept (K106, ADR 0062).
	 *
	 * @since 3.5.0
	 * @since 3.6.0 Sanitizes the schedule with Schedule_Sanitizer and the saved program IDs.
	 * @since 3.6.0 Saves the show song meta (ADR 0068).
	 *
	 * @param int                  $post_id Station post ID.
	 * @param array<string, mixed> $input   Unslashed form fields by key (stream_url, player_page, background_id, logo_id, intro_audio_id, theme_color, visualizer, hide_title, show_song, schedule); a missing key reads as a form without that field.
	 * @return void
	 */
	public static function save( int $post_id, array $input ): void {
		$stream_url = $input['stream_url'] ?? '';
		$fields     = array(
			'stream_url'     => is_string( $stream_url ) ? esc_url_raw( trim( $stream_url ) ) : '',
			'player_page'    => absint( $input['player_page'] ?? 0 ),
			'background_id'  => absint( $input['background_id'] ?? 0 ),
			'logo_id'        => absint( $input['logo_id'] ?? 0 ),
			'intro_audio_id' => absint( $input['intro_audio_id'] ?? 0 ),
			'theme_color'    => sanitize_key( $input['theme_color'] ?? '' ),
			'visualizer'     => sanitize_key( $input['visualizer'] ?? '' ),
		);

		$result = Field_Sanitizer::sanitize(
			$fields,
			'wp_attachment_is_image',
			'get_post_mime_type',
			$fields['player_page'] > 0 ? Station_Repository::player_pages_except( $post_id ) : array()
		);
		$values = $result['values'];

		$errors = $result['errors'];
		if ( array() !== $errors ) {
			set_transient( 'radplapag_station_field_errors_' . $post_id, implode( ' ', array_map( array( self::class, 'message' ), $errors ) ), 45 );
		} else {
			delete_transient( 'radplapag_station_field_errors_' . $post_id );
		}
		if ( ! in_array( 'stream_url_required', $errors, true ) ) {
			update_post_meta( $post_id, 'radplapag_station_stream_url', $values['stream_url'] );
		}
		if ( array() === array_intersect( array( 'player_page_required', 'player_page_taken' ), $errors ) ) {
			update_post_meta( $post_id, 'radplapag_station_player_page', $values['player_page'] );
		}

		foreach ( array( 'background_id', 'logo_id', 'intro_audio_id' ) as $key ) {
			if ( null !== $values[ $key ] ) {
				update_post_meta( $post_id, 'radplapag_station_' . $key, $values[ $key ] );
			}
		}
		update_post_meta( $post_id, 'radplapag_station_theme_color', $values['theme_color'] );
		update_post_meta( $post_id, 'radplapag_station_visualizer', $values['visualizer'] );
		if ( ! empty( $input['hide_title'] ) ) {
			update_post_meta( $post_id, 'radplapag_station_hide_title', '1' );
		} else {
			delete_post_meta( $post_id, 'radplapag_station_hide_title' );
		}
		if ( ! empty( $input['show_song'] ) ) {
			update_post_meta( $post_id, 'radplapag_station_show_song', '1' );
		} else {
			delete_post_meta( $post_id, 'radplapag_station_show_song' );
		}

		// The slot of a program deleted for good is kept if the station had it (K106, ADR 0062).
		$saved_json = get_post_meta( $post_id, 'radplapag_station_schedule', true );
		$saved      = is_string( $saved_json ) ? json_decode( $saved_json, true ) : null;
		$kept_ids   = is_array( $saved ) ? Schedule_View::program_ids( $saved ) : array();
		$schedule   = $input['schedule'] ?? array();
		$sanitized  = Schedule_Sanitizer::sanitize( is_array( $schedule ) ? $schedule : array(), $kept_ids );
		if ( is_wp_error( $sanitized ) ) {
			set_transient( 'radplapag_station_schedule_errors_' . $post_id, $sanitized->get_error_message(), 45 );
		} else {
			delete_transient( 'radplapag_station_schedule_errors_' . $post_id );
			update_post_meta( $post_id, 'radplapag_station_schedule', wp_json_encode( $sanitized ) );
		}
	}

	/**
	 * Returns the message of a field error code of Field_Sanitizer.
	 *
	 * @since 3.5.0
	 *
	 * @param string $code Error code.
	 * @return string
	 */
	private static function message( string $code ): string {
		switch ( $code ) {
			case 'stream_url_required':
				return __( 'Streaming URL is required.', 'radio-player-page' );
			case 'player_page_required':
				return __( 'Player Page is required. Please select a page.', 'radio-player-page' );
			case 'background_not_image':
				return __( 'Background Image must be an image; the previous one was kept.', 'radio-player-page' );
			case 'logo_not_image':
				return __( 'Logo Image must be an image; the previous one was kept.', 'radio-player-page' );
			case 'intro_not_mp3':
				return __( 'Welcome Audio must be an MP3 file; the previous one was kept.', 'radio-player-page' );
			default:
				return __( 'This Player Page is already assigned to another station. Please choose a different page.', 'radio-player-page' );
		}
	}
}
