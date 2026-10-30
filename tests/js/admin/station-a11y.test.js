/**
 * External dependencies
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Internal dependencies
 */
import {
	mountStationScreen,
	rowErrorCode,
} from './support/mount-station-screen';

// Accessibility findings of the pre-release review (spec 0014, review.md §1),
// pinned as they are. Fixture: pages 101 (this station), 102 (Other FM), 103;
// programs 201 Morning Show, 202 Night Owl, 203 Draft Show (draft). Monday has
// "Morning Show 07:00–10:00" (index 1) and "Night Owl 22:00–02:00" (index 0).

// As the details box prints it when the assigned page is not published (K36);
// the K27 notice is the same span. Pinned by AdminScreensTest.
const PAGE_NOTICE =
	'<span class="radplapag-field-notice">This page is not published; the player is not shown until it is.</span>';

afterEach( () => {
	vi.restoreAllMocks();
	vi.useRealTimers();
	delete window.wp;
} );

describe( 'station-admin.js: page notices (R-a11y-1)', () => {
	async function mountWithPageNotice() {
		const screen = await mountStationScreen();
		screen.form
			.querySelector( '[data-field="player_page"]' )
			.insertAdjacentHTML( 'beforeend', PAGE_NOTICE );
		return {
			...screen,
			select: screen.form.querySelector(
				'#radplapag_station_player_page'
			),
			notice: screen.form.querySelector(
				'[data-field="player_page"] .radplapag-field-notice'
			),
		};
	}

	it( 'currently does not tie the page notice to the select', async () => {
		const screen = await mountWithPageNotice();

		expect( screen.notice.id ).toBe( '' );
		// Only the Player Page help describes the select (ADR 0073).
		expect( screen.select.getAttribute( 'aria-describedby' ) ).toBe(
			'radplapag_station_player_page_description'
		);
	} );

	it( 'currently keeps the page notice after another page is chosen', async () => {
		const screen = await mountWithPageNotice();

		screen.select.value = '103';
		screen.select.dispatchEvent(
			new window.Event( 'change', { bubbles: true } )
		);

		expect( screen.notice.isConnected ).toBe( true );
		expect( screen.notice.hidden ).toBe( false );
	} );
} );

describe( 'station-admin.js: program notice (R-a11y-2)', () => {
	it( 'currently does not tie the not public notice to its slot', async () => {
		const screen = await mountStationScreen();
		const [ morning ] = screen.rows( 'monday' );
		const select = morning.querySelector( '.radplapag-program-id' );

		select.value = '203';
		select.dispatchEvent( new window.Event( 'change', { bubbles: true } ) );

		const notice = morning.querySelector( '.radplapag-program-notice' );
		expect( notice ).not.toBeNull();
		expect( notice.id ).toBe( '' );
		expect( select.hasAttribute( 'aria-describedby' ) ).toBe( false );
	} );

	it( 'currently drops the whole aria-describedby when a slot error clears', async () => {
		const screen = await mountStationScreen();
		vi.useFakeTimers();
		const [ morning ] = screen.rows( 'monday' );
		const select = morning.querySelector( '.radplapag-program-id' );
		select.setAttribute( 'aria-describedby', 'radplapag-other' );
		const start = morning.querySelector( '.radplapag-program-start' );
		start.value = '';
		screen.submit();
		expect( rowErrorCode( morning ) ).toBe( 'required' );

		start.value = '07:00';
		// The submit left the focus on the row's program.
		document.activeElement.blur();
		morning.dispatchEvent(
			new window.FocusEvent( 'focusout', { bubbles: true } )
		);
		vi.advanceTimersByTime( 10 );

		expect( rowErrorCode( morning ) ).toBeNull();
		expect( select.hasAttribute( 'aria-describedby' ) ).toBe( false );
	} );
} );

describe( 'station-admin.js: station field errors (R-a11y-3)', () => {
	it( 'currently marks a field error without aria-invalid or aria-describedby, and moves the focus to it', async () => {
		const screen = await mountStationScreen();
		const input = screen.form.querySelector(
			'#radplapag_station_stream_url'
		);
		input.value = '';

		expect( screen.submit().blocked ).toBe( true );

		expect( input.classList.contains( 'radplapag-error' ) ).toBe( true );
		expect( input.hasAttribute( 'aria-invalid' ) ).toBe( false );
		expect( input.hasAttribute( 'aria-describedby' ) ).toBe( false );
		expect( document.activeElement ).toBe( input );
	} );

	it( 'currently drops the whole aria-describedby when the mixed content notice hides', async () => {
		const screen = await mountStationScreen();
		const wrap = screen.form.querySelector( '[data-field="stream_url"]' );
		wrap.dataset.siteScheme = 'https';
		const input = wrap.querySelector( '#radplapag_station_stream_url' );
		input.setAttribute( 'aria-describedby', 'radplapag-other' );

		input.value = 'https://stream.example.test/live.mp3';
		input.dispatchEvent( new window.Event( 'input' ) );

		expect( input.hasAttribute( 'aria-describedby' ) ).toBe( false );
	} );
} );

describe( 'station-admin.js: slot errors on focusout (R-a11y-5)', () => {
	it( 'currently shows a focusout error without announcing it', async () => {
		window.wp = { a11y: { speak: vi.fn() } };
		const screen = await mountStationScreen();
		vi.useFakeTimers();
		const added = screen.addSlot( 'monday', {
			programId: '202',
			start: '08:00',
			end: '09:00',
		} );

		added.dispatchEvent(
			new window.FocusEvent( 'focusout', { bubbles: true } )
		);
		vi.advanceTimersByTime( 10 );

		expect( rowErrorCode( added ) ).toBe( 'overlap' );
		const message = added.querySelector(
			'.radplapag-program-error-message'
		);
		expect( message.closest( '[role="alert"], [aria-live]' ) ).toBeNull();
		expect( window.wp.a11y.speak ).not.toHaveBeenCalled();
	} );
} );

describe( 'station-admin.js: smooth scrolling with reduced motion (R-a11y-7)', () => {
	it( 'currently scrolls smoothly to the first error', async () => {
		const screen = await mountStationScreen();
		vi.spyOn( window, 'matchMedia' ).mockImplementation( ( query ) => ( {
			matches: query.includes( 'prefers-reduced-motion: reduce' ),
			media: query,
			addEventListener() {},
			removeEventListener() {},
		} ) );
		const scroll = vi
			.spyOn( window.HTMLElement.prototype, 'scrollIntoView' )
			.mockImplementation( () => {} );
		const [ morning ] = screen.rows( 'monday' );
		morning.querySelector( '.radplapag-program-start' ).value = '';

		screen.form.dispatchEvent(
			new window.Event( 'submit', { bubbles: true, cancelable: true } )
		);

		expect( scroll.mock.contexts[ 0 ] ).toBe( morning );
		expect( scroll ).toHaveBeenCalledWith( {
			behavior: 'smooth',
			block: 'center',
		} );
	} );
} );

describe( 'station meta box: minor findings (R-a11y-8 c–e)', () => {
	it( 'currently marks the required fields only with an asterisk (c)', async () => {
		const screen = await mountStationScreen();

		[
			'#radplapag_station_player_page',
			'#radplapag_station_stream_url',
		].forEach( ( selector ) => {
			const control = screen.form.querySelector( selector );
			expect( control.hasAttribute( 'aria-required' ) ).toBe( false );
			expect( control.required ).toBe( false );
			expect(
				screen.form.querySelector( `label[for="${ control.id }"]` )
					.textContent
			).toContain( '*' );
		} );
	} );

	it( 'currently leaves the media labels unbound and repeats the image button names (d)', async () => {
		const screen = await mountStationScreen();
		const labels = Array.from(
			// The "Player Display" heading names its group instead (ADR 0073).
			screen.form.querySelectorAll(
				'.radplapag-field-wrap > label:not(#radplapag_station_display_title)'
			)
		).filter( ( label ) => ! label.hasAttribute( 'for' ) );

		expect( labels.map( ( label ) => label.textContent ) ).toEqual( [
			'Logo Image (Optional)',
			'Background Image (Optional)',
			'Welcome Audio (Optional)',
		] );
		const selects = Array.from(
			screen.form.querySelectorAll( '.radplapag-program-logo-select' )
		);
		expect( selects.map( ( button ) => button.textContent ) ).toEqual( [
			'Select Image',
			'Select Image',
		] );
		selects.forEach( ( button ) => {
			expect( button.hasAttribute( 'aria-label' ) ).toBe( false );
			expect( button.hasAttribute( 'aria-describedby' ) ).toBe( false );
		} );
	} );

	it( 'currently makes the Remove link of a slot a link that Space does not activate (e)', async () => {
		const screen = await mountStationScreen();
		screen.addSlot( 'tuesday', {
			programId: '201',
			start: '07:00',
			end: '08:00',
		} );

		screen.rows().forEach( ( row ) => {
			const remove = row.querySelector( '.radplapag-remove-program' );
			expect( remove.tagName ).toBe( 'A' );
			expect( remove.getAttribute( 'href' ) ).toBe( '#' );
			expect( remove.hasAttribute( 'role' ) ).toBe( false );
		} );
		const [ morning ] = screen.rows( 'monday' );
		morning.querySelector( '.radplapag-remove-program' ).dispatchEvent(
			new window.KeyboardEvent( 'keydown', {
				key: ' ',
				bubbles: true,
			} )
		);
		expect( morning.isConnected ).toBe( true );
	} );
} );
