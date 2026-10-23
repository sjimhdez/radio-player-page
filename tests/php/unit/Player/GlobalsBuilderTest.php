<?php
/**
 * Tests for RadioPlayerPage\Player\Globals_Builder.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Player;

use DateTimeImmutable;
use DateTimeZone;
use RadioPlayerPage\Player\Globals_Builder;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * The window.RADPLAPAG_* globals of the clean page, built as in 3.4.2.
 */
final class GlobalsBuilderTest extends TestCase {

	/**
	 * A station row as Data\Station::row() gives it.
	 *
	 * @return array<string, mixed>
	 */
	private static function station(): array {
		return array(
			'id'             => 7,
			'station_title'  => 'Radio One',
			'stream_url'     => 'https://example.com/stream.mp3',
			'player_page'    => 10,
			'background_id'  => 3,
			'logo_id'        => 4,
			'intro_audio_id' => 5,
			'theme_color'    => 'blue',
			'visualizer'     => 'bars',
			'schedule'       => array(),
		);
	}

	/**
	 * Media URLs as the clean page reads them.
	 *
	 * @return array<string, mixed>
	 */
	private static function media(): array {
		return array(
			'background_url'  => 'https://example.com/bg.jpg',
			'logo_url'        => 'https://example.com/logo.png',
			'intro_audio_url' => 'https://example.com/intro.mp3',
		);
	}

	/**
	 * A stand-in for sanitize_key().
	 *
	 * @return callable
	 */
	private static function sanitize_key(): callable {
		return static function ( $key ) {
			return is_scalar( $key ) ? (string) preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $key ) ) : '';
		};
	}

	/**
	 * A stand-in for sanitize_text_field() that shows where it runs.
	 *
	 * @return callable
	 */
	private static function sanitize_text(): callable {
		return static function ( $value ) {
			return is_string( $value ) ? trim( $value ) : '';
		};
	}

	/**
	 * Now in a timezone.
	 *
	 * @param string $zone Timezone name or offset.
	 * @param string $time Date and time.
	 * @return DateTimeImmutable
	 */
	private static function now( string $zone, string $time = '2026-01-15 12:00:00' ): DateTimeImmutable {
		return new DateTimeImmutable( $time, new DateTimeZone( $zone ) );
	}

	/**
	 * Config for a station.
	 *
	 * @param array<string, mixed> $station Station row.
	 * @param array<string, mixed> $media   Media URLs.
	 * @param DateTimeImmutable    $now     Now.
	 * @return array<string, mixed>
	 */
	private static function config( array $station, array $media = array(), ?DateTimeImmutable $now = null ): array {
		return Globals_Builder::config( $station, $media, 'My Site', $now ? $now : self::now( 'UTC' ), self::sanitize_key() );
	}

	/**
	 * A full station gives every key of RADPLAPAG_CONFIG, in the order of 3.4.2.
	 */
	public function test_config_with_a_full_station() {
		$this->assertSame(
			array(
				'streamUrl'       => 'https://example.com/stream.mp3',
				'siteTitle'       => 'Radio One',
				'backgroundImage' => 'https://example.com/bg.jpg',
				'logoImage'       => 'https://example.com/logo.png',
				'introAudioUrl'   => 'https://example.com/intro.mp3',
				'themeColor'      => 'blue',
				'visualizer'      => 'bars',
				'timezoneOffset'  => 0,
				'timezone'        => 'UTC',
			),
			self::config( self::station(), self::media() )
		);
	}

	/**
	 * Falsy or missing media URLs are null.
	 */
	public function test_falsy_media_urls_are_null() {
		$config = self::config(
			self::station(),
			array(
				'background_url'  => false,
				'logo_url'        => '',
			)
		);

		$this->assertNull( $config['backgroundImage'] );
		$this->assertNull( $config['logoImage'] );
		$this->assertNull( $config['introAudioUrl'] );
	}

	/**
	 * An empty station title ('', '0' or missing) falls back to the site title.
	 */
	public function test_empty_station_title_falls_back_to_the_site_title() {
		$station = self::station();

		$station['station_title'] = '';
		$this->assertSame( 'My Site', self::config( $station )['siteTitle'] );

		$station['station_title'] = '0';
		$this->assertSame( 'My Site', self::config( $station )['siteTitle'] );

		unset( $station['station_title'] );
		$this->assertSame( 'My Site', self::config( $station )['siteTitle'] );
	}

	/**
	 * Theme and visualizer go through sanitize_key() and the whitelists.
	 */
	public function test_theme_and_visualizer_whitelists() {
		$station = self::station();

		$station['theme_color'] = 'RED';
		$station['visualizer']  = 'Particles';
		$config                 = self::config( $station );
		$this->assertSame( 'red', $config['themeColor'] );
		$this->assertSame( 'particles', $config['visualizer'] );

		$station['theme_color'] = 'teal';
		$station['visualizer']  = 'spiral';
		$config                 = self::config( $station );
		$this->assertSame( 'neutral', $config['themeColor'] );
		$this->assertSame( 'oscilloscope', $config['visualizer'] );

		unset( $station['theme_color'], $station['visualizer'] );
		$config = self::config( $station );
		$this->assertSame( 'neutral', $config['themeColor'] );
		$this->assertSame( 'oscilloscope', $config['visualizer'] );
	}

	/**
	 * The offset is the one of now, in hours: an integer when exact, a float otherwise.
	 *
	 * @dataProvider offsets
	 *
	 * @param string    $zone     Timezone.
	 * @param string    $time     Date and time.
	 * @param int|float $expected Offset in hours.
	 */
	public function test_timezone_offset( string $zone, string $time, $expected ) {
		$this->assertSame( $expected, self::config( self::station(), array(), self::now( $zone, $time ) )['timezoneOffset'] );
	}

	/**
	 * Timezones with half-hour, negative and daylight saving offsets.
	 *
	 * @return array<string, array{string, string, int|float}>
	 */
	public static function offsets(): array {
		return array(
			'utc'                  => array( 'UTC', '2026-01-15 12:00:00', 0 ),
			'kolkata +5:30'        => array( 'Asia/Kolkata', '2026-01-15 12:00:00', 5.5 ),
			'manual -3:30'         => array( '-03:30', '2026-01-15 12:00:00', -3.5 ),
			'new york winter'      => array( 'America/New_York', '2026-01-15 12:00:00', -5 ),
			'new york summer'      => array( 'America/New_York', '2026-07-15 12:00:00', -4 ),
			'madrid before change' => array( 'Europe/Madrid', '2026-03-29 01:59:00', 1 ),
			'madrid after change'  => array( 'Europe/Madrid', '2026-03-29 03:00:00', 2 ),
		);
	}

	/**
	 * The zone is the IANA name of now, or null when the site uses a manual offset (C9, ADR 0046).
	 *
	 * @dataProvider zones
	 *
	 * @param string      $zone     Timezone name or offset.
	 * @param string|null $expected Zone printed for the player.
	 */
	public function test_timezone( string $zone, ?string $expected ) {
		$this->assertSame( $expected, self::config( self::station(), array(), self::now( $zone ) )['timezone'] );
	}

	/**
	 * Named zones and manual offsets, as wp_timezone() gives them.
	 *
	 * @return array<string, array{string, string|null}>
	 */
	public static function zones(): array {
		return array(
			'utc'           => array( 'UTC', 'UTC' ),
			'kolkata'       => array( 'Asia/Kolkata', 'Asia/Kolkata' ),
			'new york'      => array( 'America/New_York', 'America/New_York' ),
			'manual -03:30' => array( '-03:30', null ),
			'manual +00:00' => array( '+00:00', null ),
		);
	}

	/**
	 * Program IDs come in the order of their first appearance, without repeats.
	 */
	public function test_program_ids_in_order_of_first_appearance() {
		$schedule = array(
			'tuesday' => array(
				array( 'program_id' => '12' ),
				array( 'program_id' => 5 ),
			),
			'monday'  => array(
				array( 'program_id' => '5' ),
				array( 'program_id' => '3' ),
				array( 'program_id' => 12 ),
			),
		);

		$this->assertSame( array( 12, 5, 3 ), Globals_Builder::program_ids( $schedule ) );
	}

	/**
	 * Only numeric IDs above 0 count; days and entries that are not arrays are skipped.
	 */
	public function test_program_ids_skip_invalid_values() {
		$schedule = array(
			'monday'    => array(
				array( 'program_id' => null ),
				array( 'program_id' => '' ),
				array( 'program_id' => 'abc' ),
				array( 'program_id' => '0' ),
				array( 'program_id' => '-4' ),
				array( 'program_id' => true ),
				array( 'start' => '08:00' ),
				'not an entry',
				array( 'program_id' => '2.9' ),
				array( 'program_id' => ' 8' ),
				array( 'program_id' => 6.0 ),
			),
			'tuesday'   => 'not a day',
			'wednesday' => null,
		);

		$this->assertSame( array( 2, 8, 6 ), Globals_Builder::program_ids( $schedule ) );
	}

	/**
	 * No schedule, no program IDs.
	 */
	public function test_program_ids_of_an_empty_schedule() {
		$this->assertSame( array(), Globals_Builder::program_ids( array() ) );
	}

	/**
	 * Programs keep the order given, with string IDs and empty values as null.
	 */
	public function test_programs() {
		$this->assertSame(
			array(
				array(
					'id'                  => '12',
					'name'                => 'Morning',
					'description'         => 'Short',
					'extendedDescription' => 'Long',
					'logoUrl'             => 'https://example.com/m.png',
				),
				array(
					'id'                  => '5',
					'name'                => 'Night',
					'description'         => null,
					'extendedDescription' => null,
					'logoUrl'             => null,
				),
			),
			Globals_Builder::programs(
				array(
					12 => array(
						'name'                 => 'Morning',
						'description'          => 'Short',
						'extended_description' => 'Long',
						'logo_id'              => 9,
						'logo_url'             => 'https://example.com/m.png',
					),
					5  => array(
						'name'                 => 'Night',
						'description'          => '',
						'extended_description' => '',
						'logo_id'              => 0,
						'logo_url'             => null,
					),
				)
			)
		);
	}

	/**
	 * Programs without data (missing or draft, C10) are left out.
	 */
	public function test_programs_without_data_are_left_out() {
		$this->assertSame(
			array( '3' ),
			array_column(
				Globals_Builder::programs(
					array(
						8 => null,
						3 => array(
							'name'                 => 'Kept',
							'description'          => '',
							'extended_description' => '',
							'logo_id'              => 0,
							'logo_url'             => null,
						),
					)
				),
				'id'
			)
		);
	}

	/**
	 * The schedule keeps days and entries in order, with string program IDs and boolean reruns.
	 */
	public function test_schedule() {
		$this->assertSame(
			array(
				'friday' => array(
					array(
						'program_id' => '12',
						'start'      => '22:00',
						'end'        => '02:00',
						'is_rerun'   => false,
					),
				),
				'monday' => array(
					array(
						'program_id' => '5',
						'start'      => '08:00',
						'end'        => '10:00',
						'is_rerun'   => true,
					),
					array(
						'program_id' => '7',
						'start'      => '10:00',
						'end'        => '11:00',
						'is_rerun'   => true,
					),
				),
			),
			Globals_Builder::schedule(
				array(
					'friday' => array(
						array(
							'program_id' => 12,
							'start'      => '22:00',
							'end'        => '02:00',
						),
					),
					'monday' => array(
						array(
							'program_id' => '5',
							'start'      => '08:00',
							'end'        => '10:00',
							'is_rerun'   => true,
						),
						array(
							'program_id' => '7.8',
							'start'      => '10:00',
							'end'        => '11:00',
							'is_rerun'   => '1',
						),
					),
				),
				self::sanitize_text()
			)
		);
	}

	/**
	 * A program ID that is not numeric goes through sanitize_text_field(); '0' is kept.
	 */
	public function test_schedule_program_ids_that_are_not_numeric() {
		$schedule = Globals_Builder::schedule(
			array(
				'monday' => array(
					array(
						'program_id' => ' legacy ',
						'start'      => '08:00',
						'end'        => '09:00',
					),
					array(
						'program_id' => '0',
						'start'      => '09:00',
						'end'        => '10:00',
					),
				),
			),
			self::sanitize_text()
		);

		$this->assertSame( array( 'legacy', '0' ), array_column( $schedule['monday'], 'program_id' ) );
	}

	/**
	 * Entries with an empty program ID, start or end are skipped, and so are days left empty.
	 */
	public function test_schedule_skips_incomplete_entries() {
		$schedule = Globals_Builder::schedule(
			array(
				'monday'    => array(
					array(
						'start' => '08:00',
						'end'   => '09:00',
					),
					array(
						'program_id' => '   ',
						'start'      => '08:00',
						'end'        => '09:00',
					),
					array(
						'program_id' => '1',
						'start'      => '0',
						'end'        => '09:00',
					),
					array(
						'program_id' => '1',
						'start'      => '08:00',
						'end'        => '',
					),
					array( 'program_id' => '1' ),
					'not an entry',
				),
				'tuesday'   => 'not a day',
				'wednesday' => array(
					array(
						'program_id' => '2',
						'start'      => '08:00',
						'end'        => '09:00',
					),
				),
			),
			self::sanitize_text()
		);

		$this->assertSame( array( 'wednesday' ), array_keys( $schedule ) );
	}

	/**
	 * Start and end are kept as stored, without validation.
	 */
	public function test_schedule_keeps_start_and_end_as_stored() {
		$schedule = Globals_Builder::schedule(
			array(
				'monday' => array(
					array(
						'program_id' => '1',
						'start'      => 'later',
						'end'        => 930,
					),
				),
			),
			self::sanitize_text()
		);

		$this->assertSame( 'later', $schedule['monday'][0]['start'] );
		$this->assertSame( 930, $schedule['monday'][0]['end'] );
	}

	/**
	 * K17: without slots the printable schedule is an empty object, printed as {} (ADR 0045).
	 * schedule() keeps returning an array; with slots both print the same.
	 */
	public function test_an_empty_schedule_prints_as_a_json_object() {
		$this->assertSame( '{}', json_encode( Globals_Builder::printable_schedule( array(), self::sanitize_text() ) ) );
		$this->assertSame( '{}', json_encode( Globals_Builder::printable_schedule( array( 'monday' => array() ), self::sanitize_text() ) ) );
		$this->assertSame( array(), Globals_Builder::schedule( array(), self::sanitize_text() ) );

		$schedule = array( 'monday' => array( array( 'program_id' => '4', 'start' => '08:00', 'end' => '09:00' ) ) );
		$this->assertSame(
			json_encode( Globals_Builder::schedule( $schedule, self::sanitize_text() ) ),
			json_encode( Globals_Builder::printable_schedule( $schedule, self::sanitize_text() ) )
		);
	}

	/**
	 * K21 and K43: titles and descriptions saved with entities reach the player decoded.
	 * Empty descriptions stay null.
	 */
	public function test_titles_and_descriptions_are_decoded() {
		$station                  = self::station();
		$station['station_title'] = 'Rock &amp; Roll';
		$this->assertSame( 'Rock & Roll', self::config( $station )['siteTitle'] );

		$station['station_title'] = '';
		$this->assertSame( 'Tom &amp; Jerry', Globals_Builder::config( $station, array(), 'Tom &amp;amp; Jerry', self::now( 'UTC' ), self::sanitize_key() )['siteTitle'] );

		$programs = Globals_Builder::programs(
			array(
				4 => array(
					'name'                 => 'Jazz &amp; Blues',
					'description'          => 'I &lt;3 jazz',
					'extended_description' => 'Rock &#039;n&#039; roll, &quot;live&quot;',
					'logo_id'              => 0,
					'logo_url'             => null,
				),
				5 => array(
					'name'                 => 'Plain',
					'description'          => '',
					'extended_description' => '',
					'logo_id'              => 0,
					'logo_url'             => null,
				),
			)
		);
		$this->assertSame( 'Jazz & Blues', $programs[0]['name'] );
		$this->assertSame( 'I <3 jazz', $programs[0]['description'] );
		$this->assertSame( 'Rock \'n\' roll, "live"', $programs[0]['extendedDescription'] );
		$this->assertNull( $programs[1]['description'] );
		$this->assertNull( $programs[1]['extendedDescription'] );
	}
}
