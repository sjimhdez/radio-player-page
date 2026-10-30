<?php
/**
 * Tests for RadioPlayerPage\Stream\Url_Variants.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Stream;

use RadioPlayerPage\Stream\Url_Variants;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * The URLs the stream probe derives from the one the administrator wrote (ADR 0064).
 */
final class UrlVariantsTest extends TestCase {

	/**
	 * An http(s) URL splits into its parts, with the default port and a lowercase host.
	 *
	 * @dataProvider data_parse
	 *
	 * @param string                    $url      URL.
	 * @param array<string, mixed>|null $expected Parts, or null.
	 */
	public function test_parse( $url, $expected ) {
		$this->assertSame( $expected, Url_Variants::parse( $url ) );
	}

	/**
	 * Inputs for test_parse().
	 *
	 * @return array<string, array{string, array<string, mixed>|null}>
	 */
	public function data_parse() {
		return array(
			'http with port and path' => array(
				'http://Radio.Example.com:8000/live.mp3?x=1#a',
				array(
					'scheme' => 'http',
					'host'   => 'radio.example.com',
					'port'   => 8000,
					'path'   => '/live.mp3',
					'query'  => 'x=1',
				),
			),
			'https without path'      => array(
				'HTTPS://example.com',
				array(
					'scheme' => 'https',
					'host'   => 'example.com',
					'port'   => 443,
					'path'   => '/',
					'query'  => '',
				),
			),
			'IPv6 host'               => array(
				'http://[::1]:8000/;',
				array(
					'scheme' => 'http',
					'host'   => '[::1]',
					'port'   => 8000,
					'path'   => '/;',
					'query'  => '',
				),
			),
			'user info is not a host' => array( 'http://user:pass@example.com/', null ),
			'other scheme'            => array( 'ftp://example.com/live.mp3', null ),
			'relative'                => array( '/live.mp3', null ),
			'empty host'              => array( 'http:///live.mp3', null ),
			'port out of range'       => array( 'http://example.com:70000/', null ),
			'space in the host'       => array( 'http://exa mple.com/', null ),
		);
	}

	/**
	 * The origin leaves out the default port.
	 */
	public function test_origin() {
		$this->assertSame( 'https://example.com', Url_Variants::origin( 'https://example.com:443/radio/' ) );
		$this->assertSame( 'http://localhost:8886', Url_Variants::origin( 'http://localhost:8886/' ) );
		$this->assertSame( '', Url_Variants::origin( 'not a url' ) );
	}

	/**
	 * The https variant keeps the host, path and query, and drops port 80.
	 */
	public function test_https() {
		$this->assertSame( 'https://example.com/live.mp3?a=1', Url_Variants::https( 'http://example.com/live.mp3?a=1' ) );
		$this->assertSame( 'https://example.com/live.mp3', Url_Variants::https( 'http://example.com:80/live.mp3' ) );
		$this->assertSame( 'https://example.com:8000/;', Url_Variants::https( 'http://example.com:8000/;' ) );
		$this->assertNull( Url_Variants::https( 'https://example.com/live.mp3' ) );
		$this->assertNull( Url_Variants::https( 'nope' ) );
	}

	/**
	 * Icecast's status-json.xsl lives at the root of the same scheme, host and port.
	 */
	public function test_icecast_status() {
		$this->assertSame( 'http://example.com:8000/status-json.xsl', Url_Variants::icecast_status( 'http://example.com:8000/' ) );
		$this->assertSame( 'https://example.com/status-json.xsl', Url_Variants::icecast_status( 'https://example.com/radio/index.html?x' ) );
		$this->assertNull( Url_Variants::icecast_status( 'nope' ) );
	}

	/**
	 * Shoutcast gives audio to a browser at /; (v1 and v2) and /stream (v2).
	 */
	public function test_shoutcast() {
		$this->assertSame(
			array( 'http://example.com:8000/;', 'http://example.com:8000/stream' ),
			Url_Variants::shoutcast( 'http://example.com:8000/index.html' )
		);
		$this->assertSame( array(), Url_Variants::shoutcast( 'nope' ) );
	}

	/**
	 * A Location header resolves against the URL that answered.
	 *
	 * @dataProvider data_resolve
	 *
	 * @param string      $location Location header.
	 * @param string|null $expected Absolute URL, or null.
	 */
	public function test_resolve( $location, $expected ) {
		$this->assertSame( $expected, Url_Variants::resolve( 'http://example.com:8000/radio/live.mp3?a=1', $location ) );
	}

	/**
	 * Inputs for test_resolve().
	 *
	 * @return array<string, array{string, string|null}>
	 */
	public function data_resolve() {
		return array(
			'absolute'          => array( 'https://cdn.example.net/x.mp3', 'https://cdn.example.net/x.mp3' ),
			'protocol-relative' => array( '//cdn.example.net/x.mp3', 'http://cdn.example.net/x.mp3' ),
			'root-relative'     => array( '/other.mp3', 'http://example.com:8000/other.mp3' ),
			'path-relative'     => array( 'hi.mp3', 'http://example.com:8000/radio/hi.mp3' ),
			'query only'        => array( '?b=2', 'http://example.com:8000/radio/live.mp3?b=2' ),
			'other scheme'      => array( 'ftp://example.com/x', null ),
			'empty'             => array( '', null ),
		);
	}

	/**
	 * Local and private hosts, which the probe never proposes.
	 *
	 * @dataProvider data_private_host
	 *
	 * @param string $host     Host.
	 * @param bool   $expected Whether it is private.
	 */
	public function test_is_private_host( $host, $expected ) {
		$this->assertSame( $expected, Url_Variants::is_private_host( $host ) );
	}

	/**
	 * Inputs for test_is_private_host().
	 *
	 * @return array<string, array{string, bool}>
	 */
	public function data_private_host() {
		return array(
			'localhost'       => array( 'localhost', true ),
			'sub.localhost'   => array( 'radio.localhost', true ),
			'loopback'        => array( '127.0.0.1', true ),
			'10/8'            => array( '10.0.0.1', true ),
			'192.168/16'      => array( '192.168.100.245', true ),
			'172.16/12'       => array( '172.20.1.1', true ),
			'link-local'      => array( '169.254.169.254', true ),
			'unspecified'     => array( '0.0.0.0', true ),
			'IPv6 loopback'   => array( '[::1]', true ),
			'IPv6 ULA'        => array( '[fd00::1]', true ),
			'IPv6 ULA fd12'   => array( 'fd12::1', true ),
			'IPv6 fc00/7'     => array( '[fc00::1]', true ),
			'CGNAT start'     => array( '100.64.0.1', true ),
			'CGNAT end'       => array( '100.127.255.254', true ),
			'after CGNAT'     => array( '100.128.0.1', false ),
			'before CGNAT'    => array( '100.63.255.255', false ),
			'IPv4-mapped'     => array( '[::ffff:127.0.0.1]', true ),
			'public IPv4'     => array( '8.8.8.8', false ),
			'public IPv6'     => array( '[2001:4860:4860::8888]', false ),
			'public hostname' => array( 'ice1.somafm.com', false ),
		);
	}
}
