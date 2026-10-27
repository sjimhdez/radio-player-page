<?php
/**
 * Server-side render for the Now Playing block.
 *
 * Wired via the "render" key in block.json. WordPress core requires this file directly
 * (not require_once) on every render, inside a closure that already exposes $attributes,
 * $content, and $block. Deliberately wrapped in an anonymous function (not a named one): a
 * named function here would be redeclared — and fatal — the second time the block renders in
 * the same request (e.g. content + excerpt generation on the front end); an anonymous function
 * has no name to collide with, and keeps these variables out of WordPress Coding Standards'
 * "global variable" scope.
 *
 * Each piece of output is escaped right at the point it's echoed — not built into a combined
 * string first — since the escaping sniff can't verify safety through an intermediate
 * variable. get_block_wrapper_attributes() already returns an attribute-escaped string, but
 * WPCS's EscapeOutput sniff doesn't recognize it as an escaping function, so it's wrapped in
 * wp_kses_post() (safe here: the string has no tags for wp_kses to touch) purely to satisfy
 * the sniff.
 *
 * @package radio-player-page
 * @since 3.4.0
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Block content (empty for dynamic).
 * @var WP_Block $block      Block instance.
 */

defined( 'ABSPATH' ) || exit;

( function ( $attributes ) {
	$station_id    = (int) ( $attributes['stationId'] ?? 0 );
	$station_index = (int) ( $attributes['stationIndex'] ?? 0 );
	$station_index = $station_id > 0 ? \RadioPlayerPage\Data\Stations::block_index( radplapag_get_stations(), $station_id, $station_index ) : $station_index;
	$show_logo     = (bool) ( $attributes['showLogo'] ?? true );
	$heading_level = (int) ( $attributes['headingLevel'] ?? 2 );
	$heading_level = ( $heading_level >= 2 && $heading_level <= 6 ) ? $heading_level : 2;
	$now_playing   = radplapag_get_now_playing_for_station( $station_index );

	if ( null === $now_playing || null === $now_playing['current'] ) {
		// Only the editor preview gets the notice; other REST responses print nothing, as the front does (K48).
		$rest_route = isset( $GLOBALS['wp']->query_vars['rest_route'] ) ? (string) $GLOBALS['wp']->query_vars['rest_route'] : '';
		if ( ! defined( 'REST_REQUEST' ) || ! REST_REQUEST || 0 !== strpos( $rest_route, '/wp/v2/block-renderer/radplapag/now-playing' ) ) {
			return;
		}

		echo '<div ' . wp_kses_post( get_block_wrapper_attributes( array( 'class' => 'is-empty' ) ) ) . '>' .
			'<div class="wp-block-group" style="border: 1px dashed currentColor; opacity: 0.6; padding: 1em;">' .
			'<p><em>' . esc_html__( 'Now Playing: nothing to show — no program is currently on air or starting soon for this station. This block will render empty on the front end.', 'radio-player-page' ) . '</em></p>' .
			'</div>' .
			'</div>';
		return;
	}

	$current          = $now_playing['current'];
	$upcoming         = $now_playing['upcoming'];
	$station_page_url = $now_playing['station_page_url'];
	// phpcs:disable Squiz.ControlStructures.ControlSignature.NewlineAfterOpenBrace -- Inline markup: a line break here would change the block's HTML output.
	?>
	<div <?php echo wp_kses_post( get_block_wrapper_attributes() ); ?>>
		<article class="wp-block-group" data-program-id="<?php echo esc_attr( $current['id'] ); ?>">
			<h<?php echo (int) $heading_level; ?> class="wp-block-title" style="font-size: 1.5rem;">
				
				<?php if ( '' !== $station_page_url ) : ?>
					<a href="<?php echo esc_url( $station_page_url ); ?>" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'On Air', 'radio-player-page' ); ?>: <strong><?php echo esc_html( $current['name'] ); ?></strong><?php if ( ! empty( $current['is_rerun'] ) ) : ?> <?php esc_html_e( '(Rerun)', 'radio-player-page' ); ?><?php endif; ?></a>
				<?php else : ?>
					<?php esc_html_e( 'On Air', 'radio-player-page' ); ?>: <strong><?php echo esc_html( $current['name'] ); ?></strong><?php if ( ! empty( $current['is_rerun'] ) ) : ?> <?php esc_html_e( '(Rerun)', 'radio-player-page' ); ?><?php endif; ?>
				<?php endif; ?>
			</h<?php echo (int) $heading_level; ?>>
			<?php if ( $show_logo && $current['logo_id'] > 0 ) : ?>
				<figure class="wp-block-image" style="margin-top: 0.5em;margin-bottom: 0.5em; max-width: 15rem;">
					<?php if ( '' !== $station_page_url ) : ?>
						<a href="<?php echo esc_url( $station_page_url ); ?>" target="_blank" rel="noopener noreferrer">
							<?php
							echo wp_get_attachment_image(
								$current['logo_id'],
								'medium',
								false,
								array(
									'alt'   => esc_attr( '' !== $current['name'] ? $current['name'] : __( 'Radio Show image', 'radio-player-page' ) ),
									'style' => 'max-width: 100%; height: auto;',
								)
							);
							?>
						</a>
					<?php else : ?>
						<?php
						echo wp_get_attachment_image(
							$current['logo_id'],
							'medium',
							false,
							array(
								'alt'   => esc_attr( '' !== $current['name'] ? $current['name'] : __( 'Radio Show image', 'radio-player-page' ) ),
								'style' => 'max-width: 100%; height: auto;',
							)
						);
						?>
					<?php endif; ?>
				</figure>
			<?php endif; ?>
			<p class="wp-block-paragraph" style="font-size: 80%;">
				<?php echo esc_html( $current['time_range'] ); ?>
			</p>
		</article>
		<?php if ( null !== $upcoming ) : ?>
			<article class="wp-block-group" data-program-id="<?php echo esc_attr( $upcoming['id'] ); ?>" style="padding-top: 1em; font-size: 90%;">
				<h<?php echo (int) $heading_level; ?> class="wp-block-title" style="font-size: 1.5rem;"><?php esc_html_e( 'Coming up', 'radio-player-page' ); ?>: <strong><?php echo esc_html( $upcoming['name'] ); ?></strong><?php if ( ! empty( $upcoming['is_rerun'] ) ) : ?> <?php esc_html_e( '(Rerun)', 'radio-player-page' ); ?><?php endif; ?></h<?php echo (int) $heading_level; ?>>
				<p class="wp-block-paragraph" style="font-size: 90%;">
					<?php echo esc_html( $upcoming['time_range'] ); ?>
				</p>
			</article>
		<?php endif; ?>
	</div>
	<?php
	// phpcs:enable Squiz.ControlStructures.ControlSignature.NewlineAfterOpenBrace
} )( $attributes );
