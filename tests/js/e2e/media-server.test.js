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
		cutAfterMs: 300,
	} );
} );

afterAll( () => servers.close() );

beforeEach( async () => {
	await fetchRaw( servers.cors, '/__requests', { method: 'DELETE' } );
	await fetchRaw( servers.noCors, '/__requests', { method: 'DELETE' } );
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
} );
