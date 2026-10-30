<?php
/**
 * Tests for RadioPlayerPage\Stream\Response_Classifier.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Stream;

use RadioPlayerPage\Stream\Response_Classifier;
use RadioPlayerPage\Tests\Unit\Support\StreamSamples;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * What a stream server answered, from its status, headers and first bytes (ADR 0064 §7).
 */
final class ResponseClassifierTest extends TestCase {

	const ORIGIN = 'https://example.com';

	/**
	 * Kind of each real sample.
	 */
	const SAMPLE_KINDS = array(
		'airtime-root'                         => 'icecast-page',
		'airtime-stream'                       => 'audio',
		'azuracast-public-page'                => 'html',
		'azuracast-public.pls'                 => 'playlist',
		'azuracast-status-json-origin'         => 'html',
		'azuracast-stream'                     => 'audio',
		'azuracast-stream-origin'              => 'audio',
		'bbc-hls.m3u8'                         => 'hls',
		'bbc-icecast'                          => 'audio',
		'centova-proxy-7html'                  => 'html',
		'centova-proxy-stats-json'             => 'html',
		'centova-proxy-status-json'            => 'audio',
		'centova-proxy-stream'                 => 'audio',
		'centova-torontocast-7html'            => 'html',
		'centova-torontocast-currentsong'      => 'html',
		'centova-torontocast-root'             => 'shoutcast-page',
		'centova-torontocast-stats-json'       => 'html',
		'centova-torontocast-status-json'      => 'audio',
		'centova-torontocast-stream'           => 'audio',
		'everestcast-status-json-origin'       => 'icecast-page',
		'everestcast-stream'                   => 'audio',
		'fip.m3u8'                             => 'hls',
		'icecast244-single-root'               => 'icecast-page',
		'icecast244-single-status-json'        => 'icecast-page',
		'icecast244-single-status-json-origin' => 'icecast-page',
		'icecast2499-multi-root'               => 'icecast-page',
		'icecast2499-multi-status-json'        => 'icecast-page',
		'icecast2499-multi-status-json-origin' => 'icecast-page',
		'icecast250-multi-root'                => 'icecast-page',
		'icecast250-multi-status-json'         => 'icecast-page',
		'icecast250-multi-status-json-origin'  => 'icecast-page',
		'live365-station-site.m3u'             => 'playlist',
		'live365-stream'                       => 'audio',
		'radioco-stream'                       => 'audio',
		'radiofrance-icecast-aac'              => 'audio',
		'radioking-stream'                     => 'audio',
		'rp-128.m3u'                           => 'playlist',
		'rp-mp3-128'                           => 'audio',
		'securenet.m3u'                        => 'playlist',
		'shoutcast-radio24-7html'              => 'html',
		'shoutcast-radio24-currentsong'        => 'html',
		'shoutcast-radio24-root-browser'       => 'shoutcast-page',
		'shoutcast-radio24-root-wp'            => 'audio',
		'shoutcast-radio24-semicolon'          => 'audio',
		'shoutcast-radio24-stats-json'         => 'html',
		'shoutcastcom-stream'                  => 'audio',
		'somafm-groovesalad.m3u'               => 'http-error',
		'somafm-groovesalad.pls'               => 'playlist',
		'somafm-groovesalad130.pls'            => 'playlist',
		'somafm-ice1-mount'                    => 'audio',
		'somafm-ice1-root'                     => 'icecast-page',
		'somafm-ice1-status-json'              => 'icecast-page',
		'somafm-ice1-status-json-origin'       => 'icecast-page',
		'sonicpanel-stream'                    => 'audio',
		'streamguys-npr'                       => 'audio',
		'streamguys-npr-origin'                => 'audio',
		'streamtheworld-provisioning.pls'      => 'playlist',
		'streamtheworld-redirect.mp3'          => 'audio',
		'zeno-stream'                          => 'audio',
		'zeno-stream-origin'                   => 'audio',
	);

	/**
	 * Every real sample has its expected kind.
	 *
	 * @dataProvider data_samples
	 *
	 * @param string $name Sample name.
	 * @param string $kind Expected kind.
	 */
	public function test_real_sample_kind( $name, $kind ) {
		$sample = StreamSamples::load( $name );

		$result = Response_Classifier::classify( $sample['status'], $sample['headers'], $sample['body'], self::ORIGIN );

		$this->assertSame( $kind, $result['kind'] );
	}

	/**
	 * Inputs for test_real_sample_kind().
	 *
	 * @return array<string, array{string, string}>
	 */
	public function data_samples() {
		$data = array();
		foreach ( self::SAMPLE_KINDS as $name => $kind ) {
			$data[ $name ] = array( $name, $kind );
		}
		return $data;
	}

	/**
	 * The table covers every sample in tests/fixtures/streams/.
	 */
	public function test_every_sample_has_a_kind() {
		$this->assertSame( StreamSamples::names(), array_keys( self::SAMPLE_KINDS ) );
	}

	/**
	 * CORS from Access-Control-Allow-Origin, as the sample servers answer.
	 *
	 * @dataProvider data_cors
	 *
	 * @param string    $name     Sample name.
	 * @param bool|null $expected Expected cors.
	 */
	public function test_cors_of_real_samples( $name, $expected ) {
		$sample = StreamSamples::load( $name );

		$result = Response_Classifier::classify( $sample['status'], $sample['headers'], $sample['body'], self::ORIGIN );

		$this->assertSame( $expected, $result['cors'] );
	}

	/**
	 * Inputs for test_cors_of_real_samples().
	 *
	 * @return array<string, array{string, bool}>
	 */
	public function data_cors() {
		return array(
			'any origin'              => array( 'somafm-groovesalad.pls', true ),
			'echoes the origin'       => array( 'azuracast-stream-origin', true ),
			'without Origin, nothing' => array( 'zeno-stream', false ),
		);
	}

	/**
	 * CORS for another origin, an empty header list and a trailing slash.
	 */
	public function test_cors_edge_cases() {
		$audio = array( 'content-type' => 'audio/mpeg' );

		$this->assertFalse( Response_Classifier::classify( 200, $audio + array( 'access-control-allow-origin' => 'https://other.example' ), '', self::ORIGIN )['cors'] );
		$this->assertTrue( Response_Classifier::classify( 200, $audio + array( 'access-control-allow-origin' => 'HTTPS://Example.com/' ), '', self::ORIGIN )['cors'] );
		$this->assertNull( Response_Classifier::classify( 0, array(), "ID3\x04", self::ORIGIN )['cors'] );
	}

	/**
	 * Without headers (the streams transport cut), the bytes decide.
	 *
	 * @dataProvider data_bytes
	 *
	 * @param string $body Body.
	 * @param string $kind Expected kind.
	 */
	public function test_kind_from_bytes_only( $body, $kind ) {
		$this->assertSame( $kind, Response_Classifier::classify( 0, array(), $body, self::ORIGIN )['kind'] );
	}

	/**
	 * Inputs for test_kind_from_bytes_only().
	 *
	 * @return array<string, array{string, string}>
	 */
	public function data_bytes() {
		return array(
			'ID3'          => array( "ID3\x04\x00", 'audio' ),
			'MPEG sync'    => array( "\xFF\xFB\x90\x64", 'audio' ),
			'ADTS'         => array( "\xFF\xF1\x50\x80", 'audio' ),
			'Ogg'          => array( "OggS\x00\x02", 'audio' ),
			'FLAC'         => array( "fLaC\x00", 'audio' ),
			'DASH'         => array( "<?xml version=\"1.0\"?>\n<MPD xmlns=\"urn:mpeg:dash:schema:mpd:2011\">", 'dash' ),
			'XSPF'         => array( "<?xml version=\"1.0\"?>\n<playlist version=\"1\" xmlns=\"http://xspf.org/ns/0/\">", 'playlist' ),
			'BOM and .pls' => array( "\xEF\xBB\xBF\n[Playlist]\nFile1=http://a.example/x", 'playlist' ),
			'HTML'         => array( '<!doctype html><title>Radio</title>', 'html' ),
			'empty'        => array( '', 'html' ),
			'unknown'      => array( "\x00\x01\x02", 'html' ),
		);
	}

	/**
	 * A Shoutcast v1 page and its icy-notice2 header.
	 */
	public function test_shoutcast_v1_page_and_server_note() {
		$v1 = Response_Classifier::classify( 200, array( 'content-type' => 'text/html' ), '<html><head><title>SHOUTcast Administrator</title></head><body>SHOUTcast D.N.A.S. Status</body></html>', self::ORIGIN );
		$this->assertSame( 'shoutcast-page', $v1['kind'] );
		$this->assertSame( array(), $v1['notes'] );

		// The note is for audio at the root only (ADR 0064 §8): not for an error.
		$error = Response_Classifier::classify(
			404,
			array(
				'content-type' => 'text/html',
				'icy-notice2'  => 'SHOUTcast DNAS/posix(linux x64) v2.6.1.777<BR>',
			),
			'<html><body>Not found</body></html>',
			self::ORIGIN
		);
		$this->assertSame( 'http-error', $error['kind'] );
		$this->assertSame( array(), $error['notes'] );

		$sample = StreamSamples::load( 'shoutcast-radio24-root-wp' );
		$audio  = Response_Classifier::classify( $sample['status'], $sample['headers'], $sample['body'], self::ORIGIN );
		$this->assertSame( array( 'shoutcast-server' ), $audio['notes'] );
	}

	/**
	 * Icecast by its title when the Server header is hidden.
	 */
	public function test_icecast_page_by_title() {
		$result = Response_Classifier::classify( 200, array( 'content-type' => 'text/html' ), '<html><head><title>Status — Icecast Server</title>', self::ORIGIN );

		$this->assertSame( 'icecast-page', $result['kind'] );
	}

	/**
	 * Any status from 400 is an HTTP error, whatever the body; a playlist type does not make a 404 one.
	 */
	public function test_http_error_wins() {
		$this->assertSame( 'http-error', Response_Classifier::classify( 503, array( 'content-type' => 'audio/mpeg' ), "ID3\x04", self::ORIGIN )['kind'] );
		$this->assertSame( 'http-error', Response_Classifier::classify( 404, array( 'content-type' => 'audio/x-scpls' ), '[playlist]', self::ORIGIN )['kind'] );
	}

	/**
	 * An audio type with an icy header or ogg, without recognizable bytes.
	 */
	public function test_audio_by_headers() {
		$this->assertSame( 'audio', Response_Classifier::classify( 200, array( 'content-type' => 'application/ogg' ), 'x', self::ORIGIN )['kind'] );
		$this->assertSame( 'audio', Response_Classifier::classify( 200, array( 'icy-name' => 'Radio' ), 'x', self::ORIGIN )['kind'] );
	}

	/**
	 * A playlist type with a body that is not a playlist is not audio.
	 */
	public function test_playlist_type_is_not_audio() {
		$this->assertSame( 'html', Response_Classifier::classify( 200, array( 'content-type' => 'audio/x-mpegurl' ), 'not a list', self::ORIGIN )['kind'] );
	}
}
