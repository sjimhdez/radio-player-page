<?php
/**
 * R5: golden master of the legacy radplapag_settings → CPT migration, through the real
 * admin_init path (radplapag_run_legacy_migration_if_needed), for each historical shape.
 *
 * Missing golden files are written on the first run (the test is then marked incomplete).
 */
class MigrationGoldenTest extends WP_UnitTestCase {

	public function fixtures() {
		$out = array();
		foreach ( glob( dirname( __DIR__ ) . '/fixtures/legacy-settings/*.json' ) as $file ) {
			$out[ basename( $file, '.json' ) ] = array( $file );
		}
		return $out;
	}

	/**
	 * @dataProvider fixtures
	 */
	public function test_migration_matches_golden_and_is_idempotent( $file ) {
		$pages = array(
			'{{PAGE_1}}' => self::factory()->post->create( array( 'post_type' => 'page', 'post_title' => 'Player 1' ) ),
			'{{PAGE_2}}' => self::factory()->post->create( array( 'post_type' => 'page', 'post_title' => 'Player 2' ) ),
		);
		$fixture = json_decode( strtr( file_get_contents( $file ), array_map( 'strval', $pages ) ), true );

		// Legacy state: the option exists and no schema version was recorded.
		delete_option( 'radplapag_db_version' );
		update_option( 'radplapag_settings', $fixture['settings'] );
		radplapag_ensure_schema_version_option(); // What plugins_loaded does on every request.

		$admin = self::factory()->user->create( array( 'role' => 'administrator' ) );
		wp_set_current_user( $admin );
		set_current_screen( 'dashboard' );

		radplapag_run_legacy_migration_if_needed();
		$first = $this->dump( array_flip( array_map( 'strval', $pages ) ) );

		radplapag_run_legacy_migration_if_needed();
		$this->assertSame( $first, $this->dump( array_flip( array_map( 'strval', $pages ) ) ), 'Second run must not change anything.' );

		$golden = dirname( __DIR__ ) . '/fixtures/golden/' . basename( $file );
		$json   = wp_json_encode( $first, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . "\n";
		if ( ! file_exists( $golden ) ) {
			file_put_contents( $golden, $json );
			$this->markTestIncomplete( 'Golden written: ' . basename( $golden ) );
		}
		$this->assertSame( file_get_contents( $golden ), $json );
	}

	/** Normalized snapshot of every station, program and relevant option. */
	private function dump( array $page_names ) {
		$program_names = array();
		$programs      = array();
		foreach ( get_posts( array( 'post_type' => 'radplapag_program', 'post_status' => 'any', 'numberposts' => -1, 'orderby' => 'ID', 'order' => 'ASC' ) ) as $p ) {
			$program_names[ $p->ID ] = '{{PROGRAM:' . $p->post_title . '}}';
			$programs[] = array(
				'title'  => $p->post_title,
				'status' => $p->post_status,
				'meta'   => $this->meta( $p->ID, 'radplapag_program_' ),
			);
		}
		$stations = array();
		foreach ( get_posts( array( 'post_type' => 'radplapag_station', 'post_status' => 'any', 'numberposts' => -1, 'orderby' => 'menu_order ID', 'order' => 'ASC' ) ) as $s ) {
			$meta = $this->meta( $s->ID, 'radplapag_station_' );
			if ( isset( $meta['radplapag_station_player_page'] ) ) {
				$meta['radplapag_station_player_page'] = isset( $page_names[ $meta['radplapag_station_player_page'] ] ) ? $page_names[ $meta['radplapag_station_player_page'] ] : $meta['radplapag_station_player_page'];
			}
			if ( isset( $meta['radplapag_station_schedule'] ) ) {
				$meta['radplapag_station_schedule'] = preg_replace_callback(
					'/"program_id":(\d+)/',
					function ( $m ) use ( $program_names ) {
						return '"program_id":"' . ( isset( $program_names[ $m[1] ] ) ? $program_names[ $m[1] ] : $m[1] ) . '"';
					},
					$meta['radplapag_station_schedule']
				);
			}
			$stations[] = array(
				'title'      => $s->post_title,
				'status'     => $s->post_status,
				'menu_order' => $s->menu_order,
				'meta'       => $meta,
			);
		}
		$settings = get_option( 'radplapag_settings', '{{ABSENT}}' );
		if ( is_array( $settings ) && isset( $settings['player_page'], $page_names[ $settings['player_page'] ] ) ) {
			$settings['player_page'] = $page_names[ $settings['player_page'] ];
		}
		return array(
			'stations' => $stations,
			'programs' => $programs,
			'options'  => array(
				'radplapag_settings'   => $settings,
				'radplapag_db_version' => get_option( 'radplapag_db_version', '{{ABSENT}}' ),
				'radplapag_migration_skipped_cpt_conflict' => get_option( 'radplapag_migration_skipped_cpt_conflict', '{{ABSENT}}' ),
			),
			'transients' => array(
				'radplapag_migration_success_notice' => get_transient( 'radplapag_migration_success_notice' ),
				'radplapag_migration_error_notice'   => get_transient( 'radplapag_migration_error_notice' ),
			),
		);
	}

	private function meta( $post_id, $prefix ) {
		$out = array();
		foreach ( get_post_meta( $post_id ) as $key => $values ) {
			if ( 0 === strpos( $key, $prefix ) ) {
				$out[ $key ] = $values[0];
			}
		}
		ksort( $out );
		return $out;
	}
}
