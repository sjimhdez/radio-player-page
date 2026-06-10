<?php
defined( 'ABSPATH' ) || exit;

/**
 * Render callback for the Radio Schedule block.
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
function radplapag_render_schedule_block( $attributes, $content, $block ) {
	$station_index             = (int) ( $attributes['stationIndex'] ?? 0 );
	$day_order                 = ( $attributes['dayOrder'] ?? '' ) === 'natural' ? 'natural' : 'current_first';
	$show_description          = (bool) ( $attributes['showDescription'] ?? true );
	$show_extended_description = (bool) ( $attributes['showExtendedDescription'] ?? false );
	$data             = radplapag_get_schedule_for_station( $station_index, $day_order );
	$wrapper_attributes = get_block_wrapper_attributes(
		[
			'class' => 'wp-block-radplapag-schedule',
		]
	);

	if ( $data === null ) {
		return '<div ' . $wrapper_attributes . '>' .
			'<div class="wp-block-group is-empty">' .
			'<p>' . esc_html__( 'No radio schedule for this station.', 'radio-player-page' ) . '</p>' .
			'</div>' .
			'</div>';
	}

	$days = $data['days'] ?? [];
	$has_any_slots = false;
	foreach ( $days as $day_data ) {
		if ( ! empty( $day_data['slots'] ) ) {
			$has_any_slots = true;
			break;
		}
	}

	if ( ! $has_any_slots ) {
		return '<div ' . $wrapper_attributes . '>' .
			'<div class="wp-block-group is-empty"><p>' . esc_html__( 'No radio schedule for this station.', 'radio-player-page' ) . '</p></div>' .
			'</div>';
	}

	$station_page_url = $data['station_page_url'] ?? '';
	$station_page_url = ( is_string( $station_page_url ) && $station_page_url !== '' ) ? $station_page_url : '';

	$html = '<div ' . $wrapper_attributes . '>';

	foreach ( $days as $day_data ) {
		$slots = $day_data['slots'] ?? [];
		if ( empty( $slots ) ) {
			continue;
		}
		$day_key = (string) ( $day_data['day_key'] ?? '' );
		$label   = (string) ( $day_data['label'] ?? $day_key );
		$html    .= '<section class="wp-block-group" data-day="' . esc_attr( $day_key ) . '">';
		$html    .= '<header class="wp-block-heading" style="font-size:1.5em;">' . esc_html( $label ) . '</header>';
		$html    .= '<ul class="wp-block-list">';

		foreach ( $slots as $slot ) {
			$program_name = (string) ( $slot['program_name'] ?? '' );
			$time_range   = (string) ( $slot['time_range'] ?? '' );
			$is_live      = ! empty( $slot['is_live'] );
			$slot_class   = 'wp-block-list-item';
			if ( $is_live ) {
				$slot_class .= ' is-live';
			}
			$html .= '<li class="' . esc_attr( $slot_class ) . '"' . ( $is_live ? ' data-is-live="true"' : '' ) . '>';
			$slot_content = '<span>' . esc_html( $program_name !== '' ? $program_name : '—' ) . '</span>';
			$slot_content .= ' - <span>' . esc_html( $time_range ) . '</span>';
			if ( $is_live ) {
				$slot_content = '<span>' . esc_html__( 'On Air', 'radio-player-page' ) . '</span>: ' . $slot_content;
			}
			$html .= '<p class="wp-block-paragraph">';
			if ( $is_live && $station_page_url !== '' ) {
				$html .= '<a href="' . esc_url( $station_page_url ) . '" target="_blank" rel="noopener noreferrer">' . $slot_content . '</a>';
			} else {
				$html .= $slot_content;
			}
			$html .= '</p>';
			if ( $show_description ) {
				$program_description = (string) ( $slot['program_description'] ?? '' );
				if ( $program_description !== '' ) {
					$html .= '<div class="wp-block-group"><p class="wp-block-paragraph" style="font-size:0.875em;">' . esc_html( $program_description ) . '</p></div>';
				}
			}
			if ( $show_extended_description ) {
				$program_extended_description = (string) ( $slot['program_extended_description'] ?? '' );
				if ( $program_extended_description !== '' ) {
					$html .= '<div class="wp-block-group"><p class="wp-block-paragraph" style="font-size:0.875em;">' . esc_html( $program_extended_description ) . '</p></div>';
				}
			}
			$html .= '</li>';
		}

		$html .= '</ul>';
		$html .= '</section>';
	}

	$html .= '</div>';

	return $html;
}
