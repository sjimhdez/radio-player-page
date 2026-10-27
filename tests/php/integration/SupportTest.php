<?php
/**
 * Tests for the integration harness: bootstrap, Clock, Factory and Snapshot.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration;

use DateTime;
use DateTimeZone;
use PHPUnit\Framework\AssertionFailedError;
use RadioPlayerPage\Tests\Integration\Support\Clock;
use RadioPlayerPage\Tests\Integration\Support\Factory;
use RadioPlayerPage\Tests\Integration\Support\Snapshot;
use WP_UnitTestCase;

/**
 * Proves that the helpers every other integration test relies on do what they promise.
 */
final class SupportTest extends WP_UnitTestCase {

	/**
	 * Requested local day and minute, as the schedule vectors express them.
	 *
	 * @return array<string, array{string, string}>
	 */
	public function clock_targets() {
		return array(
			'midnight'      => array( 'monday', '00:00' ),
			'last minute'   => array( 'sunday', '23:59' ),
			'midday'        => array( 'wednesday', '12:00' ),
			'half past'     => array( 'friday', '05:30' ),
			'odd minute'    => array( 'saturday', '17:17' ),
			'early morning' => array( 'tuesday', '06:59' ),
		);
	}

	/**
	 * After Clock::set(), the plugin's own way of reading the time gives the requested
	 * minute, and the rotated vector day is today's local day.
	 *
	 * @dataProvider clock_targets
	 *
	 * @param string $day  Vector day key.
	 * @param string $time Vector local time (HH:MM).
	 */
	public function test_clock_sets_requested_local_minute_and_rotates_day( $day, $time ) {
		Clock::run(
			$day,
			$time,
			function ( Clock $clock ) use ( $day, $time ) {
				$now = new DateTime( 'now', wp_timezone() );

				$this->assertSame( $time, $now->format( 'H:i' ) );
				$this->assertSame( strtolower( $now->format( 'l' ) ), $clock->rotate_day( $day ) );
				$this->assertSame( $day, $clock->unrotate_day( $clock->rotate_day( $day ) ) );
				$this->assertSame( '', get_option( 'timezone_string' ) );
			}
		);
	}

	/**
	 * The offset stays in (-12 h, +12 h] and wp_timezone() applies it to the second:
	 * no minute is lost to the rounding in wp_timezone_string().
	 *
	 * @dataProvider clock_targets
	 *
	 * @param string $day  Vector day key.
	 * @param string $time Vector local time (HH:MM).
	 */
	public function test_clock_offset_is_exact_and_in_range( $day, $time ) {
		Clock::run(
			$day,
			$time,
			function ( Clock $clock ) {
				$offset_seconds = wp_timezone()->getOffset( new DateTime( 'now', new DateTimeZone( 'UTC' ) ) );

				$this->assertSame( $clock->offset_minutes() * 60, $offset_seconds );
				$this->assertGreaterThan( -720, $clock->offset_minutes() );
				$this->assertLessThanOrEqual( 720, $clock->offset_minutes() );
			}
		);
	}

	/**
	 * With $exact_day, the local day is the requested one whatever today is: no rotation,
	 * and wp_timezone() still applies the offset to the second (K73).
	 *
	 * @dataProvider clock_targets
	 *
	 * @param string $day  Vector day key.
	 * @param string $time Vector local time (HH:MM).
	 */
	public function test_clock_exact_day_sets_requested_local_day( $day, $time ) {
		Clock::run(
			$day,
			$time,
			function ( Clock $clock ) use ( $day, $time ) {
				$utc = new DateTime( 'now', new DateTimeZone( 'UTC' ) );
				$now = new DateTime( 'now', wp_timezone() );

				$this->assertSame( $time, $now->format( 'H:i' ) );
				$this->assertSame( $day, strtolower( $now->format( 'l' ) ) );
				$this->assertSame( $day, $clock->rotate_day( $day ) );
				$this->assertSame( $clock->offset_minutes() * 60, wp_timezone()->getOffset( $utc ) );
				$this->assertLessThan( 96 * 60, abs( $clock->offset_minutes() ) );
			},
			true
		);
	}

	/**
	 * The clock can put the site on a different calendar day than UTC.
	 */
	public function test_clock_local_day_can_differ_from_utc_day() {
		$utc_minute = (int) gmdate( 'G' ) * 60 + (int) gmdate( 'i' );
		$time       = $utc_minute < 720 ? '23:59' : '00:00';

		Clock::run(
			'thursday',
			$time,
			function () use ( $time ) {
				$local = new DateTime( 'now', wp_timezone() );
				$utc   = new DateTime( 'now', new DateTimeZone( 'UTC' ) );

				$this->assertSame( $time, $local->format( 'H:i' ) );
				$this->assertNotSame( $utc->format( 'Y-m-d' ), $local->format( 'Y-m-d' ) );
			}
		);
	}

	/**
	 * Every slot of a schedule moves to the rotated day; nothing else changes.
	 */
	public function test_clock_rotates_schedule_keys() {
		Clock::run(
			'monday',
			'10:00',
			function ( Clock $clock ) {
				$slot     = array(
					'program_id' => '7',
					'start'      => '22:00',
					'end'        => '02:00',
					'is_rerun'   => false,
				);
				$rotated  = $clock->rotate_schedule(
					array(
						'monday' => array( $slot ),
						'sunday' => array( $slot ),
					)
				);
				$expected = array(
					$clock->rotate_day( 'monday' ) => array( $slot ),
					$clock->rotate_day( 'sunday' ) => array( $slot ),
				);

				ksort( $rotated );
				ksort( $expected );
				$this->assertSame( $expected, $rotated );
			}
		);
	}

	/**
	 * A failure that is not caused by the minute changing is reported, not retried away.
	 */
	public function test_clock_run_rethrows_real_failures() {
		$calls = 0;

		try {
			Clock::run(
				'monday',
				'10:00',
				function () use ( &$calls ) {
					++$calls;
					$this->fail( 'Real failure.' );
				}
			);
		} catch ( AssertionFailedError $e ) {
			$this->assertSame( 'Real failure.', $e->getMessage() );
			$this->assertSame( 1, $calls );
			return;
		}

		$this->fail( 'Clock::run() swallowed the failure.' );
	}

	/**
	 * Admin code is loaded with the plugin, so every callback of SPEC.md §3.4 is hooked
	 * with its priority and number of arguments.
	 */
	public function test_every_contract_callback_is_hooked() {
		$expected = array(
			array( 'plugins_loaded', 'radplapag_ensure_schema_version_option', 5, 1 ),
			array( 'init', 'radplapag_register_station_post_type', 10, 1 ),
			array( 'init', 'radplapag_register_program_post_type', 10, 1 ),
			array( 'init', 'radplapag_register_station_meta', 20, 1 ),
			array( 'init', 'radplapag_register_program_meta', 20, 1 ),
			array( 'init', 'radplapag_register_schedule_block', 10, 1 ),
			array( 'init', 'radplapag_register_programs_list_block', 10, 1 ),
			array( 'init', 'radplapag_register_now_playing_block', 10, 1 ),
			array( 'template_redirect', 'radplapag_output_clean_page', 10, 1 ),
			array( 'admin_init', 'radplapag_maybe_clear_migration_conflict_flag', 5, 1 ),
			array( 'admin_init', 'radplapag_handle_migration_notice_dismiss', 15, 1 ),
			array( 'admin_init', 'radplapag_run_legacy_migration_if_needed', 20, 1 ),
			array( 'admin_menu', 'radplapag_admin_menu', 5, 1 ),
			array( 'admin_menu', 'radplapag_remove_duplicate_rpp_submenu', 99, 1 ),
			array( 'admin_notices', 'radplapag_migration_admin_notices', 10, 1 ),
			array( 'admin_notices', 'radplapag_station_schedule_errors_notice', 10, 1 ),
			array( 'admin_enqueue_scripts', 'radplapag_admin_scripts', 10, 1 ),
			array( 'admin_enqueue_scripts', 'radplapag_station_edit_scripts', 10, 1 ),
			array( 'admin_enqueue_scripts', 'radplapag_program_edit_scripts', 10, 1 ),
			array( 'add_meta_boxes', 'radplapag_add_station_meta_boxes', 10, 1 ),
			array( 'add_meta_boxes', 'radplapag_add_program_meta_boxes', 10, 1 ),
			array( 'save_post_radplapag_station', 'radplapag_save_station_meta', 10, 1 ),
			array( 'save_post_radplapag_program', 'radplapag_save_program_meta', 10, 1 ),
			array( 'enqueue_block_editor_assets', 'radplapag_enqueue_schedule_block_editor_assets', 10, 1 ),
			array( 'enqueue_block_editor_assets', 'radplapag_enqueue_programs_list_block_editor_assets', 10, 1 ),
			array( 'enqueue_block_editor_assets', 'radplapag_enqueue_now_playing_block_editor_assets', 10, 1 ),
			array( 'upgrader_process_complete', 'radplapag_on_upgrader_process_complete', 10, 2 ),
			array( 'map_meta_cap', 'radplapag_map_cpt_meta_cap', 10, 4 ),
			array( 'user_has_cap', 'radplapag_grant_station_caps_to_manage_options', 10, 4 ),
			array( 'user_has_cap', 'radplapag_grant_program_caps_to_manage_options', 10, 4 ),
			array( 'use_block_editor_for_post_type', 'radplapag_station_use_classic_editor', 10, 2 ),
		);

		global $wp_filter;

		foreach ( $expected as list( $hook, $callback, $priority, $accepted_args ) ) {
			$label = "$hook → $callback";

			$this->assertSame( $priority, has_filter( $hook, $callback ), $label );
			$this->assertSame( $accepted_args, $wp_filter[ $hook ]->callbacks[ $priority ][ $callback ]['accepted_args'], $label );
		}
	}

	/**
	 * The plugin is loaded as admin, but tests start on the public side.
	 */
	public function test_tests_start_outside_admin() {
		$this->assertFalse( is_admin() );
	}

	/**
	 * Factory records a readable name for each ID it creates.
	 */
	public function test_factory_creates_posts_and_names_them() {
		$factory = new Factory();
		$program = $factory->program( 'Morning Show', array( 'description' => 'Wake up' ) );
		$draft   = $factory->program( 'Hidden', array(), 'draft' );
		$logo    = $factory->image( 'logo' );
		$intro   = $factory->audio( 'intro' );
		$page    = $factory->page( 'Player' );
		$station = $factory->station(
			'Radio One',
			array(
				'stream_url'     => 'https://stream.example.test/live.mp3',
				'player_page'    => $page,
				'logo_id'        => $logo,
				'intro_audio_id' => $intro,
				'schedule'       => array(
					'monday' => array(
						array(
							'program_id' => (string) $program,
							'start'      => '08:00',
							'end'        => '10:00',
							'is_rerun'   => false,
						),
					),
				),
			)
		);

		$this->assertSame( 'publish', get_post_status( $program ) );
		$this->assertSame( 'draft', get_post_status( $draft ) );
		$this->assertSame( 'Wake up', get_post_meta( $program, 'radplapag_program_description', true ) );
		$this->assertTrue( wp_attachment_is_image( $logo ) );
		$this->assertSame( 'audio/mpeg', get_post_mime_type( $intro ) );

		$stations = radplapag_get_stations();
		$this->assertCount( 1, $stations );
		$this->assertSame( $station, (int) $stations[0]['id'] );
		$this->assertSame( (string) $program, $stations[0]['schedule']['monday'][0]['program_id'] );
		$this->assertSame( $page, (int) $stations[0]['player_page'] );

		$this->assertSame(
			array(
				$program => '{{PROGRAM:Morning Show}}',
				$draft   => '{{PROGRAM:Hidden}}',
				$logo    => '{{ATTACHMENT:logo}}',
				$intro   => '{{ATTACHMENT:intro}}',
				$page    => '{{PAGE:Player}}',
				$station => '{{STATION:Radio One}}',
			),
			$factory->names()
		);
	}

	/**
	 * Snapshot normalizes the origin (plain and JSON-escaped), the uploads year/month
	 * and known IDs in their usual contexts, and leaves times and unknown numbers alone.
	 */
	public function test_snapshot_normalizes_origin_dates_and_ids() {
		$home   = home_url();
		$quoted = str_replace( '/', '\/', $home );
		$input  = '<a href="' . $home . '/?page_id=42">x</a>'
			. '<img class="wp-image-42" src="' . $home . '/wp-content/uploads/2026/10/a.jpg">'
			. '{"id":42,"program_id":"7","url":"' . $quoted . '\/wp-content\/uploads\/2025\/01\/b.jpg","time":"07:00-10:00","n":420}';

		$expected = '<a href="{{ORIGIN}}/?page_id={{PAGE:P}}">x</a>'
			. '<img class="wp-image-{{PAGE:P}}" src="{{ORIGIN}}/wp-content/uploads/{{YYYY}}/{{MM}}/a.jpg">'
			. '{"id":{{PAGE:P}},"program_id":"{{PROGRAM:S}}","url":"{{ORIGIN}}\/wp-content\/uploads\/{{YYYY}}\/{{MM}}\/b.jpg","time":"07:00-10:00","n":420}';

		$this->assertSame(
			$expected,
			Snapshot::normalize(
				$input,
				array(
					42 => '{{PAGE:P}}',
					7  => '{{PROGRAM:S}}',
					10 => '{{NEVER}}',
				)
			)
		);
	}

	/**
	 * Without RADPLAPAG_UPDATE_SNAPSHOTS, a missing snapshot fails instead of being written.
	 */
	public function test_snapshot_missing_file_fails_without_update_flag() {
		if ( getenv( 'RADPLAPAG_UPDATE_SNAPSHOTS' ) ) {
			$this->markTestSkipped( 'Only meaningful without RADPLAPAG_UPDATE_SNAPSHOTS.' );
		}

		$name = 'support-test-missing-' . wp_generate_password( 8, false ) . '.html';

		try {
			Snapshot::assert_matches( $this, $name, 'content' );
		} catch ( AssertionFailedError $e ) {
			$this->assertStringContainsString( 'RADPLAPAG_UPDATE_SNAPSHOTS=1', $e->getMessage() );
			$this->assertFileDoesNotExist( Snapshot::path( $name ) );
			return;
		}

		$this->fail( 'A missing snapshot did not fail.' );
	}

	/**
	 * An existing snapshot is compared after normalization.
	 */
	public function test_snapshot_compares_with_existing_file() {
		$name = 'support-test-existing.txt';
		$path = Snapshot::path( $name );

		$this->assertFileExists( $path );
		Snapshot::assert_matches( $this, $name, home_url() . "/?p=5\n", array( 5 => '{{PAGE:Home}}' ) );
	}
}
