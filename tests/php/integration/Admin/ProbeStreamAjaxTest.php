<?php
/**
 * Integration tests for radplapag_ajax_probe_stream().
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Admin;

use RadioPlayerPage\Tests\Unit\Support\StreamSamples;
use WPAjaxDieContinueException;
use WPAjaxDieStopException;
use WP_Ajax_UnitTestCase;
use WP_Error;

/**
 * The radplapag_probe_stream AJAX action (ADR 0064 §1 and §8): nonce and
 * manage_options before anything, and the probe's report without a body.
 */
final class ProbeStreamAjaxTest extends WP_Ajax_UnitTestCase {

	/**
	 * URLs that reached the HTTP API.
	 *
	 * @var list<string>
	 */
	private $requested = array();

	/**
	 * Answers the probe with a real Icecast stream sample, without core's update
	 * checks, which admin_init would run.
	 */
	public function set_up() {
		parent::set_up();
		$this->requested = array();
		remove_action( 'admin_init', '_maybe_update_core' );
		remove_action( 'admin_init', '_maybe_update_plugins' );
		remove_action( 'admin_init', '_maybe_update_themes' );
		add_filter( 'pre_http_request', array( $this, 'answer' ), 10, 3 );
	}

	/**
	 * Records a request of the probe and answers it. Anything else gets an
	 * error, so nothing leaves.
	 *
	 * @param false|array<string, mixed> $pre  Short-circuit value.
	 * @param array<string, mixed>       $args Request arguments.
	 * @param string                     $url  URL.
	 * @return array<string, mixed>|WP_Error
	 */
	public function answer( $pre, $args, $url ) {
		if ( 0 !== strpos( $url, 'http://93.184.215.14' ) ) {
			return new WP_Error( 'http_request_failed', 'Not in the test.' );
		}
		$this->requested[] = $url;
		$sample            = StreamSamples::load( 'streamguys-npr' );
		return array(
			'headers'  => $sample['headers'],
			'body'     => $sample['body'],
			'response' => array(
				'code'    => $sample['status'],
				'message' => 'OK',
			),
			'cookies'  => array(),
			'filename' => null,
		);
	}

	/**
	 * Calls the action and returns its decoded JSON.
	 *
	 * @return array<string, mixed>
	 */
	private function call() {
		try {
			$this->_handleAjax( 'radplapag_probe_stream' );
		} catch ( WPAjaxDieContinueException $e ) {
			unset( $e );
		}
		$this->assertIsString( $this->_last_response );
		return (array) json_decode( $this->_last_response, true );
	}

	/**
	 * Without a valid nonce the request dies with -1 and nothing is requested.
	 */
	public function test_without_nonce() {
		$this->_setRole( 'administrator' );
		$_POST['url']         = 'http://93.184.215.14/live';
		$_POST['_ajax_nonce'] = 'nope';

		$this->expectException( WPAjaxDieStopException::class );
		$this->expectExceptionMessage( '-1' );
		try {
			$this->_handleAjax( 'radplapag_probe_stream' );
		} finally {
			$this->assertSame( array(), $this->requested );
		}
	}

	/**
	 * Without manage_options the answer is an error and nothing is requested.
	 */
	public function test_without_capability() {
		$this->_setRole( 'editor' );
		$_POST['url']         = 'http://93.184.215.14/live';
		$_POST['_ajax_nonce'] = wp_create_nonce( 'radplapag_probe_stream' );

		$this->assertSame(
			array(
				'success' => false,
			),
			$this->call()
		);
		$this->assertSame( array(), $this->requested );
	}

	/**
	 * A URL that is not http(s) is an error and nothing is requested.
	 *
	 * @dataProvider data_bad_urls
	 *
	 * @param string|null $url Posted URL, or null for none.
	 */
	public function test_bad_url( $url ) {
		$this->_setRole( 'administrator' );
		if ( null !== $url ) {
			$_POST['url'] = $url;
		}
		$_POST['_ajax_nonce'] = wp_create_nonce( 'radplapag_probe_stream' );

		$this->assertFalse( $this->call()['success'] );
		$this->assertSame( array(), $this->requested );
	}

	/**
	 * Inputs for test_bad_url().
	 *
	 * @return array<string, array{string|null}>
	 */
	public function data_bad_urls() {
		return array(
			'missing' => array( null ),
			'empty'   => array( '' ),
			'ftp'     => array( 'ftp://93.184.215.14/live' ),
			'script'  => array( 'javascript:alert(1)' ),
		);
	}

	/**
	 * With nonce and capability, the report of the probe, without the body.
	 */
	public function test_report() {
		$this->_setRole( 'administrator' );
		$_POST['url']         = 'http://93.184.215.14:8000/live';
		$_POST['_ajax_nonce'] = wp_create_nonce( 'radplapag_probe_stream' );

		$response = $this->call();

		$this->assertTrue( $response['success'] );
		$this->assertSame( array( 'kind', 'status', 'cors', 'streams', 'mounts', 'variant', 'notes' ), array_keys( $response['data'] ) );
		$this->assertSame( 'audio', $response['data']['kind'] );
		$this->assertSame( 200, $response['data']['status'] );
		$this->assertSame( array( 'http://93.184.215.14:8000/live' ), $this->requested );
	}
}
