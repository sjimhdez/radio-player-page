<?php
/**
 * The window.RADPLAPAG_* globals of the clean page.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\Player;

use DateTimeImmutable;
use RadioPlayerPage\Data\Station;

defined( 'ABSPATH' ) || exit;

/**
 * Builds RADPLAPAG_CONFIG, RADPLAPAG_PROGRAMS and RADPLAPAG_SCHEDULE as radplapag_output_clean_page() prints them.
 *
 * @since 3.5.0
 */
final class Globals_Builder {

	/**
	 * Program IDs of a schedule, in the order of their first appearance.
	 *
	 * Only numeric IDs above 0 count; days and entries that are not arrays are skipped.
	 *
	 * @since 3.5.0
	 *
	 * @param array<mixed> $schedule Raw station schedule, by day.
	 * @return list<int>
	 */
	public static function program_ids( array $schedule ): array {
		$seen = array();
		foreach ( $schedule as $day_entries ) {
			if ( ! is_array( $day_entries ) ) {
				continue;
			}
			foreach ( $day_entries as $entry ) {
				if ( ! is_array( $entry ) ) {
					continue;
				}
				$pid = isset( $entry['program_id'] ) ? $entry['program_id'] : null;
				if ( null !== $pid && '' !== $pid && is_numeric( $pid ) ) {
					$pid_int = (int) $pid;
					if ( $pid_int > 0 && ! isset( $seen[ $pid_int ] ) ) {
						$seen[ $pid_int ] = true;
					}
				}
			}
		}
		return array_keys( $seen );
	}

	/**
	 * RADPLAPAG_CONFIG for a station.
	 *
	 * An empty station title falls back to the site title. Theme and visualizer go
	 * through sanitize_key() and the whitelists; falsy media URLs are null. The offset
	 * is the one of $now in hours, an integer when exact.
	 *
	 * @since 3.5.0
	 *
	 * @param array<string, mixed> $station      Station row with its stream_url.
	 * @param array<string, mixed> $media        background_url, logo_url and intro_audio_url, each optional.
	 * @param string               $site_title   Site title.
	 * @param DateTimeImmutable    $now          Now, in the site timezone.
	 * @param callable             $sanitize_key sanitize_key().
	 * @return array{streamUrl: mixed, siteTitle: mixed, backgroundImage: mixed, logoImage: mixed, introAudioUrl: mixed, themeColor: string, visualizer: string, timezoneOffset: int|float}
	 */
	public static function config( array $station, array $media, string $site_title, DateTimeImmutable $now, callable $sanitize_key ): array {
		$theme_color = isset( $station['theme_color'] ) ? $sanitize_key( $station['theme_color'] ) : Station::THEMES[0];
		if ( ! in_array( $theme_color, Station::THEMES, true ) ) {
			$theme_color = Station::THEMES[0];
		}

		$visualizer = isset( $station['visualizer'] ) ? $sanitize_key( $station['visualizer'] ) : Station::VISUALIZERS[0];
		if ( ! in_array( $visualizer, Station::VISUALIZERS, true ) ) {
			$visualizer = Station::VISUALIZERS[0];
		}

		return array(
			'streamUrl'       => $station['stream_url'],
			'siteTitle'       => ! empty( $station['station_title'] ) ? $station['station_title'] : $site_title,
			'backgroundImage' => ! empty( $media['background_url'] ) ? $media['background_url'] : null,
			'logoImage'       => ! empty( $media['logo_url'] ) ? $media['logo_url'] : null,
			'introAudioUrl'   => ! empty( $media['intro_audio_url'] ) ? $media['intro_audio_url'] : null,
			'themeColor'      => $theme_color,
			'visualizer'      => $visualizer,
			'timezoneOffset'  => $now->getOffset() / 3600,
		);
	}

	/**
	 * RADPLAPAG_PROGRAMS, in the order given.
	 *
	 * Programs without data (missing or draft) are left out; empty descriptions and
	 * logo URLs are null.
	 *
	 * @since 3.5.0
	 *
	 * @param array<int, array<string, mixed>|null|false> $data_by_id Program data of radplapag_get_program_data(), by post ID.
	 * @return list<array{id: string, name: mixed, description: mixed, extendedDescription: mixed, logoUrl: mixed}>
	 */
	public static function programs( array $data_by_id ): array {
		$programs = array();
		foreach ( $data_by_id as $post_id => $data ) {
			if ( ! $data ) {
				continue;
			}
			$programs[] = array(
				'id'                  => (string) $post_id,
				'name'                => $data['name'],
				'description'         => '' !== $data['description'] ? $data['description'] : null,
				'extendedDescription' => '' !== $data['extended_description'] ? $data['extended_description'] : null,
				'logoUrl'             => $data['logo_url'] ? $data['logo_url'] : null,
			);
		}
		return $programs;
	}

	/**
	 * RADPLAPAG_SCHEDULE, with program IDs as strings.
	 *
	 * Numeric IDs are cast to an integer string; the rest go through
	 * sanitize_text_field(). Entries with an empty ID, start or end are skipped, and
	 * so are days left empty. Without slots the result is an empty array (K17).
	 *
	 * @since 3.5.0
	 *
	 * @param array<mixed> $schedule      Raw station schedule, by day.
	 * @param callable     $sanitize_text sanitize_text_field().
	 * @return array<array-key, list<array{program_id: string, start: mixed, end: mixed, is_rerun: bool}>>
	 */
	public static function schedule( array $schedule, callable $sanitize_text ): array {
		$result = array();
		foreach ( $schedule as $day => $day_programs ) {
			if ( ! is_array( $day_programs ) ) {
				continue;
			}
			$day_entries = array();
			foreach ( $day_programs as $entry ) {
				if ( ! is_array( $entry ) ) {
					continue;
				}
				$program_id = isset( $entry['program_id'] ) ? $entry['program_id'] : '';
				$program_id = is_numeric( $program_id ) ? (string) (int) $program_id : $sanitize_text( $program_id );
				$start      = isset( $entry['start'] ) ? $entry['start'] : '';
				$end        = isset( $entry['end'] ) ? $entry['end'] : '';
				if ( '' === $program_id || empty( $start ) || empty( $end ) ) {
					continue;
				}
				$day_entries[] = array(
					'program_id' => $program_id,
					'start'      => $start,
					'end'        => $end,
					'is_rerun'   => ! empty( $entry['is_rerun'] ),
				);
			}
			if ( ! empty( $day_entries ) ) {
				$result[ $day ] = $day_entries;
			}
		}
		return $result;
	}
}
