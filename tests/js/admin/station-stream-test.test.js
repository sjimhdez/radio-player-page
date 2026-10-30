/**
 * External dependencies
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Internal dependencies
 */
import { adminData, mountStationScreen } from './support/mount-station-screen';

// "Test Stream" (spec 0018, A7 and A8) on the real meta box, with `fetch` and
// `Audio` simulated: no request leaves the test.

const AJAX_URL = 'http://site.test/wp-admin/admin-ajax.php';

/**
 * Marker strings: each verdict shows its code.
 */
const STREAM_STRINGS = {
	streamPlays: '[plays]',
	streamPlaysNoVisualizer: '[plays-no-visualizer]',
	streamServerOnly: '[server-only]',
	streamUnreachable: '[unreachable]',
	streamManifestNoCors: '[manifest-no-cors]',
	streamHttpError: '[http-error] %d',
	streamNotAStream: '[not-a-stream]',
	streamPlaylist: '[playlist]',
	streamIcecastMounts: '[icecast-mounts]',
	streamNotePlaylistMirrors: '[note-mirrors]',
	streamTesting: 'testing…',
	streamUseUrl: 'use',
	streamMountLabel: '%1$s (%2$s)',
	streamUrlRequired: 'required',
	streamUrlInvalid: 'invalid',
};

/**
 * A server report as radplapag_probe_stream answers it (ADR 0064 §8).
 *
 * @param {Object} fields Fields to replace.
 * @return {Object} Report.
 */
function report( fields = {} ) {
	return {
		kind: 'audio',
		status: 200,
		cors: true,
		streams: [],
		mounts: [],
		variant: null,
		notes: [],
		...fields,
	};
}

/**
 * A fake `Audio`: records what the script sets and answers each load with
 * `FakeAudio.answer( audio )` (an event name, or null to stay silent).
 */
class FakeAudio extends EventTarget {
	static instances = [];
	static answer = () => 'loadedmetadata';

	constructor() {
		super();
		this.muted = false;
		this.preload = '';
		this.crossOrigin = null;
		this.attrSrc = null;
		this.removed = false;
		this.play = vi.fn();
		this.load = vi.fn();
		FakeAudio.instances.push( this );
	}

	set src( value ) {
		this.attrSrc = value;
		// The settings the load starts with.
		this.loadedWith = {
			muted: this.muted,
			preload: this.preload,
			crossOrigin: this.crossOrigin,
		};
		const event = FakeAudio.answer( this );
		if ( event ) {
			queueMicrotask( () => this.dispatchEvent( new Event( event ) ) );
		}
	}

	get src() {
		return this.attrSrc ?? '';
	}

	removeAttribute( name ) {
		if ( name === 'src' ) {
			this.attrSrc = null;
			this.removed = true;
		}
	}
}

let serverReport;
let manifest;
let fetchMock;

beforeEach( () => {
	FakeAudio.instances = [];
	FakeAudio.answer = () => 'loadedmetadata';
	serverReport = { success: true, data: report() };
	manifest = () => Promise.resolve( { status: 200 } );
	fetchMock = vi.fn( ( url ) =>
		url === AJAX_URL
			? Promise.resolve( { json: () => Promise.resolve( serverReport ) } )
			: manifest( url )
	);
	vi.stubGlobal( 'fetch', fetchMock );
	vi.stubGlobal( 'Audio', FakeAudio );
} );

afterEach( () => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	document.body.innerHTML = '';
} );

/**
 * Mounts the screen with the probe data and marker strings.
 *
 * @return {Promise<Object>} Helpers: `input`, `result`, `test( url )`.
 */
async function mountScreen() {
	const screen = await mountStationScreen(
		adminData( {
			strings: STREAM_STRINGS,
			probe: { ajaxUrl: AJAX_URL, nonce: 'n0nce' },
		} )
	);
	const input = screen.form.querySelector( '#radplapag_station_stream_url' );
	const result = document.getElementById( 'radplapag_stream_test_result' );
	const button = screen.form.querySelector( '.radplapag-stream-test' );
	return {
		input,
		result,
		/**
		 * Writes a URL and presses "Test Stream".
		 *
		 * @param {string} url Stream URL.
		 */
		test( url ) {
			input.value = url;
			button.click();
		},
		button,
		wrap: screen.form.querySelector( '[data-field="stream_url"]' ),
	};
}

/**
 * Waits until the result region shows a verdict.
 *
 * @param {HTMLElement} result Result region.
 * @return {Promise<string>} Its text.
 */
async function verdictText( result ) {
	await vi.waitFor( () => {
		expect( result.textContent ).toMatch( /^\[/ );
	} );
	return result.textContent;
}

describe( 'station-admin.js: "Test Stream" asks the server', () => {
	it( 'posts the URL with the action and the nonce to admin-ajax.php', async () => {
		const screen = await mountScreen();
		screen.test( 'http://radio.test:8000/live' );
		await verdictText( screen.result );

		const [ url, options ] = fetchMock.mock.calls[ 0 ];
		expect( url ).toBe( AJAX_URL );
		expect( options.method ).toBe( 'POST' );
		expect( options.credentials ).toBe( 'same-origin' );
		expect(
			Object.fromEntries( new URLSearchParams( options.body ) )
		).toEqual( {
			action: 'radplapag_probe_stream',
			_ajax_nonce: 'n0nce',
			url: 'http://radio.test:8000/live',
		} );
	} );

	it( 'goes on with the browser when the server request fails', async () => {
		serverReport = { success: false };
		const screen = await mountScreen();
		screen.test( 'http://radio.test:8000/live' );

		expect( await verdictText( screen.result ) ).toBe( '[plays]' );
	} );

	it( 'trusts the server alone for a page, without a browser test', async () => {
		serverReport = { success: true, data: report( { kind: 'html' } ) };
		const screen = await mountScreen();
		screen.test( 'http://radio.test/' );

		expect( await verdictText( screen.result ) ).toBe( '[not-a-stream]' );
		expect( FakeAudio.instances ).toHaveLength( 0 );
		expect( fetchMock ).toHaveBeenCalledTimes( 1 );
	} );
} );

describe( 'station-admin.js: the browser test never plays', () => {
	it( 'loads a muted Audio with CORS first, never plays it and frees it', async () => {
		const screen = await mountScreen();
		screen.test( 'http://radio.test:8000/live' );

		expect( await verdictText( screen.result ) ).toBe( '[plays]' );
		expect( FakeAudio.instances ).toHaveLength( 1 );
		const [ audio ] = FakeAudio.instances;
		expect( audio.loadedWith ).toEqual( {
			muted: true,
			preload: 'auto',
			crossOrigin: 'anonymous',
		} );
		expect( audio.play ).not.toHaveBeenCalled();
		expect( audio.removed ).toBe( true );
		expect( audio.load ).toHaveBeenCalled();
	} );

	it( 'retries without CORS after an error, as the player does (ADR 0033)', async () => {
		FakeAudio.answer = ( audio ) =>
			audio.crossOrigin ? 'error' : 'loadedmetadata';
		const screen = await mountScreen();
		screen.test( 'http://radio.test:8000/live' );

		expect( await verdictText( screen.result ) ).toBe(
			'[plays-no-visualizer]'
		);
		expect(
			FakeAudio.instances.map( ( a ) => a.loadedWith.crossOrigin )
		).toEqual( [ 'anonymous', null ] );
		expect( FakeAudio.instances.every( ( a ) => a.removed ) ).toBe( true );
		expect(
			FakeAudio.instances.some( ( a ) => a.play.mock.calls.length )
		).toBe( false );
	} );

	it( 'also counts canplay as loaded', async () => {
		FakeAudio.answer = () => 'canplay';
		const screen = await mountScreen();
		screen.test( 'http://radio.test:8000/live' );

		expect( await verdictText( screen.result ) ).toBe( '[plays]' );
	} );

	it( 'reports an error in both tries', async () => {
		FakeAudio.answer = () => 'error';
		serverReport = {
			success: true,
			data: report( { kind: 'unreachable', status: null, cors: null } ),
		};
		const screen = await mountScreen();
		screen.test( 'http://radio.test:8000/live' );

		expect( await verdictText( screen.result ) ).toBe( '[unreachable]' );
		expect( FakeAudio.instances ).toHaveLength( 2 );
	} );

	it( 'gives up after 8 s of silence, without a second try', async () => {
		vi.useFakeTimers();
		FakeAudio.answer = () => null;
		const screen = await mountScreen();
		screen.test( 'http://radio.test:8000/live' );

		await vi.advanceTimersByTimeAsync( 7999 );
		expect( screen.result.textContent ).not.toMatch( /^\[/ );
		await vi.advanceTimersByTimeAsync( 1 );

		expect( await verdictText( screen.result ) ).toBe( '[server-only]' );
		expect( FakeAudio.instances ).toHaveLength( 1 );
		expect( FakeAudio.instances[ 0 ].removed ).toBe( true );
	} );
} );

describe( 'station-admin.js: the browser test of a manifest', () => {
	it( 'fetches an HLS manifest in cors mode without credentials', async () => {
		serverReport = { success: true, data: report( { kind: 'hls' } ) };
		const screen = await mountScreen();
		screen.test( 'https://radio.test/live/index.m3u8' );

		expect( await verdictText( screen.result ) ).toBe( '[plays]' );
		const [ url, options ] = fetchMock.mock.calls[ 1 ];
		expect( url ).toBe( 'https://radio.test/live/index.m3u8' );
		expect( options ).toMatchObject( {
			mode: 'cors',
			credentials: 'omit',
		} );
		expect( FakeAudio.instances ).toHaveLength( 0 );
	} );

	it( 'says a manifest without CORS will not play', async () => {
		serverReport = {
			success: true,
			data: report( { kind: 'hls', cors: false } ),
		};
		manifest = () => Promise.reject( new TypeError( 'Failed to fetch' ) );
		const screen = await mountScreen();
		screen.test( 'https://radio.test/live/index.m3u8' );

		expect( await verdictText( screen.result ) ).toBe(
			'[manifest-no-cors]'
		);
	} );

	it( 'gives the status the browser gets', async () => {
		serverReport = { success: false };
		manifest = () => Promise.resolve( { status: 404 } );
		const screen = await mountScreen();
		screen.test( 'https://radio.test/live/stream.mpd' );

		expect( await verdictText( screen.result ) ).toBe( '[http-error] 404' );
	} );

	it( 'aborts the fetch after 8 s', async () => {
		vi.useFakeTimers();
		serverReport = { success: true, data: report( { kind: 'dash' } ) };
		let signal;
		manifest = ( url ) => {
			signal = fetchMock.mock.calls.find( ( c ) => c[ 0 ] === url )[ 1 ]
				.signal;
			return new Promise( ( resolve, reject ) =>
				signal.addEventListener( 'abort', () =>
					reject( new DOMException( 'Aborted', 'AbortError' ) )
				)
			);
		};
		const screen = await mountScreen();
		screen.test( 'https://radio.test/live/stream.mpd' );

		await vi.advanceTimersByTimeAsync( 8000 );

		expect( signal.aborted ).toBe( true );
		expect( await verdictText( screen.result ) ).toBe( '[server-only]' );
	} );
} );

describe( 'station-admin.js: the verdict and its fix', () => {
	it( 'lists the streams of a playlist, each with "Use This URL", and its notes', async () => {
		serverReport = {
			success: true,
			data: report( {
				kind: 'playlist',
				streams: [ 'http://a.test/live', 'http://b.test/live' ],
				notes: [ 'playlist-mirrors', 'unknown-note' ],
			} ),
		};
		const screen = await mountScreen();
		screen.test( 'http://radio.test/listen.pls' );
		await verdictText( screen.result );

		const items = screen.result.querySelectorAll( 'li' );
		expect( screen.result.querySelector( 'p' ).textContent ).toBe(
			'[playlist]'
		);
		expect(
			Array.from(
				items,
				( li ) => li.querySelector( 'code' ).textContent
			)
		).toEqual( [ 'http://a.test/live', 'http://b.test/live' ] );
		const buttons = screen.result.querySelectorAll( 'li button' );
		expect( Array.from( buttons, ( b ) => b.textContent ) ).toEqual( [
			'use',
			'use',
		] );
		expect( buttons[ 0 ].getAttribute( 'type' ) ).toBe( 'button' );
		expect(
			document.getElementById(
				buttons[ 1 ].getAttribute( 'aria-describedby' )
			).textContent
		).toBe( 'http://b.test/live' );
		expect( screen.result.textContent ).toContain( '[note-mirrors]' );
		expect( screen.result.textContent ).not.toContain( 'unknown-note' );
	} );

	it( '"Use This URL" fills the field, fires input and focuses it, without saving', async () => {
		serverReport = {
			success: true,
			data: report( {
				kind: 'playlist',
				streams: [ 'http://a.test/live', 'http://b.test/live' ],
			} ),
		};
		const screen = await mountScreen();
		const onInput = vi.fn();
		screen.input.addEventListener( 'input', onInput );
		const onSubmit = vi.fn( ( e ) => e.preventDefault() );
		screen.input.form.addEventListener( 'submit', onSubmit );
		screen.test( 'http://radio.test/listen.pls' );
		await verdictText( screen.result );

		screen.result.querySelectorAll( 'li button' )[ 1 ].click();

		expect( screen.input.value ).toBe( 'http://b.test/live' );
		expect( onInput ).toHaveBeenCalledTimes( 1 );
		expect( document.activeElement ).toBe( screen.input );
		expect( onSubmit ).not.toHaveBeenCalled();
		expect( fetchMock ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'updates the mixed content notice when it fills an http URL on an https site (C13)', async () => {
		serverReport = {
			success: true,
			data: report( {
				kind: 'playlist',
				streams: [ 'http://a.test/live' ],
			} ),
		};
		const screen = await mountScreen();
		screen.wrap.setAttribute( 'data-site-scheme', 'https' );
		const notice = document.getElementById(
			'radplapag_station_stream_url_notice'
		);
		screen.test( 'https://radio.test/listen.pls' );
		await verdictText( screen.result );
		expect( notice.hidden ).toBe( true );

		screen.result.querySelector( 'li button' ).click();

		expect( notice.hidden ).toBe( false );
	} );

	it( 'lists the Icecast mounts by name and type', async () => {
		serverReport = {
			success: true,
			data: report( {
				kind: 'icecast-page',
				mounts: [
					{
						url: 'http://radio.test:8000/live',
						name: 'Live',
						type: 'MP3',
					},
					{ url: 'http://radio.test:8000/hq', name: '', type: '' },
				],
			} ),
		};
		const screen = await mountScreen();
		screen.test( 'http://radio.test:8000/' );
		await verdictText( screen.result );

		const items = screen.result.querySelectorAll( 'li' );
		expect( items ).toHaveLength( 2 );
		expect( items[ 0 ].textContent ).toBe(
			'Live (MP3) http://radio.test:8000/live use'
		);
		expect( items[ 1 ].textContent ).toBe(
			'http://radio.test:8000/hq use'
		);
	} );

	it( 'paints what the server sends as text, never as HTML', async () => {
		const url = 'http://a.test/"><img src=x onerror=alert(1)>';
		serverReport = {
			success: true,
			data: report( {
				kind: 'icecast-page',
				mounts: [ { url, name: '<b>Live</b>', type: 'MP3' } ],
			} ),
		};
		const screen = await mountScreen();
		screen.test( 'http://radio.test:8000/' );
		await verdictText( screen.result );

		expect( screen.result.querySelector( 'img, b' ) ).toBeNull();
		expect( screen.result.querySelector( 'code' ).textContent ).toBe( url );
		expect( screen.result.textContent ).toContain( '<b>Live</b> (MP3)' );
	} );
} );

describe( 'station-admin.js: while testing', () => {
	it.each( [
		[ '', 'required' ],
		[ 'not a url', 'invalid' ],
	] )(
		'shows the field error for %j and asks nothing',
		async ( url, message ) => {
			const screen = await mountScreen();
			screen.test( url );

			expect(
				screen.wrap.querySelector( '.radplapag-field-error-message' )
					.textContent
			).not.toBe( '' );
			expect( screen.wrap.classList.contains( 'radplapag-error' ) ).toBe(
				true
			);
			expect(
				screen.wrap.querySelector( '.radplapag-field-error-message' )
					.textContent
			).toBe( message === 'invalid' ? 'invalid' : 'required' );
			expect( fetchMock ).not.toHaveBeenCalled();
			expect( screen.result.textContent ).toBe( '' );
		}
	);

	// aria-disabled, not disabled, keeps the focus on the button (K130).
	it( 'marks the button disabled, keeping its focus, and says it is testing until the verdict', async () => {
		let answer;
		fetchMock.mockImplementationOnce(
			() =>
				new Promise( ( resolve ) => {
					answer = resolve;
				} )
		);
		const screen = await mountScreen();
		screen.button.focus();
		screen.test( 'http://radio.test:8000/live' );

		expect( screen.button.getAttribute( 'aria-disabled' ) ).toBe( 'true' );
		expect( screen.button.disabled ).toBe( false );
		expect( document.activeElement ).toBe( screen.button );
		expect( screen.result.textContent ).toBe( 'testing…' );

		answer( { json: () => Promise.resolve( serverReport ) } );

		expect( await verdictText( screen.result ) ).toBe( '[plays]' );
		expect( screen.button.hasAttribute( 'aria-disabled' ) ).toBe( false );
		expect( document.activeElement ).toBe( screen.button );
	} );

	it( 'ignores a click while it tests (K130)', async () => {
		let answer;
		fetchMock.mockImplementationOnce(
			() =>
				new Promise( ( resolve ) => {
					answer = resolve;
				} )
		);
		const screen = await mountScreen();
		screen.test( 'http://radio.test:8000/live' );
		screen.button.click();

		expect( fetchMock ).toHaveBeenCalledTimes( 1 );
		answer( { json: () => Promise.resolve( serverReport ) } );
		expect( await verdictText( screen.result ) ).toBe( '[plays]' );
	} );

	it( 'drops the result of a test the field changed under', async () => {
		let answerFirst;
		fetchMock.mockImplementationOnce(
			() =>
				new Promise( ( resolve ) => {
					answerFirst = resolve;
				} )
		);
		const screen = await mountScreen();
		screen.test( 'http://radio.test/listen.pls' );
		screen.input.value = 'http://radio.test:8000/live';
		screen.input.dispatchEvent( new Event( 'input', { bubbles: true } ) );

		expect( screen.button.hasAttribute( 'aria-disabled' ) ).toBe( false );
		screen.button.click();
		expect( await verdictText( screen.result ) ).toBe( '[plays]' );

		answerFirst( {
			json: () =>
				Promise.resolve( {
					success: true,
					data: report( {
						kind: 'playlist',
						streams: [ 'http://a.test/live' ],
					} ),
				} ),
		} );
		await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

		expect( screen.result.textContent ).toBe( '[plays]' );
	} );

	it( 'gives the button back and says it does not answer when the test throws', async () => {
		const screen = await mountScreen();
		const verdict = vi
			.spyOn( window.radplapagStreamRules, 'verdict' )
			.mockImplementationOnce( () => {
				throw new Error( 'boom' );
			} );
		screen.test( 'http://radio.test:8000/live' );

		expect( await verdictText( screen.result ) ).toBe( '[unreachable]' );
		expect( screen.button.hasAttribute( 'aria-disabled' ) ).toBe( false );
		verdict.mockRestore();
	} );
} );
