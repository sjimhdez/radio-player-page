<?php
/**
 * Fixture factory for the integration tests.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Support;

use RuntimeException;

/**
 * Creates programs, stations, pages and attachments, and remembers a readable name
 * for each ID so Snapshot can replace IDs with names.
 *
 * Meta is written with update_post_meta(), so the sanitize callbacks registered by the
 * plugin apply, as they would for any other writer.
 */
final class Factory {

	const STATION_META = array(
		'stream_url'     => 'radplapag_station_stream_url',
		'player_page'    => 'radplapag_station_player_page',
		'background_id'  => 'radplapag_station_background_id',
		'logo_id'        => 'radplapag_station_logo_id',
		'intro_audio_id' => 'radplapag_station_intro_audio_id',
		'theme_color'    => 'radplapag_station_theme_color',
		'visualizer'     => 'radplapag_station_visualizer',
		'schedule'       => 'radplapag_station_schedule',
		'hide_title'     => 'radplapag_station_hide_title',
	);

	const PROGRAM_META = array(
		'description'          => 'radplapag_program_description',
		'extended_description' => 'radplapag_program_extended_description',
		'logo_id'              => 'radplapag_program_logo_id',
	);

	/**
	 * ID → placeholder name, in creation order.
	 *
	 * @var array<int, string>
	 */
	private $names = array();

	/**
	 * Creates a program.
	 *
	 * @param string $name   Program title.
	 * @param array  $meta   Keys of PROGRAM_META.
	 * @param string $status Post status.
	 * @return int Post ID.
	 */
	public function program( $name, array $meta = array(), $status = 'publish' ) {
		$id = $this->post( 'radplapag_program', $name, $status );
		$this->meta( $id, self::PROGRAM_META, $meta );

		return $this->name( $id, 'PROGRAM', $name );
	}

	/**
	 * Creates a station. `schedule` may be an array (stored as JSON, like the plugin
	 * does) or a raw string (to store invalid JSON).
	 *
	 * @param string $title Station title.
	 * @param array  $args  Keys of STATION_META, plus `status` and `menu_order`.
	 * @return int Post ID.
	 */
	public function station( $title, array $args = array() ) {
		$id = $this->post(
			'radplapag_station',
			$title,
			isset( $args['status'] ) ? $args['status'] : 'publish',
			isset( $args['menu_order'] ) ? (int) $args['menu_order'] : 0
		);
		unset( $args['status'], $args['menu_order'] );

		if ( isset( $args['schedule'] ) && is_array( $args['schedule'] ) ) {
			$args['schedule'] = wp_json_encode( $args['schedule'] );
		}
		$this->meta( $id, self::STATION_META, $args );

		return $this->name( $id, 'STATION', $title );
	}

	/**
	 * Creates a published page.
	 *
	 * @param string $title Page title.
	 * @return int Post ID.
	 */
	public function page( $title ) {
		return $this->name( $this->post( 'page', $title, 'publish' ), 'PAGE', $title );
	}

	/**
	 * Creates a JPEG attachment (wp_attachment_is_image() is true).
	 *
	 * @param string $name Attachment name.
	 * @return int Attachment ID.
	 */
	public function image( $name ) {
		return $this->attachment( $name, $name . '.jpg', 'image/jpeg' );
	}

	/**
	 * Creates an audio attachment.
	 *
	 * @param string $name Attachment name.
	 * @param string $mime MIME type.
	 * @return int Attachment ID.
	 */
	public function audio( $name, $mime = 'audio/mpeg' ) {
		$extension = 'audio/mpeg' === $mime ? 'mp3' : 'ogg';

		return $this->attachment( $name, $name . '.' . $extension, $mime );
	}

	/**
	 * ID → placeholder name of everything created, for Snapshot::normalize().
	 *
	 * @return array<int, string>
	 */
	public function names() {
		return $this->names;
	}

	/**
	 * Inserts a post or fails.
	 *
	 * @param string $type       Post type.
	 * @param string $title      Post title.
	 * @param string $status     Post status.
	 * @param int    $menu_order Menu order.
	 * @return int
	 * @throws RuntimeException When the post cannot be inserted.
	 */
	private function post( $type, $title, $status, $menu_order = 0 ) {
		$id = wp_insert_post(
			array(
				'post_type'   => $type,
				'post_title'  => $title,
				'post_status' => $status,
				'menu_order'  => $menu_order,
			),
			true
		);
		if ( is_wp_error( $id ) ) {
			throw new RuntimeException( esc_html( $id->get_error_message() ) );
		}

		return $id;
	}

	/**
	 * Inserts an attachment with its file path (no file on disk is needed).
	 *
	 * @param string $name Attachment name.
	 * @param string $file Relative path in uploads.
	 * @param string $mime MIME type.
	 * @return int
	 * @throws RuntimeException When the attachment cannot be inserted.
	 */
	private function attachment( $name, $file, $mime ) {
		$id = wp_insert_attachment(
			array(
				'post_title'     => $name,
				'post_mime_type' => $mime,
				'post_status'    => 'inherit',
			),
			$file,
			0,
			true
		);
		if ( is_wp_error( $id ) ) {
			throw new RuntimeException( esc_html( $id->get_error_message() ) );
		}

		return $this->name( $id, 'ATTACHMENT', $name );
	}

	/**
	 * Writes the given short keys as meta.
	 *
	 * @param int   $id     Post ID.
	 * @param array $keys   Short key → meta key.
	 * @param array $values Short key → value.
	 * @throws RuntimeException On an unknown key.
	 */
	private function meta( $id, array $keys, array $values ) {
		foreach ( $values as $key => $value ) {
			if ( ! isset( $keys[ $key ] ) ) {
				throw new RuntimeException( esc_html( "Unknown meta key: $key." ) );
			}
			update_post_meta( $id, $keys[ $key ], wp_slash( $value ) );
		}
	}

	/**
	 * Records the placeholder name of an ID.
	 *
	 * @param int    $id   Post ID.
	 * @param string $kind PROGRAM, STATION, PAGE or ATTACHMENT.
	 * @param string $name Readable name.
	 * @return int The same ID.
	 */
	private function name( $id, $kind, $name ) {
		$this->names[ $id ] = '{{' . $kind . ':' . $name . '}}';

		return $id;
	}
}
