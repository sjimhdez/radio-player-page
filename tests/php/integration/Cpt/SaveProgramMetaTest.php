<?php
/**
 * Characterization of radplapag_save_program_meta() (3.4.2).
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Cpt;

use RadioPlayerPage\Tests\Integration\Support\Factory;
use WP_UnitTestCase;

/**
 * Pins what saving the program edit form writes: guards, sanitizing, truncation
 * by bytes and the logo.
 */
final class SaveProgramMetaTest extends WP_UnitTestCase {

	/**
	 * Fixture factory.
	 *
	 * @var Factory
	 */
	private $factory_rpp;

	/**
	 * Program being saved.
	 *
	 * @var int
	 */
	private $program;

	/**
	 * Logo saved before each test.
	 *
	 * @var int
	 */
	private $old_logo;

	/**
	 * Logs in an administrator and creates the program with previous values.
	 */
	public function set_up() {
		parent::set_up();

		// WP_UnitTestCase unregisters all meta after each test; on a site it is registered on init.
		radplapag_register_program_meta();

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$this->factory_rpp = new Factory();
		$this->old_logo    = $this->factory_rpp->image( 'old' );
		$this->program     = $this->factory_rpp->program(
			'Program',
			array(
				'description'          => 'Old',
				'extended_description' => 'Old long',
				'logo_id'              => $this->old_logo,
			)
		);
		$_POST             = array();
	}

	/**
	 * Clears the request.
	 */
	public function tear_down() {
		$_POST = array();

		parent::tear_down();
	}

	/**
	 * Fills $_POST like the edit form, with a valid nonce, and saves.
	 *
	 * @param array    $fields  Form fields (names without the `radplapag_program_` prefix).
	 * @param int|null $post_id Post to save; the program by default.
	 */
	private function save( array $fields = array(), $post_id = null ) {
		$_POST['radplapag_program_meta_nonce'] = wp_create_nonce( 'radplapag_program_meta' );
		foreach ( $fields as $name => $value ) {
			$_POST[ 'radplapag_program_' . $name ] = wp_slash( $value );
		}

		radplapag_save_program_meta( null === $post_id ? $this->program : $post_id );
	}

	/**
	 * A program meta value of the saved program.
	 *
	 * @param string $key Meta key without the `radplapag_program_` prefix.
	 * @return mixed
	 */
	private function meta( $key ) {
		return get_post_meta( $this->program, 'radplapag_program_' . $key, true );
	}

	/**
	 * Asserts that the previous values are still there.
	 */
	private function assert_nothing_saved() {
		$this->assertSame( 'Old', $this->meta( 'description' ) );
		$this->assertSame( 'Old long', $this->meta( 'extended_description' ) );
		$this->assertSame( (string) $this->old_logo, $this->meta( 'logo_id' ) );
	}

	// Guards.

	/**
	 * Without the nonce field nothing is saved.
	 */
	public function test_without_nonce_nothing_is_saved() {
		$_POST['radplapag_program_description'] = 'New';

		radplapag_save_program_meta( $this->program );

		$this->assert_nothing_saved();
	}

	/**
	 * With a wrong nonce nothing is saved.
	 */
	public function test_with_invalid_nonce_nothing_is_saved() {
		$_POST['radplapag_program_meta_nonce']  = wp_create_nonce( 'radplapag_station_meta' );
		$_POST['radplapag_program_description'] = 'New';

		radplapag_save_program_meta( $this->program );

		$this->assert_nothing_saved();
	}

	/**
	 * A user without manage_options saves nothing, even with a valid nonce.
	 */
	public function test_without_manage_options_nothing_is_saved() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );

		$this->save( array( 'description' => 'New' ) );

		$this->assert_nothing_saved();
	}

	/**
	 * An autosave saves nothing. DOING_AUTOSAVE cannot be undefined, so the test runs
	 * in its own process.
	 *
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_during_autosave_nothing_is_saved() {
		define( 'DOING_AUTOSAVE', true ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- WordPress core constant.

		$this->save( array( 'description' => 'New' ) );

		$this->assert_nothing_saved();
	}

	/**
	 * A post of another type is not touched.
	 */
	public function test_other_post_type_is_not_touched() {
		$station = $this->factory_rpp->station( 'Station' );

		$this->save( array( 'description' => 'New' ), $station );

		$this->assertSame( array(), get_post_meta( $station, 'radplapag_program_description', false ) );
		$this->assert_nothing_saved();
	}

	/**
	 * The callback is hooked to the program's save_post, so wp_update_post() runs it.
	 */
	public function test_runs_on_save_post_of_the_program() {
		$_POST['radplapag_program_meta_nonce']  = wp_create_nonce( 'radplapag_program_meta' );
		$_POST['radplapag_program_description'] = 'New';

		wp_update_post( array( 'ID' => $this->program ) );

		$this->assertSame( 'New', $this->meta( 'description' ) );
	}

	// Fields.

	/**
	 * The three fields are saved, sanitized.
	 */
	public function test_saves_sanitized_fields() {
		$logo = $this->factory_rpp->image( 'logo' );

		$this->save(
			array(
				'description'          => "  <b>Morning</b>\n show ",
				'extended_description' => "<p>Line 1</p>\nLine \"2\"",
				'logo_id'              => (string) $logo,
			)
		);

		$this->assertSame( 'Morning show', $this->meta( 'description' ) );
		$this->assertSame( "Line 1\nLine \"2\"", $this->meta( 'extended_description' ) );
		$this->assertSame( (string) $logo, $this->meta( 'logo_id' ) );
	}

	/**
	 * Missing fields overwrite the previous values with empty ones.
	 */
	public function test_missing_fields_are_saved_empty() {
		$this->save();

		$this->assertSame( '', $this->meta( 'description' ) );
		$this->assertSame( '', $this->meta( 'extended_description' ) );
		$this->assertSame( '0', $this->meta( 'logo_id' ) );
	}

	/**
	 * A logo that is not an image, or does not exist, is saved as 0.
	 */
	public function test_logo_that_is_not_an_image_is_saved_as_0() {
		$audio = $this->factory_rpp->audio( 'audio' );

		$this->save( array( 'logo_id' => (string) $audio ) );
		$this->assertSame( '0', $this->meta( 'logo_id' ) );

		$this->save( array( 'logo_id' => '999999' ) );
		$this->assertSame( '0', $this->meta( 'logo_id' ) );
	}

	/**
	 * A negative logo ID goes through absint().
	 */
	public function test_negative_logo_id_goes_through_absint() {
		$logo = $this->factory_rpp->image( 'logo' );

		$this->save( array( 'logo_id' => '-' . $logo ) );

		$this->assertSame( (string) $logo, $this->meta( 'logo_id' ) );
	}

	/**
	 * The description is cut to 256 bytes and the extended one to 512.
	 */
	public function test_descriptions_are_truncated_by_bytes() {
		$this->save(
			array(
				'description'          => str_repeat( 'a', 300 ),
				'extended_description' => str_repeat( 'b', 600 ),
			)
		);

		$this->assertSame( str_repeat( 'a', 256 ), $this->meta( 'description' ) );
		$this->assertSame( str_repeat( 'b', 512 ), $this->meta( 'extended_description' ) );
	}

	/**
	 * Truncation counts bytes, not characters: 200 "é" (400 bytes) become 128.
	 */
	public function test_truncation_counts_bytes_not_characters() {
		$this->save( array( 'description' => str_repeat( 'é', 200 ) ) );

		$this->assertSame( str_repeat( 'é', 128 ), $this->meta( 'description' ) );
	}

	/**
	 * When the cut falls inside a multibyte character, the value ends in half a
	 * character; the registered sanitizer (sanitize_text_field() /
	 * sanitize_textarea_field()) sees invalid UTF-8 and the whole field is saved
	 * empty, without any error. K5 of docs/known-issues.md.
	 */
	public function test_currently_description_cut_inside_a_character_is_saved_empty() {
		$this->save(
			array(
				'description'          => str_repeat( 'a', 255 ) . 'é',
				'extended_description' => str_repeat( 'b', 511 ) . 'é',
			)
		);

		$this->assertSame( '', $this->meta( 'description' ) );
		$this->assertSame( '', $this->meta( 'extended_description' ) );
	}
}
