<?php
/**
 * Tests of the schedule globals of the clean page printed by
 * radplapag_output_clean_page().
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Station;

use RadioPlayerPage\Tests\Integration\Support\Factory;
use RuntimeException;
use WP_UnitTestCase;

/**
 * Pins that the slot of a program deleted for good stays off RADPLAPAG_SCHEDULE and
 * RADPLAPAG_PROGRAMS (K106, ADR 0062; the rule of ADR 0045).
 *
 * The clean page ends in exit, so the first URL escaped after the globals throws to
 * stop it first.
 */
final class CleanPageScheduleTest extends WP_UnitTestCase {

	const STREAM = 'https://stream.example.com/live.mp3';

	/**
	 * Only the slot of the published program is printed.
	 */
	public function test_slot_of_a_deleted_program_is_not_printed() {
		$factory   = new Factory();
		$page      = $factory->page( 'Player' );
		$deleted   = $factory->program( 'Gone' );
		$published = $factory->program( 'Morning Show' );
		$factory->station(
			'Station',
			array(
				'stream_url'  => self::STREAM,
				'player_page' => $page,
				'schedule'    => array(
					'monday' => array(
						array(
							'program_id' => $deleted,
							'start'      => '06:00',
							'end'        => '07:00',
						),
						array(
							'program_id' => $published,
							'start'      => '07:00',
							'end'        => '10:00',
						),
					),
				),
			)
		);
		wp_delete_post( $deleted, true );
		$this->go_to( get_permalink( $page ) );

		$html = $this->clean_page_head();

		$this->assertSame(
			array(
				'monday' => array(
					array(
						'program_id' => (string) $published,
						'start'      => '07:00',
						'end'        => '10:00',
						'is_rerun'   => false,
					),
				),
			),
			$this->global_value( $html, 'RADPLAPAG_SCHEDULE' )
		);
		$this->assertSame( array( (string) $published ), array_column( $this->global_value( $html, 'RADPLAPAG_PROGRAMS' ), 'id' ) );
	}

	/**
	 * Output of the clean page up to the first URL escaped after the globals.
	 *
	 * @return string
	 */
	private function clean_page_head() {
		add_filter(
			'clean_url',
			static function ( $url ) {
				if ( false !== strpos( (string) ob_get_contents(), 'window.RADPLAPAG_SCHEDULE' ) ) {
					throw new RuntimeException( 'Clean page stopped before exit.' );
				}
				return $url;
			}
		);

		ob_start();
		try {
			radplapag_output_clean_page();
		} catch ( RuntimeException $e ) {
			unset( $e );
		}

		return (string) ob_get_clean();
	}

	/**
	 * Decoded value of a window.RADPLAPAG_* global of the page.
	 *
	 * @param string $html Page output.
	 * @param string $name Global name.
	 * @return mixed
	 */
	private function global_value( $html, $name ) {
		$this->assertSame( 1, preg_match( '/window\.' . $name . ' = (.*?);(?:window\.|<\/script>)/', $html, $m ), $name );

		return json_decode( $m[1], true );
	}
}
