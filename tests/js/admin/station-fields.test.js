/**
 * External dependencies
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Internal dependencies
 */
import {
	MARKER_STRINGS,
	adminData,
	mountStationScreen,
	rowErrorCode,
} from './support/mount-station-screen';

// Fixture: pages 101 Main Player (this station), 102 Other Player (assigned to
// Other FM), 103 Free Page; programs 201 Morning Show, 202 Night Owl. Monday has
// "Morning Show 07:00–10:00" (index 1) and "Night Owl 22:00–02:00" (index 0).

const FIELD_STRINGS = {
	...MARKER_STRINGS,
	playerPageRequired: '[player_page_required]',
	playerPageAlreadyAssigned: '[player_page_assigned]',
	streamUrlRequired: '[stream_url_required]',
	streamUrlInvalid: '[stream_url_invalid]',
	streamUrlScheme: '[stream_url_scheme]',
	selectProgram: '[select_program]',
	to: '[to]',
	removeTimeSlot: '[remove]',
	scheduleRerun: '[rerun]',
	programLabel: '[program_label]',
	startTimeLabel: '[start_label]',
	endTimeLabel: '[end_label]',
};

/**
 * Mounts the screen with marker strings for the station fields too.
 *
 * @param {Object} overrides `radplapagAdmin` keys to replace.
 * @return {Promise<Object>} The mounted screen, plus field helpers.
 */
async function mount( overrides = {} ) {
	const screen = await mountStationScreen(
		adminData( { strings: FIELD_STRINGS, ...overrides } )
	);
	const wrap = ( field ) =>
		screen.form.querySelector( `[data-field="${ field }"]` );
	return {
		...screen,
		wrap,
		playerPage: screen.form.querySelector(
			'#radplapag_station_player_page'
		),
		streamUrl: screen.form.querySelector( '#radplapag_station_stream_url' ),

		/**
		 * Error state of a station field.
		 *
		 * @param {string} field `data-field` of the wrapper.
		 * @return {{marked: boolean, control: boolean, message: string}} State.
		 */
		fieldError( field ) {
			const el = wrap( field );
			return {
				marked: el.classList.contains( 'radplapag-error' ),
				control: el
					.querySelector( 'input, select' )
					.classList.contains( 'radplapag-error' ),
				message: el.querySelector( '.radplapag-field-error-message' )
					.textContent,
			};
		},

		/**
		 * Moves the focus out of a row and runs the script's 10 ms timer.
		 *
		 * @param {HTMLElement}      row             Program row.
		 * @param {HTMLElement|null} [relatedTarget] Element that gets the focus.
		 */
		blur( row, relatedTarget = null ) {
			row.dispatchEvent(
				new window.FocusEvent( 'focusout', {
					bubbles: true,
					relatedTarget,
				} )
			);
			vi.advanceTimersByTime( 10 );
		},

		/**
		 * Clicks the "Remove Time Slot" link of a row.
		 *
		 * @param {HTMLElement} row Program row.
		 */
		remove( row ) {
			row.querySelector( '.radplapag-remove-program' ).click();
		},
	};
}

const NO_ERROR = { marked: false, control: false, message: '' };

const starts = ( rows ) =>
	rows.map(
		( row ) => row.querySelector( '.radplapag-program-start' ).value
	);

afterEach( () => {
	vi.useRealTimers();
} );

describe( 'station-admin.js: required station fields', () => {
	it( 'submits when the page and the URL are valid', async () => {
		const screen = await mount();

		expect( screen.submit().blocked ).toBe( false );
		expect( screen.fieldError( 'player_page' ) ).toEqual( NO_ERROR );
		expect( screen.fieldError( 'stream_url' ) ).toEqual( NO_ERROR );
	} );

	it( 'requires a player page', async () => {
		const screen = await mount();
		screen.playerPage.value = '';

		const { blocked, firstError } = screen.submit();

		expect( blocked ).toBe( true );
		expect( firstError ).toBe( screen.wrap( 'player_page' ) );
		expect( screen.fieldError( 'player_page' ) ).toEqual( {
			marked: true,
			control: true,
			message: '[player_page_required]',
		} );
	} );

	it( 'rejects a page assigned to another station', async () => {
		const screen = await mount();
		screen.playerPage.value = '102';

		const { blocked, firstError } = screen.submit();

		expect( blocked ).toBe( true );
		expect( firstError ).toBe( screen.wrap( 'player_page' ) );
		expect( screen.fieldError( 'player_page' ).message ).toBe(
			'[player_page_assigned]'
		);
	} );

	it( 'requires a stream URL (blank counts as empty)', async () => {
		const screen = await mount();
		screen.streamUrl.value = '   ';

		const { blocked, firstError } = screen.submit();

		expect( blocked ).toBe( true );
		expect( firstError ).toBe( screen.wrap( 'stream_url' ) );
		expect( screen.fieldError( 'stream_url' ) ).toEqual( {
			marked: true,
			control: true,
			message: '[stream_url_required]',
		} );
	} );

	it( 'rejects a stream URL that `new URL()` cannot parse', async () => {
		const screen = await mount();
		screen.streamUrl.value = 'stream.example.test/live.mp3';

		expect( screen.submit().blocked ).toBe( true );
		expect( screen.fieldError( 'stream_url' ).message ).toBe(
			'[stream_url_invalid]'
		);
	} );

	it( 'rejects a URL whose scheme is not http or https (K42)', async () => {
		const screen = await mount();
		screen.streamUrl.value = 'ftp://stream.example.test/live.mp3';

		expect( screen.submit().blocked ).toBe( true );
		expect( screen.fieldError( 'stream_url' ).message ).toBe(
			'[stream_url_scheme]'
		);
	} );

	it( 'rejects host:port/path without a scheme (K42)', async () => {
		const screen = await mount();
		// `new URL()` reads `radio.example.com` as the scheme.
		screen.streamUrl.value = 'radio.example.com:8000/stream';

		expect( screen.submit().blocked ).toBe( true );
		expect( screen.fieldError( 'stream_url' ).message ).toBe(
			'[stream_url_scheme]'
		);
	} );

	it( 'reports only the page when both fields are wrong', async () => {
		const screen = await mount();
		screen.playerPage.value = '';
		screen.streamUrl.value = '';

		screen.submit();

		expect( screen.fieldError( 'player_page' ).marked ).toBe( true );
		expect( screen.fieldError( 'stream_url' ) ).toEqual( NO_ERROR );
	} );

	it( 'clears the previous field errors on the next submit', async () => {
		const screen = await mount();
		screen.streamUrl.value = '';
		screen.submit();
		screen.streamUrl.value = 'https://stream.example.test/live.mp3';

		expect( screen.submit().blocked ).toBe( false );
		expect( screen.fieldError( 'stream_url' ) ).toEqual( NO_ERROR );
	} );

	it( 'uses its built-in English messages without strings', async () => {
		const screen = await mount( { strings: {} } );
		screen.playerPage.value = '102';

		screen.submit();

		expect( screen.fieldError( 'player_page' ).message ).toBe(
			'This Player Page is already assigned to another station. Please choose a different page.'
		);
	} );

	describe( 'live clearing', () => {
		it( 'clears the page error when a page is chosen', async () => {
			const screen = await mount();
			screen.playerPage.value = '';
			screen.submit();

			screen.playerPage.value = '103';
			screen.playerPage.dispatchEvent( new window.Event( 'change' ) );

			expect( screen.fieldError( 'player_page' ) ).toEqual( NO_ERROR );
		} );

		it( 'keeps the page error when the empty option is chosen', async () => {
			const screen = await mount();
			screen.playerPage.value = '';
			screen.submit();

			screen.playerPage.dispatchEvent( new window.Event( 'change' ) );

			expect( screen.fieldError( 'player_page' ).marked ).toBe( true );
		} );

		it( 'clears the page error even if the new page is assigned', async () => {
			const screen = await mount();
			screen.playerPage.value = '';
			screen.submit();

			screen.playerPage.value = '102';
			screen.playerPage.dispatchEvent( new window.Event( 'change' ) );

			expect( screen.fieldError( 'player_page' ) ).toEqual( NO_ERROR );
		} );

		it.each( [
			[ 'a valid URL', 'https://stream.example.test/live.mp3' ],
			[ 'an empty field', '' ],
		] )( 'clears the URL error on input with %s', async ( _t, value ) => {
			const screen = await mount();
			screen.streamUrl.value = 'not a url';
			screen.submit();

			screen.streamUrl.value = value;
			screen.streamUrl.dispatchEvent( new window.Event( 'input' ) );

			expect( screen.fieldError( 'stream_url' ) ).toEqual( NO_ERROR );
		} );

		it( 'keeps the URL error on input with a URL that is not http or https (K42)', async () => {
			const screen = await mount();
			screen.streamUrl.value = 'not a url';
			screen.submit();

			screen.streamUrl.value = 'radio.example.com:8000/stream';
			screen.streamUrl.dispatchEvent( new window.Event( 'input' ) );

			expect( screen.fieldError( 'stream_url' ).marked ).toBe( true );
		} );

		it( 'keeps the URL error on input with another invalid URL', async () => {
			const screen = await mount();
			screen.streamUrl.value = 'not a url';
			screen.submit();

			screen.streamUrl.value = 'still not a url';
			screen.streamUrl.dispatchEvent( new window.Event( 'input' ) );

			expect( screen.fieldError( 'stream_url' ).message ).toBe(
				'[stream_url_invalid]'
			);
		} );
	} );
} );

describe( 'station-admin.js: mixed content notice (C13)', () => {
	/**
	 * Mounts the screen as on a site with the given scheme (the fixture is http).
	 *
	 * @param {string} siteScheme `data-site-scheme` of the URL field.
	 * @return {Promise<Object>} The mounted screen, plus `notice()`.
	 */
	async function mountOn( siteScheme ) {
		const screen = await mount();
		screen.wrap( 'stream_url' ).dataset.siteScheme = siteScheme;
		const el = screen.form.querySelector(
			'#radplapag_station_stream_url_notice'
		);
		return {
			...screen,
			type( value ) {
				screen.streamUrl.value = value;
				screen.streamUrl.dispatchEvent( new window.Event( 'input' ) );
			},
			notice: () => ( {
				shown: ! el.hidden,
				described:
					screen.streamUrl.getAttribute( 'aria-describedby' ) ===
					el.id,
			} ),
		};
	}

	it( 'shows the mixed content notice while typing an http URL on an https site (C13)', async () => {
		const screen = await mountOn( 'https' );

		screen.type( 'http://stream.example.test/live.mp3' );

		expect( screen.notice() ).toEqual( { shown: true, described: true } );
	} );

	it.each( [
		[ 'an https URL on an https site', 'https', 'https://a.test/live' ],
		[ 'an empty field on an https site', 'https', '' ],
		[ 'a URL that does not parse on an https site', 'https', 'http//x' ],
		[ 'an http URL on an http site', 'http', 'http://a.test/live' ],
	] )( 'hides it for %s', async ( _t, siteScheme, value ) => {
		const screen = await mountOn( siteScheme );
		screen.type( 'http://stream.example.test/live.mp3' );

		screen.type( value );

		expect( screen.notice() ).toEqual( {
			shown: false,
			described: false,
		} );
	} );

	it( 'does not block the submit', async () => {
		const screen = await mountOn( 'https' );

		screen.type( 'http://stream.example.test/live.mp3' );

		expect( screen.submit().blocked ).toBe( false );
	} );
} );

describe( 'station-admin.js: pages assigned to other stations', () => {
	const disabledPages = ( screen ) =>
		Array.from( screen.playerPage.options )
			.filter( ( option ) => option.disabled )
			.map( ( option ) => option.value );

	it( 'disables the options of assigned pages', async () => {
		const screen = await mount();

		expect( disabledPages( screen ) ).toEqual( [ '102' ] );
	} );

	it( 'matches IDs given as strings', async () => {
		const screen = await mount( { assignedPlayerPages: [ '103' ] } );

		expect( disabledPages( screen ) ).toEqual( [ '103' ] );
	} );

	it.each( [
		[ 'an empty list', [] ],
		[ 'no list', undefined ],
		[ 'a non-array', '102' ],
	] )( 'disables nothing with %s', async ( _t, assignedPlayerPages ) => {
		const screen = await mount( { assignedPlayerPages } );

		expect( disabledPages( screen ) ).toEqual( [] );
	} );
} );

describe( 'station-admin.js: adding and removing slots', () => {
	const addButton = ( screen, day ) =>
		screen.dayWrapper( day ).querySelector( '.radplapag-add-program' );

	it( 'appends a row with the next index to the day', async () => {
		const screen = await mount();

		addButton( screen, 'monday' ).click();

		const rows = screen.rows( 'monday' );
		expect( rows ).toHaveLength( 3 );
		const row = rows[ 2 ];
		expect( row.getAttribute( 'data-program-index' ) ).toBe( '2' );
		expect(
			Array.from( row.querySelectorAll( '[name]' ) ).map( ( el ) => [
				el.tagName.toLowerCase(),
				el.getAttribute( 'type' ),
				el.getAttribute( 'name' ),
				el.value,
			] )
		).toEqual( [
			[
				'select',
				null,
				'radplapag_station_schedule[monday][2][program_id]',
				'',
			],
			[
				'input',
				'time',
				'radplapag_station_schedule[monday][2][start]',
				'',
			],
			[
				'input',
				'time',
				'radplapag_station_schedule[monday][2][end]',
				'',
			],
			[
				'input',
				'checkbox',
				'radplapag_station_schedule[monday][2][is_rerun]',
				'1',
			],
		] );
		expect( row.textContent ).toContain( '[to]' );
		expect( row.textContent ).toContain( '[rerun]' );
		expect(
			row.querySelector( '.radplapag-remove-program' ).textContent
		).toBe( '[remove]' );
		expect(
			row.querySelector( '.radplapag-program-is-rerun' ).checked
		).toBe( false );
	} );

	// docs/known-issues.md AX3, AX4: the added row's fields had no name.
	it( 'labels the program and the times of an added slot (AX3, AX4)', async () => {
		const screen = await mount();

		addButton( screen, 'monday' ).click();

		const row = screen.rows( 'monday' )[ 2 ];
		const controls = [
			'.radplapag-program-id',
			'.radplapag-program-start',
			'.radplapag-program-end',
		].map( ( selector ) => row.querySelector( selector ) );
		expect(
			controls.map( ( control ) => [
				control.id,
				control.previousElementSibling.tagName.toLowerCase(),
				control.previousElementSibling.className,
				control.previousElementSibling.getAttribute( 'for' ),
				control.labels[ 0 ].textContent,
			] )
		).toEqual( [
			[
				'radplapag-slot-monday-2-program',
				'label',
				'screen-reader-text',
				'radplapag-slot-monday-2-program',
				'[program_label]',
			],
			[
				'radplapag-slot-monday-2-start',
				'label',
				'screen-reader-text',
				'radplapag-slot-monday-2-start',
				'[start_label]',
			],
			[
				'radplapag-slot-monday-2-end',
				'label',
				'screen-reader-text',
				'radplapag-slot-monday-2-end',
				'[end_label]',
			],
		] );
	} );

	it( 'starts at index 0 on an empty day', async () => {
		const screen = await mount();

		addButton( screen, 'tuesday' ).click();

		expect(
			screen.rows( 'tuesday' )[ 0 ].getAttribute( 'data-program-index' )
		).toBe( '0' );
	} );

	it( 'lists the localized programs in the select, escaped', async () => {
		const screen = await mount( {
			programs: [
				{ id: 201, name: 'Morning Show' },
				{ id: 205, name: '<b>"Quoted" & Co</b>' },
				{ id: 0, name: 'Zero' },
				{ id: 206, name: '' },
				{ id: null, name: 'No ID' },
			],
		} );

		addButton( screen, 'tuesday' ).click();

		const select = screen.rows( 'tuesday' )[ 0 ].querySelector( 'select' );
		expect(
			Array.from( select.options ).map( ( o ) => [ o.value, o.text ] )
		).toEqual( [
			[ '', '[select_program]' ],
			[ '201', 'Morning Show' ],
			[ '205', '<b>"Quoted" & Co</b>' ],
			[ '0', 'Zero' ],
		] );
		expect( select.querySelector( 'b' ) ).toBeNull();
	} );

	it( 'removes a row', async () => {
		const screen = await mount();
		const [ morning, night ] = screen.rows( 'monday' );

		screen.remove( night );

		expect( screen.rows( 'monday' ) ).toEqual( [ morning ] );
	} );

	// docs/known-issues.md K15: the row count reused the names of a kept row
	// and PHP kept only one of the two slots.
	it( 'uses the highest index + 1 after a removal (K15)', async () => {
		const screen = await mount();
		const [ morning, night ] = screen.rows( 'monday' );
		expect( morning.getAttribute( 'data-program-index' ) ).toBe( '1' );

		screen.remove( night );
		addButton( screen, 'monday' ).click();

		const added = screen.rows( 'monday' )[ 1 ];
		expect( added.getAttribute( 'data-program-index' ) ).toBe( '2' );
		expect( added.querySelector( '.radplapag-program-start' ).name ).toBe(
			'radplapag_station_schedule[monday][2][start]'
		);
	} );

	it( 'revalidates the rest of the day after a removal', async () => {
		const screen = await mount();
		screen.clearSchedule();
		screen.addSlot( 'monday', {
			programId: '201',
			start: '06:00',
			end: '10:00',
		} );
		screen.addSlot( 'monday', {
			programId: '202',
			start: '09:00',
			end: '11:00',
		} );
		screen.submit();
		const [ first, second ] = screen.rows( 'monday' );
		expect( rowErrorCode( first ) ).toBe( 'overlap' );

		screen.remove( second );

		expect( rowErrorCode( first ) ).toBeNull();
	} );

	it( 'revalidates the next day after a removal', async () => {
		const screen = await mount();
		screen.clearSchedule();
		const monday = screen.addSlot( 'monday', {
			programId: '202',
			start: '22:00',
			end: '02:00',
		} );
		const tuesday = screen.addSlot( 'tuesday', {
			programId: '201',
			start: '01:00',
			end: '03:00',
		} );
		screen.submit();
		expect( rowErrorCode( tuesday ) ).toBe( 'cross_midnight_overlap' );

		screen.remove( monday );

		expect( rowErrorCode( tuesday ) ).toBeNull();
	} );

	it( 'revalidates Monday after removing the Sunday slot (K16)', async () => {
		const screen = await mount();
		screen.clearSchedule();
		const sunday = screen.addSlot( 'sunday', {
			programId: '202',
			start: '22:00',
			end: '02:00',
		} );
		const monday = screen.addSlot( 'monday', {
			programId: '201',
			start: '01:00',
			end: '03:00',
		} );
		screen.submit();
		expect( rowErrorCode( monday ) ).toBe( 'cross_midnight_overlap' );

		screen.remove( sunday );

		expect( rowErrorCode( monday ) ).toBeNull();
	} );

	// docs/known-issues.md K39: the focus fell to body with the removed row.
	it( "moves the focus to the next row's program, or to Add Time Slot, after a removal (K39)", async () => {
		const screen = await mount();
		const [ morning, night ] = screen.rows( 'monday' );

		morning.querySelector( '.radplapag-remove-program' ).focus();
		screen.remove( morning );

		expect( document.activeElement ).toBe(
			night.querySelector( '.radplapag-program-id' )
		);

		night.querySelector( '.radplapag-remove-program' ).focus();
		screen.remove( night );

		expect( document.activeElement ).toBe( addButton( screen, 'monday' ) );
	} );
} );

describe( 'station-admin.js: leaving a row (focusout)', () => {
	it( 'sorts the day by start, empty starts last', async () => {
		const screen = await mount();
		vi.useFakeTimers();
		const empty = screen.addSlot( 'monday', {
			programId: '201',
			start: '',
			end: '',
		} );
		const early = screen.addSlot( 'monday', {
			programId: '201',
			start: '05:00',
			end: '06:00',
		} );

		screen.blur( early );

		expect( starts( screen.rows( 'monday' ) ) ).toEqual( [
			'05:00',
			'07:00',
			'22:00',
			'',
		] );
		expect( screen.rows( 'monday' )[ 3 ] ).toBe( empty );
	} );

	it( 'keeps the field names when it reorders', async () => {
		const screen = await mount();
		vi.useFakeTimers();
		const early = screen.addSlot( 'monday', {
			programId: '201',
			start: '05:00',
			end: '06:00',
		} );

		screen.blur( early );

		expect(
			screen
				.rows( 'monday' )
				.map( ( row ) => row.getAttribute( 'data-program-index' ) )
		).toEqual( [ '2', '1', '0' ] );
		expect( early.querySelector( '.radplapag-program-start' ).name ).toBe(
			'radplapag_station_schedule[monday][2][start]'
		);
	} );

	it( 'validates the row and the rest of its day', async () => {
		const screen = await mount();
		vi.useFakeTimers();
		const [ morning ] = screen.rows( 'monday' );
		const added = screen.addSlot( 'monday', {
			programId: '202',
			start: '08:00',
			end: '09:00',
		} );

		screen.blur( added );

		expect( rowErrorCode( added ) ).toBe( 'overlap' );
		expect( rowErrorCode( morning ) ).toBe( 'overlap' );
	} );

	it( 'does nothing while the focus moves inside the row', async () => {
		const screen = await mount();
		vi.useFakeTimers();
		const added = screen.addSlot( 'monday', {
			programId: '202',
			start: '08:00',
			end: '09:00',
		} );

		screen.blur( added, added.querySelector( '.radplapag-program-end' ) );

		expect( rowErrorCode( added ) ).toBeNull();
		expect( screen.rows( 'monday' ).pop() ).toBe( added );
	} );

	it( 'does nothing if the focus is back in the row after 10 ms', async () => {
		const screen = await mount();
		vi.useFakeTimers();
		const added = screen.addSlot( 'monday', {
			programId: '202',
			start: '08:00',
			end: '09:00',
		} );
		added.querySelector( '.radplapag-program-start' ).focus();

		screen.blur( added );

		expect( rowErrorCode( added ) ).toBeNull();
	} );

	it( 'does nothing for a row removed within the 10 ms', async () => {
		const screen = await mount();
		vi.useFakeTimers();
		const [ , night ] = screen.rows( 'monday' );
		night.dispatchEvent(
			new window.FocusEvent( 'focusout', { bubbles: true } )
		);
		screen.remove( night );

		expect( () => vi.advanceTimersByTime( 10 ) ).not.toThrow();
	} );

	it( 'revalidates the next day', async () => {
		const screen = await mount();
		vi.useFakeTimers();
		screen.clearSchedule();
		const tuesday = screen.addSlot( 'tuesday', {
			programId: '201',
			start: '01:00',
			end: '03:00',
		} );
		const monday = screen.addSlot( 'monday', {
			programId: '202',
			start: '22:00',
			end: '02:00',
		} );

		screen.blur( monday );
		expect( rowErrorCode( tuesday ) ).toBe( 'cross_midnight_overlap' );

		monday.querySelector( '.radplapag-program-end' ).value = '00:30';
		screen.blur( monday );
		expect( rowErrorCode( monday ) ).toBeNull();
		expect( rowErrorCode( tuesday ) ).toBeNull();
	} );

	it( 'revalidates across the week boundary (Sunday → Monday)', async () => {
		const screen = await mount();
		vi.useFakeTimers();
		screen.clearSchedule();
		const monday = screen.addSlot( 'monday', {
			programId: '201',
			start: '01:00',
			end: '03:00',
		} );
		const sunday = screen.addSlot( 'sunday', {
			programId: '202',
			start: '22:00',
			end: '02:00',
		} );

		screen.blur( sunday );

		expect( rowErrorCode( sunday ) ).toBe( 'cross_midnight_overlap' );
		expect( rowErrorCode( monday ) ).toBe( 'cross_midnight_overlap' );
	} );

	it( 'revalidates the previous day (Monday → Sunday)', async () => {
		const screen = await mount();
		vi.useFakeTimers();
		screen.clearSchedule();
		const sunday = screen.addSlot( 'sunday', {
			programId: '202',
			start: '22:00',
			end: '02:00',
		} );
		const monday = screen.addSlot( 'monday', {
			programId: '201',
			start: '01:00',
			end: '03:00',
		} );

		screen.blur( monday );

		expect( rowErrorCode( monday ) ).toBe( 'cross_midnight_overlap' );
		expect( rowErrorCode( sunday ) ).toBe( 'cross_midnight_overlap' );
	} );
} );
