<?php
/**
 * Render callback for the Program Schedule block.
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
	$station_index    = isset( $attributes['stationIndex'] ) ? (int) $attributes['stationIndex'] : 0;
	$day_order        = isset( $attributes['dayOrder'] ) && $attributes['dayOrder'] === 'natural' ? 'natural' : 'current_first';
	$show_description = isset( $attributes['showDescription'] ) ? (bool) $attributes['showDescription'] : true;
	$data             = radplapag_get_schedule_for_station( $station_index, $day_order );

	if ( $data === null ) {
		return '<div class="wp-block-radplapag-schedule radplapag-schedule--empty">' .
			'<p class="radplapag-schedule__notice">' . esc_html__( 'No schedule defined for this station.', 'radio-player-page' ) . '</p>' .
			'</div>';
	}

	$days = isset( $data['days'] ) ? $data['days'] : [];
	$has_any_slots = false;
	foreach ( $days as $day_data ) {
		if ( ! empty( $day_data['slots'] ) ) {
			$has_any_slots = true;
			break;
		}
	}

	if ( ! $has_any_slots ) {
		return '<div class="wp-block-radplapag-schedule radplapag-schedule--empty">' .
			'<p class="radplapag-schedule__notice">' . esc_html__( 'No schedule defined for this station.', 'radio-player-page' ) . '</p>' .
			'</div>';
	}

	$station_page_url = isset( $data['station_page_url'] ) ? $data['station_page_url'] : '';
	$station_page_url = ( is_string( $station_page_url ) && $station_page_url !== '' ) ? $station_page_url : '';

	$html = '<div class="wp-block-radplapag-schedule">';

	foreach ( $days as $day_data ) {
		$slots = isset( $day_data['slots'] ) ? $day_data['slots'] : [];
		if ( empty( $slots ) ) {
			continue;
		}
		$day_key  = isset( $day_data['day_key'] ) ? $day_data['day_key'] : '';
		$label    = isset( $day_data['label'] ) ? $day_data['label'] : $day_key;
		$html    .= '<section class="radplapag-schedule-day" data-day="' . esc_attr( $day_key ) . '">';
		$html    .= '<h3 class="radplapag-schedule-day__title">' . esc_html( $label ) . '</h3>';
		$html    .= '<ul class="radplapag-schedule-day__slots">';

		foreach ( $slots as $slot ) {
			$program_name = isset( $slot['program_name'] ) ? $slot['program_name'] : '';
			$time_range   = isset( $slot['time_range'] ) ? $slot['time_range'] : '';
			$is_live      = ! empty( $slot['is_live'] );
			$slot_class   = 'radplapag-schedule-slot';
			if ( $is_live ) {
				$slot_class .= ' radplapag-schedule-slot--live';
			}
			$html .= '<li class="' . esc_attr( $slot_class ) . '"' . ( $is_live ? ' data-is-live="true"' : '' ) . '>';
			$slot_content = '<span class="radplapag-schedule-slot__name">' . esc_html( $program_name !== '' ? $program_name : '—' ) . '</span>';
			$slot_content .= ' - <span class="radplapag-schedule-slot__time">' . esc_html( $time_range ) . '</span>';
			if ( $is_live ) {
				$slot_content = '<span class="radplapag-schedule-slot__live-label">' . esc_html__( 'On air', 'radio-player-page' ) . '</span>: ' . $slot_content;
			}
			$html .= '<p class="radplapag-schedule-slot__line">';
			if ( $is_live && $station_page_url !== '' ) {
				$html .= '<a href="' . esc_url( $station_page_url ) . '" class="radplapag-schedule-slot__link" target="_blank" rel="noopener noreferrer">' . $slot_content . '</a>';
			} else {
				$html .= $slot_content;
			}
			$html .= '</p>';
			if ( $show_description ) {
				$program_description = isset( $slot['program_description'] ) ? $slot['program_description'] : '';
				if ( $program_description !== '' ) {
					$html .= '<p class="radplapag-schedule-slot__description">' . esc_html( $program_description ) . '</p>';
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
