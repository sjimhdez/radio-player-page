<?php
/**
 * Messages for schedule validation errors.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\WP;

defined( 'ABSPATH' ) || exit;

/**
 * Turns the error codes of RadioPlayerPage\Schedule\Slot_Validator into the
 * translated messages of radplapag_sanitize_station_schedule() in 3.4.2.
 *
 * @since 3.5.0
 */
final class Schedule_Messages {

	/**
	 * Joins the messages of several errors with a space, in order.
	 *
	 * @since 3.5.0
	 *
	 * @param list<array{code: string, day: string, program: string|null, other: string|null, next_day: string|null}> $errors Validator errors.
	 * @return string
	 */
	public static function join( array $errors ): string {
		return implode( ' ', array_map( array( self::class, 'message' ), $errors ) );
	}

	/**
	 * Returns the message of one error.
	 *
	 * @since 3.5.0
	 *
	 * @param array{code: string, day: string, program: string|null, other: string|null, next_day: string|null} $error Validator error.
	 * @return string
	 */
	public static function message( array $error ): string {
		$day = self::day_label( $error['day'] );

		switch ( $error['code'] ) {
			case 'required':
				return sprintf(
					/* translators: 1: Day name */
					__( 'Radio show on %1$s: All fields (radio show, start time, end time) are required.', 'radio-player-page' ),
					$day
				);
			case 'invalid_program':
				return sprintf(
					/* translators: 1: Day name */
					__( 'Radio show on %1$s: Please select a valid radio show.', 'radio-player-page' ),
					$day
				);
			case 'format':
				return sprintf(
					/* translators: 1: Program name, 2: Day name */
					__( 'Radio show "%1$s" on %2$s: Invalid time format. Times must be in HH:MM format.', 'radio-player-page' ),
					$error['program'],
					$day
				);
			case 'end_before_start':
				// The validator does not emit it (end <= start crosses midnight); the string stays translated.
				return sprintf(
					/* translators: 1: Program name, 2: Day name */
					__( 'Radio show "%1$s" on %2$s: End time must be after start time.', 'radio-player-page' ),
					$error['program'],
					$day
				);
			case 'overlap':
				return sprintf(
					/* translators: 1: Program name, 2: Day name, 3: Overlapping program name */
					__( 'Radio show "%1$s" on %2$s: Time slot overlaps with "%3$s".', 'radio-player-page' ),
					$error['program'],
					$day,
					$error['other']
				);
			case 'cross_midnight_overlap':
				return sprintf(
					/* translators: 1: Program name, 2: Day name, 3: Overlapping program name, 4: Next day name */
					__( 'Radio show "%1$s" on %2$s (crosses midnight) overlaps with "%3$s" on %4$s.', 'radio-player-page' ),
					$error['program'],
					$day,
					$error['other'],
					self::day_label( (string) $error['next_day'] )
				);
			default:
				return '';
		}
	}

	/**
	 * Returns the translated name of a day key.
	 *
	 * @since 3.5.0
	 *
	 * @param string $day Day key (monday ... sunday).
	 * @return string
	 */
	private static function day_label( string $day ): string {
		$labels = array(
			'monday'    => __( 'Monday', 'radio-player-page' ),
			'tuesday'   => __( 'Tuesday', 'radio-player-page' ),
			'wednesday' => __( 'Wednesday', 'radio-player-page' ),
			'thursday'  => __( 'Thursday', 'radio-player-page' ),
			'friday'    => __( 'Friday', 'radio-player-page' ),
			'saturday'  => __( 'Saturday', 'radio-player-page' ),
			'sunday'    => __( 'Sunday', 'radio-player-page' ),
		);

		return isset( $labels[ $day ] ) ? $labels[ $day ] : $day;
	}
}
