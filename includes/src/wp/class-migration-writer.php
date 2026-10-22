<?php
/**
 * Writes of the legacy radplapag_settings → CPT migration.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\WP;

use RadioPlayerPage\Migration\Slot_Filter;
use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * Writes the plan of Migration\Legacy_Plan for Radplapag_Migrator_Settings_To_Cpt::run().
 *
 * @since 3.5.0
 */
final class Migration_Writer {

	/**
	 * Meta key on the posts a migration creates until it completes (ADR 0037).
	 */
	const PENDING_META = '_radplapag_migration_pending';

	/**
	 * Creates the programs and the stations of the plan, then retires the legacy option.
	 *
	 * Writes in the order of 3.4.2: the duplicate IDs are logged, every program is
	 * created with its meta, and each station logs its skipped slots, drops and logs
	 * the slots that do not validate (Migration\Slot_Filter, ADR 0037), validates the
	 * rest with radplapag_sanitize_station_schedule() as a safety net and is created
	 * with its meta. Every created post carries the pending meta. If anything fails,
	 * the created posts are deleted (newest first) and no option is touched. Otherwise
	 * the pending meta is removed, radplapag_settings is deleted and
	 * radplapag_db_version saved.
	 *
	 * @since 3.5.0
	 *
	 * @param array{programs: list<array{id: string, name: string, description: string, extended_description: string, logo_id: int}>, duplicates: list<string>, stations: list<array{title: string, stream_url: string, player_page: int, background_id: int, logo_id: int, theme_color: string, visualizer: string, menu_order: int, schedule: array<array-key, list<array{program_id: string, start: string, end: string}>>, skipped: list<string>}>} $plan Plan of Legacy_Plan::build().
	 * @param int                                                                                                                                                                                                                                                                                                                                                                                                                                       $author Post author of the created posts.
	 * @param callable(string): void                                                                                                                                                                                                                                                                                                                                                                                                                    $log    Receives each debug message.
	 * @return array{stations: int, dropped: list<array{station: string, day: string, start: string, end: string, program: string}>}|WP_Error Summary on success, WP_Error on failure.
	 */
	public static function write( array $plan, int $author, callable $log ) {
		foreach ( $plan['duplicates'] as $old_id ) {
			$log( 'Radio Player Page migration: duplicate legacy program id "' . $old_id . '" with differing data; using the last occurrence.' );
		}

		$created       = array();
		$program_posts = array();
		$program_names = array();
		foreach ( $plan['programs'] as $program ) {
			$post_id = self::insert_program( $program, $author );
			if ( is_wp_error( $post_id ) ) {
				self::rollback( $created );
				return $post_id;
			}
			$created[]                       = $post_id;
			$program_posts[ $program['id'] ] = $post_id;
			$program_names[ $post_id ]       = self::program_title( $program );
		}

		$dropped = array();
		foreach ( $plan['stations'] as $station ) {
			$post_id = self::insert_station( $station, $program_posts, $program_names, $author, $log, $dropped );
			if ( is_wp_error( $post_id ) ) {
				self::rollback( $created );
				return $post_id;
			}
			$created[] = $post_id;
		}

		delete_post_meta_by_key( self::PENDING_META );
		delete_option( 'radplapag_settings' );
		update_option( 'radplapag_db_version', defined( 'RADPLAPAG_DB_VERSION' ) ? RADPLAPAG_DB_VERSION : '330' );

		return array(
			'stations' => count( $plan['stations'] ),
			'dropped'  => $dropped,
		);
	}

	/**
	 * Deletes for good the posts left pending by a migration that was cut, in any status.
	 *
	 * @since 3.5.0
	 *
	 * @return void
	 */
	public static function purge_pending(): void {
		$post_ids = get_posts(
			array(
				'post_type'   => array( 'radplapag_station', 'radplapag_program' ),
				'post_status' => array_keys( get_post_stati() ),
				'numberposts' => -1,
				'fields'      => 'ids',
				'meta_key'    => self::PENDING_META, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- Only runs while a legacy migration is pending.
			)
		);
		foreach ( $post_ids as $post_id ) {
			wp_delete_post( (int) $post_id, true );
		}
	}

	/**
	 * Creates the radplapag_program post of a planned program.
	 *
	 * @since 3.5.0
	 *
	 * @param array{id: string, name: string, description: string, extended_description: string, logo_id: int} $program Planned program.
	 * @param int                                                                                              $author  Post author.
	 * @return int|WP_Error New post ID or error.
	 */
	private static function insert_program( array $program, int $author ) {
		$post_id = wp_insert_post(
			wp_slash(
				array(
					'post_type'    => 'radplapag_program',
					'post_status'  => 'publish',
					'post_title'   => self::program_title( $program ),
					'post_author'  => $author,
					'post_content' => '',
					'meta_input'   => array( self::PENDING_META => '1' ),
				)
			),
			true
		);
		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}
		update_post_meta( $post_id, 'radplapag_program_description', wp_slash( $program['description'] ) );
		update_post_meta( $post_id, 'radplapag_program_extended_description', wp_slash( $program['extended_description'] ) );
		update_post_meta( $post_id, 'radplapag_program_logo_id', $program['logo_id'] );
		return $post_id;
	}

	/**
	 * Title of a planned program: its name or the translated default.
	 *
	 * @since 3.5.0
	 *
	 * @param array{id: string, name: string, description: string, extended_description: string, logo_id: int} $program Planned program.
	 * @return string
	 */
	private static function program_title( array $program ): string {
		return '' !== $program['name'] ? $program['name'] : __( 'Program', 'radio-player-page' );
	}

	/**
	 * Logs the skipped slots, drops the invalid ones, validates the schedule and creates the radplapag_station post.
	 *
	 * @since 3.5.0
	 *
	 * @param array{title: string, stream_url: string, player_page: int, background_id: int, logo_id: int, theme_color: string, visualizer: string, menu_order: int, schedule: array<array-key, list<array{program_id: string, start: string, end: string}>>, skipped: list<string>} $station       Planned station.
	 * @param array<array-key, int>                                                                                                                                                                                                                                                  $program_posts Legacy program ID => new program post ID.
	 * @param array<int, string>                                                                                                                                                                                                                                                     $program_names New program post ID => title.
	 * @param int                                                                                                                                                                                                                                                                    $author        Post author.
	 * @param callable(string): void                                                                                                                                                                                                                                                 $log           Receives each debug message.
	 * @param list<array{station: string, day: string, start: string, end: string, program: string}>                                                                                                                                                                                 $dropped       Receives the dropped slots.
	 * @return int|WP_Error New post ID or error.
	 */
	private static function insert_station( array $station, array $program_posts, array $program_names, int $author, callable $log, array &$dropped ) {
		foreach ( $station['skipped'] as $legacy_pid ) {
			$log( 'Radio Player Page migration: skipping schedule slot with unknown program id "' . $legacy_pid . '".' );
		}

		$schedule = array();
		foreach ( $station['schedule'] as $day => $slots ) {
			foreach ( $slots as $slot ) {
				$schedule[ $day ][] = array(
					'program_id' => $program_posts[ $slot['program_id'] ],
					'start'      => $slot['start'],
					'end'        => $slot['end'],
				);
			}
		}

		$title    = '' !== $station['title'] ? $station['title'] : __( 'Radio Station', 'radio-player-page' );
		$filtered = Slot_Filter::filter( $schedule, $program_names );
		foreach ( $filtered['dropped'] as $slot ) {
			$log( 'Radio Player Page migration: dropping schedule slot "' . $slot['program'] . '" on ' . $slot['day'] . ' ' . $slot['start'] . '-' . $slot['end'] . ' of station "' . $title . '"; it does not validate with the earlier slots.' );
			$dropped[] = array( 'station' => $title ) + $slot;
		}

		$sanitized = radplapag_sanitize_station_schedule( $filtered['schedule'] );
		if ( is_wp_error( $sanitized ) ) {
			return new WP_Error(
				'radplapag_migration_schedule',
				sprintf(
					/* translators: %s: validation error message */
					__( 'Schedule migration failed: %s', 'radio-player-page' ),
					$sanitized->get_error_message()
				)
			);
		}

		$post_id = wp_insert_post(
			wp_slash(
				array(
					'post_type'    => 'radplapag_station',
					'post_status'  => 'publish',
					'post_title'   => $title,
					'post_author'  => $author,
					'menu_order'   => $station['menu_order'],
					'post_content' => '',
					'meta_input'   => array( self::PENDING_META => '1' ),
				)
			),
			true
		);
		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}

		update_post_meta( $post_id, 'radplapag_station_stream_url', wp_slash( $station['stream_url'] ) );
		update_post_meta( $post_id, 'radplapag_station_player_page', $station['player_page'] );
		update_post_meta( $post_id, 'radplapag_station_background_id', $station['background_id'] );
		update_post_meta( $post_id, 'radplapag_station_logo_id', $station['logo_id'] );
		update_post_meta( $post_id, 'radplapag_station_theme_color', wp_slash( $station['theme_color'] ) );
		update_post_meta( $post_id, 'radplapag_station_visualizer', wp_slash( $station['visualizer'] ) );
		update_post_meta( $post_id, 'radplapag_station_schedule', wp_slash( wp_json_encode( $sanitized ) ) );

		return $post_id;
	}

	/**
	 * Deletes the posts created by a failed migration (newest first).
	 *
	 * @since 3.5.0
	 *
	 * @param int[] $post_ids Created post IDs, oldest first.
	 * @return void
	 */
	private static function rollback( array $post_ids ): void {
		foreach ( array_reverse( $post_ids ) as $post_id ) {
			wp_delete_post( $post_id, true );
		}
	}
}
