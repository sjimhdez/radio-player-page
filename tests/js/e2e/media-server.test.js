/**
 * External dependencies
 */
import { statSync } from 'node:fs';
import { request } from 'node:http';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { startMediaServers } from '../../e2e/media-server.mjs';

const TONE_SIZE = statSync(
	resolve( __dirname, '../../fixtures/audio/tone.mp3' )
).size;

let servers;

/**
 * Sends a raw request (the path is not normalised, so `../` reaches the server).
 *
 * @param {number} port               Server port.
 * @param {string} path               Request path, as sent.
 * @param {Object} [options]          Request options.
 * @param {string} [options.method]   HTTP method (GET).
 * @param {Object} [options.headers]  Request headers.
 * @param {number} [options.maxBytes] Stop reading after that many bytes and
 *                                    close the connection.
 * @return {Promise<Object>} `status`, `headers`, `body` (Buffer) and `aborted`
 *                           (the server cut the connection).
 */
function fetchRaw(
	port,
	path,
	{ method = 'GET', headers = {}, maxBytes } = {}
) {
	return new Promise( ( done, fail ) => {
		const req = request(
			{ host: '127.0.0.1', port, path, method, headers },
			( res ) => {
				const chunks = [];
				let length = 0;
				let aborted = false;
				const finish = () =>
					done( {
						status: res.statusCode,
						headers: res.headers,
						body: Buffer.concat( chunks ),
						aborted,
					} );
				res.on( 'data', ( chunk ) => {
					chunks.push( chunk );
					length += chunk.length;
					if ( maxBytes && length >= maxBytes ) {
						res.destroy();
						finish();
					}
				} );
				res.on( 'aborted', () => {
					aborted = true;
				} );
				res.on( 'error', () => {
					aborted = true;
				} );
				res.on( 'close', finish );
			}
		);
		req.on( 'error', fail );
		req.end();
	} );
}

/**
 * Request counts of one origin.
 *
 * @param {number} port Server port.
 * @return {Promise<Object>} Count by path.
 */
async function counts( port ) {
	const { body } = await fetchRaw( port, '/__requests' );
	return JSON.parse( body.toString() );
}

beforeAll( async () => {
	servers = await startMediaServers( {
		cors: 0,
		noCors: 0,
		icy: 0,
		shoutcast: 0,
		cutAfterMs: 300,
	} );
} );

afterAll( () => servers.close() );

beforeEach( async () => {
	await fetchRaw( servers.cors, '/__requests', { method: 'DELETE' } );
	await fetchRaw( servers.noCors, '/__requests', { method: 'DELETE' } );
	await fetchRaw( servers.cors, '/__song', { method: 'POST' } );
} );

describe( 'startMediaServers', () => {
	it( 'listens on the requested ports (0 picks free ones)', () => {
		expect( servers.cors ).toBeGreaterThan( 0 );
		expect( servers.noCors ).toBeGreaterThan( 0 );
		expect( servers.cors ).not.toBe( servers.noCors );
	} );

	it( 'serves a fixture with its media type and length', async () => {
		const res = await fetchRaw( servers.cors, '/tone.mp3' );

		expect( res.status ).toBe( 200 );
		expect( res.headers[ 'content-type' ] ).toBe( 'audio/mpeg' );
		expect( res.headers[ 'accept-ranges' ] ).toBe( 'bytes' );
		expect( res.body.length ).toBe( TONE_SIZE );
	} );

	it( 'serves the HLS and DASH files', async () => {
		const hls = await fetchRaw( servers.cors, '/hls/index.m3u8' );
		const dash = await fetchRaw( servers.cors, '/dash/manifest.mpd' );

		expect( hls.status ).toBe( 200 );
		expect( hls.headers[ 'content-type' ] ).toBe(
			'application/vnd.apple.mpegurl'
		);
		expect( dash.status ).toBe( 200 );
		expect( dash.headers[ 'content-type' ] ).toBe( 'application/dash+xml' );
	} );

	it( 'sends the CORS headers only on the CORS origin', async () => {
		const withCors = await fetchRaw( servers.cors, '/tone.mp3' );
		const withoutCors = await fetchRaw( servers.noCors, '/tone.mp3' );

		expect( withCors.headers[ 'access-control-allow-origin' ] ).toBe( '*' );
		expect( withoutCors.status ).toBe( 200 );
		expect(
			withoutCors.headers[ 'access-control-allow-origin' ]
		).toBeUndefined();
	} );

	it( 'answers the preflight with 204 and the CORS headers', async () => {
		const res = await fetchRaw( servers.cors, '/hls/index.m3u8', {
			method: 'OPTIONS',
		} );

		expect( res.status ).toBe( 204 );
		expect( res.headers[ 'access-control-allow-headers' ] ).toBe( 'Range' );
	} );

	it( 'answers a Range request with 206 and that slice', async () => {
		const res = await fetchRaw( servers.cors, '/tone.mp3', {
			headers: { Range: 'bytes=100-199' },
		} );

		expect( res.status ).toBe( 206 );
		expect( res.headers[ 'content-range' ] ).toBe(
			`bytes 100-199/${ TONE_SIZE }`
		);
		expect( res.body.length ).toBe( 100 );
	} );

	it( 'answers an open-ended Range up to the end of the file', async () => {
		const res = await fetchRaw( servers.cors, '/tone.mp3', {
			headers: { Range: `bytes=${ TONE_SIZE - 10 }-` },
		} );

		expect( res.status ).toBe( 206 );
		expect( res.body.length ).toBe( 10 );
	} );

	it( 'answers a Range past the end with 416', async () => {
		const res = await fetchRaw( servers.cors, '/tone.mp3', {
			headers: { Range: `bytes=${ TONE_SIZE }-` },
		} );

		expect( res.status ).toBe( 416 );
		expect( res.headers[ 'content-range' ] ).toBe(
			`bytes */${ TONE_SIZE }`
		);
	} );

	it( 'keeps sending /live.mp3 past the size of the file', async () => {
		const res = await fetchRaw( servers.cors, '/live.mp3', {
			maxBytes: TONE_SIZE + 1,
		} );

		expect( res.status ).toBe( 200 );
		expect( res.headers[ 'content-type' ] ).toBe( 'audio/mpeg' );
		expect( res.headers[ 'content-length' ] ).toBeUndefined();
		expect( res.body.length ).toBeGreaterThan( TONE_SIZE );
	}, 10_000 );

	it( 'cuts /cut.mp3 mid-stream', async () => {
		const res = await fetchRaw( servers.cors, '/cut.mp3' );

		expect( res.status ).toBe( 200 );
		expect( res.aborted ).toBe( true );
		expect( res.body.length ).toBeGreaterThan( 0 );
	} );

	it( 'answers /broken-intro.mp3 with 404', async () => {
		const res = await fetchRaw( servers.cors, '/broken-intro.mp3' );

		expect( res.status ).toBe( 404 );
	} );

	it( 'counts the requests by path on each origin', async () => {
		await fetchRaw( servers.cors, '/tone.mp3' );
		await fetchRaw( servers.cors, '/tone.mp3', {
			headers: { Range: 'bytes=0-9' },
		} );
		await fetchRaw( servers.cors, '/broken-intro.mp3' );
		await fetchRaw( servers.cors, '/hls/index.m3u8', {
			method: 'OPTIONS',
		} );
		await fetchRaw( servers.noCors, '/tone.mp3' );

		expect( await counts( servers.cors ) ).toEqual( {
			'/tone.mp3': 2,
			'/broken-intro.mp3': 1,
		} );
		expect( await counts( servers.noCors ) ).toEqual( { '/tone.mp3': 1 } );
	} );

	it( 'resets the counts with DELETE /__requests', async () => {
		await fetchRaw( servers.cors, '/tone.mp3' );

		await fetchRaw( servers.cors, '/__requests', { method: 'DELETE' } );

		expect( await counts( servers.cors ) ).toEqual( {} );
	} );

	it.each( [
		'/../package.json',
		'/hls/../../../package.json',
		'/..%2f..%2f..%2fpackage.json',
		'/%2e%2e/%2e%2e/%2e%2e/package.json',
		'/',
		'/hls',
	] )( 'serves nothing outside the audio fixtures: %s', async ( path ) => {
		const res = await fetchRaw( servers.cors, path );

		expect( res.status ).toBe( 404 );
	} );

	it( 'rejects methods other than GET, HEAD and OPTIONS', async () => {
		const res = await fetchRaw( servers.cors, '/tone.mp3', {
			method: 'POST',
		} );

		expect( res.status ).toBe( 405 );
	} );

	describe( 'the pages and playlists of "Test Stream" (spec 0018)', () => {
		it.each( [ 'cors', 'noCors' ] )(
			'serves a .pls with one stream on the %s origin',
			async ( origin ) => {
				const res = await fetchRaw( servers[ origin ], '/listen.pls' );

				expect( res.status ).toBe( 200 );
				expect( res.headers[ 'content-type' ] ).toBe( 'audio/x-scpls' );
				expect( res.body.toString() ).toBe(
					'[playlist]\nNumberOfEntries=1\nFile1=http://stream.example.test/live.mp3\nTitle1=E2E radio\nVersion=2\n'
				);
			}
		);

		it( 'serves a .m3u with a private entry and a public one', async () => {
			const res = await fetchRaw( servers.cors, '/listen.m3u' );

			expect( res.status ).toBe( 200 );
			expect( res.headers[ 'content-type' ] ).toBe( 'audio/x-mpegurl' );
			expect( res.body.toString() ).toBe(
				`#EXTM3U\n#EXTINF:-1,E2E radio\nhttp://localhost:${ servers.cors }/live.mp3\n#EXTINF:-1,E2E radio HQ\nhttp://stream.example.test/hq.mp3\n`
			);
		} );

		it( 'serves an Icecast page with the Server header', async () => {
			const res = await fetchRaw( servers.cors, '/icecast/' );

			expect( res.status ).toBe( 200 );
			expect( res.headers.server ).toBe( 'Icecast 2.4.4' );
			expect( res.headers[ 'content-type' ] ).toMatch( /^text\/html/ );
			expect( res.body.toString() ).toContain(
				'<title>Icecast Streaming Media Server</title>'
			);
		} );

		it( 'lists one live mount and one without a source in status-json.xsl', async () => {
			const res = await fetchRaw( servers.noCors, '/status-json.xsl' );

			expect( res.status ).toBe( 200 );
			expect( res.headers.server ).toBe( 'Icecast 2.4.4' );
			expect( JSON.parse( res.body.toString() ).icestats.source ).toEqual(
				[
					{
						listenurl: `http://localhost:${ servers.noCors }/live.mp3`,
						server_name: 'E2E radio',
						server_type: 'audio/mpeg',
						title: 'E2E Artist - First Song',
					},
					{ listenurl: `http://localhost:${ servers.noCors }/off` },
				]
			);
		} );

		it( 'serves a Shoutcast v1 status page', async () => {
			const res = await fetchRaw( servers.cors, '/shoutcast/' );

			expect( res.status ).toBe( 200 );
			expect( res.headers[ 'content-type' ] ).toMatch( /^text\/html/ );
			expect( res.body.toString() ).toContain(
				'<title>SHOUTcast Administrator</title>'
			);
		} );

		it( 'sends the live stream with icy headers at /;', async () => {
			const res = await fetchRaw( servers.cors, '/;', { maxBytes: 1 } );

			expect( res.status ).toBe( 200 );
			expect( res.headers[ 'content-type' ] ).toBe( 'audio/mpeg' );
			expect( res.headers[ 'icy-notice2' ] ).toMatch( /^SHOUTcast/ );
			expect( res.headers[ 'access-control-allow-origin' ] ).toBe( '*' );
		} );

		it( 'serves an HTML page that is not a stream', async () => {
			const res = await fetchRaw( servers.cors, '/page.html' );

			expect( res.status ).toBe( 200 );
			expect( res.headers[ 'content-type' ] ).toMatch( /^text\/html/ );
			expect( res.body.toString() ).toContain(
				'<title>My radio</title>'
			);
		} );

		it( 'keeps the CORS headers off the pages of the origin without CORS', async () => {
			const res = await fetchRaw( servers.noCors, '/icecast/' );

			expect(
				res.headers[ 'access-control-allow-origin' ]
			).toBeUndefined();
		} );
	} );

	describe( 'the current song (spec 0020)', () => {
		/**
		 * The first ICY block of a stream read with Icy-MetaData: 1.
		 *
		 * @param {number} port Server port.
		 * @return {Promise<Object>} `headers` and `text` of the block.
		 */
		async function firstIcyBlock( port ) {
			const res = await fetchRaw( port, '/live.mp3', {
				headers: { 'Icy-MetaData': '1' },
				maxBytes: 8192 + 1 + 255 * 16,
			} );
			const metaint = Number( res.headers[ 'icy-metaint' ] );
			const length = res.body[ metaint ] * 16;
			return {
				headers: res.headers,
				text: res.body
					.subarray( metaint + 1, metaint + 1 + length )
					.toString()
					.replace( /\0+$/, '' ),
			};
		}

		it( 'changes the title of status-json.xsl with POST /__song', async () => {
			await fetchRaw( servers.cors, '/__song?title=Other%20-%20Song', {
				method: 'POST',
			} );
			const res = await fetchRaw( servers.cors, '/status-json.xsl' );

			expect(
				JSON.parse( res.body.toString() ).icestats.source[ 0 ].title
			).toBe( 'Other - Song' );
		} );

		it( 'sends ICY blocks with the title in /live.mp3 asked with Icy-MetaData', async () => {
			await fetchRaw( servers.cors, '/__song?title=Caf%C3%A9', {
				method: 'POST',
			} );
			const { headers, text } = await firstIcyBlock( servers.cors );

			expect( headers[ 'icy-metaint' ] ).toBe( '8192' );
			expect( text ).toBe( "StreamTitle='Café';" );
			expect( await counts( servers.cors ) ).toMatchObject( {
				'/live.mp3 (Icy-MetaData)': 1,
			} );
		} );

		it( 'sends /live.mp3 without ICY blocks when not asked', async () => {
			const res = await fetchRaw( servers.cors, '/live.mp3', {
				maxBytes: 1,
			} );

			expect( res.headers[ 'icy-metaint' ] ).toBeUndefined();
		} );

		it( 'keeps Icy-MetaData and icy-metaint out of the CORS of the origin with CORS', async () => {
			const res = await fetchRaw( servers.cors, '/live.mp3', {
				method: 'OPTIONS',
			} );

			expect( res.headers[ 'access-control-allow-headers' ] ).toBe(
				'Range'
			);
			expect(
				res.headers[ 'access-control-expose-headers' ]
			).not.toContain( 'icy-metaint' );
		} );

		it( 'lets the icy origin read ICY, without a status-json.xsl', async () => {
			const preflight = await fetchRaw( servers.icy, '/live.mp3', {
				method: 'OPTIONS',
			} );
			const status = await fetchRaw( servers.icy, '/status-json.xsl' );
			const { text } = await firstIcyBlock( servers.icy );

			expect(
				preflight.headers[ 'access-control-allow-headers' ]
			).toContain( 'Icy-MetaData' );
			expect(
				preflight.headers[ 'access-control-expose-headers' ]
			).toContain( 'icy-metaint' );
			expect( status.status ).toBe( 404 );
			expect( text ).toBe( "StreamTitle='E2E Artist - First Song';" );
		} );

		it( 'answers status-json.xsl with the live stream on the shoutcast origin, open until closed', async () => {
			const res = await fetchRaw( servers.shoutcast, '/status-json.xsl', {
				maxBytes: 1,
			} );
			// The server sees the close a moment after the client.
			await new Promise( ( done ) => setTimeout( done, 50 ) );
			const open = await fetchRaw( servers.shoutcast, '/__open' );

			expect( res.headers[ 'content-type' ] ).toBe( 'audio/mpeg' );
			expect( res.headers[ 'access-control-allow-origin' ] ).toBe( '*' );
			expect( res.headers[ 'icy-notice2' ] ).toMatch( /^SHOUTcast/ );
			expect( JSON.parse( open.body.toString() ) ).toEqual( {
				'/status-json.xsl': 0,
			} );
		} );
	} );
} );
