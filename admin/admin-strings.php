<?php
/**
 * Admin strings and config for JavaScript localization (station-admin.js).
 *
 * @package radio-player-page
 * @since 3.3.0
 */

defined( 'ABSPATH' ) || exit;

/**
 * Returns admin strings and config for JavaScript localization.
 *
 * @since 1.0.0
 *
 * @return array Array with 'programs' (list for schedule dropdowns) and 'strings' (translated strings for station-admin.js).
 */
function radplapag_get_admin_strings(): array {
	$programs = function_exists( 'radplapag_get_all_programs_for_select' ) ? radplapag_get_all_programs_for_select() : array();
	return array(
		'programs' => $programs,
		'strings'  => array(
			'addProgramImage'                => __( 'Add Radio Show Image', 'radio-player-page' ),
			'selectImage'                    => __( 'Select Image', 'radio-player-page' ),
			'changeImage'                    => __( 'Change Image', 'radio-player-page' ),
			'streamUrlRequired'              => __( 'This field is required.', 'radio-player-page' ),
			'streamUrlInvalid'               => __( 'Please enter a valid URL.', 'radio-player-page' ),
			'streamUrlScheme'                => __( 'Please enter a URL that starts with http:// or https://.', 'radio-player-page' ),
			'playerPageRequired'             => __( 'This field is required.', 'radio-player-page' ),
			'playerPageAlreadyAssigned'      => __( 'This Player Page is already assigned to another station. Please choose a different page.', 'radio-player-page' ),
			'monday'                         => __( 'Monday', 'radio-player-page' ),
			'tuesday'                        => __( 'Tuesday', 'radio-player-page' ),
			'wednesday'                      => __( 'Wednesday', 'radio-player-page' ),
			'thursday'                       => __( 'Thursday', 'radio-player-page' ),
			'friday'                         => __( 'Friday', 'radio-player-page' ),
			'saturday'                       => __( 'Saturday', 'radio-player-page' ),
			'sunday'                         => __( 'Sunday', 'radio-player-page' ),
			'invalidTimeFormat'              => __( 'Invalid time format. Times must be in HH:MM format.', 'radio-player-page' ),
			'unnamedProgram'                 => __( 'Unnamed Radio Show', 'radio-player-page' ),
			'timeSlotOverlapsWith'           => __( 'This time slot overlaps with', 'radio-player-page' ),
			/* translators: %s: program name or time slot description. */
			'timeSlotOverlapsWithMessage'    => __( 'This time slot overlaps with: %s', 'radio-player-page' ),
			'pleaseSelectProgram'            => __( 'Please select a radio show.', 'radio-player-page' ),
			'pleaseSelectProgramWithName'    => __( 'Please select a Radio Show. A Radio Show Name is required for the schedule.', 'radio-player-page' ),
			'allFieldsRequired'              => __( 'All fields are required.', 'radio-player-page' ),
			'selectProgram'                  => __( 'Select a Radio Show', 'radio-player-page' ),
			'to'                             => __( 'to', 'radio-player-page' ),
			'remove'                         => _x( 'Remove', 'time slot link', 'radio-player-page' ),
			'removeTimeSlot'                 => __( 'Remove Time Slot', 'radio-player-page' ),
			'scheduleRerun'                  => __( 'Rerun', 'radio-player-page' ),
			'showMoreFields'                 => __( 'Show Optional Fields', 'radio-player-page' ),
			'hideMoreFields'                 => __( 'Hide Optional Fields', 'radio-player-page' ),
			'programName'                    => __( 'Radio Show Name', 'radio-player-page' ),
			'programImageLabel'              => __( 'Radio Show Image', 'radio-player-page' ),
			'programDescription'             => __( 'e.g. Morning news with Howard Mallory and guests', 'radio-player-page' ),
			'descriptionLabel'               => __( 'Description', 'radio-player-page' ),
			'programExtendedDescription'     => __( 'e.g. Join us every morning for in-depth interviews, breaking news analysis, and listener calls. Howard Mallory brings decades of experience to the microphone, covering local politics [...]', 'radio-player-page' ),
			'extendedDescriptionLabel'       => __( 'Extended Description', 'radio-player-page' ),
			'removeImage'                    => __( 'Remove Image', 'radio-player-page' ),
			'recommendedImageSize'           => __( 'Recommended size: 512x512 pixels.', 'radio-player-page' ),
			'recommendedProgramImageSize'    => __( 'Recommended size: 256x256 pixels.', 'radio-player-page' ),
			'removeProgram'                  => __( 'Remove Radio Show', 'radio-player-page' ),
			'programNameRequired'            => __( 'Radio Show Name is required. Enter a name to use this Radio Show in the schedule.', 'radio-player-page' ),
			'programNotPublished'            => __( 'This radio show is not published; this time slot is not shown on the site.', 'radio-player-page' ),
			'programLabel'                   => __( 'Radio Show', 'radio-player-page' ),
			'startTimeLabel'                 => __( 'Start time', 'radio-player-page' ),
			'endTimeLabel'                   => __( 'End time', 'radio-player-page' ),
			// "Test Stream" (spec 0018): one message per verdict code and note of stream-rules.js.
			'streamTesting'                  => __( 'Testing the stream…', 'radio-player-page' ),
			'streamUseUrl'                   => __( 'Use This URL', 'radio-player-page' ),
			/* translators: 1: mount point name, 2: its format, such as MP3 or AAC. */
			'streamMountLabel'               => __( '%1$s (%2$s)', 'radio-player-page' ),
			'streamPlays'                    => __( 'The stream works: it plays in this browser, and its server allows the visualizer. Safari and all browsers on iPhone and iPad show the static animation instead.', 'radio-player-page' ),
			'streamPlaysNoVisualizer'        => __( 'The stream plays with the static animation instead of the visualizer, because its server does not send CORS headers. To get the visualizer, ask your provider to add the header Access-Control-Allow-Origin: * to the stream.', 'radio-player-page' ),
			'streamPlaylist'                 => __( 'This is a playlist, not the stream. Use the stream it points to:', 'radio-player-page' ),
			'streamPlaylistEmpty'            => __( 'This is a playlist, but it has no stream address that this site can use.', 'radio-player-page' ),
			'streamIcecastMounts'            => __( 'This is the page of an Icecast server, not the stream. Choose one of its mount points:', 'radio-player-page' ),
			'streamIcecastNoMounts'          => __( 'This is the page of an Icecast server, but no mount point is on the air now. Start the broadcast and test again, or use the URL of your mount point.', 'radio-player-page' ),
			'streamShoutcast'                => __( 'This is a Shoutcast server: browsers play its stream at another address. Use one of these:', 'radio-player-page' ),
			'streamMixedContentVariant'      => __( 'This stream uses http:// and this site uses https://, so browsers block it. The https:// address of the same stream works:', 'radio-player-page' ),
			'streamMixedContent'             => __( 'This stream uses http:// and this site uses https://, so browsers block it, and the server does not answer at https://. Ask your provider for an https:// streaming URL.', 'radio-player-page' ),
			'streamManifestNoCors'           => __( 'This HLS or DASH stream will not play: its server does not send the CORS headers these streams need. Ask your provider to add the header Access-Control-Allow-Origin: * to the stream.', 'radio-player-page' ),
			'streamNotAStream'               => __( 'This address is a web page, not an audio stream. Look for the streaming URL on that page or in your station\'s control panel.', 'radio-player-page' ),
			/* translators: %d: HTTP status code, such as 404. */
			'streamHttpError'                => __( 'The server answers with HTTP error %d. Check the address.', 'radio-player-page' ),
			'streamServerOnly'               => __( 'This site\'s server reaches the stream, but this browser cannot play it: it may be blocked here, or this browser may not support its format. Try it in another browser.', 'radio-player-page' ),
			'streamUnreachable'              => __( 'The stream does not answer. Check the address and make sure the station is broadcasting.', 'radio-player-page' ),
			'streamNotePlaylistMirrors'      => __( 'The playlist lists the same stream on several servers. This address may change; if it stops working, test the playlist again.', 'radio-player-page' ),
			'streamNotePlaylistPrivateEntry' => __( 'The playlist also lists an address on a private network, which listeners cannot reach. Check your control panel\'s settings.', 'radio-player-page' ),
		),
	);
}
