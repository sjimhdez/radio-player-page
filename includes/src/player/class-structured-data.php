<?php
/**
 * The schema.org structured data of the clean page.
 *
 * @package radio-player-page
 * @since 3.6.0
 */

namespace RadioPlayerPage\Player;

use RadioPlayerPage\Schedule\Week;
use RadioPlayerPage\Schedule\Week_Interval;

defined( 'ABSPATH' ) || exit;

/**
 * Builds the JSON-LD graph that radplapag_output_clean_page() prints (ADR 0070).
 *
 * @since 3.6.0
 */
final class Structured_Data {

	/**
	 * The graph: the RadioStation, then one BroadcastEvent per program and rerun flag.
	 *
	 * The events follow the order of $programs (first appearance, K78), the live one
	 * before the rerun; slots of programs that are not in $programs are left out, and
	 * so are programs without slots. Null descriptions and logos are left out. The
	 * station image is the logo, else the background.
	 *
	 * @since 3.6.0
	 *
	 * @param array<string, mixed>                       $station  name, url, logo_url, background_url and in_language.
	 * @param list<array<string, mixed>>                 $programs RADPLAPAG_PROGRAMS, from Globals_Builder::programs().
	 * @param array<array-key, list<array<string, mixed>>> $schedule Printed slots, from Globals_Builder::schedule().
	 * @param string|null                                $timezone IANA zone of the site, or null with a manual offset.
	 * @param string                                     $offset   Offset of the site at the time of the request, `±HH:MM`.
	 * @return array<string, mixed>
	 */
	public static function graph( array $station, array $programs, array $schedule, ?string $timezone, string $offset ): array {
		$url        = (string) $station['url'];
		$station_id = $url . '#station';

		$node = array(
			'@type' => 'RadioStation',
			'@id'   => $station_id,
			'name'  => $station['name'],
			'url'   => $url,
		);
		if ( ! empty( $station['logo_url'] ) ) {
			$node['logo'] = $station['logo_url'];
		}
		$image = ! empty( $station['logo_url'] ) ? $station['logo_url'] : ( ! empty( $station['background_url'] ) ? $station['background_url'] : null );
		if ( null !== $image ) {
			$node['image'] = $image;
		}

		$slots  = self::slots_by_program( $schedule, $timezone, $offset );
		$events = array();
		foreach ( $programs as $program ) {
			$id = (string) $program['id'];
			foreach ( array( false, true ) as $is_rerun ) {
				$key = $id . ( $is_rerun ? '-rerun' : '' );
				if ( empty( $slots[ $key ] ) ) {
					continue;
				}
				$event = array(
					'@type' => 'BroadcastEvent',
					'@id'   => $url . '#program-' . $key,
					'name'  => $program['name'],
				);
				if ( null !== $program['description'] ) {
					$event['description'] = $program['description'];
				}
				if ( null !== $program['logoUrl'] ) {
					$event['image'] = $program['logoUrl'];
				}
				$events[] = $event + array(
					'isLiveBroadcast'     => ! $is_rerun,
					'inLanguage'          => $station['in_language'],
					'eventAttendanceMode' => 'https://schema.org/OnlineEventAttendanceMode',
					'location'            => array(
						'@type' => 'VirtualLocation',
						'url'   => $url,
					),
					'organizer'           => array( '@id' => $station_id ),
					'eventSchedule'       => $slots[ $key ],
				);
			}
		}

		if ( ! empty( $events ) ) {
			$node['event'] = array_map(
				static function ( array $event ): array {
					return array( '@id' => $event['@id'] );
				},
				$events
			);
		}

		return array(
			'@context' => 'https://schema.org',
			'@graph'   => array_merge( array( $node ), $events ),
		);
	}

	/**
	 * The Schedule of each slot, by program ID with `-rerun` for the reruns.
	 *
	 * @param array<array-key, list<array<string, mixed>>> $schedule Printed slots.
	 * @param string|null                                $timezone IANA zone, or null.
	 * @param string                                     $offset   Offset `±HH:MM`.
	 * @return array<string, list<array<string, mixed>>>
	 */
	private static function slots_by_program( array $schedule, ?string $timezone, string $offset ): array {
		$result = array();
		foreach ( Week::KEYS as $day ) {
			if ( empty( $schedule[ $day ] ) ) {
				continue;
			}
			foreach ( $schedule[ $day ] as $slot ) {
				// Time::to_minutes() is loose: only a strict HH:MM is printed.
				if ( ! self::is_time( $slot['start'] ) || ! self::is_time( $slot['end'] ) ) {
					continue;
				}
				$interval = Week_Interval::from_slot( $day, $slot['start'], $slot['end'] );
				if ( null === $interval ) {
					continue;
				}
				$suffix = null === $timezone ? ':00' . $offset : ':00';
				$entry  = array(
					'@type'           => 'Schedule',
					'byDay'           => 'https://schema.org/' . ucfirst( $day ),
					'startTime'       => $slot['start'] . $suffix,
					'endTime'         => $slot['end'] . $suffix,
					'duration'        => self::duration( $interval['duration'] ),
					'repeatFrequency' => 'P1W',
				);
				if ( null !== $timezone ) {
					$entry['scheduleTimezone'] = $timezone;
				}
				$key              = (string) $slot['program_id'] . ( ! empty( $slot['is_rerun'] ) ? '-rerun' : '' );
				$result[ $key ][] = $entry;
			}
		}
		return $result;
	}

	/**
	 * Checks if a value is a strict `HH:MM` time (00:00 to 23:59).
	 *
	 * @param mixed $time Slot time.
	 * @return bool
	 */
	private static function is_time( $time ): bool {
		return is_string( $time ) && 1 === preg_match( '/^([01]\d|2[0-3]):[0-5]\d$/D', $time );
	}

	/**
	 * An ISO 8601 duration without the zero parts: 90 → `PT1H30M`, 1440 → `PT24H`.
	 *
	 * @param int $minutes Duration in minutes (1-1440).
	 * @return string
	 */
	private static function duration( int $minutes ): string {
		$hours = intdiv( $minutes, 60 );
		$rest  = $minutes % 60;
		return 'PT' . ( $hours > 0 ? $hours . 'H' : '' ) . ( $rest > 0 ? $rest . 'M' : '' );
	}
}
