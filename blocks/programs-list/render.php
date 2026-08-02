<?php
defined( 'ABSPATH' ) || exit;

/**
 * Render callback for the Programs List block.
 *
 * Outputs semantic HTML (no plugin CSS) so the editor/theme controls design.
 *
 * @package radio-player-page
 * @since 3.3.0
 *
 * @param array    $attributes Block attributes.
 * @param string   $content    Block content (empty for dynamic).
 * @param WP_Block $block      Block instance.
 * @return string HTML output.
 */
function radplapag_render_programs_list_block( $attributes, $content, $block ) {
	$station_index             = (int) ( $attributes['stationIndex'] ?? 0 );
	$show_image                = (bool) ( $attributes['showImage'] ?? true );
	$show_description          = (bool) ( $attributes['showDescription'] ?? true );
	$show_extended_description = (bool) ( $attributes['showExtendedDescription'] ?? true );
	$show_schedule             = (bool) ( $attributes['showSchedule'] ?? true );
	$wrapper_attributes        = get_block_wrapper_attributes(
		[
			'class' => 'wp-block-radplapag-programs-list',
		]
	);

	$programs = radplapag_get_programs_list_for_station( $station_index );

	if ( $programs === null || ! is_array( $programs ) || count( $programs ) === 0 ) {
		return '<div ' . $wrapper_attributes . '>' .
			'<div class="wp-block-group is-empty"><p>' . esc_html__( 'No radio shows for this station.', 'radio-player-page' ) . '</p></div>' .
			'</div>';
	}

	$html   = '<div ' . $wrapper_attributes . '>';
	$total  = count( $programs );
	$index  = 0;

	foreach ( $programs as $prog ) {
		$index++;
		$id          = (string) ( $prog['id'] ?? '' );
		$name        = (string) ( $prog['name'] ?? '' );
		$logo_id     = (int) ( $prog['logo_id'] ?? 0 );
		$description = $prog['description'] ?? null;
		$ext_desc    = $prog['extended_description'] ?? null;
		$slots       = is_array( $prog['slots'] ?? null ) ? $prog['slots'] : [];

		$html .= '<article class="wp-block-group"' . ( $id !== '' ? ' data-program-id="' . esc_attr( $id ) . '"' : '' ) . '>';

		$html .= '<header class="wp-block-title" style="font-size:1.5em;">' . esc_html( $name !== '' ? $name : '—' ) . '</header>';

		if ( $show_image && $logo_id > 0 ) {
			$img_alt = $name !== '' ? $name : __( 'Radio Show image', 'radio-player-page' );
			$html   .= '<figure class="wp-block-image has-small-padding-bottom" style="max-width: 15rem;">' . wp_get_attachment_image(
				$logo_id,
				'medium',
				false,
				[
					'alt'   => esc_attr( $img_alt ),
					'style' => 'max-width: 100%; height: auto;',
				]
			) . '</figure>';
		}

		if ( $show_description && $description !== null && $description !== '' ) {
			$html .= '<div class="wp-block-group"><p class="wp-block-paragraph">' . esc_html( $description ) . '</p></div>';
		}

		if ( $show_extended_description && $ext_desc !== null && $ext_desc !== '' ) {
			$html .= '<div class="wp-block-group"><p class="wp-block-paragraph">' . esc_html( $ext_desc ) . '</p></div>';
		}

		if ( $show_schedule && ! empty( $slots ) ) {
			$html .= '<ul class="wp-block-list">';
			foreach ( $slots as $slot ) {
				$day_label  = (string) ( $slot['day_label'] ?? '' );
				$time_range = (string) ( $slot['time_range'] ?? '' );
				$is_live    = ! empty( $slot['is_live'] );
				$slot_class = 'wp-block-list-item';
				if ( $is_live ) {
					$slot_class .= ' is-live';
				}
				$slot_text = $day_label . ' ' . $time_range;
				if ( $is_live ) {
					$html .= '<li class="' . esc_attr( $slot_class ) . '" style="font-size:0.875em;"><span>' . esc_html__( 'On Air', 'radio-player-page' ) . '</span>: ' . esc_html( $slot_text ) . '</li>';
				} else {
					$html .= '<li class="' . esc_attr( $slot_class ) . '" style="font-size:0.875em;">' . esc_html( $slot_text ) . '</li>';
				}
			}
			$html .= '</ul>';
		}

		$html .= '</article>';

		if ( $index < $total ) {
			$html .= '<hr class="wp-block-separator" />';
		}
	}

	$html .= '</div>';

	return $html;
}
