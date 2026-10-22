<?php
/**
 * Success notice of the legacy migration.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\WP;

defined( 'ABSPATH' ) || exit;

/**
 * Turns the value of the radplapag_migration_success_notice transient into the
 * escaped HTML of the success notice (ADR 0037).
 *
 * The value is the summary that Radplapag_Migrator_Settings_To_Cpt::run() returns:
 * the number of stations, then a list of the dropped slots. Any other truthy value
 * ('1' from an earlier version) prints the text of 3.4.2.
 *
 * @since 3.5.0
 */
final class Migration_Notice {

	/**
	 * Returns the HTML of the success notice.
	 *
	 * @since 3.5.0
	 *
	 * @param mixed $value Value of the transient (truthy).
	 * @return string
	 */
	public static function success( $value ): string {
		if ( ! is_array( $value ) || ! isset( $value['stations'], $value['dropped'] ) || ! is_array( $value['dropped'] ) ) {
			return self::wrap( '<p>' . esc_html__( 'Radio Player Page: Your radio stations and radio shows were migrated from the previous storage format to the new editor. The old settings entry was removed.', 'radio-player-page' ) . '</p>' );
		}

		$stations = (int) $value['stations'];
		$html     = '<p>' . esc_html(
			sprintf(
				/* translators: %s: Number of radio stations */
				_n(
					'Radio Player Page: %s radio station and its radio shows were migrated from the previous storage format to the new editor. The old settings entry was removed.',
					'Radio Player Page: %s radio stations and their radio shows were migrated from the previous storage format to the new editor. The old settings entry was removed.',
					$stations,
					'radio-player-page'
				),
				number_format_i18n( $stations )
			)
		) . '</p>';

		$dropped = array_values( array_filter( $value['dropped'], 'is_array' ) );
		if ( array() !== $dropped ) {
			$html .= '<p>' . esc_html(
				_n(
					'This schedule slot was dropped because it overlaps an earlier slot or is not valid. Add it again in its radio station if you need it:',
					'These schedule slots were dropped because they overlap an earlier slot or are not valid. Add them again in their radio station if you need them:',
					count( $dropped ),
					'radio-player-page'
				)
			) . '</p><ul>';
			foreach ( $dropped as $slot ) {
				$html .= '<li>' . esc_html( self::slot( $slot ) ) . '</li>';
			}
			$html .= '</ul>';
		}

		return self::wrap( $html );
	}

	/**
	 * Returns the line of one dropped slot.
	 *
	 * @since 3.5.0
	 *
	 * @param array<array-key, mixed> $slot Dropped slot: station, day, start, end and program.
	 * @return string
	 */
	private static function slot( array $slot ): string {
		$field = static function ( string $key ) use ( $slot ): string {
			return isset( $slot[ $key ] ) && is_scalar( $slot[ $key ] ) ? (string) $slot[ $key ] : '';
		};

		return sprintf(
			/* translators: 1: Radio station name, 2: Day name, 3: Start time, 4: End time, 5: Radio show name */
			__( '%1$s: %2$s %3$s–%4$s, "%5$s"', 'radio-player-page' ),
			$field( 'station' ),
			Schedule_Messages::day_label( $field( 'day' ) ),
			$field( 'start' ),
			$field( 'end' ),
			$field( 'program' )
		);
	}

	/**
	 * Wraps the paragraphs in the dismissible success notice.
	 *
	 * @since 3.5.0
	 *
	 * @param string $html Escaped HTML.
	 * @return string
	 */
	private static function wrap( string $html ): string {
		return '<div class="notice notice-success is-dismissible">' . $html . '</div>';
	}
}
