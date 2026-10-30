<?php
/**
 * Tests for RadioPlayerPage\Stream\Icecast_Status.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Stream;

use RadioPlayerPage\Stream\Icecast_Status;
use RadioPlayerPage\Tests\Unit\Support\StreamSamples;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * The mounts of an Icecast server, from its status-json.xsl (ADR 0064 §8).
 */
final class IcecastStatusTest extends TestCase {

	/**
	 * One source comes as an object.
	 */
	public function test_one_source() {
		$json = StreamSamples::load( 'icecast244-single-status-json' )['body'];

		$this->assertSame(
			array(
				array(
					'url'  => 'http://radio2.sikhnet.com:8018/autodj',
					'name' => 'SikhNet Radio - Channel 5 - Siri Akhand Path',
					'type' => 'audio/mpeg',
				),
			),
			Icecast_Status::mounts( $json, 'http://radio2.sikhnet.com:8018/status-json.xsl' )
		);
	}

	/**
	 * Several sources come as a list, in order.
	 */
	public function test_several_sources() {
		$json = StreamSamples::load( 'icecast2499-multi-status-json' )['body'];

		$mounts = Icecast_Status::mounts( $json, 'http://as.fm1.be:8000/status-json.xsl' );

		$this->assertSame(
			array( 'http://as.fm1.be:8000/media', 'http://as.fm1.be:8000/rand', 'http://as.fm1.be:8000/vlar1.mp3', 'http://as.fm1.be:8000/wrgm1' ),
			array_column( $mounts, 'url' )
		);
		$this->assertSame( 'Radio Rand', $mounts[1]['name'] );
	}

	/**
	 * Icecast 2.5.0 lists a mount without a source (no server_type): it is left out.
	 */
	public function test_mount_without_a_source_is_left_out() {
		$json = StreamSamples::load( 'icecast250-multi-status-json' )['body'];

		$this->assertSame(
			array( 'http://radiohanzestad.ddns.net:18000/nonstop' ),
			array_column( Icecast_Status::mounts( $json, 'http://radiohanzestad.ddns.net:18000/status-json.xsl' ), 'url' )
		);
	}

	/**
	 * The URL keeps the scheme, host and port that answered, not the server's own hostname.
	 */
	public function test_url_uses_the_host_that_answered() {
		$json = '{"icestats":{"source":{"listenurl":"http://localhost:8000/live?x=1","server_type":"audio/ogg"}}}';

		$this->assertSame(
			array(
				array(
					'url'  => 'https://radio.example/live?x=1',
					'name' => '',
					'type' => 'audio/ogg',
				),
			),
			Icecast_Status::mounts( $json, 'https://radio.example/status-json.xsl' )
		);
	}

	/**
	 * Anything else gives no mounts.
	 *
	 * @dataProvider data_no_mounts
	 *
	 * @param string $json Body.
	 */
	public function test_no_mounts( $json ) {
		$this->assertSame( array(), Icecast_Status::mounts( $json, 'http://radio.example:8000/status-json.xsl' ) );
	}

	/**
	 * Inputs for test_no_mounts().
	 *
	 * @return array<string, array{string}>
	 */
	public function data_no_mounts() {
		return array(
			'SomaFM HTML'        => array( StreamSamples::load( 'somafm-ice1-status-json' )['body'] ),
			'broken JSON'        => array( '{"icestats":' ),
			'no sources'         => array( '{"icestats":{"admin":"x"}}' ),
			'source not a list'  => array( '{"icestats":{"source":"x"}}' ),
			'no listenurl'       => array( '{"icestats":{"source":[{"server_type":"audio/mpeg"},"x"]}}' ),
			'listenurl not http' => array( '{"icestats":{"source":{"listenurl":"x","server_type":"audio/mpeg"}}}' ),
		);
	}

	/**
	 * An unparseable base URL gives no mounts.
	 */
	public function test_bad_base_url() {
		$json = StreamSamples::load( 'icecast244-single-status-json' )['body'];

		$this->assertSame( array(), Icecast_Status::mounts( $json, 'nope' ) );
	}
}
