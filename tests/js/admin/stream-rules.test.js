/**
 * External dependencies
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import rules from '../../../admin/js/stream-rules.js';

/**
 * A server report as radplapag_probe_stream answers it (ADR 0064 §8).
 *
 * @param {Object} fields Fields to replace.
 * @return {Object} Report.
 */
function server( fields = {} ) {
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

describe( 'stream-rules: isMixed', () => {
	it.each( [
		[ 'http://radio.test/live', 'https', true ],
		[ 'HTTP://radio.test/live', 'https', true ],
		[ 'https://radio.test/live', 'https', false ],
		[ 'http://radio.test/live', 'http', false ],
		[ 'not a url', 'https', false ],
		[ 'http://radio.test/live', '', false ],
	] )( '%s on an %s site → %s', ( url, scheme, mixed ) => {
		expect( rules.isMixed( url, scheme ) ).toBe( mixed );
	} );
} );

describe( 'stream-rules: browserTest', () => {
	it.each( [
		[ 'audio', 'audio' ],
		[ 'hls', 'manifest' ],
		[ 'dash', 'manifest' ],
		[ 'playlist', null ],
		[ 'icecast-page', null ],
		[ 'shoutcast-page', null ],
		[ 'html', null ],
		[ 'http-error', null ],
	] )( 'the server saw %s → %s', ( kind, test ) => {
		expect(
			rules.browserTest(
				'http://radio.test/live',
				server( { kind } ),
				'http'
			)
		).toBe( test );
	} );

	it.each( [
		[ 'unreachable', 'http://radio.test/live', 'audio' ],
		[ 'blocked', 'http://192.168.1.10:8000/live', 'audio' ],
		[ 'unreachable', 'http://radio.test/hls/index.m3u8', 'manifest' ],
		[ 'blocked', 'http://radio.test/dash/stream.MPD?x=1', 'manifest' ],
	] )(
		'without an answer (%s) it goes by the URL: %s → %s',
		( kind, url, test ) => {
			expect( rules.browserTest( url, server( { kind } ), 'http' ) ).toBe(
				test
			);
		}
	);

	it.each( [
		[ 'http://radio.test/live.mp3', 'audio' ],
		[ 'http://radio.test/index.m3u8', 'manifest' ],
	] )(
		'without the server report (AJAX failed) it goes by the URL: %s → %s',
		( url, test ) => {
			expect( rules.browserTest( url, null, 'http' ) ).toBe( test );
		}
	);

	it( 'does not test mixed content: the verdict comes from the schemes', () => {
		expect(
			rules.browserTest( 'http://radio.test/live', server(), 'https' )
		).toBeNull();
	} );
} );

const AUDIO_CORS = { test: 'audio', result: 'cors' };
const AUDIO_NO_CORS = { test: 'audio', result: 'no-cors' };
const AUDIO_ERROR = { test: 'audio', result: 'error' };
const AUDIO_TIMEOUT = { test: 'audio', result: 'timeout' };
const MANIFEST_OK = { test: 'manifest', status: 200 };
const MANIFEST_404 = { test: 'manifest', status: 404 };
const MANIFEST_FAILED = { test: 'manifest', failed: true };

/**
 * The verdict of a test on an http site.
 *
 * @param {Object|null} report  Server report, or null.
 * @param {Object|null} browser Browser result, or null.
 * @param {Object}      [more]  Other inputs (url, siteScheme).
 * @return {Object} Verdict.
 */
function verdictOf( report, browser, more = {} ) {
	return rules.verdict( {
		url: 'http://radio.test:8000/live',
		siteScheme: 'http',
		server: report,
		browser,
		...more,
	} );
}

describe( 'stream-rules: verdict', () => {
	it.each( [
		[ 'audio with CORS', server(), AUDIO_CORS, 'plays' ],
		[
			'audio without CORS',
			server( { cors: false } ),
			AUDIO_NO_CORS,
			'plays-no-visualizer',
		],
		[ 'HLS with CORS', server( { kind: 'hls' } ), MANIFEST_OK, 'plays' ],
		[ 'DASH with CORS', server( { kind: 'dash' } ), MANIFEST_OK, 'plays' ],
		[
			'blocked on the server, plays in the browser',
			server( { kind: 'blocked', status: null, cors: null } ),
			AUDIO_CORS,
			'plays',
		],
		[
			'unreachable from the server, plays in the browser',
			server( { kind: 'unreachable', status: null, cors: null } ),
			AUDIO_NO_CORS,
			'plays-no-visualizer',
		],
		[ 'no server report, plays in the browser', null, AUDIO_CORS, 'plays' ],
	] )( '%s → %s', ( _, report, browser, code ) => {
		expect( verdictOf( report, browser ) ).toEqual( {
			code,
			status: null,
			fix: null,
			notes: [],
		} );
	} );

	it( 'proposes the streams of a playlist, with its notes', () => {
		const report = server( {
			kind: 'playlist',
			streams: [ 'http://a.test/live', 'http://b.test/live' ],
			notes: [ 'playlist-mirrors' ],
		} );
		expect( verdictOf( report, null ) ).toEqual( {
			code: 'playlist',
			status: null,
			fix: { urls: [ 'http://a.test/live', 'http://b.test/live' ] },
			notes: [ 'playlist-mirrors' ],
		} );
	} );

	it( 'explains a playlist with no stream to propose', () => {
		const report = server( {
			kind: 'playlist',
			notes: [ 'playlist-private-entry' ],
		} );
		expect( verdictOf( report, null ) ).toMatchObject( {
			code: 'playlist-empty',
			fix: null,
			notes: [ 'playlist-private-entry' ],
		} );
	} );

	it( 'lists the mounts of an Icecast page', () => {
		const mounts = [
			{ url: 'http://radio.test:8000/live', name: 'Live', type: 'MP3' },
			{ url: 'http://radio.test:8000/hq', name: 'HQ', type: 'AAC' },
		];
		expect(
			verdictOf( server( { kind: 'icecast-page', mounts } ), null )
		).toMatchObject( { code: 'icecast-mounts', fix: { mounts } } );
	} );

	it( 'explains an Icecast page without mounts', () => {
		expect(
			verdictOf( server( { kind: 'icecast-page' } ), null )
		).toMatchObject( { code: 'icecast-no-mounts', fix: null } );
	} );

	it( 'proposes the Shoutcast paths of the server', () => {
		const streams = [
			'http://radio.test:8000/;',
			'http://radio.test:8000/stream',
		];
		expect(
			verdictOf( server( { kind: 'shoutcast-page', streams } ), null )
		).toMatchObject( { code: 'shoutcast', fix: { urls: streams } } );
	} );

	it( 'proposes /; when the server hears Shoutcast audio and the browser does not (spike, proposal 5)', () => {
		const report = server( { notes: [ 'shoutcast-server' ] } );
		expect( verdictOf( report, AUDIO_ERROR ) ).toEqual( {
			code: 'shoutcast',
			status: null,
			fix: { urls: [ 'http://radio.test:8000/;' ] },
			notes: [ 'shoutcast-server' ],
		} );
	} );

	it.each( [
		[ 'an error', AUDIO_ERROR ],
		[ 'a timeout', AUDIO_TIMEOUT ],
	] )(
		'says the server reaches the audio when the browser gives %s',
		( _, browser ) => {
			expect( verdictOf( server(), browser ) ).toMatchObject( {
				code: 'server-only',
				fix: null,
			} );
		}
	);

	it( 'says an HLS manifest without CORS will not play', () => {
		expect(
			verdictOf( server( { kind: 'hls', cors: false } ), MANIFEST_FAILED )
		).toMatchObject( { code: 'manifest-no-cors' } );
	} );

	it( 'says the server reaches a manifest with CORS the browser cannot load', () => {
		expect(
			verdictOf( server( { kind: 'dash', cors: true } ), MANIFEST_FAILED )
		).toMatchObject( { code: 'server-only' } );
	} );

	it( 'gives the status of a manifest the browser gets with an error', () => {
		expect(
			verdictOf(
				server( { kind: 'unreachable', status: null } ),
				MANIFEST_404
			)
		).toMatchObject( { code: 'http-error', status: 404 } );
	} );

	it( 'gives the status of an HTTP error from the server', () => {
		expect(
			verdictOf( server( { kind: 'http-error', status: 404 } ), null )
		).toEqual( { code: 'http-error', status: 404, fix: null, notes: [] } );
	} );

	it( 'says an HTML page is not a stream', () => {
		expect(
			verdictOf( server( { kind: 'html', cors: false } ), null )
		).toMatchObject( { code: 'not-a-stream', fix: null } );
	} );

	it.each( [
		[ 'unreachable', AUDIO_ERROR ],
		[ 'blocked', AUDIO_TIMEOUT ],
		[ 'unreachable', MANIFEST_FAILED ],
	] )(
		'says it does not answer when the server gives %s and the browser fails',
		( kind, browser ) => {
			expect(
				verdictOf(
					server( { kind, status: null, cors: null } ),
					browser
				)
			).toMatchObject( { code: 'unreachable', fix: null } );
		}
	);

	it( 'says it does not answer without a server report when the browser fails', () => {
		expect( verdictOf( null, AUDIO_ERROR ) ).toMatchObject( {
			code: 'unreachable',
		} );
	} );

	describe( 'http stream on an https site', () => {
		const https = { siteScheme: 'https' };

		it.each( [ 'audio', 'hls', 'dash' ] )(
			'proposes the https variant when it answers with %s',
			( kind ) => {
				const report = server( {
					variant: {
						url: 'https://radio.test:8000/live',
						kind,
						status: 200,
					},
				} );
				expect( verdictOf( report, null, https ) ).toEqual( {
					code: 'mixed-content-variant',
					status: null,
					fix: { urls: [ 'https://radio.test:8000/live' ] },
					notes: [],
				} );
			}
		);

		it.each( [
			[
				'the variant does not answer',
				{
					url: 'https://radio.test:8000/live',
					kind: 'unreachable',
					status: null,
				},
			],
			[
				'the variant is a page',
				{
					url: 'https://radio.test:8000/live',
					kind: 'html',
					status: 200,
				},
			],
			[ 'there is no variant', null ],
		] )( 'explains it when %s', ( _, variant ) => {
			expect(
				verdictOf( server( { variant } ), null, https )
			).toMatchObject( { code: 'mixed-content', fix: null } );
		} );

		it( 'explains it without a server report', () => {
			expect( verdictOf( null, null, https ) ).toMatchObject( {
				code: 'mixed-content',
			} );
		} );
	} );
} );

describe( 'stream-rules: every code has its message', () => {
	// The keys of admin/admin-strings.php; station-admin.js reads
	// `stream` + the code in PascalCase (`streamNote` for the notes).
	const PHP = readFileSync(
		resolve( __dirname, '../../../admin/admin-strings.php' ),
		'utf8'
	);
	const key = ( prefix, code ) =>
		prefix +
		code
			.split( '-' )
			.map( ( part ) => part[ 0 ].toUpperCase() + part.slice( 1 ) )
			.join( '' );

	it.each( [
		'plays',
		'plays-no-visualizer',
		'playlist',
		'playlist-empty',
		'icecast-mounts',
		'icecast-no-mounts',
		'shoutcast',
		'mixed-content-variant',
		'mixed-content',
		'manifest-no-cors',
		'not-a-stream',
		'http-error',
		'server-only',
		'unreachable',
	] )( 'verdict %s', ( code ) => {
		expect( PHP ).toContain( `'${ key( 'stream', code ) }'` );
	} );

	// shoutcast-server needs no note: the shoutcast verdict says it.
	it.each( [ 'playlist-mirrors', 'playlist-private-entry' ] )(
		'note %s',
		( code ) => {
			expect( PHP ).toContain( `'${ key( 'streamNote', code ) }'` );
		}
	);
} );
