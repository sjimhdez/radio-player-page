<?php
/**
 * Integration tests for RadioPlayerPage\WP\Stream_Probe.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Stream;

use RadioPlayerPage\Tests\Unit\Support\StreamSamples;
use RadioPlayerPage\WP\Stream_Probe;
use WP_Error;
use WP_UnitTestCase;

/**
 * The server probe over the safe HTTP API (ADR 0064 §3–§5). No request leaves:
 * pre_http_request answers each one, after the probe has validated the URL.
 * Hosts are public IP literals so that wp_http_validate_url() needs no DNS.
 */
final class StreamProbeTest extends WP_UnitTestCase {

	/**
	 * Requests that reached the HTTP API: URL and arguments.
	 *
	 * @var list<array{url: string, args: array<string, mixed>}>
	 */
	private $requests = array();

	/**
	 * Answers by URL: a response array or a WP_Error.
	 *
	 * @var array<string, array<string, mixed>|WP_Error>
	 */
	private $answers = array();

	/**
	 * Hooks the fake transport.
	 */
	public function set_up() {
		parent::set_up();
		$this->requests = array();
		$this->answers  = array();
		add_filter( 'pre_http_request', array( $this, 'answer' ), 10, 3 );
	}

	/**
	 * Answers a request from $answers and records it, unless a test answered it first.
	 *
	 * @param false|array<string, mixed>|WP_Error $pre  Short-circuit value.
	 * @param array<string, mixed>                $args Request arguments.
	 * @param string                              $url  URL.
	 * @return array<string, mixed>|WP_Error
	 */
	public function answer( $pre, $args, $url ) {
		if ( false !== $pre ) {
			return $pre;
		}
		$this->requests[] = array(
			'url'  => $url,
			'args' => $args,
		);
		$this->assertArrayHasKey( $url, $this->answers, "Unexpected request to {$url}." );
		return $this->answers[ $url ];
	}

	/**
	 * A response built from a real sample.
	 *
	 * @param string $name Sample name.
	 * @return array<string, mixed>
	 */
	private static function sample( $name ) {
		$sample = StreamSamples::load( $name );
		return self::response( $sample['status'], $sample['headers'], $sample['body'] );
	}

	/**
	 * A response array as the HTTP API returns it.
	 *
	 * @param int                   $status  Status.
	 * @param array<string, string> $headers Headers.
	 * @param string                $body    Body.
	 * @return array<string, mixed>
	 */
	private static function response( $status, array $headers, $body = '' ) {
		return array(
			'headers'  => $headers,
			'body'     => $body,
			'response' => array(
				'code'    => $status,
				'message' => '',
			),
			'cookies'  => array(),
			'filename' => null,
		);
	}

	/**
	 * The request uses the safe API with the limits, a browser UA and the site's Origin.
	 */
	public function test_request_arguments() {
		$this->answers['http://93.184.215.14:8000/live'] = self::sample( 'streamguys-npr' );

		$report = Stream_Probe::probe( 'http://93.184.215.14:8000/live' );

		$this->assertSame( 'audio', $report['kind'] );
		$this->assertCount( 1, $this->requests );
		$args = $this->requests[0]['args'];
		$this->assertTrue( $args['reject_unsafe_urls'] );
		$this->assertSame( 5, $args['timeout'] );
		$this->assertSame( 0, $args['redirection'] );
		$this->assertSame( 16384, $args['limit_response_size'] );
		$this->assertStringStartsWith( 'Mozilla/5.0', $args['user-agent'] );
		$this->assertSame( untrailingslashit( home_url() ), $args['headers']['Origin'] );
	}

	/**
	 * Only the URL's port is allowed, and only during the request.
	 */
	public function test_port_allowed_only_during_the_request() {
		$this->answers['http://93.184.215.14:8000/live'] = self::sample( 'streamguys-npr' );
		$ports_inside                                    = null;
		$spy = function ( $pre ) use ( &$ports_inside ) {
			$ports_inside = self::safe_ports( 'http://93.184.215.14:8000/live' );
			return $pre;
		};
		add_filter( 'pre_http_request', $spy, 5 );

		Stream_Probe::probe( 'http://93.184.215.14:8000/live' );

		$this->assertSame( array( 80, 443, 8080, 8000 ), $ports_inside );
		$this->assertSame( array( 80, 443, 8080 ), self::safe_ports( '' ) );
		$this->assertFalse( wp_http_validate_url( 'http://93.184.215.14:8000/live' ) );
	}

	/**
	 * Private and reserved hosts are blocked without any request.
	 *
	 * @dataProvider data_blocked
	 *
	 * @param string $url URL.
	 */
	public function test_blocked_without_a_request( $url ) {
		$report = Stream_Probe::probe( $url );

		$this->assertSame( 'blocked', $report['kind'] );
		$this->assertSame( array(), $this->requests );
	}

	/**
	 * Inputs for test_blocked_without_a_request().
	 *
	 * @return array<string, array{string}>
	 */
	public function data_blocked() {
		return array(
			'loopback'        => array( 'http://127.0.0.1:8000/live' ),
			'private'         => array( 'http://192.168.1.10/live' ),
			'cloud metadata'  => array( 'http://169.254.169.254/latest/meta-data/' ),
			'not http'        => array( 'ftp://93.184.215.14/live' ),
			'service port'    => array( 'http://93.184.215.14:3306/' ),
			'port below 1024' => array( 'http://93.184.215.14:25/' ),
		);
	}

	/**
	 * On the site's own host the URL's port is not added: only 80, 443 and 8080 (ADR 0064 §4).
	 */
	public function test_site_host_keeps_the_safe_ports() {
		$host                                        = (string) wp_parse_url( home_url(), PHP_URL_HOST );
		$this->answers[ "http://{$host}:8080/live" ] = self::sample( 'streamguys-npr' );

		$this->assertSame( 'blocked', Stream_Probe::probe( "http://{$host}:3306/" )['kind'] );
		$this->assertSame( 'audio', Stream_Probe::probe( "http://{$host}:8080/live" )['kind'] );
		$this->assertCount( 1, $this->requests );
	}

	/**
	 * A WP_Error is unreachable.
	 */
	public function test_unreachable() {
		$this->answers['http://93.184.215.14/live'] = new WP_Error( 'http_request_failed', 'cURL error 28' );

		$this->assertSame( 'unreachable', Stream_Probe::probe( 'http://93.184.215.14/live' )['kind'] );
	}

	/**
	 * With cURL, a server that never answers (refused, DNS, TLS, timeout without
	 * headers) is unreachable, not the empty capture (ADR 0066 §5).
	 */
	public function test_unreachable_with_curl() {
		$refused = function ( $pre, $args, $url ) {
			$handle = curl_init(); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_init -- Stands in for the transport.
			do_action_ref_array( 'http_api_curl', array( &$handle, $args, $url ) ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Fires the core action as the transport does.
			return new WP_Error( 'http_request_failed', 'cURL error 7: Failed to connect' );
		};
		add_filter( 'pre_http_request', $refused, 5, 3 );

		$this->assertSame( 'unreachable', Stream_Probe::probe( 'http://93.184.215.14:8000/live' )['kind'] );
	}

	/**
	 * The probe follows up to three redirects, resolving relative Locations.
	 */
	public function test_follows_redirects() {
		$this->answers['http://93.184.215.14/a']    = self::response( 302, array( 'location' => '/b' ) );
		$this->answers['http://93.184.215.14/b']    = self::response( 301, array( 'Location' => 'http://93.184.215.15/c' ) );
		$this->answers['http://93.184.215.15/c']    = self::response( 307, array( 'location' => 'http://93.184.215.15/live' ) );
		$this->answers['http://93.184.215.15/live'] = self::sample( 'streamguys-npr' );

		$report = Stream_Probe::probe( 'http://93.184.215.14/a' );

		$this->assertSame( 'audio', $report['kind'] );
		$this->assertSame( 200, $report['status'] );
		$this->assertCount( 4, $this->requests );
	}

	/**
	 * A fourth redirect is unreachable.
	 */
	public function test_too_many_redirects() {
		foreach ( array( 'a', 'b', 'c', 'd' ) as $index => $path ) {
			$this->answers[ 'http://93.184.215.14/' . $path ] = self::response( 302, array( 'location' => '/' . chr( ord( 'b' ) + $index ) ) );
		}

		$this->assertSame( 'unreachable', Stream_Probe::probe( 'http://93.184.215.14/a' )['kind'] );
		$this->assertCount( 4, $this->requests );
	}

	/**
	 * A redirect to a private host, or to another port, is blocked before it is requested.
	 *
	 * @dataProvider data_blocked_redirects
	 *
	 * @param string $location Location header.
	 */
	public function test_blocked_redirect( $location ) {
		$this->answers['http://93.184.215.14:8000/live'] = self::response( 302, array( 'location' => $location ) );

		$this->assertSame( 'blocked', Stream_Probe::probe( 'http://93.184.215.14:8000/live' )['kind'] );
		$this->assertCount( 1, $this->requests );
	}

	/**
	 * Inputs for test_blocked_redirect().
	 *
	 * @return array<string, array{string}>
	 */
	public function data_blocked_redirects() {
		return array(
			'private IP'           => array( 'http://10.0.0.1:8000/live' ),
			'same host, port 22'   => array( 'http://93.184.215.14:22/' ),
			// The site's host (WP_HOME in the tests) on the port opened for the URL (ADR 0066 §1).
			'site host, same port' => array( 'http://localhost:8000/live' ),
		);
	}

	/**
	 * A request of another plugin made during the probe's one gets neither the
	 * opened port nor the probe's cURL callbacks (ADR 0066 §1 and §5).
	 */
	public function test_other_requests_are_left_alone() {
		$this->answers['http://93.184.215.14:8000/live'] = self::sample( 'streamguys-npr' );
		$file = (string) wp_tempnam( 'radplapag-other' );
		file_put_contents( $file, 'other' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- Local test file.
		$valid  = null;
		$output = null;
		$other  = function ( $pre ) use ( $file, &$valid, &$output ) {
			$valid  = wp_http_validate_url( 'http://93.184.215.14:8000/other' );
			$handle = curl_init( 'file://' . $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_init -- Stands in for the other request's transport.
			curl_setopt( $handle, CURLOPT_RETURNTRANSFER, true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_setopt -- Stands in for the other request's transport.
			do_action_ref_array( 'http_api_curl', array( &$handle, array(), 'http://93.184.215.14:8000/other' ) ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Fires the core action as the transport does.
			$output = curl_exec( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_exec -- Stands in for the other request's transport.
			return $pre;
		};
		add_filter( 'pre_http_request', $other, 5 );

		$report = Stream_Probe::probe( 'http://93.184.215.14:8000/live' );
		unlink( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink -- Local test file.

		$this->assertSame( 'audio', $report['kind'] );
		$this->assertFalse( $valid );
		$this->assertSame( 'other', $output );
	}

	/**
	 * A redirect without a usable Location is unreachable.
	 */
	public function test_redirect_without_location() {
		$this->answers['http://93.184.215.14/live'] = self::response( 302, array() );

		$this->assertSame( 'unreachable', Stream_Probe::probe( 'http://93.184.215.14/live' )['kind'] );
	}

	/**
	 * The report keeps no body, even of a long page; headers with several values are joined.
	 */
	public function test_report_without_body() {
		$this->answers['http://93.184.215.14/'] = self::response(
			200,
			array( 'content-type' => 'text/html' ),
			'<html>' . str_repeat( 'x', 40000 ) . '<title>Icecast'
		);

		$report = Stream_Probe::probe( 'http://93.184.215.14/' );

		$this->assertSame( 'html', $report['kind'] );
		$this->assertStringNotContainsString( 'xxxx', (string) wp_json_encode( $report ) );
	}

	/**
	 * An http stream on an https site also requests the https variant.
	 */
	public function test_https_variant() {
		add_filter( 'home_url', array( $this, 'https_home' ) );
		$this->answers['http://93.184.215.14/live']  = self::sample( 'streamguys-npr' );
		$this->answers['https://93.184.215.14/live'] = new WP_Error( 'http_request_failed', 'SSL' );

		$report = Stream_Probe::probe( 'http://93.184.215.14/live' );

		$this->assertSame( 'unreachable', $report['variant']['kind'] );
		$this->assertSame( 'https://example.org', $this->requests[0]['args']['headers']['Origin'] );
	}

	/**
	 * An https home URL for test_https_variant().
	 *
	 * @return string
	 */
	public function https_home() {
		return 'https://example.org/';
	}

	/**
	 * A redirect on the same non-default port is followed: the port of the URL stays allowed.
	 */
	public function test_redirect_on_the_same_port() {
		$this->answers['http://93.184.215.14:8000/']     = self::response( 302, array( 'location' => '/live' ) );
		$this->answers['http://93.184.215.14:8000/live'] = self::sample( 'streamguys-npr' );

		$this->assertSame( 'audio', Stream_Probe::probe( 'http://93.184.215.14:8000/' )['kind'] );
	}

	/**
	 * Nothing of the probe stays hooked, also after an error.
	 */
	public function test_no_hook_left() {
		$this->answers['http://93.184.215.14:8000/live'] = new WP_Error( 'http_request_failed', 'x' );

		Stream_Probe::probe( 'http://93.184.215.14:8000/live' );

		$this->assertFalse( has_filter( 'http_allowed_safe_ports' ) );
		$this->assertFalse( has_action( 'http_api_curl' ) );
		$this->assertFalse( has_action( 'requests-request.progress' ) );
	}

	/**
	 * With cURL, the probe's own write and header callbacks keep 16 KB and cut the
	 * transfer; the error of the cut is ignored. The handle reads a local file, so
	 * nothing leaves the container.
	 */
	public function test_curl_cut() {
		$file = (string) wp_tempnam( 'radplapag-live' );
		file_put_contents( $file, "ID3\x04" . str_repeat( "\x00", 100000 ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- Local test file.
		$written = null;
		$cut     = function ( $pre, $args, $url ) use ( $file, &$written ) {
			$handle = curl_init( 'file://' . $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_init -- Stands in for the transport.
			do_action_ref_array( 'http_api_curl', array( &$handle, $args, $url ) ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Fires the core action as the transport does.
			curl_exec( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_exec -- Stands in for the transport.
			$written = curl_errno( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_errno -- Stands in for the transport.
			return new WP_Error( 'http_request_failed', 'cURL error 23' );
		};
		add_filter( 'pre_http_request', $cut, 5, 3 );

		$report = Stream_Probe::probe( 'http://93.184.215.14:8000/live' );
		unlink( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink -- Local test file.

		$this->assertSame( CURLE_WRITE_ERROR, $written );
		$this->assertSame( 'audio', $report['kind'] );
		$this->assertFalse( has_action( 'http_api_curl' ) );
	}

	/**
	 * The header callback keeps the headers of the last response, with its status line.
	 */
	public function test_curl_header_callback() {
		$probe  = new Stream_Probe();
		$handle = curl_init(); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_init -- A handle for the callback, never executed.

		foreach ( array( "HTTP/1.1 302 Found\r\n", "Location: /x\r\n", "\r\n", "HTTP/1.0 200 OK\r\n", "Content-Type: audio/mpeg\r\n", "icy-name: Radio\r\n", "\r\n" ) as $line ) {
			$this->assertSame( strlen( $line ), $probe->curl_header( $handle, $line ) );
		}

		$this->assertSame(
			array(
				'status'  => 200,
				'headers' => array(
					'content-type' => 'audio/mpeg',
					'icy-name'     => 'Radio',
				),
				'body'    => '',
			),
			$probe->captured()
		);
	}

	/**
	 * The header callback keeps up to 16 KB of headers per response and lets the
	 * rest go by, so that a server sending headers without end does not fill the
	 * memory (K128).
	 */
	public function test_curl_header_callback_caps_the_headers() {
		$probe  = new Stream_Probe();
		$handle = curl_init(); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_init -- A handle for the callback, never executed.

		$probe->curl_header( $handle, "HTTP/1.1 200 OK\r\n" );
		for ( $i = 0; $i < 1000; $i++ ) {
			$line = "x-filler-{$i}: " . str_repeat( 'a', 100 ) . "\r\n";
			$this->assertSame( strlen( $line ), $probe->curl_header( $handle, $line ) );
		}
		$kept = 0;
		foreach ( $probe->captured()['headers'] as $name => $value ) {
			$kept += strlen( $name ) + strlen( $value );
		}

		$this->assertLessThanOrEqual( Stream_Probe::MAX_BYTES, $kept );
		$this->assertArrayHasKey( 'x-filler-0', $probe->captured()['headers'] );
		$this->assertSame( 200, $probe->captured()['status'] );

		// The next response starts with room again, though this one is full.
		for ( $i = 0; $i < 200; $i++ ) {
			$probe->curl_header( $handle, "x: y\r\n" );
		}
		$probe->curl_header( $handle, "HTTP/1.1 302 Found\r\n" );
		$probe->curl_header( $handle, "Location: /x\r\n" );

		$this->assertSame( 302, $probe->captured()['status'] );
		$this->assertSame( array( 'location' => '/x' ), $probe->captured()['headers'] );
	}

	/**
	 * A private connection address is not allowed, unless it is the site's host
	 * or http_request_host_is_external says so (ADR 0066 §2).
	 *
	 * @dataProvider data_connection
	 *
	 * @param string $ip       Address cURL connected to.
	 * @param string $host     Host of the request.
	 * @param bool   $expected Whether the connection is allowed.
	 */
	public function test_connection_allowed( $ip, $host, $expected ) {
		$this->assertSame( $expected, ( new Stream_Probe() )->connection_allowed( $ip, $host ) );
	}

	/**
	 * Inputs for test_connection_allowed().
	 *
	 * @return array<string, array{string, string, bool}>
	 */
	public function data_connection() {
		return array(
			'public'           => array( '93.184.215.14', '93.184.215.14', true ),
			'unknown (file)'   => array( '', 'example.org', true ),
			'loopback'         => array( '127.0.0.1', 'rebind.example', false ),
			'private'          => array( '10.0.0.1', 'rebind.example', false ),
			'shared (CGNAT)'   => array( '100.100.100.200', 'rebind.example', false ),
			'IPv6 loopback'    => array( '::1', 'rebind.example', false ),
			'IPv6 unique'      => array( 'fd00::1', 'rebind.example', false ),
			'the site\'s host' => array( '127.0.0.1', 'localhost', true ),
		);
	}

	/**
	 * The core filter http_request_host_is_external lets a private address through.
	 */
	public function test_connection_allowed_when_external() {
		add_filter( 'http_request_host_is_external', '__return_true' );

		$this->assertTrue( ( new Stream_Probe() )->connection_allowed( '127.0.0.1', 'rebind.example' ) );
	}

	/**
	 * With cURL, a response from a private address is cut at its status line and
	 * reported as blocked: a name that resolved to a public IP when validated and
	 * to a private one when connecting (ADR 0066 §2). The server listens on the
	 * container's loopback and answers in this same process.
	 */
	public function test_private_connection_is_blocked() {
		$this->serve_through_curl( "HTTP/1.1 200 OK\r\nContent-Type: audio/mpeg\r\n\r\nID3\x04" . str_repeat( "\x00", 100 ) );

		$this->assertSame( 'blocked', Stream_Probe::probe( 'http://93.184.215.14:8000/live' )['kind'] );
	}

	/**
	 * The same response is audio when the host is marked as external.
	 */
	public function test_private_connection_marked_external() {
		add_filter( 'http_request_host_is_external', '__return_true' );
		$this->serve_through_curl( "HTTP/1.1 200 OK\r\nContent-Type: audio/mpeg\r\n\r\nID3\x04" . str_repeat( "\x00", 100 ) );

		$this->assertSame( 'audio', Stream_Probe::probe( 'http://93.184.215.14:8000/live' )['kind'] );
	}

	/**
	 * A redirect with an uppercase scheme still gets the connection check: the
	 * probe keeps the URL as core normalizes it (wp_kses_bad_protocol()).
	 */
	public function test_uppercase_scheme_redirect_is_checked() {
		$this->answers['http://93.184.215.14:8000/live'] = self::response( 302, array( 'location' => 'HTTP://93.184.215.14/live' ) );
		$this->serve_through_curl( "HTTP/1.1 200 OK\r\nContent-Type: audio/mpeg\r\n\r\nID3\x04" . str_repeat( "\x00", 100 ), 'http://93.184.215.14/live' );

		$this->assertSame( 'blocked', Stream_Probe::probe( 'http://93.184.215.14:8000/live' )['kind'] );
	}

	/**
	 * Through a proxy cURL connects to the proxy, whose address says nothing of
	 * the host: the check is left to core's validation (ADR 0066 §2).
	 *
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_connection_through_a_proxy() {
		define( 'WP_PROXY_HOST', '10.0.0.5' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- Core's proxy constant, in a separate process.
		define( 'WP_PROXY_PORT', '3128' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- Core's proxy constant, in a separate process.

		$this->assertTrue( ( new Stream_Probe() )->connection_allowed( '10.0.0.5', 'radio.example' ) );
	}

	/**
	 * Answers the probe's request through a real cURL transfer to a server on
	 * 127.0.0.1 that sends $raw, with the probe's http_api_curl callbacks set.
	 *
	 * @param string      $raw  Raw HTTP response.
	 * @param string|null $only Only this URL, as the HTTP API gets it; null for all.
	 */
	private function serve_through_curl( $raw, $only = null ) {
		$transport = function ( $pre, $args, $url ) use ( $raw, $only ) {
			if ( null !== $only && $only !== $url ) {
				return $pre;
			}
			$server = stream_socket_server( 'tcp://127.0.0.1:0' );
			$this->assertNotFalse( $server );
			$handle = curl_init( 'http://' . stream_socket_get_name( $server, false ) . '/' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_init -- Stands in for the transport.
			do_action_ref_array( 'http_api_curl', array( &$handle, $args, $url ) ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Fires the core action as the transport does.
			$multi = curl_multi_init(); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_multi_init -- Drives the transfer while this process answers it.
			curl_multi_add_handle( $multi, $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_multi_add_handle -- Same.
			$running = 1;
			curl_multi_exec( $multi, $running ); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_multi_exec -- Same.
			$connection = stream_socket_accept( $server, 2 );
			$this->assertNotFalse( $connection );
			fwrite( $connection, $raw ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite -- Local test server.
			fclose( $connection ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose -- Local test server.
			$until = microtime( true ) + 2;
			while ( $running > 0 && microtime( true ) < $until ) {
				curl_multi_exec( $multi, $running ); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_multi_exec -- Same.
				curl_multi_select( $multi, 0.1 ); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_multi_select -- Same.
			}
			$info = curl_multi_info_read( $multi ); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_multi_info_read -- Same.
			curl_multi_remove_handle( $multi, $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_multi_remove_handle -- Same.
			fclose( $server ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose -- Local test server.
			// Requests sees neither headers nor body once the probe's callbacks are set.
			return new WP_Error( 'http_request_failed', 'cURL error ' . ( is_array( $info ) ? $info['result'] : 0 ) );
		};
		add_filter( 'pre_http_request', $transport, 5, 3 );
	}

	/**
	 * The write callback keeps 16 KB and then returns 0, which makes cURL stop.
	 */
	public function test_curl_write_callback() {
		$probe  = new Stream_Probe();
		$handle = curl_init(); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_init -- A handle for the callback, never executed.

		$this->assertSame( 10000, $probe->curl_write( $handle, str_repeat( 'a', 10000 ) ) );
		$this->assertSame( 0, $probe->curl_write( $handle, str_repeat( 'b', 10000 ) ) );
		$this->assertSame( 16384, strlen( $probe->captured()['body'] ) );
	}

	/**
	 * Without cURL, the progress hook cuts at 16 KB with an exception; there are no headers.
	 */
	public function test_streams_cut() {
		$stream = function () {
			foreach ( array( "ID3\x04" . str_repeat( "\x00", 7996 ), str_repeat( "\x00", 8000 ), str_repeat( "\x00", 8000 ) ) as $index => $block ) {
				do_action( 'requests-request.progress', $block, 8000 * ( $index + 1 ), 16384 ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound, WordPress.NamingConventions.ValidHookName.UseUnderscores -- Fires the core action as the transport does.
			}
			return new WP_Error( 'http_request_failed', 'never reached' );
		};
		add_filter( 'pre_http_request', $stream, 5 );

		$report = Stream_Probe::probe( 'http://93.184.215.14:8000/live' );

		$this->assertSame( 'audio', $report['kind'] );
		$this->assertNull( $report['status'] );
		$this->assertNull( $report['cors'] );
		$this->assertFalse( has_action( 'requests-request.progress' ) );
	}

	/**
	 * Without cURL, a body cut in chunked framing loses its first chunk-size line.
	 */
	public function test_streams_cut_strips_the_first_chunk_size() {
		$stream = function () {
			do_action( 'requests-request.progress', "2000\r\nID3\x04" . str_repeat( "\x00", 17000 ), 17010, 16384 ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound, WordPress.NamingConventions.ValidHookName.UseUnderscores -- Fires the core action as the transport does.
			return new WP_Error( 'http_request_failed', 'never reached' );
		};
		add_filter( 'pre_http_request', $stream, 5 );

		$this->assertSame( 'audio', Stream_Probe::probe( 'http://93.184.215.14:8000/live' )['kind'] );
	}

	/**
	 * Without cURL, the progress hook also stops a slow transfer after 5 s: the
	 * transport's own timeout is per read and never ends a trickle (spike R1).
	 */
	public function test_progress_stops_after_the_timeout() {
		$probe   = new Stream_Probe();
		$started = new \ReflectionProperty( Stream_Probe::class, 'started' );
		$started->setAccessible( true );
		$started->setValue( $probe, microtime( true ) - 6 );

		$this->expectException( \WpOrg\Requests\Exception::class );
		$probe->progress( 'x' );
	}

	/**
	 * Without time left in the probe, nothing is requested (ADR 0066 §3).
	 */
	public function test_no_time_left() {
		$this->assertSame( array( 'error' => 'unreachable' ), ( new Stream_Probe( 0.0 ) )->fetch( 'http://93.184.215.14:8000/live' ) );
		$this->assertSame( array(), $this->requests );
	}

	/**
	 * Each request waits at most for the time left in the probe.
	 */
	public function test_redirects_share_the_time() {
		$this->answers['http://93.184.215.14:8000/live'] = self::response( 302, array( 'location' => '/next' ) );
		$this->answers['http://93.184.215.14:8000/next'] = self::sample( 'streamguys-npr' );

		( new Stream_Probe( 2.0 ) )->fetch( 'http://93.184.215.14:8000/live' );

		$this->assertCount( 2, $this->requests );
		$this->assertLessThan( $this->requests[0]['args']['timeout'], $this->requests[1]['args']['timeout'] );
	}

	/**
	 * Each request waits at most for the time left in the probe.
	 */
	public function test_timeout_is_the_time_left() {
		$this->answers['http://93.184.215.14:8000/live'] = self::sample( 'streamguys-npr' );

		( new Stream_Probe( 2.0 ) )->fetch( 'http://93.184.215.14:8000/live' );

		$timeout = $this->requests[0]['args']['timeout'];
		$this->assertGreaterThan( 0, $timeout );
		$this->assertLessThanOrEqual( 2, $timeout );
	}

	/**
	 * A probe lasts at most 15 s: the redirects of a URL share its time too.
	 */
	public function test_probe_budget() {
		$this->assertSame( 15, Stream_Probe::BUDGET );
	}

	/**
	 * Without cURL, the cut also comes when the request's own time is up.
	 */
	public function test_progress_stops_at_the_request_timeout() {
		$probe = new Stream_Probe();
		foreach ( array(
			'started' => microtime( true ) - 1.5,
			'timeout' => 1.0,
		) as $name => $value ) {
			$property = new \ReflectionProperty( Stream_Probe::class, $name );
			$property->setAccessible( true );
			$property->setValue( $probe, $value );
		}

		$this->expectException( \WpOrg\Requests\Exception::class );
		$probe->progress( 'x' );
	}

	/**
	 * What the remote server writes reaches the report sanitized: playlist URLs,
	 * mount URLs and names (ADR 0066 §4).
	 */
	public function test_report_is_sanitized() {
		$this->answers['http://93.184.215.14:8000/live.pls']        = self::response(
			200,
			array( 'content-type' => 'audio/x-scpls' ),
			"[playlist]\nNumberOfEntries=1\nFile1=http://93.184.215.14/a\"><img/src=x/onerror=alert(1)>\n"
		);
		$this->answers['http://93.184.215.14:8000/status-json.xsl'] = self::response(
			200,
			array(
				'server'       => 'Icecast 2.4.4',
				'content-type' => 'application/json',
			),
			(string) wp_json_encode(
				array(
					'icestats' => array(
						'source' => array(
							'listenurl'   => 'http://93.184.215.14:8000/live"><svg/onload=x()>',
							'server_name' => '<b>Radio</b> <script>x()</script>',
							'server_type' => 'audio/mpeg<img>',
						),
					),
				)
			)
		);

		$streams = Stream_Probe::probe( 'http://93.184.215.14:8000/live.pls' )['streams'];
		$mounts  = Stream_Probe::probe( 'http://93.184.215.14:8000/status-json.xsl' )['mounts'];

		$this->assertCount( 1, $streams );
		$this->assertStringNotContainsString( '<', $streams[0] );
		$this->assertStringNotContainsString( '"', $streams[0] );
		$this->assertSame( 'Radio', $mounts[0]['name'] );
		$this->assertSame( 'audio/mpeg', $mounts[0]['type'] );
		$this->assertStringNotContainsString( '<', $mounts[0]['url'] );
		$this->assertStringNotContainsString( '"', $mounts[0]['url'] );
	}

	/**
	 * The https variant also reaches the report through esc_url_raw().
	 */
	public function test_variant_is_sanitized() {
		add_filter( 'home_url', array( $this, 'https_home' ) );
		$this->answers['http://93.184.215.14/a"<b>']  = self::sample( 'streamguys-npr' );
		$this->answers['https://93.184.215.14/a"<b>'] = self::sample( 'streamguys-npr' );

		$variant = Stream_Probe::probe( 'http://93.184.215.14/a"<b>' )['variant'];

		$this->assertNotNull( $variant );
		$this->assertSame( 'https://93.184.215.14/ab', $variant['url'] );
	}

	/**
	 * The safe ports the HTTP API would allow for a URL on 93.184.215.14.
	 *
	 * @param string $url URL.
	 * @return mixed
	 */
	private static function safe_ports( $url ) {
		return apply_filters( 'http_allowed_safe_ports', array( 80, 443, 8080 ), '93.184.215.14', $url ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Reads the core filter that the probe hooks.
	}
}
