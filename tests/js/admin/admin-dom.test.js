/**
 * External dependencies
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import jQuery from 'jquery';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Internal dependencies
 */
import {
	MARKER_STRINGS,
	adminData,
	mountStationScreen,
} from './support/mount-station-screen';

// Characterizes the DOM the admin scripts build from HTML strings (spec 0005,
// task 2.1), so the rewrite with createElement (2.8, 2.9) keeps it. Names are
// escaped for `<`, `>` and `"` but not `&`, and translations go in raw:
// `innerHTML` decodes their entities, and the visible text keeps that (risk 1
// of the spec; the entities stored in titles are K21, for 0012).

// Fixture: Monday has two slots, Sunday none.

const PROGRAMS = [
	{ id: 301, name: 'Rock & Roll' },
	{ id: 302, name: 'Tom &amp; Jerry' },
	{ id: 303, name: 'a &lt; b' },
	{ id: 304, name: 'I <3 <b>jazz</b>' },
	{ id: 305, name: 'Say "hi"' },
	{ id: 306, name: "Rock 'n' roll" },
	{ id: '7"x', name: 'Quoted ID' },
	{ id: 0, name: 'Zero' },
	{ id: 308, name: '' },
	{ id: null, name: 'No ID' },
];

const ENTITY_STRINGS = {
	...MARKER_STRINGS,
	selectProgram: 'Pick &amp; go',
	to: 'a &amp; b',
	scheduleRerun: 'R & R',
	removeTimeSlot: 'Don&rsquo;t',
	programLabel: 'Show &amp; tell',
	startTimeLabel: 'From &lt; to',
	endTimeLabel: 'Until & after',
};

/**
 * Markup of a row added with the "Add" button, as `station-admin.js` writes it.
 *
 * @param {string} day          Schedule day key.
 * @param {number} index        Index of the new row in its day.
 * @param {Object} text         Serialized text of the row.
 * @param {string} text.options Serialized `<option>` elements.
 * @param {string} text.to      Text between the two times.
 * @param {string} text.rerun   Text of the rerun label.
 * @param {string} text.remove  Text of the remove link.
 * @param {Object} text.labels  Screen reader labels: `program`, `start`, `end`.
 * @return {string} `outerHTML` of the row.
 */
function rowHtml( day, index, { options, to, rerun, remove, labels } ) {
	const name = ( field ) =>
		`radplapag_station_schedule[${ day }][${ index }][${ field }]`;
	const id = ( field ) => `radplapag-slot-${ day }-${ index }-${ field }`;
	const label = ( field ) =>
		`<label class="screen-reader-text" for="${ id( field ) }">${
			labels[ field ]
		}</label>`;
	return (
		`<div class="radplapag-program-row" data-program-index="${ index }">` +
		label( 'program' ) +
		`<select name="${ name(
			'program_id'
		) }" class="radplapag-program-id" style="width: 200px; margin-right: 24px;" id="${ id(
			'program'
		) }">` +
		options +
		'</select>' +
		label( 'start' ) +
		`<input type="time" name="${ name(
			'start'
		) }" value="" class="radplapag-program-start" style="width: 100px; margin-right: 5px;" id="${ id(
			'start'
		) }">` +
		`<span style="margin-right: 5px;"> ${ to } </span>` +
		label( 'end' ) +
		`<input type="time" name="${ name(
			'end'
		) }" value="" class="radplapag-program-end" style="width: 100px; margin-right: 10px;" id="${ id(
			'end'
		) }">` +
		'<label class="radplapag-program-is-rerun-label" style="margin-right: 10px;">' +
		`<input type="checkbox" name="${ name(
			'is_rerun'
		) }" value="1" class="radplapag-program-is-rerun"> ${ rerun }</label>` +
		'<div class="radplapag-schedule-remove-cell">' +
		`<a href="#" class="submitdelete radplapag-remove-program">${ remove }</a>` +
		'</div>' +
		'<div class="radplapag-program-error-message" style="display: none;"></div>' +
		'</div>'
	);
}

/**
 * Mounts the station screen and adds a row to a day with its "Add" button.
 *
 * @param {string} day       Schedule day key.
 * @param {Object} overrides `radplapagAdmin` keys to replace.
 * @return {Promise<HTMLElement>} The new row.
 */
async function addRow( day, overrides = {} ) {
	const screen = await mountStationScreen( adminData( overrides ) );
	screen.dayWrapper( day ).querySelector( '.radplapag-add-program' ).click();
	return screen.rows( day ).pop();
}

/**
 * Value and visible text of each option of a row's program select.
 *
 * @param {HTMLElement} row Program row.
 * @return {string[][]} `[ value, text ]` pairs.
 */
function optionsOf( row ) {
	return Array.from( row.querySelectorAll( 'option' ) ).map( ( option ) => [
		option.value,
		option.textContent,
	] );
}

describe( 'station-admin.js: new schedule row', () => {
	it( 'builds the row with the default strings', async () => {
		const row = await addRow( 'sunday' );

		expect( row.outerHTML ).toBe(
			rowHtml( 'sunday', 0, {
				options:
					'<option value="">Select Radio Show</option>' +
					'<option value="203">Draft Show (Draft)</option>' +
					'<option value="201">Morning Show</option>' +
					'<option value="202">Night Owl</option>',
				to: 'to',
				rerun: 'Rerun',
				remove: 'Remove Time Slot',
				labels: {
					program: 'Radio Show',
					start: 'Start time',
					end: 'End time',
				},
			} )
		);
	} );

	it( 'numbers the row after the slots of its day', async () => {
		const row = await addRow( 'monday' );

		expect( row.getAttribute( 'data-program-index' ) ).toBe( '2' );
		expect( row.querySelector( 'select' ).name ).toBe(
			'radplapag_station_schedule[monday][2][program_id]'
		);
	} );

	it( 'leaves only the placeholder without programs', async () => {
		const row = await addRow( 'sunday', { programs: undefined } );

		expect( optionsOf( row ) ).toEqual( [ [ '', 'Select Radio Show' ] ] );
	} );

	it( 'decodes the entities of names and translations', async () => {
		const row = await addRow( 'sunday', {
			programs: PROGRAMS,
			strings: ENTITY_STRINGS,
		} );

		expect( row.outerHTML ).toBe(
			rowHtml( 'sunday', 0, {
				options:
					'<option value="">Pick &amp; go</option>' +
					'<option value="301">Rock &amp; Roll</option>' +
					'<option value="302">Tom &amp; Jerry</option>' +
					'<option value="303">a &lt; b</option>' +
					'<option value="304">I &lt;3 &lt;b&gt;jazz&lt;/b&gt;</option>' +
					'<option value="305">Say "hi"</option>' +
					`<option value="306">Rock 'n' roll</option>` +
					'<option value="7&quot;x">Quoted ID</option>' +
					'<option value="0">Zero</option>',
				to: 'a &amp; b',
				rerun: 'R &amp; R',
				remove: 'Don’t',
				labels: {
					program: 'Show &amp; tell',
					start: 'From &lt; to',
					end: 'Until &amp; after',
				},
			} )
		);
	} );

	it( 'shows names and translations without their entities', async () => {
		const row = await addRow( 'sunday', {
			programs: PROGRAMS,
			strings: ENTITY_STRINGS,
		} );

		// Programs without an ID or a name are left out; ID 0 is kept.
		expect( optionsOf( row ) ).toEqual( [
			[ '', 'Pick & go' ],
			[ '301', 'Rock & Roll' ],
			[ '302', 'Tom & Jerry' ],
			[ '303', 'a < b' ],
			[ '304', 'I <3 <b>jazz</b>' ],
			[ '305', 'Say "hi"' ],
			[ '306', "Rock 'n' roll" ],
			[ '7"x', 'Quoted ID' ],
			[ '0', 'Zero' ],
		] );
		expect( row.querySelector( 'span' ).textContent ).toBe( ' a & b ' );
		expect(
			row.querySelector( '.radplapag-program-is-rerun-label' ).textContent
		).toBe( ' R & R' );
		expect(
			row.querySelector( '.radplapag-remove-program' ).textContent
		).toBe( 'Don’t' );
	} );

	it( 'keeps the whitespace around translations', async () => {
		const row = await addRow( 'sunday', {
			strings: { ...MARKER_STRINGS, removeTimeSlot: '\n  Remove &amp; ' },
		} );

		expect(
			row.querySelector( '.radplapag-remove-program' ).textContent
		).toBe( '\n  Remove & ' );
	} );
} );

const META_BOX_HTML = readFileSync(
	resolve( __dirname, '../../fixtures/admin/station-meta-box.html' ),
	'utf8'
);

/**
 * Mounts the meta box, runs `admin/js/program-admin.js` and picks an
 * attachment in the frame opened by a wrapper's "Select" button.
 *
 * @param {string} kind       `program-logo` or `station-audio`.
 * @param {Object} attachment Attachment JSON.
 * @return {Promise<string>} `innerHTML` of the wrapper's preview.
 */
async function pickAttachment( kind, attachment ) {
	let onSelect;
	const frame = {
		open: vi.fn(),
		on: ( event, callback ) => {
			onSelect = callback;
		},
		state: () => ( {
			get: () => ( { first: () => ( { toJSON: () => attachment } ) } ),
		} ),
	};
	jQuery( document.body ).off();
	document.body.innerHTML = META_BOX_HTML;
	globalThis.jQuery = jQuery;
	globalThis.wp = { media: () => frame };
	vi.resetModules();
	await import( '../../../admin/js/program-admin.js' );
	await new Promise( ( done ) => jQuery( done ) );

	const wrapper = document.querySelector( `.radplapag-${ kind }-wrapper` );
	wrapper.querySelector( `.radplapag-${ kind }-select` ).click();
	onSelect();
	return wrapper.querySelector( `.radplapag-${ kind }-preview` ).innerHTML;
}

afterEach( () => {
	delete globalThis.wp;
	delete globalThis.jQuery;
} );

describe( 'program-admin.js: previews', () => {
	it( 'writes the image preview with a query in its URL', async () => {
		const preview = await pickAttachment( 'program-logo', {
			id: 601,
			url: 'https://example.test/logo.jpg?a=1&b=2',
		} );

		expect( preview ).toBe(
			'<img src="https://example.test/logo.jpg?a=1&amp;b=2" alt="">'
		);
		expect( document.querySelector( 'img' ).getAttribute( 'src' ) ).toBe(
			'https://example.test/logo.jpg?a=1&b=2'
		);
	} );

	it( 'writes the audio preview with a query in its URL', async () => {
		const preview = await pickAttachment( 'station-audio', {
			id: 602,
			url: 'https://example.test/hello.mp3?a=1&b=2',
		} );

		expect( preview ).toBe(
			'<audio controls="" src="https://example.test/hello.mp3?a=1&amp;b=2"></audio>'
		);
		expect( document.querySelector( 'audio' ).getAttribute( 'src' ) ).toBe(
			'https://example.test/hello.mp3?a=1&b=2'
		);
	} );
} );
