<?php
defined( 'ABSPATH' ) || exit;

/**
 * Admin strings and config for JavaScript localization (station-admin.js).
 *
 * @package radio-player-page
 * @since 3.3.0
 */

/**
 * Returns admin strings and config for JavaScript localization.
 *
 * @since 1.0.0
 *
 * @return array Array with 'programs' (list for schedule dropdowns) and 'strings' (translated strings for station-admin.js).
 */
function radplapag_get_admin_strings() {
	$programs = function_exists( 'radplapag_get_all_programs_for_select' ) ? radplapag_get_all_programs_for_select() : array();
	return array(
		'programs' => $programs,
		'strings'  => array(
			'addProgramImage'          => __( 'Add Radio Show Image', 'radio-player-page' ),
			'selectImage'              => __( 'Select Image', 'radio-player-page' ),
			'changeImage'              => __( 'Change Image', 'radio-player-page' ),
			'streamUrlRequired'        => __( 'This field is required.', 'radio-player-page' ),
			'streamUrlInvalid'         => __( 'Please enter a valid URL.', 'radio-player-page' ),
			'playerPageRequired'       => __( 'This field is required.', 'radio-player-page' ),
			'playerPageAlreadyAssigned' => __( 'This Player Page is already assigned to another station. Please choose a different page.', 'radio-player-page' ),
			'monday'                   => __( 'Monday', 'radio-player-page' ),
			'tuesday'                  => __( 'Tuesday', 'radio-player-page' ),
			'wednesday'                => __( 'Wednesday', 'radio-player-page' ),
			'thursday'                 => __( 'Thursday', 'radio-player-page' ),
			'friday'                   => __( 'Friday', 'radio-player-page' ),
			'saturday'                 => __( 'Saturday', 'radio-player-page' ),
			'sunday'                   => __( 'Sunday', 'radio-player-page' ),
			'invalidTimeFormat'        => __( 'Invalid time format. Times must be in HH:MM format.', 'radio-player-page' ),
			'completeTimeFields'       => __( 'Please complete all time fields.', 'radio-player-page' ),
			'startEndSame'             => __( 'Start and end times cannot be the same', 'radio-player-page' ),
			'unnamedProgram'           => __( 'Unnamed Radio Show', 'radio-player-page' ),
			'timeSlotOverlapsWith'     => __( 'This time slot overlaps with', 'radio-player-page' ),
			/* translators: %s: program name or time slot description. */
			'timeSlotOverlapsWithMessage' => __( 'This time slot overlaps with: %s', 'radio-player-page' ),
			'pleaseSelectProgram'      => __( 'Please select a Radio Show.', 'radio-player-page' ),
			'pleaseSelectProgramWithName' => __( 'Please select a Radio Show and enter a name. Radio Show name is required for the schedule.', 'radio-player-page' ),
			'allFieldsRequired'        => __( 'All fields are required.', 'radio-player-page' ),
			'selectProgram'            => __( 'Select Radio Show', 'radio-player-page' ),
			'to'                       => __( 'to', 'radio-player-page' ),
			'removeTimeSlot'           => __( 'Remove Time Slot', 'radio-player-page' ),
			'showMoreFields'           => __( 'Show optional fields', 'radio-player-page' ),
			'hideMoreFields'           => __( 'Hide optional fields', 'radio-player-page' ),
			'programName'              => __( 'Radio Show name', 'radio-player-page' ),
			'programImageLabel'        => __( 'Radio Show Image', 'radio-player-page' ),
			'programDescription'       => __( 'e.g. Morning news with Howard Mallory and guests', 'radio-player-page' ),
			'descriptionLabel'         => __( 'Description', 'radio-player-page' ),
			'programExtendedDescription' => __( 'e.g. Join us every morning for in-depth interviews, breaking news analysis, and listener calls. Howard Mallory brings decades of experience to the microphone, covering local politics [...]', 'radio-player-page' ),
			'extendedDescriptionLabel' => __( 'Extended Description', 'radio-player-page' ),
			'removeImage'              => __( 'Remove Image', 'radio-player-page' ),
			'recommendedImageSize'     => __( 'Recommended size: 512x512 pixels.', 'radio-player-page' ),
			'recommendedProgramImageSize' => __( 'Recommended size: 256x256 pixels.', 'radio-player-page' ),
			'removeProgram'            => __( 'Remove Radio Show', 'radio-player-page' ),
			'programNameRequired'      => __( 'Radio Show name is required. Enter a name to use this Radio Show in the schedule.', 'radio-player-page' ),
		),
	);
}
