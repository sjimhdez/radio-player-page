<?php
/**
 * The shared schedule vectors against the pure core.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Schedule;

use RadioPlayerPage\Schedule\Slot_Validator;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * Runs tests/fixtures/schedule-vectors.json against RadioPlayerPage\Schedule: the
 * `validation` vectors (layer `php`).
 */
final class ScheduleVectorsTest extends TestCase {

	/**
	 * The shared vectors file.
	 *
	 * @return array<string, mixed>
	 */
	private static function vectors() {
		static $vectors = null;
		if ( null === $vectors ) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local fixture.
			$vectors = json_decode( (string) file_get_contents( RADPLAPAG_TESTS_PLUGIN_DIR . '/tests/fixtures/schedule-vectors.json' ), true );
		}

		return $vectors;
	}

	/**
	 * Vector program key → program ID (1, 2, …), as the names map is keyed.
	 *
	 * @return array<string, int>
	 */
	private static function program_ids() {
		$ids = array();
		foreach ( self::vectors()['programs'] as $i => $key ) {
			$ids[ $key ] = $i + 1;
		}

		return $ids;
	}

	/**
	 * The `validation` vectors, by ID.
	 *
	 * @return array<string, array{array<string, mixed>}>
	 */
	public function validation_vectors() {
		$out = array();
		foreach ( self::vectors()['validation'] as $vector ) {
			$out[ $vector['id'] ] = array( $vector );
		}

		return $out;
	}

	/**
	 * Each vector gives its PHP result. A valid schedule comes back with every row,
	 * ordered by start, `is_rerun` as a boolean; an invalid one starts with its error.
	 *
	 * @dataProvider validation_vectors
	 *
	 * @param array<string, mixed> $vector A `validation` vector.
	 */
	public function test_validation_vector( array $vector ) {
		$this->assertArrayHasKey( 'php', $vector, 'Vector without a PHP result.' );

		$schedule = is_string( $vector['schedule'] ) ? self::vectors()['grids'][ $vector['schedule'] ] : $vector['schedule'];
		$result   = Slot_Validator::validate( $this->to_input( $schedule ), array_flip( self::program_ids() ) );

		if ( $vector['php']['valid'] ) {
			$this->assertSame( array(), $result['errors'] );
			$this->assertSame( $this->to_expected_output( $schedule ), $result['schedule'] );
			return;
		}

		$this->assertNotEmpty( $result['errors'] );
		$this->assertSame( $vector['php']['error'], $result['errors'][0]['code'] );
	}

	/**
	 * Vector schedule → raw input, as the meta box posts it.
	 *
	 * @param array<string, list<array<string, mixed>>> $schedule Vector schedule (day → rows with `program`).
	 * @return array<string, list<array<string, string>>>
	 */
	private function to_input( array $schedule ) {
		$input = array();
		foreach ( $schedule as $day => $rows ) {
			foreach ( $rows as $row ) {
				$raw = array(
					'program_id' => (string) $this->program_id( $row['program'] ),
					'start'      => $row['start'],
					'end'        => $row['end'],
				);
				if ( ! empty( $row['is_rerun'] ) ) {
					$raw['is_rerun'] = '1';
				}
				$input[ $day ][] = $raw;
			}
		}

		return $input;
	}

	/**
	 * Vector schedule → sanitized output: days Monday → Sunday, rows by start.
	 *
	 * @param array<string, list<array<string, mixed>>> $schedule Vector schedule.
	 * @return array<string, list<array<string, mixed>>>
	 */
	private function to_expected_output( array $schedule ) {
		$out = array();
		foreach ( array( 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday' ) as $day ) {
			if ( empty( $schedule[ $day ] ) ) {
				continue;
			}
			$rows = $schedule[ $day ];
			usort(
				$rows,
				function ( $a, $b ) {
					return strcmp( $a['start'], $b['start'] );
				}
			);
			foreach ( $rows as $row ) {
				$out[ $day ][] = array(
					'program_id' => $this->program_id( $row['program'] ),
					'start'      => $row['start'],
					'end'        => $row['end'],
					'is_rerun'   => ! empty( $row['is_rerun'] ),
				);
			}
		}

		return $out;
	}

	/**
	 * Program ID of a vector program key (a missing key is an ID out of the names map).
	 *
	 * @param string $program Vector program key.
	 * @return int
	 */
	private function program_id( $program ) {
		$ids = self::program_ids();

		return isset( $ids[ $program ] ) ? $ids[ $program ] : 987654321;
	}
}
