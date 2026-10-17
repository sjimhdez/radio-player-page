/**
 * External dependencies
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import jQuery from 'jquery';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The station meta box has the same image markup as the program one (two
// image wrappers: logo 401 and background 402) plus the welcome audio (403).
const META_BOX_HTML = readFileSync(
	resolve( __dirname, '../../fixtures/admin/station-meta-box.html' ),
	'utf8'
);

/**
 * A `wp.media` stand-in: records the frames it creates and lets the test pick
 * an attachment in the last one.
 *
 * @return {Function} `wp.media`, with `frames` (one per call).
 */
function fakeMedia() {
	const media = vi.fn( ( options ) => {
		let attachment = null;
		const listeners = {};
		const frame = {
			options,
			open: vi.fn(),
			on( event, callback ) {
				listeners[ event ] = callback;
			},
			state: () => ( {
				get: () => ( {
					first: () => ( { toJSON: () => attachment } ),
				} ),
			} ),
			/**
			 * Picks an attachment, as the user does in the modal.
			 *
			 * @param {Object} picked Attachment JSON.
			 */
			select( picked ) {
				attachment = picked;
				listeners.select();
			},
		};
		media.frames.push( frame );
		return frame;
	} );
	media.frames = [];
	return media;
}

/**
 * Mounts the meta box and runs `admin/js/program-admin.js` with WordPress'
 * jQuery and the given `wp`, then waits for its `jQuery( fn )` callback.
 *
 * @param {Object} [globals]        Globals to replace; a key given as
 *                                  `undefined` leaves that global unset.
 * @param {Object} [globals.wp]     `window.wp` (default: with a fake media).
 * @param {*}      [globals.jQuery] `window.jQuery` (default: jQuery 3.7.1).
 * @return {Promise<Object>} Helpers bound to the mounted screen.
 */
async function mountProgramAdmin( globals = {} ) {
	const { wp, jQuery: $ } = {
		wp: { media: fakeMedia() },
		jQuery,
		...globals,
	};
	// Handlers are delegated from <body>, which outlives each test's markup.
	jQuery( document.body ).off();
	document.body.innerHTML = META_BOX_HTML;
	globalThis.jQuery = $;
	globalThis.wp = wp;
	vi.resetModules();
	await import( '../../../admin/js/program-admin.js' );
	// The script's ready callback was queued first, so it has run by now.
	await new Promise( ( done ) => jQuery( done ) );

	const wrappers = ( selector ) =>
		Array.from( document.querySelectorAll( selector ) );
	const [ logo, background ] = wrappers( '.radplapag-program-logo-wrapper' );
	const [ audio ] = wrappers( '.radplapag-station-audio-wrapper' );

	return {
		media: wp && wp.media,
		logo,
		background,
		audio,

		/**
		 * State of an image or audio wrapper.
		 *
		 * @param {HTMLElement} wrapper Wrapper element.
		 * @return {{id: string, preview: string, removeShown: boolean}} State.
		 */
		state( wrapper ) {
			const kind = wrapper.matches( '.radplapag-station-audio-wrapper' )
				? 'station-audio'
				: 'program-logo';
			return {
				id: wrapper.querySelector( `.radplapag-${ kind }-id` ).value,
				preview: wrapper
					.querySelector( `.radplapag-${ kind }-preview` )
					.innerHTML.trim(),
				removeShown:
					wrapper.querySelector( `.radplapag-${ kind }-remove` ).style
						.display !== 'none',
			};
		},

		/**
		 * Clicks a button of a wrapper.
		 *
		 * @param {HTMLElement} wrapper Wrapper element.
		 * @param {string}      action  `select` or `remove`.
		 */
		click( wrapper, action ) {
			wrapper.querySelector( `[class*="-${ action }"]` ).click();
		},
	};
}

const ORIGIN = '{{ORIGIN}}';

afterEach( () => {
	delete globalThis.wp;
	delete globalThis.jQuery;
} );

describe( 'program-admin.js: image selector', () => {
	it( 'opens an image frame for one attachment', async () => {
		const screen = await mountProgramAdmin();

		screen.click( screen.background, 'select' );

		expect( screen.media ).toHaveBeenCalledTimes( 1 );
		expect( screen.media ).toHaveBeenCalledWith( {
			library: { type: 'image' },
			multiple: false,
		} );
		expect( screen.media.frames[ 0 ].open ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'fills the clicked wrapper with the medium size', async () => {
		const screen = await mountProgramAdmin();
		screen.click( screen.background, 'remove' );
		screen.click( screen.background, 'select' );

		screen.media.frames[ 0 ].select( {
			id: 501,
			url: 'https://example.test/full.jpg',
			sizes: { medium: { url: 'https://example.test/medium.jpg' } },
		} );

		expect( screen.state( screen.background ) ).toEqual( {
			id: '501',
			preview: '<img src="https://example.test/medium.jpg" alt="">',
			removeShown: true,
		} );
		expect( screen.state( screen.logo ).id ).toBe( '401' );
	} );

	it( 'falls back to the full URL without a medium size', async () => {
		const screen = await mountProgramAdmin();
		screen.click( screen.logo, 'select' );

		screen.media.frames[ 0 ].select( {
			id: 502,
			url: 'https://example.test/small.png',
			sizes: { thumbnail: { url: 'https://example.test/thumb.png' } },
		} );

		expect( screen.state( screen.logo ).preview ).toBe(
			'<img src="https://example.test/small.png" alt="">'
		);
	} );

	it( 'reuses one frame and fills the wrapper clicked last', async () => {
		const screen = await mountProgramAdmin();
		screen.click( screen.logo, 'select' );
		screen.click( screen.background, 'select' );

		screen.media.frames[ 0 ].select( {
			id: 503,
			url: 'https://example.test/bg.jpg',
		} );

		expect( screen.media ).toHaveBeenCalledTimes( 1 );
		expect( screen.media.frames[ 0 ].open ).toHaveBeenCalledTimes( 2 );
		expect( screen.state( screen.background ).id ).toBe( '503' );
		expect( screen.state( screen.logo ) ).toEqual( {
			id: '401',
			preview: `<img src="${ ORIGIN }/wp-content/uploads/logo.jpg" alt="">`,
			removeShown: true,
		} );
	} );

	it( 'removes the image of its own wrapper', async () => {
		const screen = await mountProgramAdmin();

		screen.click( screen.logo, 'remove' );

		expect( screen.state( screen.logo ) ).toEqual( {
			id: '',
			preview: '',
			removeShown: false,
		} );
		expect( screen.state( screen.background ).id ).toBe( '402' );
		expect( screen.media ).not.toHaveBeenCalled();
	} );
} );

describe( 'program-admin.js: welcome audio selector', () => {
	it( 'opens its own audio frame and fills the preview', async () => {
		const screen = await mountProgramAdmin();
		screen.click( screen.logo, 'select' );
		screen.click( screen.audio, 'select' );

		screen.media.frames[ 1 ].select( {
			id: 504,
			url: 'https://example.test/hello.mp3',
		} );

		expect( screen.media ).toHaveBeenCalledTimes( 2 );
		expect( screen.media.frames[ 1 ].options ).toEqual( {
			library: { type: 'audio' },
			multiple: false,
		} );
		expect( screen.state( screen.audio ) ).toEqual( {
			id: '504',
			preview:
				'<audio controls="" src="https://example.test/hello.mp3"></audio>',
			removeShown: true,
		} );
	} );

	it( 'removes the audio', async () => {
		const screen = await mountProgramAdmin();

		screen.click( screen.audio, 'remove' );

		expect( screen.state( screen.audio ) ).toEqual( {
			id: '',
			preview: '',
			removeShown: false,
		} );
	} );
} );

describe( 'program-admin.js: missing globals', () => {
	it.each( [
		[ 'wp', { wp: undefined } ],
		[ 'wp.media', { wp: {} } ],
		[ 'jQuery', { jQuery: undefined } ],
	] )( 'binds nothing without %s', async ( _t, globals ) => {
		const screen = await mountProgramAdmin( globals );

		screen.click( screen.logo, 'remove' );

		expect( screen.state( screen.logo ).id ).toBe( '401' );
	} );
} );
