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
	 * K49: now playing prints «On Air: » before the program name with and without a
	 * player page, as «Up Next: » and the schedule block do.
	 */
	public function test_now_playing_without_player_page_keeps_the_on_air_label() {
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
				$this->assertStringContainsString( 'On Air: <strong>Show</strong>', $without_page );
				$this->assertStringNotContainsString( 'href=', $without_page );
			}
		);
	}

	/**
	 * K50: the link to the player page is printed only when the page serves the clean
	 * player page (D6): with the page in draft, private, password-protected or the
	 * posts page of a static front page, neither now playing nor the schedule block
	 * link to it.
	 *
	 * @dataProvider data_player_pages_that_are_not_served
	 *
	 * @param array<string, mixed> $page_changes Fields set on the player page.
	 * @param bool                 $posts_page   Whether the page becomes the posts page of a static front page.
	 */
	public function test_does_not_link_to_a_player_page_that_is_not_served( array $page_changes, $posts_page ) {
		$f       = $this->factory_rpp;
		$program = $f->program( 'Show' );
		$page_id = $f->page( 'Player' );
		$station = $f->station( 'Main', array( 'player_page' => $page_id ) );
		if ( $page_changes ) {
			wp_update_post( array_merge( array( 'ID' => $page_id ), $page_changes ) );
		}
		if ( $posts_page ) {
			update_option( 'show_on_front', 'page' );
			update_option( 'page_for_posts', $page_id );
		}

		Clock::run(
			'wednesday',
			'10:00',
			function ( Clock $clock ) use ( $program, $station ) {
				self::write_schedule( $clock, $station, array( 'wednesday' => array( self::slot( $program, '09:00', '11:00' ) ) ) );

				$now_playing = self::render( 'now-playing' );
				$schedule    = self::render( 'schedule' );

				$this->assertStringContainsString( 'On Air: <strong>Show</strong>', $now_playing );
				$this->assertStringNotContainsString( 'href=', $now_playing );
				$this->assertStringContainsString( 'Show', $schedule );
				$this->assertStringNotContainsString( 'href=', $schedule );
			}
		);
	}

	/**
	 * Player pages that do not serve the clean player page.
	 *
	 * @return array<string, array{0: array<string, mixed>, 1: bool}>
	 */
	public static function data_player_pages_that_are_not_served() {
		return array(
			'draft'      => array( array( 'post_status' => 'draft' ), false ),
			'private'    => array( array( 'post_status' => 'private' ), false ),
			'password'   => array( array( 'post_password' => 'secret' ), false ),
			'posts page' => array( array(), true ),
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
	 * K51 (fixed in spec 0013): the line breaks of the extended description (a
	 * textarea, kept by the sanitizer) become `<br />` inside the same `<p>`, in the
	 * programs list and in the schedule, and the text stays escaped.
	 */
	public function test_extended_description_keeps_its_line_breaks() {
		$f       = $this->factory_rpp;
		$program = $f->program( 'Show', array( 'extended_description' => "Line one\n\nLine two & more" ) );
		$f->station( 'Main', array( 'schedule' => array( 'monday' => array( self::slot( $program, '09:00', '10:00' ) ) ) ) );

		$renders = array(
			'programs-list' => self::render( 'programs-list' ),
			'schedule'      => self::render( 'schedule', array( 'showExtendedDescription' => true ) ),
		);
		foreach ( $renders as $name => $html ) {
			$this->assertMatchesRegularExpression(
				'#<p class="wp-block-paragraph"[^>]*>Line one<br />\n<br />\nLine two &amp; more</p>#',
				$html,
				$name
			);
		}
	}

	/**
	 * K53 (fixed in spec 0013): the three blocks print real `<hN>` headings (day names,
	 * program names and «On Air»/«Up Next») with the same classes, never `<header>`.
	 * `headingLevel` picks the level (2–6, default 2); any other value falls back to 2.
	 */
	public function test_blocks_print_heading_elements() {
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
					$this->assertStringContainsString( '<h2 class="wp-block-', $html, $name );
					$this->assertStringNotContainsString( '<header', $html, $name );
					$this->assertDoesNotMatchRegularExpression( '/<h[13-6][\s>]/', $html, $name );

					$html = self::render( $name, array( 'headingLevel' => 4 ) );
					$this->assertStringContainsString( '<h4 class="wp-block-', $html, $name );
					$this->assertStringContainsString( '</h4>', $html, $name );
					$this->assertDoesNotMatchRegularExpression( '/<h[1-35-6][\s>]/', $html, $name );

					foreach ( array( 9, 1 ) as $level ) {
						$html = self::render( $name, array( 'headingLevel' => $level ) );
						$this->assertStringContainsString( '<h2 class="wp-block-', $html, $name . ' ' . $level );
						$this->assertDoesNotMatchRegularExpression( '/<h[13-6][\s>]/', $html, $name . ' ' . $level );
					}
				}
				$this->assertStringContainsString( '<h2 class="wp-block-heading"', self::render( 'schedule' ) );
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
