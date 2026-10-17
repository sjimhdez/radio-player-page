<?php
/**
 * Golden master of the legacy radplapag_settings → CPT migration (3.4.2).
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Migration;

use RadioPlayerPage\Tests\Integration\Support\Factory;
use WP_UnitTestCase;

/**
 * Runs the plugin's plugins_loaded and admin_init callbacks twice, as an administrator,
 * for each historical shape of radplapag_settings in tests/fixtures/legacy-settings/, and
 * compares the resulting stations, programs, options and transients with
 * tests/fixtures/legacy-settings/golden/<fixture>.json.
 *
 * Placeholders in a fixture: `{{PAGE:<name>}}` creates a published page and
 * `{{ATTACHMENT:<name>}}` an attachment of the type given in its `attachments` map
 * (`image` or `audio`). In the golden, post IDs become `{{PAGE:…}}`,
 * `{{ATTACHMENT:…}}`, `{{PROGRAM:…}}` and `{{STATION:…}}`.
 *
 * Goldens are written only with RADPLAPAG_UPDATE_SNAPSHOTS=1 (see Support/Snapshot.php);
 * without it, a missing golden fails.
 */
final class MigrationGoldenTest extends WP_UnitTestCase {

	/**
	 * Fixture factory.
	 *
	 * @var Factory
	 */
	private $factory_rpp;

	/**
	 * Previous error_log ini value.
	 *
	 * @var string|false
	 */
	private $error_log;

	/**
	 * Logs in an administrator and silences the migration's WP_DEBUG log lines.
	 */
	public function set_up() {
		parent::set_up();

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$this->factory_rpp = new Factory();
		$this->error_log   = ini_set( 'error_log', '/dev/null' ); // phpcs:ignore WordPress.PHP.IniSet.Risky -- Restored in tear_down().
	}

	/**
	 * Restores the error log.
	 */
	public function tear_down() {
		ini_set( 'error_log', (string) $this->error_log ); // phpcs:ignore WordPress.PHP.IniSet.Risky -- Restores set_up().

		parent::tear_down();
	}

	/**
	 * One case per fixture file.
	 *
	 * @return array<string, array{string}>
	 */
	public function fixtures() {
		$out = array();
		foreach ( glob( self::dir() . '/*.json' ) as $file ) {
			$out[ basename( $file, '.json' ) ] = array( $file );
		}

		return $out;
	}

	/**
	 * The migration of each legacy shape matches its golden and a second pass changes nothing.
	 *
	 * @dataProvider fixtures
	 *
	 * @param string $file Fixture path.
	 */
	public function test_migration_matches_golden_and_is_idempotent( $file ) {
		$fixture = $this->load( $file );

		// Legacy state: the option exists and no schema version was recorded.
		delete_option( 'radplapag_db_version' );
		update_option( 'radplapag_settings', $fixture['settings'] );

		set_current_screen( 'dashboard' );

		$this->request();
		$first = $this->dump();

		$this->request();
		$this->assertSame( $first, $this->dump(), 'A second request must not change anything.' );

		$this->assert_golden( basename( $file ), $first );
	}

	/**
	 * Directory of the fixtures.
	 *
	 * @return string
	 */
	private static function dir() {
		return dirname( __DIR__, 3 ) . '/fixtures/legacy-settings';
	}

	/**
	 * Reads a fixture, creating the pages and attachments its placeholders name.
	 *
	 * @param string $file Fixture path.
	 * @return array
	 */
	private function load( $file ) {
		$json = file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file.
		$raw  = json_decode( $json, true );

		$ids = array();
		preg_match_all( '/\{\{PAGE:([^}]+)\}\}/', $json, $pages );
		foreach ( array_unique( $pages[1] ) as $name ) {
			$ids[ '{{PAGE:' . $name . '}}' ] = (string) $this->factory_rpp->page( $name );
		}
		$attachments = isset( $raw['attachments'] ) ? $raw['attachments'] : array();
		foreach ( $attachments as $name => $type ) {
			$id = 'audio' === $type ? $this->factory_rpp->audio( $name ) : $this->factory_rpp->image( $name );

			$ids[ '{{ATTACHMENT:' . $name . '}}' ] = (string) $id;
		}

		return json_decode( strtr( $json, $ids ), true );
	}

	/**
	 * Runs the plugin's callbacks of an admin request, in hook and priority order.
	 *
	 * Only callbacks named radplapag_* are run: core's own admin_init callbacks send
	 * headers, which the CLI cannot do.
	 */
	private function request() {
		foreach ( array( 'plugins_loaded', 'admin_init' ) as $hook ) {
			$callbacks = $GLOBALS['wp_filter'][ $hook ]->callbacks;
			ksort( $callbacks );
			foreach ( $callbacks as $by_priority ) {
				foreach ( $by_priority as $callback ) {
					if ( is_string( $callback['function'] ) && 0 === strpos( $callback['function'], 'radplapag_' ) ) {
						call_user_func( $callback['function'] );
					}
				}
			}
		}
	}

	/**
	 * Normalized state of every station, program and migration option and transient.
	 *
	 * @return array
	 */
	private function dump() {
		$names = $this->factory_rpp->names();

		$programs = array();
		foreach ( $this->posts( 'radplapag_program', 'ID' ) as $post ) {
			$names[ $post->ID ] = '{{PROGRAM:' . $post->post_title . '}}';
			$programs[]         = $this->post_dump( $post, 'radplapag_program_' );
		}
		$stations = array();
		foreach ( $this->posts( 'radplapag_station', 'menu_order ID' ) as $post ) {
			$names[ $post->ID ] = '{{STATION:' . $post->post_title . '}}';
			$stations[]         = $this->post_dump( $post, 'radplapag_station_' );
		}

		$state = array(
			'stations'   => $stations,
			'programs'   => $programs,
			'options'    => array(
				'radplapag_settings'                       => get_option( 'radplapag_settings', '{{ABSENT}}' ),
				'radplapag_db_version'                     => get_option( 'radplapag_db_version', '{{ABSENT}}' ),
				'radplapag_migration_skipped_cpt_conflict' => get_option( 'radplapag_migration_skipped_cpt_conflict', '{{ABSENT}}' ),
			),
			'transients' => array(
				'radplapag_migrating'                => get_transient( 'radplapag_migrating' ),
				'radplapag_migration_success_notice' => get_transient( 'radplapag_migration_success_notice' ),
				'radplapag_migration_error_notice'   => get_transient( 'radplapag_migration_error_notice' ),
			),
		);

		return $this->rename( $state, $names );
	}

	/**
	 * Posts of a type, in any status.
	 *
	 * @param string $type    Post type.
	 * @param string $orderby Order.
	 * @return \WP_Post[]
	 */
	private function posts( $type, $orderby ) {
		return get_posts(
			array(
				'post_type'   => $type,
				'post_status' => 'any',
				'numberposts' => -1,
				'orderby'     => $orderby,
				'order'       => 'ASC',
			)
		);
	}

	/**
	 * Title, status, order and the plugin meta of a post.
	 *
	 * @param \WP_Post $post   Post.
	 * @param string   $prefix Meta key prefix.
	 * @return array
	 */
	private function post_dump( $post, $prefix ) {
		$meta = array();
		foreach ( get_post_meta( $post->ID ) as $key => $values ) {
			if ( 0 === strpos( $key, $prefix ) ) {
				$meta[ $key ] = $values[0];
			}
		}
		ksort( $meta );

		return array(
			'title'      => $post->post_title,
			'status'     => $post->post_status,
			'menu_order' => $post->menu_order,
			'meta'       => $meta,
		);
	}

	/**
	 * Replaces post IDs with names where IDs are stored: `*_id` and `*_player_page`
	 * meta, `player_page`, `background_id`, `logo_id` and `program_id` in the schedule
	 * JSON and in the legacy option.
	 *
	 * @param array              $state Dump.
	 * @param array<int, string> $names ID → placeholder.
	 * @return array
	 */
	private function rename( array $state, array $names ) {
		$name = static function ( $id ) use ( $names ) {
			return isset( $names[ (int) $id ] ) && (string) (int) $id === (string) $id ? $names[ (int) $id ] : $id;
		};

		foreach ( array( 'stations', 'programs' ) as $group ) {
			foreach ( $state[ $group ] as $i => $post ) {
				foreach ( $post['meta'] as $key => $value ) {
					if ( preg_match( '/(_id|_player_page)$/', $key ) ) {
						$state[ $group ][ $i ]['meta'][ $key ] = $name( $value );
					} elseif ( 'radplapag_station_schedule' === $key ) {
						$state[ $group ][ $i ]['meta'][ $key ] = preg_replace_callback(
							'/"program_id":(\d+)/',
							static function ( $m ) use ( $name ) {
								return '"program_id":"' . $name( $m[1] ) . '"';
							},
							$value
						);
					}
				}
			}
		}

		$settings = $state['options']['radplapag_settings'];
		if ( is_array( $settings ) ) {
			array_walk_recursive(
				$settings,
				static function ( &$value, $key ) use ( $name ) {
					if ( in_array( $key, array( 'player_page', 'background_id', 'logo_id' ), true ) ) {
						$value = $name( $value );
					}
				}
			);
			$state['options']['radplapag_settings'] = $settings;
		}

		return $state;
	}

	/**
	 * Compares the dump with its golden, writing it with RADPLAPAG_UPDATE_SNAPSHOTS=1.
	 *
	 * @param string $file  Fixture file name.
	 * @param array  $state Dump.
	 */
	private function assert_golden( $file, array $state ) {
		$path = self::dir() . '/golden/' . $file;
		$json = wp_json_encode( $state, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . "\n";

		if ( getenv( 'RADPLAPAG_UPDATE_SNAPSHOTS' ) ) {
			file_put_contents( $path, $json ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- Test helper, not shipped.
		}
		if ( ! file_exists( $path ) ) {
			$this->fail( "Missing golden $file. Write it with RADPLAPAG_UPDATE_SNAPSHOTS=1 and review it." );
		}

		$this->assertSame( file_get_contents( $path ), $json, "Golden $file" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file.
	}
}
