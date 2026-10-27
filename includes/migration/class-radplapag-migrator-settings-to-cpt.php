<?php
/**
 * One-time migration: radplapag_settings (single option) → radplapag_station / radplapag_program CPTs.
 *
 * Applies to any Radio Player Page release **before 3.3.0** that used this storage model
 * (e.g. 3.2.x, 3.1.x, 3.0.x with the same `stations` array shape—not tied to a specific prior semver).
 *
 * @package radio-player-page
 * @since 3.3.0
 */

defined( 'ABSPATH' ) || exit;

/**
 * Migrates serialized option data into radplapag_program and radplapag_station posts.
 *
 * @since 3.3.0
 */
class Radplapag_Migrator_Settings_To_Cpt {

	/**
	 * Runs migration when legacy settings exist and preconditions are met.
	 *
	 * @since 3.3.0
	 * @since 3.5.0 Delegates to RadioPlayerPage\Migration\Legacy_Plan and RadioPlayerPage\WP\Migration_Writer,
	 *              and returns the summary (stations and dropped slots) instead of true.
	 * @param int $author_user_id WordPress user ID for post_author on created posts.
	 * @return array{stations: int, dropped: list<array{station: string, day: string, start: string, end: string, program: string}>}|WP_Error Summary on success, WP_Error on failure.
	 */
	public static function run( int $author_user_id ) {
		$author_user_id = (int) $author_user_id;
		if ( $author_user_id <= 0 ) {
			return new WP_Error( 'radplapag_migration_author', __( 'Migration could not find a valid administrator user to assign created content.', 'radio-player-page' ) );
		}

		$plan = \RadioPlayerPage\Migration\Legacy_Plan::build(
			get_option( 'radplapag_settings', null ),
			array(
				'text'     => 'sanitize_text_field',
				'textarea' => 'sanitize_textarea_field',
				'url'      => 'esc_url_raw',
				'key'      => 'sanitize_key',
				'absint'   => 'absint',
			)
		);
		if ( null === $plan ) {
			return new WP_Error( 'radplapag_migration_no_data', __( 'No legacy station data was found to migrate.', 'radio-player-page' ) );
		}

		$log = static function ( string $message ): void {
			if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
				error_log( $message ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Debug output only behind WP_DEBUG.
			}
		};

		return \RadioPlayerPage\WP\Migration_Writer::write( $plan, $author_user_id, $log );
	}
}
