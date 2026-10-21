/**
 * External dependencies
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { vi } from 'vitest';

const ROOT = resolve( __dirname, '../../../..' );

/**
 * The station meta box as rendered by WordPress (written by
 * tests/php/integration/Admin/AdminScreensTest.php).
 */
const META_BOX_HTML = readFileSync(
	resolve( ROOT, 'tests/fixtures/admin/station-meta-box.html' ),
	'utf8'
);

export const DAYS = [
	'monday',
	'tuesday',
	'wednesday',
	'thursday',
	'friday',
	'saturday',
	'sunday',
];

/**
 * Strings that name the check that produced a message, so a test can read the
 * error code back from the row. Day labels keep the script defaults.
 */
export const MARKER_STRINGS = {
	allFieldsRequired: '[required]',
	pleaseSelectProgram: '[invalid_program]',
	invalidTimeFormat: '[format]',
	completeTimeFields: '[complete_time_fields]',
	startEndSame: '[start_equals_end]',
	timeSlotOverlapsWithMessage: '[overlap] %s',
};

/**
 * `window.radplapagAdmin` as `admin/admin.php` localizes it: the shape of
 * `radplapag_get_admin_strings()` plus `assignedPlayerPages`.
 *
 * @param {Object} overrides Keys to replace.
 * @return {Object} Localized data.
 */
export function adminData( overrides = {} ) {
	return {
		programs: [
			{ id: 201, name: 'Morning Show' },
			{ id: 202, name: 'Night Owl' },
		],
		strings: MARKER_STRINGS,
		// 102 belongs to Other FM in the fixture.
		assignedPlayerPages: [ 102 ],
		...overrides,
	};
}

/**
 * Mounts the station meta box, sets `window.radplapagAdmin` and runs
 * `admin/js/schedule-rules.js` and `admin/js/station-admin.js` on it, as the
 * edit screen does.
 *
 * @param {Object|null} admin `window.radplapagAdmin`; `null` leaves it unset.
 * @return {Promise<Object>} Helpers bound to the mounted screen.
 */
export async function mountStationScreen( admin = adminData() ) {
	document.body.innerHTML = META_BOX_HTML;
	// happy-dom 21 leaves a parsed <select> on its second option instead of the
	// one marked `selected` (and has no `defaultSelected`); restore what a
	// browser shows.
	document.querySelectorAll( 'select' ).forEach( ( select ) => {
		const marked = Array.from( select.options ).filter( ( option ) =>
			option.hasAttribute( 'selected' )
		);
		select.selectedIndex = marked.length ? marked.pop().index : 0;
	} );
	if ( admin === null ) {
		delete window.radplapagAdmin;
	} else {
		window.radplapagAdmin = admin;
	}
	vi.resetModules();
	// The edit screen loads the rules first (`radplapag-schedule-rules` is a
	// dependency of `radplapag-station-admin`).
	await import( '../../../../admin/js/schedule-rules.js' );
	await import( '../../../../admin/js/station-admin.js' );

	const form = document.getElementById( 'post' );
	const container = document.getElementById(
		'radplapag-station-cpt-container'
	);
	const dayWrapper = ( day ) =>
		container.querySelector(
			`.radplapag-schedule-day[data-day="${ day }"]`
		);

	return {
		form,
		container,
		dayWrapper,

		/**
		 * Rows of a day, or of every day in screen order (Monday to Sunday).
		 *
		 * @param {string} [day] Schedule day key.
		 * @return {HTMLElement[]} Rows.
		 */
		rows( day ) {
			const scope = day ? dayWrapper( day ) : container;
			return Array.from(
				scope.querySelectorAll( '.radplapag-program-row' )
			);
		},

		/** Removes every slot without going through the remove links. */
		clearSchedule() {
			container
				.querySelectorAll( '.radplapag-programs-list' )
				.forEach( ( list ) => {
					list.innerHTML = '';
				} );
		},

		/**
		 * Adds a slot with the day's "Add" button and fills it.
		 *
		 * @param {string} day                 Schedule day key.
		 * @param {Object} slot                Slot values.
		 * @param {string} slot.programId      Program ID; one missing from the
		 *                                     select is added as an extra option.
		 * @param {string} [slot.programLabel] Text of that extra option.
		 * @param {string} slot.start          Start (HH:MM, or anything).
		 * @param {string} slot.end            End (HH:MM, or anything).
		 * @return {HTMLElement} The new row.
		 */
		addSlot( day, { programId, programLabel, start, end } ) {
			dayWrapper( day ).querySelector( '.radplapag-add-program' ).click();
			const row = this.rows( day ).pop();
			const select = row.querySelector( '.radplapag-program-id' );
			if (
				programId &&
				! select.querySelector( `option[value="${ programId }"]` )
			) {
				const option = document.createElement( 'option' );
				option.value = programId;
				option.textContent = programLabel || programId;
				select.appendChild( option );
			}
			select.value = programId;
			row.querySelector( '.radplapag-program-start' ).value = start;
			row.querySelector( '.radplapag-program-end' ).value = end;
			return row;
		},

		/**
		 * Submits the form and reports what the script did.
		 *
		 * @return {{blocked: boolean, firstError: (HTMLElement|null)}} Whether the
		 * submit was prevented, and the element scrolled into view.
		 */
		submit() {
			const scroll = vi
				.spyOn( window.HTMLElement.prototype, 'scrollIntoView' )
				.mockImplementation( () => {} );
			const event = new window.Event( 'submit', {
				bubbles: true,
				cancelable: true,
			} );
			form.dispatchEvent( event );
			const firstError = scroll.mock.contexts[ 0 ] || null;
			scroll.mockRestore();
			return { blocked: event.defaultPrevented, firstError };
		},
	};
}

/**
 * Error code of a row, read from its message (see `MARKER_STRINGS`). An overlap
 * with a slot of the same day is `overlap`; with another day,
 * `cross_midnight_overlap`.
 *
 * @param {HTMLElement} row Program row.
 * @return {string|null} Code, or `null` if the row shows no error.
 */
export function rowErrorCode( row ) {
	const message = row.querySelector(
		'.radplapag-program-error-message.show'
	);
	if ( ! message ) {
		return null;
	}
	const text = message.textContent;
	const code = text.match( /^\[(\w+)\]/ );
	if ( ! code ) {
		return text;
	}
	if ( code[ 1 ] !== 'overlap' ) {
		return code[ 1 ];
	}
	const day = row
		.closest( '.radplapag-schedule-day' )
		.getAttribute( 'data-day' );
	const label = day.charAt( 0 ).toUpperCase() + day.slice( 1 );
	return text.includes( `(${ label },` )
		? 'overlap'
		: 'cross_midnight_overlap';
}
