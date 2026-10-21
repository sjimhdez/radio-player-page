<?php
/**
 * Station meta writes of the station edit form.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\WP;

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
	 * Writes in the order of 3.4.2: the field errors transient (set, or deleted
	 * together with writing the URL and the player page), the five other metas, and
	 * the schedule through radplapag_sanitize_station_schedule().
	 *
	 * @since 3.5.0
	 *
	 * @param int                  $post_id Station post ID.
	 * @param array<string, mixed> $input   Unslashed form fields by key (stream_url, player_page, background_id, logo_id, intro_audio_id, theme_color, visualizer, schedule); a missing key reads as a form without that field.
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

		if ( array() !== $result['errors'] ) {
			set_transient( 'radplapag_station_field_errors_' . $post_id, implode( ' ', array_map( array( self::class, 'message' ), $result['errors'] ) ), 45 );
		} else {
			delete_transient( 'radplapag_station_field_errors_' . $post_id );
			update_post_meta( $post_id, 'radplapag_station_stream_url', $values['stream_url'] );
			update_post_meta( $post_id, 'radplapag_station_player_page', $values['player_page'] );
		}

		update_post_meta( $post_id, 'radplapag_station_background_id', $values['background_id'] );
		update_post_meta( $post_id, 'radplapag_station_logo_id', $values['logo_id'] );
		update_post_meta( $post_id, 'radplapag_station_intro_audio_id', $values['intro_audio_id'] );
		update_post_meta( $post_id, 'radplapag_station_theme_color', $values['theme_color'] );
		update_post_meta( $post_id, 'radplapag_station_visualizer', $values['visualizer'] );

		$schedule  = $input['schedule'] ?? array();
		$sanitized = radplapag_sanitize_station_schedule( is_array( $schedule ) ? $schedule : array() );
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
			default:
				return __( 'This Player Page is already assigned to another station. Please choose a different page.', 'radio-player-page' );
		}
	}
}
