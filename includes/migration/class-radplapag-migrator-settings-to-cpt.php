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
	 * @param int $author_user_id WordPress user ID for post_author on created posts.
	 * @return true|WP_Error True on success, WP_Error on failure.
	 */
	public static function run( int $author_user_id ) {
		$author_user_id = (int) $author_user_id;
		if ( $author_user_id <= 0 ) {
			return new WP_Error( 'radplapag_migration_author', __( 'Migration could not find a valid administrator user to assign created content.', 'radio-player-page' ) );
		}

		$raw = get_option( 'radplapag_settings', null );
		if ( ! is_array( $raw ) || ! isset( $raw['stations'] ) || ! is_array( $raw['stations'] ) || empty( $raw['stations'] ) ) {
			return new WP_Error( 'radplapag_migration_no_data', __( 'No legacy station data was found to migrate.', 'radio-player-page' ) );
		}

		$stations = $raw['stations'];
		$map      = self::build_program_id_map( $stations );

		$created_post_ids = [];
		$program_posts    = [];
		foreach ( $map['unique_programs'] as $old_id => $def ) {
			$post_id = self::insert_program_post( $def, $author_user_id );
			if ( is_wp_error( $post_id ) ) {
				self::rollback_created_posts( $created_post_ids );
				return $post_id;
			}
			$created_post_ids[] = $post_id;
			$program_posts[ $old_id ] = $post_id;
		}

		$menu_order = 0;
		foreach ( $stations as $station ) {
			if ( ! is_array( $station ) ) {
				continue;
			}
			$station_id = self::insert_station_post( $station, $menu_order, $program_posts, $author_user_id );
			if ( is_wp_error( $station_id ) ) {
				self::rollback_created_posts( $created_post_ids );
				return $station_id;
			}
			$created_post_ids[] = $station_id;
			$menu_order++;
		}

		delete_option( 'radplapag_settings' );
		update_option( 'radplapag_db_version', defined( 'RADPLAPAG_DB_VERSION' ) ? RADPLAPAG_DB_VERSION : '330' );

		return true;
	}

	/**
	 * Collects unique programs by legacy string id across all stations.
	 *
	 * @since 3.3.0
	 * @param array $stations Legacy stations list.
	 * @return array Map with key 'unique_programs' => old_id => program row.
	 */
	private static function build_program_id_map( array $stations ): array {
		$unique = [];
		foreach ( $stations as $station ) {
			if ( ! is_array( $station ) || ! isset( $station['programs'] ) || ! is_array( $station['programs'] ) ) {
				continue;
			}
			foreach ( $station['programs'] as $prog ) {
				if ( ! is_array( $prog ) ) {
					continue;
				}
				$old_id = (string) ( $prog['id'] ?? '' );
				if ( $old_id === '' ) {
					continue;
				}
				$fingerprint = self::program_fingerprint( $prog );
				if ( isset( $unique[ $old_id ] ) && $unique[ $old_id ]['_fp'] !== $fingerprint && defined( 'WP_DEBUG' ) && WP_DEBUG ) {
					// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
					error_log( 'Radio Player Page migration: duplicate legacy program id "' . $old_id . '" with differing data; using the last occurrence.' );
				}
				$prog['_fp']       = $fingerprint;
				$unique[ $old_id ] = $prog;
			}
		}
		return [ 'unique_programs' => $unique ];
	}

	/**
	 * @since 3.3.0
	 * @param array $prog Legacy program row.
	 * @return string
	 */
	private static function program_fingerprint( array $prog ): string {
		$name = (string) ( $prog['name'] ?? '' );
		$desc = (string) ( $prog['description'] ?? '' );
		$ext  = (string) ( $prog['extended_description'] ?? '' );
		$logo = (string) ( $prog['logo_id'] ?? '0' );
		return md5( $name . '|' . $desc . '|' . $ext . '|' . $logo );
	}

	/**
	 * @since 3.3.0
	 * @param array $prog    Legacy program row.
	 * @param int   $author_user_id Post author.
	 * @return int|WP_Error New post ID or error.
	 */
	private static function insert_program_post( array $prog, int $author_user_id ) {
		$name = sanitize_text_field( (string) ( $prog['name'] ?? '' ) );
		if ( $name === '' ) {
			$name = __( 'Program', 'radio-player-page' );
		}
		$description          = sanitize_text_field( (string) ( $prog['description'] ?? '' ) );
		$extended_description = sanitize_textarea_field( (string) ( $prog['extended_description'] ?? '' ) );
		$logo_id              = absint( $prog['logo_id'] ?? 0 );

		$post_id = wp_insert_post(
			[
				'post_type'    => 'radplapag_program',
				'post_status'  => 'publish',
				'post_title'   => $name,
				'post_author'  => $author_user_id,
				'post_content' => '',
			],
			true
		);
		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}
		update_post_meta( $post_id, 'radplapag_program_description', $description );
		update_post_meta( $post_id, 'radplapag_program_extended_description', $extended_description );
		update_post_meta( $post_id, 'radplapag_program_logo_id', $logo_id );
		return (int) $post_id;
	}

	/**
	 * @since 3.3.0
	 * @param array $station        Legacy station row.
	 * @param int   $menu_order     Menu order index.
	 * @param array $program_posts  Map legacy program id string => new post ID.
	 * @param int   $author_user_id Post author.
	 * @return int|WP_Error
	 */
	private static function insert_station_post( array $station, int $menu_order, array $program_posts, int $author_user_id ) {
		$title = sanitize_text_field( (string) ( $station['station_title'] ?? '' ) );
		if ( $title === '' ) {
			$title = __( 'Radio Station', 'radio-player-page' );
		}
		$stream_url    = esc_url_raw( trim( (string) ( $station['stream_url'] ?? '' ) ) );
		$player_page   = absint( $station['player_page'] ?? 0 );
		$background_id = absint( $station['background_id'] ?? 0 );
		$logo_id       = absint( $station['logo_id'] ?? 0 );
		$theme         = sanitize_key( (string) ( $station['theme_color'] ?? 'neutral' ) );
		$visualizer    = sanitize_key( (string) ( $station['visualizer'] ?? 'oscilloscope' ) );

		$valid_themes      = [ 'neutral', 'blue', 'green', 'red', 'orange', 'yellow', 'purple', 'pink' ];
		$valid_visualizers = [ 'oscilloscope', 'bars', 'particles', 'waterfall' ];
		if ( ! in_array( $theme, $valid_themes, true ) ) {
			$theme = 'neutral';
		}
		if ( ! in_array( $visualizer, $valid_visualizers, true ) ) {
			$visualizer = 'oscilloscope';
		}

		$schedule_input = [];
		if ( isset( $station['schedule'] ) && is_array( $station['schedule'] ) ) {
			$schedule_input = self::translate_schedule_for_cpt( $station['schedule'], $program_posts );
		}

		$schedule_sanitized = radplapag_sanitize_station_schedule( $schedule_input );
		if ( is_wp_error( $schedule_sanitized ) ) {
			return new WP_Error(
				'radplapag_migration_schedule',
				sprintf(
					/* translators: %s: validation error message */
					__( 'Schedule migration failed: %s', 'radio-player-page' ),
					$schedule_sanitized->get_error_message()
				)
			);
		}
		$schedule_json = wp_json_encode( $schedule_sanitized );

		$post_id = wp_insert_post(
			[
				'post_type'    => 'radplapag_station',
				'post_status'  => 'publish',
				'post_title'   => $title,
				'post_author'  => $author_user_id,
				'menu_order'   => (int) $menu_order,
				'post_content' => '',
			],
			true
		);
		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}

		update_post_meta( $post_id, 'radplapag_station_stream_url', $stream_url );
		update_post_meta( $post_id, 'radplapag_station_player_page', $player_page );
		update_post_meta( $post_id, 'radplapag_station_background_id', $background_id );
		update_post_meta( $post_id, 'radplapag_station_logo_id', $logo_id );
		update_post_meta( $post_id, 'radplapag_station_theme_color', $theme );
		update_post_meta( $post_id, 'radplapag_station_visualizer', $visualizer );
		update_post_meta( $post_id, 'radplapag_station_schedule', $schedule_json );

		return (int) $post_id;
	}

	/**
	 * Converts legacy schedule program_id strings to integers for sanitization.
	 *
	 * @since 3.3.0
	 * @param array $legacy_schedule Day => list of slots.
	 * @param array $program_posts   Legacy id => new program post ID.
	 * @return array
	 */
	private static function translate_schedule_for_cpt( array $legacy_schedule, array $program_posts ): array {
		$out = [];
		foreach ( $legacy_schedule as $day => $slots ) {
			if ( ! is_array( $slots ) ) {
				continue;
			}
			$day_rows = [];
			foreach ( $slots as $slot ) {
				if ( ! is_array( $slot ) ) {
					continue;
				}
				$legacy_pid = (string) ( $slot['program_id'] ?? '' );
				$start      = trim( (string) ( $slot['start'] ?? '' ) );
				$end        = trim( (string) ( $slot['end'] ?? '' ) );
				if ( $legacy_pid === '' || $start === '' || $end === '' ) {
					continue;
				}
				if ( ! isset( $program_posts[ $legacy_pid ] ) ) {
					if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
						// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
						error_log( 'Radio Player Page migration: skipping schedule slot with unknown program id "' . $legacy_pid . '".' );
					}
					continue;
				}
				$day_rows[] = [
					'program_id' => (int) $program_posts[ $legacy_pid ],
					'start'      => $start,
					'end'        => $end,
				];
			}
			if ( ! empty( $day_rows ) ) {
				$out[ $day ] = $day_rows;
			}
		}
		return $out;
	}

	/**
	 * Deletes posts created during a failed migration attempt (newest first).
	 *
	 * @since 3.3.0
	 * @param array $post_ids Post IDs to remove.
	 * @return void
	 */
	private static function rollback_created_posts( array $post_ids ): void {
		if ( ! is_array( $post_ids ) || empty( $post_ids ) ) {
			return;
		}
		foreach ( array_reverse( $post_ids ) as $post_id ) {
			$post_id = (int) $post_id;
			if ( $post_id > 0 ) {
				wp_delete_post( $post_id, true );
			}
		}
	}
}
