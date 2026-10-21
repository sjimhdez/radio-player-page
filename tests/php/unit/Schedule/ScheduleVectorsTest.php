<?php
/**
 * The shared schedule vectors against the pure core.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Schedule;

use DateTimeImmutable;
use DateTimeZone;
use RadioPlayerPage\Schedule\Now_Playing_Resolver;
use RadioPlayerPage\Schedule\Slot_Validator;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * Runs tests/fixtures/schedule-vectors.json against RadioPlayerPage\Schedule: the
 * `resolution` vectors (top-level, PHP result) and the `validation` vectors (layer `php`).
 */
final class ScheduleVectorsTest extends TestCase {

	/**
	 * Schedule day keys, Monday to Sunday.
	 */
	const DAYS = array( 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday' );

	/**
	 * The upcoming window the vectors assume (RADPLAPAG_NOW_PLAYING_UPCOMING_WINDOW_MINUTES).
	 */
	const WINDOW = 10;

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
	 * The `resolution` vectors whose 3.4.2 result is the correct one, by ID.
	 *
	 * @return array<string, array{array<string, mixed>}>
	 */
	public function resolution_vectors() {
		return self::resolution_vectors_where( false );
	}

	/**
	 * The `resolution` vectors whose 3.4.2 result is wrong (`currently`), by ID.
	 *
	 * @return array<string, array{array<string, mixed>}>
	 */
	public function currently_resolution_vectors() {
		return self::resolution_vectors_where( true );
	}

	/**
	 * The `resolution` vectors with the given `currently` flag, by ID.
	 *
	 * @param bool $currently Whether to return the `currently` vectors.
	 * @return array<string, array{array<string, mixed>}>
	 */
	private static function resolution_vectors_where( $currently ) {
		$out = array();
		foreach ( self::vectors()['resolution'] as $vector ) {
			if ( ! empty( $vector['currently'] ) === $currently ) {
				$out[ $vector['id'] ] = array( $vector );
			}
		}

		return $out;
	}

	/**
	 * Each vector gives its PHP result at its local day and minute.
	 *
	 * @dataProvider resolution_vectors
	 *
	 * @param array<string, mixed> $vector A `resolution` vector.
	 */
	public function test_resolution_vector( array $vector ) {
		$this->assert_resolution( $vector );
	}

	/**
	 * C16: a slot that crosses midnight counts as active in the early morning of its
	 * own day and hides the previous day's slot (vectors 13, 14 and C3-4).
	 *
	 * @see docs/known-issues.md C16
	 *
	 * @dataProvider currently_resolution_vectors
	 *
	 * @param array<string, mixed> $vector A `resolution` vector with `currently`.
	 */
	public function test_currently_midnight_slot_is_active_early_on_its_own_day( array $vector ) {
		$this->assertSame( 'C16', $vector['issue'] );
		$this->assertNotEquals(
			array( $vector['current'], $vector['upcoming'] ),
			array( $vector['correct']['current'], $vector['correct']['upcoming'] ),
			'A currently vector must differ from its correct result.'
		);

		$this->assert_resolution( $vector );
	}

	/**
	 * Resolves the vector's grid at its day and minute (in the week of Monday
	 * 2026-10-19, UTC) and compares with its top-level `current` and `upcoming`.
	 *
	 * @param array<string, mixed> $vector A `resolution` vector.
	 */
	private function assert_resolution( array $vector ) {
		$this->assertArrayHasKey( 'current', $vector, 'Vector without a PHP result.' );
		$this->assertArrayHasKey( 'upcoming', $vector, 'Vector without a PHP result.' );

		$programs = array();
		foreach ( self::program_ids() as $key => $id ) {
			$programs[ $id ] = array(
				'name'    => $key,
				'logo_id' => 0,
			);
		}
		$schedule = array();
		foreach ( self::vectors()['grids'][ $vector['grid'] ] as $day => $slots ) {
			foreach ( $slots as $slot ) {
				$schedule[ $day ][] = array(
					'program_id' => $this->program_id( $slot['program'] ),
					'start'      => $slot['start'],
					'end'        => $slot['end'],
					'is_rerun'   => $slot['is_rerun'],
				);
			}
		}
		$offset = array_search( $vector['now']['day'], self::DAYS, true );
		$now    = new DateTimeImmutable( sprintf( '2026-10-%02d %s:00', 19 + $offset, $vector['now']['time'] ), new DateTimeZone( 'UTC' ) );

		$result = Now_Playing_Resolver::resolve( $schedule, $programs, self::day_labels(), $now, self::WINDOW );

		$this->assertSame( $this->to_expected_entry( $vector['current'], true ), $result['current'], 'current' );
		$this->assertSame( $this->to_expected_entry( $vector['upcoming'], false ), $result['upcoming'], 'upcoming' );
	}

	/**
	 * Vector `current`/`upcoming` → the resolver's entry. Vector programs have no
	 * logo; `upcoming` has no `logo_id` key.
	 *
	 * @param array<string, mixed>|null $entry   Vector entry.
	 * @param bool                      $current Whether the entry is `current`.
	 * @return array<string, mixed>|null
	 */
	private function to_expected_entry( $entry, $current ) {
		if ( null === $entry ) {
			return null;
		}

		$expected = array(
			'id'   => (string) $this->program_id( $entry['program'] ),
			'name' => $entry['program'],
		);
		if ( $current ) {
			$expected['logo_id'] = 0;
		}

		return $expected + array(
			'day_label'  => self::day_labels()[ $entry['day'] ],
			'time_range' => $entry['time_range'],
			'is_rerun'   => $entry['is_rerun'],
		);
	}

	/**
	 * Day key → label, as the wrapper passes the translated ones.
	 *
	 * @return array<string, string>
	 */
	private static function day_labels() {
		return array_combine( self::DAYS, array_map( 'ucfirst', self::DAYS ) );
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
		foreach ( self::DAYS as $day ) {
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
