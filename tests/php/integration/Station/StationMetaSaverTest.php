<?php
/**
 * Tests of RadioPlayerPage\WP\Station_Meta_Saver.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Station;

use RadioPlayerPage\Tests\Integration\Support\Factory;
use RadioPlayerPage\WP\Station_Meta_Saver;
use WP_UnitTestCase;

/**
 * Pins the adapter of the station save with the fields already read from the form,
 * including the valid URL path that SaveStationMetaTest cannot reach in the CLI.
 */
final class StationMetaSaverTest extends WP_UnitTestCase {

	const URL_REQUIRED  = 'Streaming URL is required.';
	const PAGE_REQUIRED = 'Player Page is required. Please select a page.';
	const PAGE_TAKEN    = 'This Player Page is already assigned to another station. Please choose a different page.';

	/**
	 * Fixture factory.
	 *
	 * @var Factory
	 */
	private $factory_rpp;

	/**
	 * Station being saved.
	 *
	 * @var int
	 */
	private $station;

	/**
	 * Player page of the valid saves.
	 *
	 * @var int
	 */
	private $page;

	/**
	 * Creates the station and a page.
	 */
	public function set_up() {
		parent::set_up();

		$this->factory_rpp = new Factory();
		$this->station     = $this->factory_rpp->station( 'Station' );
		$this->page        = $this->factory_rpp->page( 'Page' );
	}

	/**
	 * A station meta value of the saved station.
	 *
	 * @param string $key Meta key without the `radplapag_station_` prefix.
	 * @return mixed
	 */
	private function meta( $key ) {
		return get_post_meta( $this->station, 'radplapag_station_' . $key, true );
	}

	/**
	 * The field errors transient of the station.
	 *
	 * @return mixed
	 */
	private function field_errors() {
		return get_transient( 'radplapag_station_field_errors_' . $this->station );
	}

	/**
	 * Saves with Station_Meta_Saver and records the meta keys written and the
	 * transients set or deleted, in order.
	 *
	 * @param array $input Fields of the save.
	 * @return string[]
	 */
	private function save_and_record_writes( array $input ) {
		$writes    = array();
		$meta_hook = static function ( $meta_id, $object_id, $meta_key ) use ( &$writes ) {
			$writes[] = current_filter() . ':' . $meta_key;
		};
		$transient = static function ( $name ) use ( &$writes ) {
			$writes[] = current_filter() . ':' . $name;
		};
		add_action( 'added_post_meta', $meta_hook, 10, 3 );
		add_action( 'updated_post_meta', $meta_hook, 10, 3 );
		add_action( 'setted_transient', $transient );
		add_action( 'deleted_transient', $transient );

		Station_Meta_Saver::save( $this->station, $input );

		remove_action( 'added_post_meta', $meta_hook, 10 );
		remove_action( 'updated_post_meta', $meta_hook, 10 );
		remove_action( 'setted_transient', $transient );
		remove_action( 'deleted_transient', $transient );

		return $writes;
	}

	/**
	 * With a valid URL and page: the old field errors are deleted, URL and page are
	 * written before the five metas, then the schedule.
	 */
	public function test_valid_save_writes_url_and_page_first() {
		set_transient( 'radplapag_station_field_errors_' . $this->station, 'Old error', 45 );

		$writes = $this->save_and_record_writes(
			array(
				'stream_url'  => 'https://radio.test/live.mp3',
				'player_page' => (string) $this->page,
			)
		);

		$this->assertSame(
			array(
				'deleted_transient:radplapag_station_field_errors_' . $this->station,
				'added_post_meta:radplapag_station_stream_url',
				'added_post_meta:radplapag_station_player_page',
				'added_post_meta:radplapag_station_background_id',
				'added_post_meta:radplapag_station_logo_id',
				'added_post_meta:radplapag_station_intro_audio_id',
				'added_post_meta:radplapag_station_theme_color',
				'added_post_meta:radplapag_station_visualizer',
				'added_post_meta:radplapag_station_schedule',
			),
			$writes
		);
		$this->assertFalse( $this->field_errors() );
		$this->assertSame( 'https://radio.test/live.mp3', $this->meta( 'stream_url' ) );
		$this->assertSame( (string) $this->page, $this->meta( 'player_page' ) );
		$this->assertSame( '[]', $this->meta( 'schedule' ) );
	}

	/**
	 * The URL is trimmed and passed through esc_url_raw().
	 */
	public function test_stream_url_is_trimmed_and_escaped() {
		Station_Meta_Saver::save(
			$this->station,
			array(
				'stream_url'  => "  radio.test/a b.mp3\n",
				'player_page' => $this->page,
			)
		);

		$this->assertSame( 'http://radio.test/a%20b.mp3', $this->meta( 'stream_url' ) );
	}

	/**
	 * A URL that esc_url_raw() empties is reported as missing.
	 */
	public function test_url_emptied_by_esc_url_raw_is_required() {
		Station_Meta_Saver::save(
			$this->station,
			array(
				'stream_url'  => 'javascript:alert(1)',
				'player_page' => $this->page,
			)
		);

		$this->assertSame( self::URL_REQUIRED, $this->field_errors() );
		$this->assertSame( '', $this->meta( 'stream_url' ) );
	}

	/**
	 * A URL that is not a string reads as empty.
	 */
	public function test_non_string_url_is_required() {
		Station_Meta_Saver::save(
			$this->station,
			array(
				'stream_url'  => array( 'https://radio.test/live.mp3' ),
				'player_page' => $this->page,
			)
		);

		$this->assertSame( self::URL_REQUIRED, $this->field_errors() );
	}

	/**
	 * Without fields both required messages are joined with a space, and the URL and
	 * page metas are not written.
	 */
	public function test_missing_fields_report_both_messages() {
		Station_Meta_Saver::save( $this->station, array() );

		$this->assertSame( self::URL_REQUIRED . ' ' . self::PAGE_REQUIRED, $this->field_errors() );
		$this->assertSame( '', $this->meta( 'stream_url' ) );
		$this->assertSame( '', $this->meta( 'player_page' ) );
		$this->assertSame( 'neutral', $this->meta( 'theme_color' ) );
		$this->assertSame( 'oscilloscope', $this->meta( 'visualizer' ) );
		$this->assertSame( '0', $this->meta( 'background_id' ) );
	}

	/**
	 * A page of another station is reported and the URL and page are kept.
	 */
	public function test_page_of_another_station_is_reported() {
		update_post_meta( $this->station, 'radplapag_station_stream_url', 'https://radio.test/old.mp3' );
		$this->factory_rpp->station( 'Other', array( 'player_page' => $this->page ) );

		Station_Meta_Saver::save(
			$this->station,
			array(
				'stream_url'  => 'https://radio.test/live.mp3',
				'player_page' => $this->page,
			)
		);

		$this->assertSame( self::PAGE_TAKEN, $this->field_errors() );
		$this->assertSame( 'https://radio.test/old.mp3', $this->meta( 'stream_url' ) );
		$this->assertSame( '', $this->meta( 'player_page' ) );
	}

	/**
	 * The assigned pages are only read when there is a player page.
	 */
	public function test_assigned_pages_are_read_only_with_a_page() {
		$queries = 0;
		$count   = static function ( $query ) use ( &$queries ) {
			if ( 'radplapag_station' === $query->get( 'post_type' ) ) {
				++$queries;
			}
		};
		add_action( 'pre_get_posts', $count );

		Station_Meta_Saver::save( $this->station, array( 'stream_url' => 'https://radio.test/live.mp3' ) );
		$without_page = $queries;
		Station_Meta_Saver::save(
			$this->station,
			array(
				'stream_url'  => 'https://radio.test/live.mp3',
				'player_page' => $this->page,
			)
		);

		remove_action( 'pre_get_posts', $count );
		$this->assertSame( 0, $without_page );
		$this->assertSame( 1, $queries );
	}

	/**
	 * The IDs go through absint() and the keys through sanitize_key() before the
	 * whitelists.
	 */
	public function test_wordpress_sanitizers_run_before_the_core() {
		$image = $this->factory_rpp->image( 'Logo' );
		$audio = $this->factory_rpp->audio( 'Intro' );

		Station_Meta_Saver::save(
			$this->station,
			array(
				'stream_url'     => 'https://radio.test/live.mp3',
				'player_page'    => $this->page . 'abc',
				'background_id'  => '-' . $image,
				'logo_id'        => ' ' . $image,
				'intro_audio_id' => (string) $audio,
				'theme_color'    => 'Blue',
				'visualizer'     => 'BARS ',
			)
		);

		$this->assertFalse( $this->field_errors() );
		$this->assertSame( (string) $this->page, $this->meta( 'player_page' ) );
		$this->assertSame( (string) $image, $this->meta( 'background_id' ) );
		$this->assertSame( (string) $image, $this->meta( 'logo_id' ) );
		$this->assertSame( (string) $audio, $this->meta( 'intro_audio_id' ) );
		$this->assertSame( 'blue', $this->meta( 'theme_color' ) );
		$this->assertSame( 'bars', $this->meta( 'visualizer' ) );
	}

	/**
	 * Attachments of the wrong type go to 0 without a message (K37).
	 */
	public function test_wrong_attachments_go_to_zero() {
		$ogg = $this->factory_rpp->audio( 'Intro', 'audio/ogg' );

		Station_Meta_Saver::save(
			$this->station,
			array(
				'stream_url'     => 'https://radio.test/live.mp3',
				'player_page'    => $this->page,
				'background_id'  => $ogg,
				'intro_audio_id' => $ogg,
			)
		);

		$this->assertFalse( $this->field_errors() );
		$this->assertSame( '0', $this->meta( 'background_id' ) );
		$this->assertSame( '0', $this->meta( 'intro_audio_id' ) );
	}

	/**
	 * A valid schedule is stored as JSON and an invalid one sets its transient and
	 * keeps the meta.
	 */
	public function test_schedule_goes_through_the_schedule_sanitizer() {
		$program = $this->factory_rpp->program( 'Morning' );
		$slot    = array(
			'program_id' => (string) $program,
			'start'      => '06:00',
			'end'        => '10:00',
		);

		Station_Meta_Saver::save( $this->station, array( 'schedule' => array( 'monday' => array( $slot ) ) ) );
		$saved = $this->meta( 'schedule' );

		$slot['program_id'] = '';
		Station_Meta_Saver::save( $this->station, array( 'schedule' => array( 'monday' => array( $slot ) ) ) );

		$this->assertSame(
			wp_json_encode(
				array(
					'monday' => array(
						array(
							'program_id' => $program,
							'start'      => '06:00',
							'end'        => '10:00',
							'is_rerun'   => false,
						),
					),
				)
			),
			$saved
		);
		$this->assertSame( $saved, $this->meta( 'schedule' ) );
		$this->assertIsString( get_transient( 'radplapag_station_schedule_errors_' . $this->station ) );
	}

	/**
	 * A schedule that is not an array reads as empty.
	 */
	public function test_non_array_schedule_reads_as_empty() {
		Station_Meta_Saver::save( $this->station, array( 'schedule' => 'monday' ) );

		$this->assertSame( '[]', $this->meta( 'schedule' ) );
	}
}
