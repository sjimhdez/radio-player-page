/**
 * Local media servers for the e2e tests (spec 0002 §4.4). No test reaches the
 * internet: the stations of the e2e site point here.
 *
 * Two origins serve tests/fixtures/audio/, one with CORS headers and one
 * without. Besides the files there are three special routes:
 *
 * - `/live.mp3`: endless, Icecast-like (tone.mp3's audio frames in a loop, no
 *   length, no Range). No ID3 tag and no Info frame: macOS WebKit trusts the
 *   Info frame's duration and stops there (K18);
 * - `/cut.mp3`: like `/live.mp3`, but the connection is cut after ~2 s (C8);
 * - `/broken-intro.mp3`: 404.
 *
 * `GET /__requests` returns the request count by path of that origin (C7, C8);
 * `DELETE /__requests` resets it. Preflights (`OPTIONS`) are not counted.
 */
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MEDIA_PORT = 8901;
export const MEDIA_NOCORS_PORT = 8902;

const AUDIO_DIR = fileURLToPath(
	new URL( '../fixtures/audio/', import.meta.url )
);

const TYPES = {
	'.mp3': 'audio/mpeg',
	'.ogg': 'audio/ogg',
	'.m3u8': 'application/vnd.apple.mpegurl',
	'.ts': 'video/mp2t',
	'.mpd': 'application/dash+xml',
	'.m4s': 'video/iso.segment',
};

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
	'Access-Control-Allow-Headers': 'Range',
	'Access-Control-Expose-Headers':
		'Accept-Ranges, Content-Length, Content-Range',
};

// tone.mp3 is 64 kbps (8 KB/s): 8 KB every 500 ms is twice real time, which
// keeps the player's buffer ahead.
const LIVE_CHUNK = 8 * 1024;
const LIVE_INTERVAL_MS = 500;

// Bitrates (kbps) and sample rates of an MPEG-1 Layer III frame header.
const MP3_BITRATES = [
	0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
];
const MP3_SAMPLE_RATES = [ 44100, 48000, 32000 ];

/**
 * File under AUDIO_DIR for a request path, or null if it escapes the
 * directory, cannot be decoded or is not a file.
 *
 * @param {string} pathname Path of the request URL.
 * @return {string|null} Absolute path.
 */
function resolveFile( pathname ) {
	let decoded;
	try {
		decoded = decodeURIComponent( pathname );
	} catch {
		return null;
	}
	const file = resolve( AUDIO_DIR, `.${ decoded }` );
	if (
		! file.startsWith(
			AUDIO_DIR.endsWith( sep ) ? AUDIO_DIR : AUDIO_DIR + sep
		)
	) {
		return null;
	}
	try {
		return statSync( file ).isFile() ? file : null;
	} catch {
		return null;
	}
}

/**
 * Sends a fixture, honouring a single `Range: bytes=` request.
 *
 * @param {Object} req     Request.
 * @param {Object} res     Response.
 * @param {string} file    Absolute path.
 * @param {Object} headers CORS headers of the origin.
 */
function sendFile( req, res, file, headers ) {
	const size = statSync( file ).size;
	const base = {
		...headers,
		'Content-Type': TYPES[ extname( file ) ] ?? 'application/octet-stream',
		'Accept-Ranges': 'bytes',
	};
	const range = /^bytes=(\d*)-(\d*)$/.exec( req.headers.range ?? '' );
	let status = 200;
	let start = 0;
	let end = size - 1;

	if ( range && ( range[ 1 ] || range[ 2 ] ) ) {
		if ( range[ 1 ] ) {
			start = Number( range[ 1 ] );
			end = range[ 2 ] ? Math.min( Number( range[ 2 ] ), size - 1 ) : end;
		} else {
			// Suffix range: the last N bytes.
			start = Math.max( size - Number( range[ 2 ] ), 0 );
		}
		if ( start >= size || start > end ) {
			res.writeHead( 416, {
				...base,
				'Content-Range': `bytes */${ size }`,
			} );
			res.end();
			return;
		}
		status = 206;
		base[ 'Content-Range' ] = `bytes ${ start }-${ end }/${ size }`;
	}

	res.writeHead( status, { ...base, 'Content-Length': end - start + 1 } );
	if ( req.method === 'HEAD' ) {
		res.end();
		return;
	}
	createReadStream( file, { start, end } ).pipe( res );
}

/**
 * The audio frames of an MPEG-1 Layer III file: without its ID3v2 tag and its
 * Xing/Info frame, as an Icecast server sends them. The Info frame declares
 * the file's frame count and duration.
 *
 * @param {Buffer} data Whole file.
 * @return {Buffer} The frames alone.
 */
function mp3Frames( data ) {
	// The ID3v2 size is synchsafe: four 7-bit bytes after the 10-byte header.
	let at =
		data.toString( 'latin1', 0, 3 ) === 'ID3'
			? 10 +
				data[ 6 ] * 2 ** 21 +
				data[ 7 ] * 2 ** 14 +
				data[ 8 ] * 2 ** 7 +
				data[ 9 ]
			: 0;
	// Third header byte: bitrate index (4 bits), sample rate index (2 bits),
	// padding (1 bit).
	const header = data[ at + 2 ];
	const size =
		Math.floor(
			( 144 * MP3_BITRATES[ Math.floor( header / 16 ) ] * 1000 ) /
				MP3_SAMPLE_RATES[ Math.floor( header / 4 ) % 4 ]
		) +
		( Math.floor( header / 2 ) % 2 );
	const first = data.toString( 'latin1', at, at + size );
	if ( first.includes( 'Xing' ) || first.includes( 'Info' ) ) {
		at += size;
	}
	return data.subarray( at );
}

/**
 * Sends tone.mp3's audio frames in a loop, with no length, until the client leaves or, with
 * `cutAfterMs`, until the server cuts the connection.
 *
 * @param {Object}      res        Response.
 * @param {Object}      headers    CORS headers of the origin.
 * @param {number|null} cutAfterMs Milliseconds before the cut, or null.
 */
function sendLive( res, headers, cutAfterMs ) {
	const data = mp3Frames( readFileSync( join( AUDIO_DIR, 'tone.mp3' ) ) );
	res.writeHead( 200, {
		...headers,
		'Content-Type': 'audio/mpeg',
		'Cache-Control': 'no-cache, no-store',
	} );

	let offset = 0;
	const write = () => {
		const end = Math.min( offset + LIVE_CHUNK, data.length );
		res.write( data.subarray( offset, end ) );
		offset = end >= data.length ? 0 : end;
	};
	write();
	const timer = setInterval( write, LIVE_INTERVAL_MS );
	const cut =
		cutAfterMs === null
			? null
			: setTimeout( () => res.socket?.destroy(), cutAfterMs );
	res.on( 'close', () => {
		clearInterval( timer );
		clearTimeout( cut );
	} );
}

/**
 * One media origin.
 *
 * @param {boolean} cors       Whether to send the CORS headers.
 * @param {number}  cutAfterMs Milliseconds before `/cut.mp3` is cut.
 * @return {import('node:http').Server} Server, not listening yet.
 */
function createMediaServer( cors, cutAfterMs ) {
	const headers = cors ? CORS_HEADERS : {};
	let requests = {};

	return createServer( ( req, res ) => {
		const { pathname } = new URL( req.url, 'http://localhost' );

		if ( pathname === '/__requests' ) {
			if ( req.method === 'DELETE' ) {
				requests = {};
			}
			res.writeHead( 200, { 'Content-Type': 'application/json' } );
			res.end( JSON.stringify( requests ) );
			return;
		}
		if ( req.method === 'OPTIONS' ) {
			res.writeHead( 204, headers );
			res.end();
			return;
		}
		if ( req.method !== 'GET' && req.method !== 'HEAD' ) {
			res.writeHead( 405, { ...headers, Allow: 'GET, HEAD, OPTIONS' } );
			res.end();
			return;
		}

		requests[ pathname ] = ( requests[ pathname ] ?? 0 ) + 1;

		if ( pathname === '/live.mp3' ) {
			sendLive( res, headers, null );
			return;
		}
		if ( pathname === '/cut.mp3' ) {
			sendLive( res, headers, cutAfterMs );
			return;
		}
		const file =
			pathname === '/broken-intro.mp3' ? null : resolveFile( pathname );
		if ( ! file ) {
			res.writeHead( 404, headers );
			res.end();
			return;
		}
		sendFile( req, res, file, headers );
	} );
}

/**
 * Starts listening; rejects if the port is taken.
 *
 * @param {import('node:http').Server} server Server.
 * @param {number}                     port   Port (0 picks a free one).
 * @return {Promise<number>} The port it listens on.
 */
function listen( server, port ) {
	return new Promise( ( done, fail ) => {
		server.once( 'error', fail );
		server.listen( port, () => {
			server.off( 'error', fail );
			done( server.address().port );
		} );
	} );
}

/**
 * Starts both media origins.
 *
 * @param {Object} [options]            Options.
 * @param {number} [options.cors]       Port of the origin with CORS (8901).
 * @param {number} [options.noCors]     Port of the origin without CORS (8902).
 * @param {number} [options.cutAfterMs] Milliseconds before `/cut.mp3` is cut.
 * @return {Promise<Object>} `cors` and `noCors` (the ports) and `close()`.
 */
export async function startMediaServers( {
	cors = MEDIA_PORT,
	noCors = MEDIA_NOCORS_PORT,
	cutAfterMs = 2000,
} = {} ) {
	const servers = [
		createMediaServer( true, cutAfterMs ),
		createMediaServer( false, cutAfterMs ),
	];
	const close = () =>
		Promise.all(
			servers.map(
				( server ) =>
					new Promise( ( done ) => {
						if ( ! server.listening ) {
							done();
							return;
						}
						server.close( () => done() );
						server.closeAllConnections();
					} )
			)
		);

	try {
		const ports = await Promise.all( [
			listen( servers[ 0 ], cors ),
			listen( servers[ 1 ], noCors ),
		] );
		return { cors: ports[ 0 ], noCors: ports[ 1 ], close };
	} catch ( error ) {
		await close();
		throw error;
	}
}
