<?php
/**
 * Tests of RadioPlayerPage\WP\Player_Page.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Blocks;

use RadioPlayerPage\WP\Player_Page;
use WP_UnitTestCase;

/**
 * Pins the link to a player page: only a page that serves the clean player page
 * gets one (spec 0013, D6).
 */
final class PlayerPageTest extends WP_UnitTestCase {

	/**
	 * Creates a page.
	 *
	 * @param array<string, mixed> $args Post fields on top of a published page.
	 * @return int Page ID.
	 */
	private function page( array $args = array() ): int {
		return self::factory()->post->create(
			array_merge(
				array(
					'post_type'   => 'page',
					'post_status' => 'publish',
					'post_title'  => 'Player',
				),
				$args
			)
		);
	}

	/**
	 * A published page links to its permalink.
	 */
	public function test_published_page_links_to_its_permalink() {
		$page = $this->page();

		$this->assertSame( get_permalink( $page ), Player_Page::url( $page ) );
		$this->assertNotSame( '', Player_Page::url( $page ) );
	}

	/**
	 * No page, no link.
	 */
	public function test_zero_has_no_link() {
		$this->assertSame( '', Player_Page::url( 0 ) );
	}

	/**
	 * A missing page has no link.
	 */
	public function test_missing_page_has_no_link() {
		$page = $this->page();
		wp_delete_post( $page, true );

		$this->assertSame( '', Player_Page::url( $page ) );
	}

	/**
	 * Pages that are not published have no link.
	 *
	 * @dataProvider unpublished_statuses
	 *
	 * @param string $status Post status.
	 */
	public function test_unpublished_page_has_no_link( string $status ) {
		$page = $this->page( array( 'post_status' => $status ) );

		$this->assertSame( '', Player_Page::url( $page ) );
	}

	/**
	 * Statuses of a page that is not served.
	 *
	 * @return array<string, array{string}>
	 */
	public function unpublished_statuses(): array {
		return array(
			'draft'   => array( 'draft' ),
			'private' => array( 'private' ),
			'pending' => array( 'pending' ),
		);
	}

	/**
	 * A password-protected page has no link.
	 */
	public function test_password_protected_page_has_no_link() {
		$page = $this->page( array( 'post_password' => 'secret' ) );

		$this->assertSame( '', Player_Page::url( $page ) );
	}

	/**
	 * The posts page has no link while the front page shows a page (K27).
	 */
	public function test_posts_page_has_no_link_with_a_static_front_page() {
		$page = $this->page();
		update_option( 'show_on_front', 'page' );
		update_option( 'page_for_posts', $page );

		$this->assertSame( '', Player_Page::url( $page ) );
	}

	/**
	 * The same page is served while the front page shows the latest posts.
	 */
	public function test_posts_page_links_while_the_front_page_shows_posts() {
		$page = $this->page();
		update_option( 'show_on_front', 'posts' );
		update_option( 'page_for_posts', $page );

		$this->assertSame( get_permalink( $page ), Player_Page::url( $page ) );
	}

	/**
	 * A post that is not a page has no link.
	 */
	public function test_post_that_is_not_a_page_has_no_link() {
		$post = $this->page( array( 'post_type' => 'post' ) );

		$this->assertSame( '', Player_Page::url( $post ) );
	}
}
