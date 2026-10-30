<?php
/**
 * Tests for RadioPlayerPage\Data\Station.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Data;

use RadioPlayerPage\Data\Station;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * The station row of radplapag_get_stations(), built from raw meta as in 3.4.2.
 */
final class StationTest extends TestCase {

	/**
	 * The whitelists keep the values and order of 3.4.2.
	 */
	public function test_whitelists() {
		$this->assertSame( array( 'neutral', 'blue', 'green', 'red', 'orange', 'yellow', 'purple', 'pink' ), Station::THEMES );
		$this->assertSame( array( 'oscilloscope', 'bars', 'particles', 'waterfall' ), Station::VISUALIZERS );
	}

	/**
	 * A fully saved station gives every key, in the order of to_array().
	 */
	public function test_row_with_saved_meta() {
		$row = Station::row(
			12,
			'Radio One',
			array(
				'radplapag_station_stream_url'     => 'https://example.com/live.mp3',
				'radplapag_station_player_page'    => '34',
				'radplapag_station_background_id'  => '5',
				'radplapag_station_logo_id'        => '6',
				'radplapag_station_intro_audio_id' => '7',
				'radplapag_station_theme_color'    => 'blue',
				'radplapag_station_visualizer'     => 'bars',
				'radplapag_station_schedule'       => '{"monday":[{"program_id":"3","start":"08:00","end":"09:00"}]}',
				'radplapag_station_hide_title'     => '1',
				'radplapag_station_show_song'      => '1',
			)
		);

		$this->assertSame(
			array(
				'id'             => 12,
				'stream_url'     => 'https://example.com/live.mp3',
				'player_page'    => 34,
				'station_title'  => 'Radio One',
				'hide_title'     => true,
				'show_song'      => true,
				'background_id'  => 5,
				'logo_id'        => 6,
				'intro_audio_id' => 7,
				'theme_color'    => 'blue',
				'visualizer'     => 'bars',
				'schedule'       => array(
					'monday' => array(
						array(
							'program_id' => '3',
							'start'      => '08:00',
							'end'        => '09:00',
						),
					),
				),
			),
			$row
		);
	}

	/**
	 * Missing meta gives the defaults of get_post_meta( ..., true ) === ''.
	 */
	public function test_row_without_meta() {
		$this->assertSame(
			array(
				'id'             => 3,
				'stream_url'     => '',
				'player_page'    => 0,
				'station_title'  => '',
				'hide_title'     => false,
				'show_song'      => false,
				'background_id'  => 0,
				'logo_id'        => 0,
				'intro_audio_id' => 0,
				'theme_color'    => 'neutral',
				'visualizer'     => 'oscilloscope',
				'schedule'       => array(),
			),
			Station::row( 3, '', array() )
		);
	}

	/**
	 * The hide title meta is true only when it is truthy: '1' (what the save
	 * writes) is true; missing, '' and '0' are false (ADR 0054).
	 *
	 * @dataProvider data_hide_title
	 *
	 * @param array<string, mixed> $meta     Raw meta.
	 * @param bool                 $expected Expected hide_title.
	 */
	public function test_hide_title( $meta, $expected ) {
		$this->assertSame( $expected, Station::row( 1, 'Radio', $meta )['hide_title'] );
	}

	/**
	 * Raw hide title meta and the expected value.
	 *
	 * @return array<string, array{0: array<string, mixed>, 1: bool}>
	 */
	public function data_hide_title() {
		return array(
			'missing' => array( array(), false ),
			'one'     => array( array( 'radplapag_station_hide_title' => '1' ), true ),
			'empty'   => array( array( 'radplapag_station_hide_title' => '' ), false ),
			'zero'    => array( array( 'radplapag_station_hide_title' => '0' ), false ),
		);
	}

	/**
	 * The show song meta is true only when it is truthy, like hide title (ADR 0068).
	 *
	 * @dataProvider data_show_song
	 *
	 * @param array<string, mixed> $meta     Raw meta.
	 * @param bool                 $expected Expected show_song.
	 */
	public function test_show_song( $meta, $expected ) {
		$this->assertSame( $expected, Station::row( 1, 'Radio', $meta )['show_song'] );
	}

	/**
	 * Raw show song meta and the expected value.
	 *
	 * @return array<string, array{0: array<string, mixed>, 1: bool}>
	 */
	public function data_show_song() {
		return array(
			'missing' => array( array(), false ),
			'one'     => array( array( 'radplapag_station_show_song' => '1' ), true ),
			'empty'   => array( array( 'radplapag_station_show_song' => '' ), false ),
			'zero'    => array( array( 'radplapag_station_show_song' => '0' ), false ),
		);
	}

	/**
	 * Every whitelisted value is kept.
	 */
	public function test_every_whitelisted_value_is_kept() {
		foreach ( Station::THEMES as $theme ) {
			$this->assertSame( $theme, Station::row( 1, 'x', array( 'radplapag_station_theme_color' => $theme ) )['theme_color'] );
		}
		foreach ( Station::VISUALIZERS as $visualizer ) {
			$this->assertSame( $visualizer, Station::row( 1, 'x', array( 'radplapag_station_visualizer' => $visualizer ) )['visualizer'] );
		}
	}

	/**
	 * Values off the whitelist, or not strings, fall back to the defaults.
	 *
	 * @dataProvider data_off_whitelist
	 *
	 * @param mixed $value Raw meta value.
	 */
	public function test_off_whitelist_falls_back( $value ) {
		$row = Station::row(
			1,
			'x',
			array(
				'radplapag_station_theme_color' => $value,
				'radplapag_station_visualizer'  => $value,
			)
		);

		$this->assertSame( 'neutral', $row['theme_color'] );
		$this->assertSame( 'oscilloscope', $row['visualizer'] );
	}

	/**
	 * Inputs for test_off_whitelist_falls_back().
	 *
	 * @return array<string, array{mixed}>
	 */
	public function data_off_whitelist() {
		return array(
			'unknown'          => array( 'teal' ),
			'case differs'     => array( 'Blue' ),
			'padded'           => array( ' bars' ),
			'empty'            => array( '' ),
			'null'             => array( null ),
			'integer'          => array( 0 ),
			'array with value' => array( array( 'blue' ) ),
		);
	}

	/**
	 * The schedule is decoded only from a non-empty string that gives an array.
	 *
	 * @dataProvider data_schedule
	 *
	 * @param mixed $value    Raw meta value.
	 * @param array $expected Decoded schedule.
	 */
	public function test_schedule( $value, $expected ) {
		$this->assertSame( $expected, Station::row( 1, 'x', array( 'radplapag_station_schedule' => $value ) )['schedule'] );
	}

	/**
	 * Inputs for test_schedule().
	 *
	 * @return array<string, array{mixed, array<mixed>}>
	 */
	public function data_schedule() {
		return array(
			'empty object'         => array( '{}', array() ),
			'empty array'          => array( '[]', array() ),
			'list is kept as is'   => array( '[1,"a"]', array( 1, 'a' ) ),
			'raw entries are kept' => array(
				'{"monday":"x","tuesday":[{"start":""}]}',
				array(
					'monday'  => 'x',
					'tuesday' => array( array( 'start' => '' ) ),
				),
			),
			'empty string'         => array( '', array() ),
			'invalid json'         => array( '{monday', array() ),
			'json scalar'          => array( '"monday"', array() ),
			'json number'          => array( '7', array() ),
			'json null'            => array( 'null', array() ),
			'not a string: array'  => array( array( 'monday' => array() ), array() ),
			'not a string: null'   => array( null, array() ),
		);
	}

	/**
	 * The stream URL is kept only when it is a string; ids are cast with (int).
	 */
	public function test_casts() {
		$row = Station::row(
			1,
			'x',
			array(
				'radplapag_station_stream_url'     => array( 'https://example.com' ),
				'radplapag_station_player_page'    => '12abc',
				'radplapag_station_background_id'  => 'abc',
				'radplapag_station_logo_id'        => ' 9',
				'radplapag_station_intro_audio_id' => '-4',
			)
		);

		$this->assertSame( '', $row['stream_url'] );
		$this->assertSame( 12, $row['player_page'] );
		$this->assertSame( 0, $row['background_id'] );
		$this->assertSame( 9, $row['logo_id'] );
		$this->assertSame( -4, $row['intro_audio_id'] );
	}

	/**
	 * The stream URL string is not trimmed or sanitized here.
	 */
	public function test_stream_url_is_kept_verbatim() {
		$this->assertSame( ' not a url ', Station::row( 1, 'x', array( 'radplapag_station_stream_url' => ' not a url ' ) )['stream_url'] );
	}
}
