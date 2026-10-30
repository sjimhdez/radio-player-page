<?php
/**
 * Tests for RadioPlayerPage\Stream\Playlist_Parser.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Stream;

use RadioPlayerPage\Stream\Playlist_Parser;
use RadioPlayerPage\Tests\Unit\Support\StreamSamples;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * The streams a playlist proposes (ADR 0064 §8; spike proposal 4).
 */
final class PlaylistParserTest extends TestCase {

	/**
	 * Streams and notes of the real playlists.
	 *
	 * @dataProvider data_samples
	 *
	 * @param string       $name    Sample name.
	 * @param list<string> $streams Expected streams.
	 * @param list<string> $notes   Expected notes.
	 */
	public function test_real_playlists( $name, $streams, $notes ) {
		$result = Playlist_Parser::parse( StreamSamples::load( $name )['body'] );

		$this->assertSame(
			array(
				'streams' => $streams,
				'notes'   => $notes,
			),
			$result
		);
	}

	/**
	 * Inputs for test_real_playlists().
	 *
	 * @return array<string, array{string, list<string>, list<string>}>
	 */
	public function data_samples() {
		return array(
			'SomaFM .pls, three mirrors'  => array( 'somafm-groovesalad.pls', array( 'https://ice2.somafm.com/groovesalad-128-mp3' ), array( 'playlist-mirrors' ) ),
			'StreamTheWorld, 34 edges'    => array( 'streamtheworld-provisioning.pls', array( 'http://28933.live.streamtheworld.com:80/VIRGIN_RADIO_SC' ), array( 'playlist-mirrors' ) ),
			'AzuraCast with a private IP' => array( 'azuracast-public.pls', array(), array( 'playlist-private-entry' ) ),
			'Live365 #EXTM3U'             => array( 'live365-station-site.m3u', array( 'http://streaming.live365.com/b48071_128mp3' ), array() ),
			'Radio Paradise bare line'    => array( 'rp-128.m3u', array( 'http://stream.radioparadise.com/mp3-128' ), array() ),
			'Securenet https on port 80'  => array( 'securenet.m3u', array( 'https://ice6.securenetsystems.net:80/WPSBLP' ), array() ),
		);
	}

	/**
	 * Different streams are all proposed, in order and without repeats.
	 */
	public function test_different_streams_without_repeats() {
		$body = "[playlist]\r\nFile1=http://a.example/high\r\nFile2=http://a.example/low\r\nfile3=http://a.example/high\r\nFile4=rtsp://a.example/x\r\nFile5=relative.mp3\r\n";

		$this->assertSame(
			array(
				'streams' => array( 'http://a.example/high', 'http://a.example/low' ),
				'notes'   => array(),
			),
			Playlist_Parser::parse( $body )
		);
	}

	/**
	 * XSPF locations, with their XML entities.
	 */
	public function test_xspf() {
		$body = '<?xml version="1.0" encoding="UTF-8"?><playlist version="1" xmlns="http://xspf.org/ns/0/"><trackList>'
			. '<track><location>http://a.example/live.mp3?a=1&amp;b=2</location></track>'
			. '<track><location> https://b.example/live.ogg </location></track>'
			. '</trackList></playlist>';

		$this->assertSame(
			array( 'http://a.example/live.mp3?a=1&b=2', 'https://b.example/live.ogg' ),
			Playlist_Parser::parse( $body )['streams']
		);
	}

	/**
	 * A private entry is dropped and the public one is kept; mirrors need two entries.
	 */
	public function test_private_entry_beside_a_public_one() {
		$body = "#EXTM3U\n#EXTINF:-1,Radio\nhttp://localhost:8000/live\nhttp://radio.example/live\n";

		$this->assertSame(
			array(
				'streams' => array( 'http://radio.example/live' ),
				'notes'   => array( 'playlist-private-entry' ),
			),
			Playlist_Parser::parse( $body )
		);
	}

	/**
	 * Something that is not a playlist proposes nothing.
	 */
	public function test_not_a_playlist() {
		$this->assertSame(
			array(
				'streams' => array(),
				'notes'   => array(),
			),
			Playlist_Parser::parse( '<html>' )
		);
	}
}
