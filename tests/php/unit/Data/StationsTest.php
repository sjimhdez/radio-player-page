<?php
/**
 * Tests for RadioPlayerPage\Data\Stations.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Data;

use RadioPlayerPage\Data\Stations;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * The station lookups of radplapag_get_station_for_current_page() and
 * radplapag_get_player_pages_assigned_to_other_stations(), as in 3.4.2.
 */
final class StationsTest extends TestCase {

	/**
	 * A station row with a player page and a stream URL.
	 *
	 * @param int   $id          Station ID.
	 * @param mixed $player_page Player page.
	 * @param mixed $stream_url  Stream URL.
	 * @return array<string, mixed>
	 */
	private static function station( int $id, $player_page, $stream_url = 'https://example.com/live.mp3' ): array {
		return array(
			'id'          => $id,
			'stream_url'  => $stream_url,
			'player_page' => $player_page,
		);
	}

	/**
	 * The station whose player page is the page is returned as is.
	 */
	public function test_for_page_returns_the_matching_station() {
		$match = self::station( 2, 20 ) + array( 'station_title' => 'Two' );

		$this->assertSame( $match, Stations::for_page( array( self::station( 1, 10 ), $match ), 20 ) );
	}

	/**
	 * When two stations share the page, the first one in list order wins.
	 */
	public function test_for_page_first_match_wins() {
		$stations = array( self::station( 1, 10 ), self::station( 2, 10 ) );

		$this->assertSame( 1, Stations::for_page( $stations, 10 )['id'] );
	}

	/**
	 * A station with an empty stream URL is skipped, and the next one can match.
	 *
	 * @dataProvider data_empty_stream_url
	 *
	 * @param mixed $stream_url Stream URL that empty() rejects.
	 */
	public function test_for_page_skips_empty_stream_url( $stream_url ) {
		$this->assertFalse( Stations::for_page( array( self::station( 1, 10, $stream_url ) ), 10 ) );
		$this->assertSame( 2, Stations::for_page( array( self::station( 1, 10, $stream_url ), self::station( 2, 10 ) ), 10 )['id'] );
	}

	/**
	 * Inputs for test_for_page_skips_empty_stream_url().
	 *
	 * @return array<string, array{mixed}>
	 */
	public function data_empty_stream_url() {
		return array(
			'empty string' => array( '' ),
			'zero string'  => array( '0' ),
			'null'         => array( null ),
		);
	}

	/**
	 * The player page is compared with intval().
	 */
	public function test_for_page_casts_the_player_page() {
		$this->assertSame( 1, Stations::for_page( array( self::station( 1, '10' ) ), 10 )['id'] );
		$this->assertSame( 1, Stations::for_page( array( self::station( 1, '10abc' ) ), 10 )['id'] );
	}

	/**
	 * Page 0 or less (nothing queried) never matches, not even a station without a page (K24).
	 */
	public function test_for_page_zero_matches_nothing() {
		$stations = array( self::station( 1, 10 ), self::station( 2, 0 ), self::station( 3, -1 ) );

		$this->assertFalse( Stations::for_page( $stations, 0 ) );
		$this->assertFalse( Stations::for_page( $stations, -1 ) );
	}

	/**
	 * Rows without a player page or stream URL key, or that are not arrays, are skipped.
	 */
	public function test_for_page_skips_incomplete_rows() {
		$stations = array(
			'not a row',
			array( 'stream_url' => 'https://example.com/live.mp3' ),
			array( 'player_page' => 10 ),
			array(
				'player_page' => null,
				'stream_url'  => 'https://example.com/live.mp3',
			),
		);

		$this->assertFalse( Stations::for_page( $stations, 10 ) );
		$this->assertFalse( Stations::for_page( $stations, 0 ) );
	}

	/**
	 * Without stations, or on another page, nothing matches.
	 */
	public function test_for_page_without_match() {
		$this->assertFalse( Stations::for_page( array(), 10 ) );
		$this->assertFalse( Stations::for_page( array( self::station( 1, 10 ) ), 11 ) );
	}

	/**
	 * The pages are unique, in first-seen order, without empty ones.
	 */
	public function test_player_pages_unique_and_not_empty() {
		$pages = array(
			3 => '30',
			4 => '',
			5 => 10,
			6 => '30',
			7 => 0,
			8 => '-2',
			9 => '20abc',
		);

		$this->assertSame( array( 30, 10, 20 ), Stations::player_pages( $pages, 0 ) );
	}

	/**
	 * The page of the excluded station is left out, but the same page of another station is kept.
	 */
	public function test_player_pages_excludes_the_station() {
		$this->assertSame(
			array( 20 ),
			Stations::player_pages(
				array(
					3 => 10,
					4 => 20,
				),
				3
			)
		);
		$this->assertSame(
			array( 10 ),
			Stations::player_pages(
				array(
					3 => 10,
					4 => 10,
				),
				3
			)
		);
	}

	/**
	 * An exclude of 0 or less excludes nothing.
	 */
	public function test_player_pages_without_exclude() {
		$this->assertSame(
			array( 10, 20 ),
			Stations::player_pages(
				array(
					3 => 10,
					4 => 20,
				),
				0
			)
		);
		$this->assertSame( array( 10 ), Stations::player_pages( array( 0 => 10 ), 0 ) );
		$this->assertSame( array( 10 ), Stations::player_pages( array( -1 => 10 ), -1 ) );
	}

	/**
	 * Without stations, or with an unknown exclude, the list is plain.
	 */
	public function test_player_pages_edge_cases() {
		$this->assertSame( array(), Stations::player_pages( array(), 123 ) );
		$this->assertSame( array( 10 ), Stations::player_pages( array( 3 => 10 ), 123 ) );
	}

	/**
	 * With a station ID, the block index is the position of the row with that ID, whatever the stored index (K46).
	 */
	public function test_block_index_finds_the_station_id() {
		$rows = array( self::station( 7, 10 ), self::station( 3, 20 ), self::station( 5, 30 ) );

		$this->assertSame( 1, Stations::block_index( $rows, 3, 0 ) );
		$this->assertSame( 2, Stations::block_index( $rows, 5, 0 ) );
		$this->assertSame( 0, Stations::block_index( $rows, 7, 2 ) );
	}

	/**
	 * A station ID that is not in the list gives -1, never the stored index (K46).
	 */
	public function test_block_index_missing_station_id() {
		$rows = array( self::station( 7, 10 ), self::station( 3, 20 ) );

		$this->assertSame( -1, Stations::block_index( $rows, 4, 1 ) );
		$this->assertSame( -1, Stations::block_index( array(), 4, 0 ) );
	}

	/**
	 * A station ID of 0 or less falls back to the stored index, as is (D1).
	 */
	public function test_block_index_without_station_id_uses_the_index() {
		$rows = array( self::station( 7, 10 ), self::station( 3, 20 ) );

		$this->assertSame( 1, Stations::block_index( $rows, 0, 1 ) );
		$this->assertSame( 999, Stations::block_index( $rows, 0, 999 ) );
		$this->assertSame( 1, Stations::block_index( $rows, -3, 1 ) );
	}

	/**
	 * Row IDs are compared with (int), and rows without an ID or that are not arrays keep their position.
	 */
	public function test_block_index_casts_ids_and_skips_incomplete_rows() {
		$rows = array(
			'not a row',
			array( 'stream_url' => 'https://example.com/live.mp3' ),
			array( 'id' => '3' ),
			self::station( 5, 30 ),
		);

		$this->assertSame( 2, Stations::block_index( $rows, 3, 0 ) );
		$this->assertSame( 3, Stations::block_index( $rows, 5, 0 ) );
	}
}
