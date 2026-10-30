<?php
/**
 * The server stream probe over the safe HTTP API.
 *
 * @package radio-player-page
 * @since 3.6.0
 */

namespace RadioPlayerPage\WP;

use RadioPlayerPage\Stream\Prober;
use RadioPlayerPage\Stream\Url_Variants;
use WP_Error;
use WP_HTTP_Proxy;
use WpOrg\Requests\Exception as RequestsException;

defined( 'ABSPATH' ) || exit;

/**
 * Requests for RadioPlayerPage\Stream\Prober (ADR 0064 §3–§5).
 *
 * Each request goes through wp_safe_remote_get() with 5 s, 16 KB, a browser
 * User-Agent and the site's Origin. Only the URL's port is added to the safe
 * ports, and only during that request; never on the site's own host. Redirects
 * are followed here, up to three, and each hop is validated before it is
 * requested.
 *
 * limit_response_size does not stop an endless stream (spike R1), so the
 * probe cuts it itself at 16 KB. With cURL, its own write and header callbacks
 * keep the body and the headers and stop the transfer; the error of the cut is
 * ignored. Without cURL, an exception in the progress hook stops the transfer,
 * and only the bytes are known. Each hook is added for one request only.
 *
 * @since 3.6.0
 */
final class Stream_Probe {

	/**
	 * Seconds per request.
	 */
	const TIMEOUT = 5;

	/**
	 * Seconds a whole probe may last, redirects included (ADR 0066 §3).
	 */
	const BUDGET = 15;

	/**
	 * Bytes of the body that are kept.
	 */
	const MAX_BYTES = 16384;

	/**
	 * Redirects followed.
	 */
	const MAX_REDIRECTS = 3;

	/**
	 * A desktop browser, so Shoutcast answers as to a listener's browser (spike R1, R4).
	 */
	const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

	/**
	 * Redirect statuses.
	 */
	const REDIRECTS = array( 301, 302, 303, 307, 308 );

	/**
	 * Ports of databases, caches, queues and cluster APIs, never opened (ADR 0066 §1).
	 */
	const BLOCKED_PORTS = array( 1433, 1521, 2375, 2376, 2379, 2380, 3306, 5432, 5672, 5984, 6379, 6443, 8500, 9042, 9200, 9300, 10250, 11211, 15672, 27017, 27018 );

	/**
	 * Port allowed during the current request, or 0.
	 *
	 * @var int
	 */
	private $port = 0;

	/**
	 * URL of the current request, or ''.
	 *
	 * @var string
	 */
	private $url = '';

	/**
	 * When the current request started (microtime).
	 *
	 * @var float
	 */
	private $started = 0.0;

	/**
	 * Seconds the current request may last.
	 *
	 * @var float
	 */
	private $timeout = self::TIMEOUT;

	/**
	 * When the probe's time is up (microtime).
	 *
	 * @var float
	 */
	private $deadline;

	/**
	 * Whether cURL connected the current request to an address not allowed.
	 *
	 * @var bool
	 */
	private $blocked = false;

	/**
	 * Bytes of headers kept of the current response, up to 16 KB (K128).
	 *
	 * @var int
	 */
	private $header_bytes = 0;

	/**
	 * Whether cURL ran the current request with the probe's callbacks.
	 *
	 * @var bool
	 */
	private $curl = false;

	/**
	 * What the probe's own callbacks kept of the current request.
	 *
	 * @var array{status: int, headers: array<string, string>, body: string}
	 */
	private $captured = array(
		'status'  => 0,
		'headers' => array(),
		'body'    => '',
	);

	/**
	 * Probes a URL.
	 *
	 * @since 3.6.0
	 *
	 * @param string $url URL written by the administrator.
	 * @return array{kind: string, status: int|null, cors: bool|null, streams: list<string>, mounts: list<array{url: string, name: string, type: string}>, variant: array{url: string, kind: string, status: int|null}|null, notes: list<string>}
	 */
	public static function probe( string $url ): array {
		return self::sanitize( Prober::probe( $url, home_url( '/' ), array( new self(), 'fetch' ) ) );
	}

	/**
	 * Starts the probe's time.
	 *
	 * @since 3.6.0
	 *
	 * @param float $budget Seconds the probe may last.
	 */
	public function __construct( float $budget = self::BUDGET ) {
		$this->deadline = microtime( true ) + $budget;
	}

	/**
	 * Requests a URL, following redirects. Every hop may use the port of this
	 * URL only, as wp_safe_remote_get() does with its own redirects (spike R2),
	 * and never on the site's host (ADR 0066 §1).
	 *
	 * @since 3.6.0
	 *
	 * @param string $url URL.
	 * @return array{status: int, headers: array<string, string>, body: string}|array{error: string}
	 */
	public function fetch( string $url ): array {
		$parts = Url_Variants::parse( $url );
		$port  = null === $parts ? 0 : $parts['port'];
		for ( $hop = 0; $hop <= self::MAX_REDIRECTS; $hop++ ) {
			$response = $this->request( $url, $port );
			if ( isset( $response['error'] ) || ! in_array( $response['status'], self::REDIRECTS, true ) ) {
				return $response;
			}
			$next = Url_Variants::resolve( $url, $response['headers']['location'] ?? '' );
			if ( null === $next ) {
				return array( 'error' => 'unreachable' );
			}
			$url = $next;
		}
		return array( 'error' => 'unreachable' );
	}

	/**
	 * Adds the port of the current request to the safe ports: only for that
	 * request, never on the site's host, and only from 1024 up and outside the
	 * blocked ports (ADR 0066 §1).
	 *
	 * @since 3.6.0
	 *
	 * @param mixed  $ports Allowed ports.
	 * @param string $host  Host of the URL being validated.
	 * @param string $url   URL being validated.
	 * @return mixed
	 */
	public function allow_port( $ports, $host = '', $url = '' ) {
		if ( ! is_array( $ports ) || '' === $this->url || $url !== $this->url || self::is_site_host( (string) $host ) ) {
			return $ports;
		}
		if ( $this->port >= 1024 && ! in_array( $this->port, self::BLOCKED_PORTS, true ) ) {
			$ports[] = $this->port;
		}
		return $ports;
	}

	/**
	 * Sets the probe's write and header callbacks on the cURL handle of the
	 * current request (http_api_curl).
	 *
	 * @since 3.6.0
	 *
	 * @param mixed  $handle cURL handle.
	 * @param mixed  $args   Request arguments.
	 * @param string $url    URL of the request.
	 * @return void
	 */
	public function curl( $handle, $args = array(), $url = '' ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundBeforeLastUsed -- Signature fixed by http_api_curl.
		if ( '' === $this->url || $url !== $this->url ) {
			return;
		}
		$this->curl = true;
		curl_setopt( $handle, CURLOPT_HEADERFUNCTION, array( $this, 'curl_header' ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_setopt -- The HTTP API cannot stop an endless stream (ADR 0064 §6).
		curl_setopt( $handle, CURLOPT_WRITEFUNCTION, array( $this, 'curl_write' ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_setopt -- The HTTP API cannot stop an endless stream (ADR 0064 §6).
	}

	/**
	 * Keeps a header line, up to 16 KB per response (K128); a status line starts a
	 * new response, and stops the transfer if cURL connected to an address not
	 * allowed (ADR 0066 §2).
	 *
	 * @since 3.6.0
	 *
	 * @param mixed  $handle cURL handle.
	 * @param string $line   Header line.
	 * @return int Bytes handled; 0 stops cURL.
	 */
	public function curl_header( $handle, string $line ): int {
		$trimmed = trim( $line );
		if ( preg_match( '/^(?:HTTP\/[\d.]+|ICY)\s+(\d{3})/i', $trimmed, $matches ) ) {
			$ip   = (string) curl_getinfo( $handle, CURLINFO_PRIMARY_IP ); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_getinfo -- The HTTP API does not expose the address it connected to (ADR 0066 §2).
			$host = Url_Variants::parse( $this->url )['host'] ?? '';
			if ( ! $this->connection_allowed( $ip, $host ) ) {
				$this->blocked = true;
				return 0;
			}
			$this->captured['status']  = (int) $matches[1];
			$this->captured['headers'] = array();
			$this->header_bytes        = 0;
		} elseif ( false !== strpos( $trimmed, ':' ) && $this->header_bytes + strlen( $trimmed ) <= self::MAX_BYTES ) {
			list( $name, $value ) = explode( ':', $trimmed, 2 );
			$name                 = strtolower( trim( $name ) );
			$value                = trim( $value );
			$this->header_bytes  += strlen( $trimmed );

			$this->captured['headers'][ $name ] = isset( $this->captured['headers'][ $name ] ) ? $this->captured['headers'][ $name ] . ', ' . $value : $value;
		}
		return strlen( $line );
	}

	/**
	 * Whether the address cURL connected to may be read: a public one, an unknown
	 * one, the site's host (as in core), a host that http_request_host_is_external
	 * marks as external, or any through a proxy, whose address says nothing of
	 * the host (ADR 0066 §2).
	 *
	 * @since 3.6.0
	 *
	 * @param string $ip   Address connected to, or '' when unknown.
	 * @param string $host Host of the request.
	 * @return bool
	 */
	public function connection_allowed( string $ip, string $host ): bool {
		if ( '' === $ip || ! Url_Variants::is_private_host( $ip ) || self::is_site_host( $host ) ) {
			return true;
		}
		$proxy = new WP_HTTP_Proxy();
		if ( $proxy->is_enabled() && $proxy->send_through_proxy( 'http://' . $host . '/' ) ) {
			return true;
		}
		return (bool) apply_filters( 'http_request_host_is_external', false, $host, $this->url ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Core's filter, as wp_http_validate_url() applies it.
	}

	/**
	 * Keeps up to 16 KB of the body; then returns 0, which makes cURL stop.
	 *
	 * @since 3.6.0
	 *
	 * @param mixed  $handle cURL handle.
	 * @param string $data   Bytes received.
	 * @return int Bytes handled.
	 */
	public function curl_write( $handle, string $data ): int { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundBeforeLastUsed -- Signature fixed by CURLOPT_WRITEFUNCTION.
		$this->keep( $data );
		return strlen( $this->captured['body'] ) >= self::MAX_BYTES ? 0 : strlen( $data );
	}

	/**
	 * Keeps the bytes of a transport without cURL and stops it at 16 KB or after
	 * 5 s (requests-request.progress): its own timeout is per read.
	 *
	 * @since 3.6.0
	 *
	 * @param string $data Bytes received.
	 * @return void
	 * @throws RequestsException When the probe has enough bytes or time is up.
	 */
	public function progress( $data ) {
		$this->keep( (string) $data );
		if ( strlen( $this->captured['body'] ) >= self::MAX_BYTES || microtime( true ) - $this->started >= $this->timeout ) {
			throw new RequestsException( 'Stream probe limit reached.', 'radplapag_probe_cut' );
		}
	}

	/**
	 * What the probe's callbacks kept of the last request.
	 *
	 * @since 3.6.0
	 *
	 * @return array{status: int, headers: array<string, string>, body: string}
	 */
	public function captured(): array {
		return $this->captured;
	}

	/**
	 * One request, without following redirects.
	 *
	 * @param string $url  URL.
	 * @param int    $port Port added to the safe ports, or 0.
	 * @return array{status: int, headers: array<string, string>, body: string}|array{error: string}
	 */
	private function request( string $url, int $port ): array {
		if ( null === Url_Variants::parse( $url ) ) {
			return array( 'error' => 'blocked' );
		}
		// As core normalizes it (lowercase scheme), so that the hooks recognize it.
		$url           = wp_kses_bad_protocol( $url, array( 'http', 'https' ) );
		$this->started = microtime( true );
		$left          = $this->deadline - $this->started;
		if ( $left <= 0 ) {
			return array( 'error' => 'unreachable' );
		}
		$this->timeout  = min( (float) self::TIMEOUT, $left );
		$this->port     = $port;
		$this->url      = $url;
		$this->curl     = false;
		$this->blocked  = false;
		$this->captured = array(
			'status'  => 0,
			'headers' => array(),
			'body'    => '',
		);
		add_filter( 'http_allowed_safe_ports', array( $this, 'allow_port' ), 10, 3 );
		add_action( 'http_api_curl', array( $this, 'curl' ), 10, 3 );
		add_action( 'requests-request.progress', array( $this, 'progress' ) );
		try {
			if ( false === wp_http_validate_url( $url ) ) {
				return array( 'error' => 'blocked' );
			}
			$response = wp_safe_remote_get(
				$url,
				array(
					'timeout'             => $left >= self::TIMEOUT ? self::TIMEOUT : $this->timeout,
					'redirection'         => 0,
					'limit_response_size' => self::MAX_BYTES,
					'user-agent'          => self::USER_AGENT,
					'headers'             => array( 'Origin' => Url_Variants::origin( home_url( '/' ) ) ),
				)
			);
		} catch ( RequestsException $e ) {
			$response = new WP_Error( 'http_request_failed', $e->getMessage() );
		} finally {
			remove_filter( 'http_allowed_safe_ports', array( $this, 'allow_port' ), 10 );
			remove_action( 'http_api_curl', array( $this, 'curl' ), 10 );
			remove_action( 'requests-request.progress', array( $this, 'progress' ) );
			$this->port = 0;
			$this->url  = '';
		}
		return $this->outcome( $response );
	}

	/**
	 * What a request gave, from the HTTP API's response and what the probe's
	 * callbacks kept or stopped.
	 *
	 * @param mixed $response Response of the HTTP API.
	 * @return array{status: int, headers: array<string, string>, body: string}|array{error: string}
	 */
	private function outcome( $response ): array {
		if ( $this->blocked ) {
			return array( 'error' => 'blocked' );
		}
		$cut = $this->cut( $response );
		if ( null !== $cut ) {
			return $cut;
		}
		if ( is_wp_error( $response ) ) {
			return array( 'error' => 'unreachable' );
		}
		return array(
			'status'  => (int) wp_remote_retrieve_response_code( $response ),
			'headers' => self::headers( wp_remote_retrieve_headers( $response ) ),
			'body'    => substr( wp_remote_retrieve_body( $response ), 0, self::MAX_BYTES ),
		);
	}

	/**
	 * What the probe's callbacks kept, when they stand for the response: with cURL
	 * whenever a response arrived (Requests sees neither headers nor body), and
	 * without cURL only when the transfer was cut, and then without a leading
	 * chunk-size line.
	 *
	 * @param mixed $response Response of the HTTP API.
	 * @return array{status: int, headers: array<string, string>, body: string}|null
	 */
	private function cut( $response ): ?array {
		if ( $this->curl && ( $this->captured['status'] > 0 || '' !== $this->captured['body'] ) ) {
			return $this->captured;
		}
		if ( is_wp_error( $response ) && '' !== $this->captured['body'] ) {
			// The raw body may start with the size line of a chunked response.
			$this->captured['body'] = (string) preg_replace( '/^[0-9a-f]{1,8}(;[^\r\n]*)?\r\n/i', '', $this->captured['body'] );
			return $this->captured;
		}
		return null;
	}

	/**
	 * The report with what the remote server wrote made safe: URLs through
	 * esc_url_raw() (empty ones left out) and mount names and types through
	 * sanitize_text_field() (ADR 0066 §4).
	 *
	 * @param array{kind: string, status: int|null, cors: bool|null, streams: list<string>, mounts: list<array{url: string, name: string, type: string}>, variant: array{url: string, kind: string, status: int|null}|null, notes: list<string>} $report Report.
	 * @return array{kind: string, status: int|null, cors: bool|null, streams: list<string>, mounts: list<array{url: string, name: string, type: string}>, variant: array{url: string, kind: string, status: int|null}|null, notes: list<string>}
	 */
	private static function sanitize( array $report ): array {
		$streams = array();
		foreach ( $report['streams'] as $stream ) {
			$stream = esc_url_raw( $stream, array( 'http', 'https' ) );
			if ( '' !== $stream ) {
				$streams[] = $stream;
			}
		}
		$mounts = array();
		foreach ( $report['mounts'] as $mount ) {
			$url = esc_url_raw( $mount['url'], array( 'http', 'https' ) );
			if ( '' !== $url ) {
				$mounts[] = array(
					'url'  => $url,
					'name' => sanitize_text_field( $mount['name'] ),
					'type' => sanitize_text_field( $mount['type'] ),
				);
			}
		}
		$report['streams'] = $streams;
		$report['mounts']  = $mounts;
		if ( null !== $report['variant'] ) {
			$report['variant']['url'] = esc_url_raw( $report['variant']['url'], array( 'http', 'https' ) );
		}
		return $report;
	}

	/**
	 * Whether a host is the one of home_url().
	 *
	 * @param string $host Host.
	 * @return bool
	 */
	private static function is_site_host( string $host ): bool {
		$home = Url_Variants::parse( home_url( '/' ) );
		return null !== $home && strtolower( $home['host'] ) === strtolower( trim( $host, '[]' ) );
	}

	/**
	 * Adds bytes to the kept body, up to 16 KB.
	 *
	 * @param string $data Bytes received.
	 * @return void
	 */
	private function keep( string $data ) {
		$room = self::MAX_BYTES - strlen( $this->captured['body'] );
		if ( $room > 0 ) {
			$this->captured['body'] .= substr( $data, 0, $room );
		}
	}

	/**
	 * Headers with lowercase names; several values are joined with commas.
	 *
	 * @param mixed $headers Headers of the response (array or Requests dictionary).
	 * @return array<string, string>
	 */
	private static function headers( $headers ): array {
		if ( is_object( $headers ) && method_exists( $headers, 'getAll' ) ) {
			$headers = $headers->getAll();
		}
		$result = array();
		foreach ( is_array( $headers ) ? $headers : array() as $name => $value ) {
			$result[ strtolower( (string) $name ) ] = is_array( $value ) ? implode( ', ', $value ) : (string) $value;
		}
		return $result;
	}
}
