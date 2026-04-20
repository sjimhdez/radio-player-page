<?php
/**
 * One-time migration from radplapag_settings (3.2) to station/program CPTs (3.3).
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
class Radplapag_Migrator_320_To_330 {

	/**
	 * Runs migration when legacy settings exist and preconditions are met.
	 *
	 * @since 3.3.0
	 * @param int $author_user_id WordPress user ID for post_author on created posts.
	 * @return true|WP_Error True on success, WP_Error on failure.
	 */
	public static function run( $author_user_id ) {
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

		$created_post_ids = array();
		$program_posts    = array();
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
	private static function build_program_id_map( $stations ) {
		$unique = array();
		foreach ( $stations as $station ) {
			if ( ! is_array( $station ) || ! isset( $station['programs'] ) || ! is_array( $station['programs'] ) ) {
				continue;
			}
			foreach ( $station['programs'] as $prog ) {
				if ( ! is_array( $prog ) ) {
					continue;
				}
				$old_id = isset( $prog['id'] ) ? (string) $prog['id'] : '';
				if ( $old_id === '' ) {
					continue;
				}
				$fingerprint = self::program_fingerprint( $prog );
				if ( isset( $unique[ $old_id ] ) && $unique[ $old_id ]['_fp'] !== $fingerprint && defined( 'WP_DEBUG' ) && WP_DEBUG ) {
					// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
					error_log( 'Radio Player Page migration: duplicate legacy program id "' . $old_id . '" with differing data; using the last occurrence.' );
				}
				$prog['_fp']         = $fingerprint;
				$unique[ $old_id ] = $prog;
			}
		}
		return array( 'unique_programs' => $unique );
	}

	/**
	 * @since 3.3.0
	 * @param array $prog Legacy program row.
	 * @return string
	 */
	private static function program_fingerprint( $prog ) {
		$name = isset( $prog['name'] ) ? (string) $prog['name'] : '';
		$desc = isset( $prog['description'] ) ? (string) $prog['description'] : '';
		$ext  = isset( $prog['extended_description'] ) ? (string) $prog['extended_description'] : '';
		$logo = isset( $prog['logo_id'] ) ? (string) $prog['logo_id'] : '0';
		return md5( $name . '|' . $desc . '|' . $ext . '|' . $logo );
	}

	/**
	 * @since 3.3.0
	 * @param array $prog    Legacy program row.
	 * @param int   $author_user_id Post author.
	 * @return int|WP_Error New post ID or error.
	 */
	private static function insert_program_post( $prog, $author_user_id ) {
		$name = isset( $prog['name'] ) ? sanitize_text_field( $prog['name'] ) : '';
		if ( $name === '' ) {
			$name = __( 'Program', 'radio-player-page' );
		}
		$description          = isset( $prog['description'] ) ? sanitize_text_field( $prog['description'] ) : '';
		$extended_description = isset( $prog['extended_description'] ) ? sanitize_textarea_field( $prog['extended_description'] ) : '';
		$logo_id              = isset( $prog['logo_id'] ) ? absint( $prog['logo_id'] ) : 0;

		$post_id = wp_insert_post(
			array(
				'post_type'    => 'radplapag_program',
				'post_status'  => 'publish',
				'post_title'   => $name,
				'post_author'  => $author_user_id,
				'post_content' => '',
			),
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
	private static function insert_station_post( $station, $menu_order, $program_posts, $author_user_id ) {
		$title = isset( $station['station_title'] ) ? sanitize_text_field( $station['station_title'] ) : '';
		if ( $title === '' ) {
			$title = __( 'Station', 'radio-player-page' );
		}
		$stream_url    = isset( $station['stream_url'] ) ? esc_url_raw( trim( $station['stream_url'] ) ) : '';
		$player_page   = isset( $station['player_page'] ) ? absint( $station['player_page'] ) : 0;
		$background_id = isset( $station['background_id'] ) ? absint( $station['background_id'] ) : 0;
		$logo_id       = isset( $station['logo_id'] ) ? absint( $station['logo_id'] ) : 0;
		$theme         = isset( $station['theme_color'] ) ? sanitize_key( $station['theme_color'] ) : 'neutral';
		$visualizer    = isset( $station['visualizer'] ) ? sanitize_key( $station['visualizer'] ) : 'oscilloscope';

		$valid_themes      = array( 'neutral', 'blue', 'green', 'red', 'orange', 'yellow', 'purple', 'pink' );
		$valid_visualizers = array( 'oscilloscope', 'bars', 'particles', 'waterfall' );
		if ( ! in_array( $theme, $valid_themes, true ) ) {
			$theme = 'neutral';
		}
		if ( ! in_array( $visualizer, $valid_visualizers, true ) ) {
			$visualizer = 'oscilloscope';
		}

		$schedule_input = array();
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
			array(
				'post_type'    => 'radplapag_station',
				'post_status'  => 'publish',
				'post_title'   => $title,
				'post_author'  => $author_user_id,
				'menu_order'   => (int) $menu_order,
				'post_content' => '',
			),
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
	private static function translate_schedule_for_cpt( $legacy_schedule, $program_posts ) {
		$out = array();
		foreach ( $legacy_schedule as $day => $slots ) {
			if ( ! is_array( $slots ) ) {
				continue;
			}
			$day_rows = array();
			foreach ( $slots as $slot ) {
				if ( ! is_array( $slot ) ) {
					continue;
				}
				$legacy_pid = isset( $slot['program_id'] ) ? (string) $slot['program_id'] : '';
				$start       = isset( $slot['start'] ) ? trim( (string) $slot['start'] ) : '';
				$end         = isset( $slot['end'] ) ? trim( (string) $slot['end'] ) : '';
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
				$day_rows[] = array(
					'program_id' => (int) $program_posts[ $legacy_pid ],
					'start'      => $start,
					'end'        => $end,
				);
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
	private static function rollback_created_posts( $post_ids ) {
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
