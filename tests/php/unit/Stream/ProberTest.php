<?php
/**
 * Tests for RadioPlayerPage\Stream\Prober.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Stream;

use RadioPlayerPage\Stream\Prober;
use RadioPlayerPage\Tests\Unit\Support\StreamSamples;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * The steps of the server probe and its report (ADR 0064 §2 and §8).
 */
final class ProberTest extends TestCase {

	const SITE = 'https://example.com/';

	/**
	 * URLs requested by the fake fetch, in order.
	 *
	 * @var list<string>
	 */
	private $requested = array();

	/**
	 * A stream gives its kind, status and CORS, with one request.
	 */
	public function test_audio() {
		$report = $this->probe( 'https://radio.example/live', array( 'https://radio.example/live' => 'azuracast-stream-origin' ) );

		$this->assertSame(
			array(
				'kind'    => 'audio',
				'status'  => 200,
				'cors'    => true,
				'streams' => array(),
				'mounts'  => array(),
				'variant' => null,
				'notes'   => array(),
			),
			$report
		);
		$this->assertSame( array( 'https://radio.example/live' ), $this->requested );
	}

	/**
	 * A playlist proposes its streams, with its notes.
	 */
	public function test_playlist() {
		$report = $this->probe( 'https://somafm.example/groovesalad.pls', array( 'https://somafm.example/groovesalad.pls' => 'somafm-groovesalad.pls' ) );

		$this->assertSame( 'playlist', $report['kind'] );
		$this->assertSame( array( 'https://ice2.somafm.com/groovesalad-128-mp3' ), $report['streams'] );
		$this->assertSame( array( 'playlist-mirrors' ), $report['notes'] );
	}

	/**
	 * An Icecast page reads status-json.xsl on the same host and port.
	 */
	public function test_icecast_page_reads_the_mounts() {
		$report = $this->probe(
			'https://as.example:8000/',
			array(
				'https://as.example:8000/'                => 'icecast2499-multi-root',
				'https://as.example:8000/status-json.xsl' => 'icecast2499-multi-status-json',
			)
		);

		$this->assertSame( 'icecast-page', $report['kind'] );
		$this->assertSame( 'https://as.example:8000/media', $report['mounts'][0]['url'] );
		$this->assertCount( 4, $report['mounts'] );
		$this->assertSame( array( 'https://as.example:8000/', 'https://as.example:8000/status-json.xsl' ), $this->requested );
	}

	/**
	 * When status-json.xsl itself was written, its body gives the mounts without asking again.
	 */
	public function test_status_json_written_is_not_requested_twice() {
		$report = $this->probe( 'https://as.example:8000/status-json.xsl', array( 'https://as.example:8000/status-json.xsl' => 'icecast2499-multi-status-json' ) );

		$this->assertCount( 4, $report['mounts'] );
		$this->assertSame( array( 'https://as.example:8000/status-json.xsl' ), $this->requested );
	}

	/**
	 * A failed status-json.xsl leaves the mounts empty.
	 *
	 * @dataProvider data_status_failures
	 *
	 * @param string|array{error: string} $answer Sample name or error.
	 */
	public function test_status_json_failure( $answer ) {
		$report = $this->probe(
			'https://as.example:8000/',
			array(
				'https://as.example:8000/'                => 'icecast2499-multi-root',
				'https://as.example:8000/status-json.xsl' => $answer,
			)
		);

		$this->assertSame( 'icecast-page', $report['kind'] );
		$this->assertSame( array(), $report['mounts'] );
	}

	/**
	 * Inputs for test_status_json_failure().
	 *
	 * @return array<string, array{string|array{error: string}}>
	 */
	public function data_status_failures() {
		return array(
			'404'         => array( 'somafm-groovesalad.m3u' ),
			'unreachable' => array( array( 'error' => 'unreachable' ) ),
		);
	}

	/**
	 * A Shoutcast page proposes /; and /stream without requesting them.
	 */
	public function test_shoutcast_page() {
		$report = $this->probe( 'https://sc.example:8000/', array( 'https://sc.example:8000/' => 'shoutcast-radio24-root-browser' ) );

		$this->assertSame( 'shoutcast-page', $report['kind'] );
		$this->assertSame( array( 'https://sc.example:8000/;', 'https://sc.example:8000/stream' ), $report['streams'] );
		$this->assertSame( array( 'https://sc.example:8000/' ), $this->requested );
	}

	/**
	 * An error gives its kind and nothing else.
	 */
	public function test_error() {
		$report = $this->probe( 'https://down.example/live', array( 'https://down.example/live' => array( 'error' => 'blocked' ) ) );

		$this->assertSame(
			array(
				'kind'    => 'blocked',
				'status'  => null,
				'cors'    => null,
				'streams' => array(),
				'mounts'  => array(),
				'variant' => null,
				'notes'   => array(),
			),
			$report
		);
	}

	/**
	 * An http stream on an https site also tries its https variant.
	 */
	public function test_https_variant_on_an_https_site() {
		$report = $this->probe(
			'http://radio.example/live',
			array(
				'http://radio.example/live'  => 'streamguys-npr',
				'https://radio.example/live' => 'streamguys-npr-origin',
			)
		);

		$this->assertSame(
			array(
				'url'    => 'https://radio.example/live',
				'kind'   => 'audio',
				'status' => 200,
			),
			$report['variant']
		);
	}

	/**
	 * The variant is tried even when the http URL fails, and reports its own failure.
	 */
	public function test_https_variant_after_a_failure() {
		$report = $this->probe(
			'http://radio.example:8000/live',
			array(
				'http://radio.example:8000/live'  => array( 'error' => 'unreachable' ),
				'https://radio.example:8000/live' => array( 'error' => 'unreachable' ),
			)
		);

		$this->assertSame( 'unreachable', $report['kind'] );
		$this->assertSame(
			array(
				'url'    => 'https://radio.example:8000/live',
				'kind'   => 'unreachable',
				'status' => null,
			),
			$report['variant']
		);
	}

	/**
	 * An http site, or an https stream, does not try any variant.
	 */
	public function test_no_variant() {
		$answers = array( 'http://radio.example/live' => 'streamguys-npr' );

		$this->assertNull( $this->probe( 'http://radio.example/live', $answers, 'http://example.com/' )['variant'] );
		$this->assertSame( array( 'http://radio.example/live' ), $this->requested );
	}

	/**
	 * The three requests at most: an http Icecast page on an https site.
	 */
	public function test_three_requests_at_most() {
		$this->probe(
			'http://as.example:8000/',
			array(
				'http://as.example:8000/'                => 'icecast2499-multi-root',
				'http://as.example:8000/status-json.xsl' => 'icecast2499-multi-status-json',
				'https://as.example:8000/'               => array( 'error' => 'unreachable' ),
			)
		);

		$this->assertCount( 3, $this->requested );
	}

	/**
	 * A cut without headers (status 0) reports a null status and CORS.
	 */
	public function test_unknown_status() {
		$report = Prober::probe(
			'https://radio.example/live',
			self::SITE,
			static function () {
				return array(
					'status'  => 0,
					'headers' => array(),
					'body'    => "ID3\x04",
				);
			}
		);

		$this->assertSame( 'audio', $report['kind'] );
		$this->assertNull( $report['status'] );
		$this->assertNull( $report['cors'] );
	}

	/**
	 * Runs the prober with a fake fetch.
	 *
	 * @param string                                     $url     URL.
	 * @param array<string, string|array{error: string}> $answers Sample name or error by URL.
	 * @param string                                     $site    Site URL.
	 * @return array<string, mixed>
	 */
	private function probe( $url, array $answers, $site = self::SITE ) {
		$this->requested = array();
		return Prober::probe(
			$url,
			$site,
			function ( $requested ) use ( $answers ) {
				$this->requested[] = $requested;
				$this->assertArrayHasKey( $requested, $answers );
				$answer = $answers[ $requested ];
				return is_array( $answer ) ? $answer : StreamSamples::load( $answer );
			}
		);
	}
}
