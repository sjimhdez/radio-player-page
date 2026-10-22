<?php
/**
 * Plan of the legacy radplapag_settings → CPT migration.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\Migration;

use RadioPlayerPage\Data\Station;

defined( 'ABSPATH' ) || exit;

/**
 * Works out what Radplapag_Migrator_Settings_To_Cpt::run() writes, before writing anything.
 *
 * The rules are those of the migrator in 3.4.2: programs are unique by legacy ID
 * (order of first appearance, data of the last one; a different md5 fingerprint makes
 * it a duplicate), station values go through the WordPress sanitizers and the
 * whitelists of Data\Station, and schedules keep the legacy program IDs. A slot whose
 * program is unknown is skipped; the writer logs it, drops the slots that do not
 * validate (Slot_Filter) and validates the rest.
 *
 * @since 3.5.0
 */
final class Legacy_Plan {

	/**
	 * Builds the migration plan from the raw option.
	 *
	 * Empty titles and names are '' (the writer gives the translated default). A stations
	 * list without any array station gives a plan without stations (K32 in
	 * docs/known-issues.md). A slot is a rerun only when the legacy slot has true.
	 *
	 * @since 3.5.0
	 *
	 * @param mixed                   $raw        Value of radplapag_settings.
	 * @param array<string, callable> $sanitizers WordPress sanitizers by key: text (sanitize_text_field), textarea (sanitize_textarea_field), url (esc_url_raw), key (sanitize_key), absint.
	 * @return array{programs: list<array{id: string, name: string, description: string, extended_description: string, logo_id: int}>, duplicates: list<string>, stations: list<array{title: string, stream_url: string, player_page: int, background_id: int, logo_id: int, theme_color: string, visualizer: string, menu_order: int, schedule: array<array-key, list<array{program_id: string, start: string, end: string, is_rerun: bool}>>, skipped: list<string>}>}|null Null when there is no station data (no_data).
	 */
	public static function build( $raw, array $sanitizers ): ?array {
		if ( ! is_array( $raw ) || ! isset( $raw['stations'] ) || ! is_array( $raw['stations'] ) || empty( $raw['stations'] ) ) {
			return null;
		}

		$unique       = array();
		$fingerprints = array();
		$duplicates   = array();
		foreach ( $raw['stations'] as $station ) {
			if ( ! is_array( $station ) || ! isset( $station['programs'] ) || ! is_array( $station['programs'] ) ) {
				continue;
			}
			foreach ( $station['programs'] as $prog ) {
				if ( ! is_array( $prog ) ) {
					continue;
				}
				$old_id = (string) ( $prog['id'] ?? '' );
				if ( '' === $old_id ) {
					continue;
				}
				$fingerprint = self::fingerprint( $prog );
				if ( isset( $fingerprints[ $old_id ] ) && $fingerprints[ $old_id ] !== $fingerprint ) {
					$duplicates[] = $old_id;
				}
				$fingerprints[ $old_id ] = $fingerprint;
				$unique[ $old_id ]       = self::program( $old_id, $prog, $sanitizers );
			}
		}

		$stations   = array();
		$menu_order = 0;
		foreach ( $raw['stations'] as $station ) {
			if ( ! is_array( $station ) ) {
				continue;
			}
			$stations[] = self::station( $station, $menu_order, $unique, $sanitizers );
			++$menu_order;
		}

		return array(
			'programs'   => array_values( $unique ),
			'duplicates' => $duplicates,
			'stations'   => $stations,
		);
	}

	/**
	 * Fingerprint of a legacy program's raw data.
	 *
	 * @since 3.5.0
	 *
	 * @param array<mixed> $prog Legacy program row.
	 * @return string
	 */
	private static function fingerprint( array $prog ): string {
		$name = (string) ( $prog['name'] ?? '' );
		$desc = (string) ( $prog['description'] ?? '' );
		$ext  = (string) ( $prog['extended_description'] ?? '' );
		$logo = (string) ( $prog['logo_id'] ?? '0' );
		return md5( $name . '|' . $desc . '|' . $ext . '|' . $logo );
	}

	/**
	 * Sanitized values of a legacy program.
	 *
	 * @since 3.5.0
	 *
	 * @param string                  $old_id     Legacy program ID.
	 * @param array<mixed>            $prog       Legacy program row.
	 * @param array<string, callable> $sanitizers WordPress sanitizers by key.
	 * @return array{id: string, name: string, description: string, extended_description: string, logo_id: int}
	 */
	private static function program( string $old_id, array $prog, array $sanitizers ): array {
		return array(
			'id'                   => $old_id,
			'name'                 => (string) $sanitizers['text']( (string) ( $prog['name'] ?? '' ) ),
			'description'          => (string) $sanitizers['text']( (string) ( $prog['description'] ?? '' ) ),
			'extended_description' => (string) $sanitizers['textarea']( (string) ( $prog['extended_description'] ?? '' ) ),
			'logo_id'              => (int) $sanitizers['absint']( $prog['logo_id'] ?? 0 ),
		);
	}

	/**
	 * Sanitized values and schedule of a legacy station.
	 *
	 * @since 3.5.0
	 *
	 * @param array<mixed>            $station    Legacy station row.
	 * @param int                     $menu_order Position among the array stations.
	 * @param array<mixed>            $programs   Known programs by legacy ID.
	 * @param array<string, callable> $sanitizers WordPress sanitizers by key.
	 * @return array{title: string, stream_url: string, player_page: int, background_id: int, logo_id: int, theme_color: string, visualizer: string, menu_order: int, schedule: array<array-key, list<array{program_id: string, start: string, end: string, is_rerun: bool}>>, skipped: list<string>}
	 */
	private static function station( array $station, int $menu_order, array $programs, array $sanitizers ): array {
		$theme      = (string) $sanitizers['key']( (string) ( $station['theme_color'] ?? 'neutral' ) );
		$visualizer = (string) $sanitizers['key']( (string) ( $station['visualizer'] ?? 'oscilloscope' ) );

		$schedule = array();
		$skipped  = array();
		if ( isset( $station['schedule'] ) && is_array( $station['schedule'] ) ) {
			foreach ( $station['schedule'] as $day => $slots ) {
				if ( ! is_array( $slots ) ) {
					continue;
				}
				$day_rows = array();
				foreach ( $slots as $slot ) {
					if ( ! is_array( $slot ) ) {
						continue;
					}
					$legacy_pid = (string) ( $slot['program_id'] ?? '' );
					$start      = trim( (string) ( $slot['start'] ?? '' ) );
					$end        = trim( (string) ( $slot['end'] ?? '' ) );
					if ( '' === $legacy_pid || '' === $start || '' === $end ) {
						continue;
					}
					if ( ! isset( $programs[ $legacy_pid ] ) ) {
						$skipped[] = $legacy_pid;
						continue;
					}
					$day_rows[] = array(
						'program_id' => $legacy_pid,
						'start'      => $start,
						'end'        => $end,
						'is_rerun'   => true === ( $slot['is_rerun'] ?? false ),
					);
				}
				if ( ! empty( $day_rows ) ) {
					$schedule[ $day ] = $day_rows;
				}
			}
		}

		return array(
			'title'         => (string) $sanitizers['text']( (string) ( $station['station_title'] ?? '' ) ),
			'stream_url'    => (string) $sanitizers['url']( trim( (string) ( $station['stream_url'] ?? '' ) ) ),
			'player_page'   => (int) $sanitizers['absint']( $station['player_page'] ?? 0 ),
			'background_id' => (int) $sanitizers['absint']( $station['background_id'] ?? 0 ),
			'logo_id'       => (int) $sanitizers['absint']( $station['logo_id'] ?? 0 ),
			'theme_color'   => in_array( $theme, Station::THEMES, true ) ? $theme : Station::THEMES[0],
			'visualizer'    => in_array( $visualizer, Station::VISUALIZERS, true ) ? $visualizer : Station::VISUALIZERS[0],
			'menu_order'    => $menu_order,
			'schedule'      => $schedule,
			'skipped'       => $skipped,
		);
	}
}
