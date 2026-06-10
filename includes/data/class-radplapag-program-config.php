<?php
/**
 * Program configuration value object (CPT radplapag_program).
 *
 * @package radio-player-page
 * @since 3.3.0
 */

defined( 'ABSPATH' ) || exit;

/**
 * Thin wrapper around program post data for symmetry with Radplapag_Station_Config.
 *
 * @since 3.3.0
 */
class Radplapag_Program_Config {

	/**
	 * Program post ID.
	 *
	 * @var int
	 */
	private int $post_id;

	/**
	 * Data from radplapag_get_program_data().
	 *
	 * @var array
	 */
	private array $data;

	/**
	 * @since 3.3.0
	 * @param int   $post_id Program post ID.
	 * @param array $data    Associative array from radplapag_get_program_data().
	 */
	private function __construct( int $post_id, array $data ) {
		$this->post_id = $post_id;
		$this->data    = $data;
	}

	/**
	 * @since 3.3.0
	 * @param int $post_id radplapag_program post ID.
	 * @return Radplapag_Program_Config|null
	 */
	public static function from_post_id( int $post_id ): ?Radplapag_Program_Config {
		if ( ! function_exists( 'radplapag_get_program_data' ) ) {
			return null;
		}
		if ( $post_id <= 0 ) {
			return null;
		}
		$data = radplapag_get_program_data( $post_id );
		if ( ! is_array( $data ) ) {
			return null;
		}
		return new self( $post_id, $data );
	}

	/**
	 * @since 3.3.0
	 * @return int
	 */
	public function get_post_id(): int {
		return $this->post_id;
	}

	/**
	 * Same shape as radplapag_get_program_data() plus id key.
	 *
	 * @since 3.3.0
	 * @return array
	 */
	public function to_array(): array {
		return array_merge(
			[ 'id' => $this->post_id ],
			$this->data
		);
	}
}
