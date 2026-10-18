<?php
/**
 * Characterization of the render, registration and editor data of the three blocks (3.4.2).
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Blocks;

use RadioPlayerPage\Tests\Integration\Support\Clock;
use RadioPlayerPage\Tests\Integration\Support\Factory;
use RadioPlayerPage\Tests\Integration\Support\Snapshot;
use WP_Block_Type_Registry;
use WP_UnitTestCase;

/**
 * Pins the markup of `radplapag/schedule`, `radplapag/programs-list` and
 * `radplapag/now-playing` (SPEC.md §3.5) with snapshots in
 * tests/php/integration/snapshots/blocks/, rendered through render_block() so that
 * get_block_wrapper_attributes() runs as on a real page.
 *
 * The site is on a vector Wednesday at 10:55 (Clock), so `natural` and `current_first`
 * give different orders; schedules are written with vector days and rotated to the
 * real ones, and the output is rotated back before comparing.
 *
 * Fixture: station «Main» (player page «Player») with Morning (logo and both
 * descriptions; Wednesday 09:00–11:00, on air, and Monday 09:00–10:00), Early
 * (no meta; Wednesday 07:00–08:00) and Later (description only; Wednesday
 * 11:00–12:00, a rerun, coming up); station «Second» (no player page) with Early on
 * air (Wednesday 10:00–11:30); station «Silent» with Tuesday only.
 *
 * Cases:
 * - on WP 6.6 the wrapper carries its class twice (K6); newer WP prints it once, so
 *   the other tests compare the wrapper with repeated classes removed;
 * - schedule: dayOrder × showDescription × showExtendedDescription (8 snapshots);
 *   invalid index and a schedule without slots → «No radio schedule» message;
 * - programs list: showImage × showDescription × showExtendedDescription ×
 *   showSchedule (16 snapshots); invalid index → «No radio shows» message;
 * - now playing: showLogo × «Main» (logo, link, upcoming rerun) and «Second» (no
 *   logo, no link) (4 snapshots); nothing on air or invalid index → empty on the
 *   front; with REST_REQUEST → the editor placeholder;
 * - registration: apiVersion, attributes and defaults, supports, render callback and
 *   editor script handle;
 * - editor data: `{ stations: [ { label } ] }`, with «Radio Station N» for untitled
 *   stations, and nothing when the editor script is not registered.
 */
final class BlockRenderTest extends WP_UnitTestCase {

	const BLOCKS = array(
		'schedule'      => 'radplapagScheduleBlock',
		'programs-list' => 'radplapagProgramsListBlock',
		'now-playing'   => 'radplapagNowPlayingBlock',
	);

	/**
	 * Fixture factory.
	 *
	 * @var Factory
	 */
	private $factory_rpp;

	/**
	 * Station title → post ID.
	 *
	 * @var array<string, int>
	 */
	private $stations = array();

	/**
	 * Station title → schedule with vector days.
	 *
	 * @var array<string, array>
	 */
	private $schedules = array();

	/**
	 * Creates the programs and stations; schedules are written by render_at().
	 */
	public function set_up() {
		parent::set_up();

		$this->factory_rpp = new Factory();
		$f                 = $this->factory_rpp;

		$morning = $f->program(
			'Morning',
			array(
				'description'          => 'Wake up',
				'extended_description' => 'News & music',
				'logo_id'              => $f->image( 'Morning logo' ),
			)
		);
		$early   = $f->program( 'Early' );
		$later   = $f->program( 'Later', array( 'description' => 'Afternoon talk' ) );

		$this->stations['Main']   = $f->station(
			'Main',
			array(
				'player_page' => $f->page( 'Player' ),
				'menu_order'  => 0,
			)
		);
		$this->stations['Second'] = $f->station( 'Second', array( 'menu_order' => 1 ) );
		$this->stations['Silent'] = $f->station( 'Silent', array( 'menu_order' => 2 ) );

		$this->schedules = array(
			'Main'   => array(
				'monday'    => array( self::slot( $morning, '09:00', '10:00' ) ),
				'wednesday' => array(
					self::slot( $later, '11:00', '12:00', true ),
					self::slot( $morning, '09:00', '11:00' ),
					self::slot( $early, '07:00', '08:00' ),
				),
			),
			'Second' => array(
				'wednesday' => array( self::slot( $early, '10:00', '11:30' ) ),
			),
			'Silent' => array(
				'tuesday' => array( self::slot( $early, '20:00', '21:00' ) ),
			),
		);
	}

	/**
	 * A schedule entry.
	 *
	 * @param int    $program_id Program post ID.
	 * @param string $start      Start, HH:MM.
	 * @param string $end        End, HH:MM.
	 * @param bool   $is_rerun   Whether it is a rerun.
	 * @return array
	 */
	private static function slot( $program_id, $start, $end, $is_rerun = false ) {
		return array(
			'program_id' => (string) $program_id,
			'start'      => $start,
			'end'        => $end,
			'is_rerun'   => $is_rerun,
		);
	}

	/**
	 * Renders a block with the site on vector Wednesday 10:55 and returns the output with
	 * the real day keys and labels turned back into vector ones.
	 *
	 * @param string $name  Block name without the namespace.
	 * @param array  $attrs Block attributes.
	 * @param bool   $raw   Whether to keep repeated wrapper classes (K6).
	 * @return string
	 */
	private function render_at( $name, array $attrs, $raw = false ) {
		return Clock::run(
			'wednesday',
			'10:55',
			function ( Clock $clock ) use ( $name, $attrs, $raw ) {
				foreach ( $this->schedules as $title => $schedule ) {
					update_post_meta(
						$this->stations[ $title ],
						'radplapag_station_schedule',
						wp_slash( wp_json_encode( $clock->rotate_schedule( $schedule ) ) )
					);
				}

				$html = $raw ? self::render_raw( $name, $attrs ) : self::render( $name, $attrs );
				if ( ! $clock->holds() ) {
					$this->fail( 'The minute changed while rendering.' );
				}

				$map = array();
				foreach ( Clock::DAYS as $day ) {
					$map[ $day ]            = $clock->unrotate_day( $day );
					$map[ ucfirst( $day ) ] = ucfirst( $clock->unrotate_day( $day ) );
				}

				return strtr( $html, $map );
			}
		);
	}

	/**
	 * Renders a block as a page would.
	 *
	 * @param string $name  Block name without the namespace.
	 * @param array  $attrs Block attributes.
	 * @return string
	 */
	private static function render( $name, array $attrs ) {
		return self::unique_wrapper_classes( self::render_raw( $name, $attrs ) );
	}

	/**
	 * Removes repeated classes from the first `class` attribute (the wrapper's), which
	 * WP 6.6 prints twice and newer WP once (K6), so one snapshot fits both.
	 *
	 * @param string $html Rendered block.
	 * @return string
	 */
	private static function unique_wrapper_classes( $html ) {
		return preg_replace_callback(
			'/class="([^"]*)"/',
			static function ( $m ) {
				return 'class="' . implode( ' ', array_unique( explode( ' ', $m[1] ) ) ) . '"';
			},
			$html,
			1
		);
	}

	/**
	 * Renders a block as a page would, without normalizing anything.
	 *
	 * @param string $name  Block name without the namespace.
	 * @param array  $attrs Block attributes.
	 * @return string
	 */
	private static function render_raw( $name, array $attrs ) {
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
	 * Every combination of the given boolean attributes, keyed by a file-name suffix.
	 *
	 * @param array<string, string> $flags Attribute → short name.
	 * @return array<string, array>
	 */
	private static function combinations( array $flags ) {
		$out = array( '' => array() );
		foreach ( $flags as $attribute => $short ) {
			$next = array();
			foreach ( $out as $suffix => $attrs ) {
				foreach ( array( true, false ) as $value ) {
					$next[ $suffix . '-' . ( $value ? '' : 'no' ) . $short ] = $attrs + array( $attribute => $value );
				}
			}
			$out = $next;
		}

		return $out;
	}

	/**
	 * The 8 attribute combinations of the schedule block.
	 *
	 * @return array<string, array{string, array}>
	 */
	public function schedule_attributes() {
		$out = array();
		foreach ( array( 'natural', 'current_first' ) as $order ) {
			$flags = array(
				'showDescription'         => 'desc',
				'showExtendedDescription' => 'ext',
			);
			foreach ( self::combinations( $flags ) as $suffix => $attrs ) {
				$file         = 'schedule-' . str_replace( '_', '-', $order ) . $suffix . '.html';
				$out[ $file ] = array(
					$file,
					array(
						'stationIndex' => 0,
						'dayOrder'     => $order,
					) + $attrs,
				);
			}
		}

		return $out;
	}

	/**
	 * The 16 attribute combinations of the programs list block.
	 *
	 * @return array<string, array{string, array}>
	 */
	public function programs_list_attributes() {
		$flags = array(
			'showImage'               => 'image',
			'showDescription'         => 'desc',
			'showExtendedDescription' => 'ext',
			'showSchedule'            => 'schedule',
		);
		$out   = array();
		foreach ( self::combinations( $flags ) as $suffix => $attrs ) {
			$file         = 'programs-list' . $suffix . '.html';
			$out[ $file ] = array( $file, array( 'stationIndex' => 0 ) + $attrs );
		}

		return $out;
	}

	/**
	 * The 4 now playing cases: showLogo × station.
	 *
	 * @return array<string, array{string, array}>
	 */
	public function now_playing_attributes() {
		$out      = array();
		$stations = array(
			0 => 'main',
			1 => 'second',
		);
		foreach ( $stations as $index => $station ) {
			foreach ( array( true, false ) as $show_logo ) {
				$file         = 'now-playing-' . $station . '-' . ( $show_logo ? '' : 'no' ) . 'logo.html';
				$out[ $file ] = array(
					$file,
					array(
						'stationIndex' => $index,
						'showLogo'     => $show_logo,
					),
				);
			}
		}

		return $out;
	}

	/**
	 * The schedule block markup for each attribute combination.
	 *
	 * @dataProvider schedule_attributes
	 *
	 * @param string $file  Snapshot file name.
	 * @param array  $attrs Block attributes.
	 */
	public function test_schedule_render( $file, array $attrs ) {
		Snapshot::assert_matches( $this, 'blocks/' . $file, $this->render_at( 'schedule', $attrs ), $this->factory_rpp->names() );
	}

	/**
	 * The programs list block markup for each attribute combination.
	 *
	 * @dataProvider programs_list_attributes
	 *
	 * @param string $file  Snapshot file name.
	 * @param array  $attrs Block attributes.
	 */
	public function test_programs_list_render( $file, array $attrs ) {
		Snapshot::assert_matches( $this, 'blocks/' . $file, $this->render_at( 'programs-list', $attrs ), $this->factory_rpp->names() );
	}

	/**
	 * The now playing block markup for each case.
	 *
	 * @dataProvider now_playing_attributes
	 *
	 * @param string $file  Snapshot file name.
	 * @param array  $attrs Block attributes.
	 */
	public function test_now_playing_render( $file, array $attrs ) {
		Snapshot::assert_matches( $this, 'blocks/' . $file, $this->render_at( 'now-playing', $attrs ), $this->factory_rpp->names() );
	}

	/**
	 * The function get_block_wrapper_attributes() already adds the generated class
	 * `wp-block-radplapag-<name>`, and each render passes it again: WP 6.6 prints it twice,
	 * newer WP (checked on the latest in the CI) once. See K6 in docs/known-issues.md.
	 *
	 * @dataProvider registered_blocks
	 *
	 * @param string $name Block name without the namespace.
	 */
	public function test_currently_wrapper_class_is_repeated_on_wp_6_6( $name ) {
		$html  = ltrim( $this->render_at( $name, array( 'stationIndex' => 0 ), true ) );
		$class = 'wp-block-radplapag-' . $name;

		$this->assertSame( 1, preg_match( '/^<div class="([^"]*)"/', $html, $m ) );
		$expected = 0 === strpos( get_bloginfo( 'version' ), '6.6.' ) ? 2 : 1;
		$this->assertSame( $expected, count( array_keys( explode( ' ', $m[1] ), $class, true ) ) );
	}

	/**
	 * An invalid station index renders the «No radio schedule» message.
	 */
	public function test_schedule_invalid_index() {
		$this->assertSame(
			'<div class="wp-block-radplapag-schedule"><div class="wp-block-group is-empty"><p>No radio schedule for this station.</p></div></div>',
			self::render( 'schedule', array( 'stationIndex' => 99 ) )
		);
	}

	/**
	 * A station whose schedule has no slots renders the same message.
	 */
	public function test_schedule_without_slots() {
		$this->assertSame(
			'<div class="wp-block-radplapag-schedule"><div class="wp-block-group is-empty"><p>No radio schedule for this station.</p></div></div>',
			self::render( 'schedule', array( 'stationIndex' => 0 ) )
		);
	}

	/**
	 * An invalid station index renders the «No radio shows» message.
	 */
	public function test_programs_list_invalid_index() {
		$this->assertSame(
			'<div class="wp-block-radplapag-programs-list"><div class="wp-block-group is-empty"><p>No radio shows for this station.</p></div></div>',
			self::render( 'programs-list', array( 'stationIndex' => 99 ) )
		);
	}

	/**
	 * On the front, now playing prints nothing when nothing is on air or starting soon.
	 */
	public function test_now_playing_empty_on_front() {
		$this->assertSame( '', $this->render_at( 'now-playing', array( 'stationIndex' => 2 ) ) );
	}

	/**
	 * On the front, now playing prints nothing for an invalid station index.
	 */
	public function test_now_playing_invalid_index_on_front() {
		$this->assertSame( '', self::render( 'now-playing', array( 'stationIndex' => 99 ) ) );
	}

	/**
	 * In a REST request (the editor preview), an empty now playing prints a placeholder.
	 * Runs in its own process because REST_REQUEST is a constant.
	 *
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_now_playing_empty_in_rest_request() {
		define( 'REST_REQUEST', true ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- WordPress core constant.

		$this->assertSame(
			'<div class="wp-block-radplapag-now-playing is-empty"><div class="wp-block-group" style="border: 1px dashed currentColor; opacity: 0.6; padding: 1em;"><p><em>Now Playing: nothing to show — no program is currently on air or starting soon for this station. This block will render empty on the front end.</em></p></div></div>',
			self::render( 'now-playing', array( 'stationIndex' => 99 ) )
		);
	}

	/**
	 * Expected registration of each block (SPEC.md §3.5).
	 *
	 * @return array<string, array{string, array}>
	 */
	public function registered_blocks() {
		return array(
			'schedule'      => array(
				'schedule',
				array(
					'stationIndex'            => array(
						'type'    => 'number',
						'default' => 0,
					),
					'dayOrder'                => array(
						'type'    => 'string',
						'default' => 'current_first',
					),
					'showDescription'         => array(
						'type'    => 'boolean',
						'default' => true,
					),
					'showExtendedDescription' => array(
						'type'    => 'boolean',
						'default' => false,
					),
				),
			),
			'programs-list' => array(
				'programs-list',
				array(
					'stationIndex'            => array(
						'type'    => 'number',
						'default' => 0,
					),
					'showImage'               => array(
						'type'    => 'boolean',
						'default' => true,
					),
					'showDescription'         => array(
						'type'    => 'boolean',
						'default' => true,
					),
					'showExtendedDescription' => array(
						'type'    => 'boolean',
						'default' => true,
					),
					'showSchedule'            => array(
						'type'    => 'boolean',
						'default' => true,
					),
				),
			),
			'now-playing'   => array(
				'now-playing',
				array(
					'stationIndex' => array(
						'type'    => 'number',
						'default' => 0,
					),
					'showLogo'     => array(
						'type'    => 'boolean',
						'default' => true,
					),
				),
			),
		);
	}

	/**
	 * Each block is registered with apiVersion 3, its attributes and defaults, the shared
	 * supports, a server render and its editor script.
	 *
	 * @dataProvider registered_blocks
	 *
	 * @param string $name       Block name without the namespace.
	 * @param array  $attributes Expected own attributes.
	 */
	public function test_block_registration( $name, array $attributes ) {
		$type = WP_Block_Type_Registry::get_instance()->get_registered( 'radplapag/' . $name );

		$this->assertNotNull( $type );
		$this->assertSame( 3, $type->api_version );
		$this->assertSame( 'widgets', $type->category );
		// Block supports add their own attributes (style, className…), which vary by WP version.
		$this->assertSame( $attributes, array_intersect_key( $type->attributes, $attributes ) );
		$this->assertSame(
			array(
				'typography' => array(
					'fontSize'   => true,
					'lineHeight' => true,
				),
				'spacing'    => array(
					'margin'  => true,
					'padding' => true,
				),
				'color'      => array(
					'text'       => true,
					'background' => true,
				),
				'html'       => false,
			),
			$type->supports
		);
		$this->assertTrue( $type->is_dynamic() );
		$this->assertSame( array( 'radplapag-' . $name . '-editor-script' ), $type->editor_script_handles );
	}

	/**
	 * The schedule and programs list blocks render through named callbacks; now playing
	 * through its render.php file.
	 */
	public function test_render_callbacks() {
		$registry = WP_Block_Type_Registry::get_instance();

		$this->assertSame( 'radplapag_render_schedule_block', $registry->get_registered( 'radplapag/schedule' )->render_callback );
		$this->assertSame( 'radplapag_render_programs_list_block', $registry->get_registered( 'radplapag/programs-list' )->render_callback );
		$this->assertInstanceOf( \Closure::class, $registry->get_registered( 'radplapag/now-playing' )->render_callback );
	}

	/**
	 * Each editor script gets `{ stations: [ { label } ] }` in station order, with
	 * «Radio Station N» for a station without title.
	 */
	public function test_editor_data() {
		$untitled = $this->factory_rpp->station( '', array( 'menu_order' => 3 ) );
		$this->assertGreaterThan( 0, $untitled );

		foreach ( self::BLOCKS as $name => $object ) {
			$handle = 'radplapag-' . $name . '-editor-script';
			wp_scripts()->add_data( $handle, 'data', '' );
		}

		do_action( 'enqueue_block_editor_assets' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- WordPress core hook.

		$expected = '{"stations":[{"label":"Main"},{"label":"Second"},{"label":"Silent"},{"label":"Radio Station 4"}]}';
		foreach ( self::BLOCKS as $name => $object ) {
			$this->assertSame(
				'var ' . $object . ' = ' . $expected . ';',
				wp_scripts()->get_data( 'radplapag-' . $name . '-editor-script', 'data' ),
				$name
			);
		}
	}

	/**
	 * Without its editor script registered, a block adds no editor data.
	 */
	public function test_editor_data_needs_registered_script() {
		foreach ( self::BLOCKS as $name => $object ) {
			$handle = 'radplapag-' . $name . '-editor-script';
			$script = wp_scripts()->query( $handle, 'registered' );
			wp_deregister_script( $handle );

			call_user_func( 'radplapag_enqueue_' . str_replace( '-', '_', $name ) . '_block_editor_assets' );

			$this->assertFalse( wp_scripts()->query( $handle, 'registered' ), $name );
			wp_scripts()->registered[ $handle ] = $script;
		}
	}
}
