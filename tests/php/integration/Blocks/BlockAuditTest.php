<?php
/**
 * Findings of the zone 4 audit (spec 0002, task 4.5): the blocks (3.4.2).
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Blocks;

use RadioPlayerPage\Tests\Integration\Support\Clock;
use RadioPlayerPage\Tests\Integration\Support\Factory;
use WP_REST_Request;
use WP_UnitTestCase;

/**
 * Pins, as they are, the oddities the audit of the three blocks confirmed
 * (docs/known-issues.md K46–K52 and a variant of C10; report in
 * docs/specs/0002-safety-net/audit/blocks.md). Times go through Clock, as in
 * BlockRenderTest.
 */
final class BlockAuditTest extends WP_UnitTestCase {

	/**
	 * Fixture factory.
	 *
	 * @var Factory
	 */
	private $factory_rpp;

	/**
	 * Creates the factory.
	 */
	public function set_up() {
		parent::set_up();

		$this->factory_rpp = new Factory();
	}

	/**
	 * A schedule entry.
	 *
	 * @param int    $program_id Program post ID.
	 * @param string $start      Start, HH:MM.
	 * @param string $end        End, HH:MM.
	 * @return array
	 */
	private static function slot( $program_id, $start, $end ) {
		return array(
			'program_id' => (string) $program_id,
			'start'      => $start,
			'end'        => $end,
			'is_rerun'   => false,
		);
	}

	/**
	 * Writes a schedule with vector days, rotated to the real ones.
	 *
	 * @param Clock $clock      Clock of the running check.
	 * @param int   $station_id Station post ID.
	 * @param array $schedule   Schedule keyed by vector day.
	 */
	private static function write_schedule( Clock $clock, $station_id, array $schedule ) {
		update_post_meta(
			$station_id,
			'radplapag_station_schedule',
			wp_slash( wp_json_encode( $clock->rotate_schedule( $schedule ) ) )
		);
	}

	/**
	 * Renders a block as a page would.
	 *
	 * @param string $name  Block name without the namespace.
	 * @param array  $attrs Block attributes.
	 * @return string
	 */
	private static function render( $name, array $attrs = array() ) {
		return render_block(
			array(
				'blockName'    => 'radplapag/' . $name,
				'attrs'        => $attrs,
				'innerBlocks'  => array(),
				'innerHTML'    => '',
				'innerContent' => array(),
			)
		);
	}

	/**
	 * K46: `stationId` picks the station whatever its position: creating a station whose
	 * title sorts first does not move a saved block, and an unpublished station renders
	 * the empty block, never another station.
	 */
	public function test_station_id_survives_title_order_and_unpublishing() {
		$f       = $this->factory_rpp;
		$beta    = $f->program( 'Beta show' );
		$beta_id = $f->station( 'Beta', array( 'schedule' => array( 'monday' => array( self::slot( $beta, '09:00', '10:00' ) ) ) ) );
		$beta_at = array(
			'stationId'    => $beta_id,
			'stationIndex' => 0,
		);

		$this->assertStringContainsString( 'Beta show', self::render( 'programs-list', $beta_at ) );

		$alpha    = $f->program( 'Alpha show' );
		$alpha_id = $f->station( 'Alpha', array( 'schedule' => array( 'monday' => array( self::slot( $alpha, '09:00', '10:00' ) ) ) ) );
		$alpha_at = array(
			'stationId'    => $alpha_id,
			'stationIndex' => 0,
		);

		$first = self::render( 'programs-list', $beta_at );
		$this->assertStringContainsString( 'Beta show', $first );
		$this->assertStringNotContainsString( 'Alpha show', $first );
		$this->assertStringContainsString( 'Alpha show', self::render( 'programs-list', $alpha_at ) );

		wp_update_post(
			array(
				'ID'          => $alpha_id,
				'post_status' => 'draft',
			)
		);

		$this->assertStringContainsString( 'Beta show', self::render( 'programs-list', $beta_at ) );
		$this->assertStringContainsString( 'No radio shows for this station.', self::render( 'programs-list', $alpha_at ) );
	}

	/**
	 * K49: without a player page, now playing prints the program name alone; «On Air»
	 * only lives inside the link.
	 */
	public function test_currently_now_playing_without_player_page_drops_the_on_air_label() {
		$f       = $this->factory_rpp;
		$program = $f->program( 'Show' );
		$linked  = $f->station(
			'Linked',
			array(
				'player_page' => $f->page( 'Player' ),
				'menu_order'  => 0,
			)
		);
		$plain   = $f->station( 'Plain', array( 'menu_order' => 1 ) );

		Clock::run(
			'wednesday',
			'10:00',
			function ( Clock $clock ) use ( $program, $linked, $plain ) {
				foreach ( array( $linked, $plain ) as $station_id ) {
					self::write_schedule( $clock, $station_id, array( 'wednesday' => array( self::slot( $program, '09:00', '11:00' ) ) ) );
				}

				$with_page    = self::render( 'now-playing', array( 'stationIndex' => 0 ) );
				$without_page = self::render( 'now-playing', array( 'stationIndex' => 1 ) );

				$this->assertStringContainsString( 'On Air: <strong>Show</strong>', $with_page );
				$this->assertStringContainsString( '<strong>Show</strong>', $without_page );
				$this->assertStringNotContainsString( 'On Air', $without_page );
			}
		);
	}

	/**
	 * K50: the link to the player page does not check that the page is still published:
	 * with the page back in draft, now playing and the schedule block link to
	 * `?page_id=N`, which visitors cannot open.
	 */
	public function test_currently_links_to_a_player_page_that_is_no_longer_published() {
		$f       = $this->factory_rpp;
		$program = $f->program( 'Show' );
		$page_id = $f->page( 'Player' );
		$station = $f->station( 'Main', array( 'player_page' => $page_id ) );
		wp_update_post(
			array(
				'ID'          => $page_id,
				'post_status' => 'draft',
			)
		);

		Clock::run(
			'wednesday',
			'10:00',
			function ( Clock $clock ) use ( $program, $station, $page_id ) {
				self::write_schedule( $clock, $station, array( 'wednesday' => array( self::slot( $program, '09:00', '11:00' ) ) ) );

				$href = 'href="' . esc_url( home_url( '/?page_id=' . $page_id ) ) . '"';
				$this->assertStringContainsString( $href, self::render( 'now-playing' ) );
				$this->assertStringContainsString( $href, self::render( 'schedule' ) );
			}
		);
	}

	/**
	 * C10 (variant): a slot of a draft program within the upcoming window is skipped,
	 * so the published program after it is announced.
	 *
	 * @see docs/known-issues.md C10
	 */
	public function test_draft_program_slot_does_not_hide_the_next_upcoming_program() {
		$f         = $this->factory_rpp;
		$draft     = $f->program( 'Bulletin', array(), 'draft' );
		$published = $f->program( 'Show' );
		$station   = $f->station( 'Main' );

		Clock::run(
			'monday',
			'09:58',
			function ( Clock $clock ) use ( $draft, $published, $station ) {
				self::write_schedule(
					$clock,
					$station,
					array(
						'monday' => array(
							self::slot( $draft, '10:00', '10:05' ),
							self::slot( $published, '10:05', '11:00' ),
						),
					)
				);

				$now_playing = radplapag_get_now_playing_for_station( 0 );
				$this->assertNull( $now_playing['current'] );
				$this->assertSame( 'Show', $now_playing['upcoming']['name'] );
			}
		);
	}

	/**
	 * K52: a 24-hour slot on every day (`start == end`, valid on the server, C3) is
	 * not announced as coming up while it is on air, also from 23:50 on.
	 */
	public function test_24_hour_slot_is_not_coming_up_while_on_air() {
		$f       = $this->factory_rpp;
		$program = $f->program( 'Always' );
		$station = $f->station( 'Main' );

		Clock::run(
			'monday',
			'23:55',
			function ( Clock $clock ) use ( $program, $station ) {
				$schedule = array();
				foreach ( Clock::DAYS as $day ) {
					$schedule[ $day ] = array( self::slot( $program, '00:00', '00:00' ) );
				}
				self::write_schedule( $clock, $station, $schedule );

				$now_playing = radplapag_get_now_playing_for_station( 0 );
				$this->assertSame( (string) $program, $now_playing['current']['id'] );
				$this->assertNull( $now_playing['upcoming'] );
			}
		);
	}

	/**
	 * K51: the line breaks of the extended description (a textarea, kept by the
	 * sanitizer) end up inside one `<p>`, where the browser shows them as spaces; the
	 * player keeps them (`white-space: pre-wrap`).
	 */
	public function test_currently_extended_description_line_breaks_stay_in_one_paragraph() {
		$f       = $this->factory_rpp;
		$program = $f->program( 'Show', array( 'extended_description' => "Line one\n\nLine two" ) );
		$f->station( 'Main', array( 'schedule' => array( 'monday' => array( self::slot( $program, '09:00', '10:00' ) ) ) ) );

		$html = self::render( 'programs-list' );

		$this->assertStringContainsString( "<p class=\"wp-block-paragraph\">Line one\n\nLine two</p>", $html );
		$this->assertStringNotContainsString( '<br', $html );
	}

	/**
	 * K53: none of the three blocks prints a heading element. Day names, program names
	 * and «On Air»/«Coming up» are `<header>` elements styled as headings (the schedule
	 * one with the `wp-block-heading` class), so a screen reader cannot jump between them.
	 */
	public function test_currently_blocks_print_no_heading_elements() {
		$f       = $this->factory_rpp;
		$program = $f->program( 'Show', array( 'description' => 'About' ) );
		$next    = $f->program( 'Next' );
		$station = $f->station( 'Main', array( 'player_page' => $f->page( 'Player' ) ) );

		Clock::run(
			'wednesday',
			'10:55',
			function ( Clock $clock ) use ( $program, $next, $station ) {
				self::write_schedule(
					$clock,
					$station,
					array(
						'wednesday' => array(
							self::slot( $program, '09:00', '11:00' ),
							self::slot( $next, '11:00', '12:00' ),
						),
					)
				);

				foreach ( array( 'now-playing', 'schedule', 'programs-list' ) as $name ) {
					$html = self::render( $name );
					$this->assertStringContainsString( '<header class="wp-block-', $html, $name );
					$this->assertDoesNotMatchRegularExpression( '/<h[1-6][\s>]/', $html, $name );
				}
				$this->assertStringContainsString( '<header class="wp-block-heading"', self::render( 'schedule' ) );
			}
		);
	}

	/**
	 * K48 (fixed in spec 0013): the editor notice of an empty now playing only goes to
	 * the editor preview (the block renderer). `content.rendered` of
	 * `GET /wp/v2/pages/<id>` prints nothing, as the front end does, for an anonymous
	 * reader and for an editor. The route is set in `query_vars['rest_route']` by hand,
	 * as the real routing does (rest_do_request() does not). Runs in its own process
	 * because REST_REQUEST is a constant.
	 *
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_rest_content_has_no_editor_notice() {
		$this->factory_rpp->station( 'Main' );
		$page_id = self::factory()->post->create(
			array(
				'post_type'    => 'page',
				'post_status'  => 'publish',
				'post_content' => '<!-- wp:radplapag/now-playing /-->',
			)
		);
		$editor  = self::factory()->user->create( array( 'role' => 'editor' ) );

		define( 'REST_REQUEST', true ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- WordPress core constant.
		$GLOBALS['wp']->query_vars['rest_route'] = '/wp/v2/pages/' . $page_id;

		$readers = array(
			0       => 'view',
			$editor => 'edit',
		);
		foreach ( $readers as $user_id => $context ) {
			wp_set_current_user( $user_id );
			$request = new WP_REST_Request( 'GET', '/wp/v2/pages/' . $page_id );
			$request->set_param( 'context', $context );

			$response = rest_do_request( $request );

			$this->assertSame( 200, $response->get_status(), $context );
			$this->assertSame( '', trim( $response->get_data()['content']['rendered'] ), $context );
		}
	}
}
