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
 * And the answers "Test Stream" tells apart (spec 0018, A9): `/listen.pls`,
 * `/listen.m3u` (with a `localhost` entry, which the probe leaves out),
 * an Icecast page at `/icecast/` with its `/status-json.xsl`, a Shoutcast v1
 * status page at `/shoutcast/` with the live stream at `/;`, and an HTML
 * page at `/page.html`. The playlists point to `stream.example.test`, which
 * nothing requests: the e2e only fills the field with it.
 *
 * The current song (spec 0020, A12): the live mount of `/status-json.xsl`
 * has a `title`, and `/live.mp3` asked with `Icy-MetaData: 1` sends an ICY
 * block with it every 8 KB, with the `icy-metaint` header. `POST
 * /__song?title=` changes the title of that origin. Two more origins:
 * - :8903 "icy": `/status-json.xsl` is 404 and CORS allows `Icy-MetaData`
 *   and exposes `icy-metaint`, so only the ICY in the stream gives the song;
 * - :8904 "shoutcast": `/status-json.xsl` answers with the live stream, as a
 *   Shoutcast DNAS 2 does, and `icy-metaint` is not exposed.
 *
 * `GET /__requests` returns the request count by path of that origin (C7, C8;
 * those with `Icy-MetaData: 1` that are not loads of an `<audio>` as
 * `<path> (Icy-MetaData)`);
 * `DELETE /__requests` resets it. Preflights (`OPTIONS`) are not counted.
 * `GET /__open` returns the live responses still open, by path.
 */
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MEDIA_PORT = 8901;
export const MEDIA_NOCORS_PORT = 8902;
export const MEDIA_ICY_PORT = 8903;
export const MEDIA_SHOUTCAST_PORT = 8904;

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
	'.aac': 'audio/aac',
};

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
	'Access-Control-Allow-Headers': 'Range',
	'Access-Control-Expose-Headers':
		'Accept-Ranges, Content-Length, Content-Range',
};

// The "icy" origin: Icy-MetaData passes the preflight and icy-metaint can be
// read.
const ICY_CORS_HEADERS = {
	...CORS_HEADERS,
	'Access-Control-Allow-Headers': 'Icy-MetaData, Range',
	'Access-Control-Expose-Headers': `${ CORS_HEADERS[ 'Access-Control-Expose-Headers' ] }, icy-metaint`,
};

// Audio bytes between two ICY blocks.
const ICY_METAINT = 8192;

const DEFAULT_SONG = 'E2E Artist - First Song';

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

// Shoutcast v1's status page, as the spike imitated 1.9.8 (no v1 server was
// found to sample).
const SHOUTCAST_PAGE =
	'<html><head><title>SHOUTcast Administrator</title></head><body>' +
	'<font class=ST>SHOUTcast D.N.A.S. Status</font>' +
	'<a href="http://www.shoutcast.com">SHOUTcast Server Version 1.9.8/Linux</a>' +
	'</body></html>';

const SHOUTCAST_HEADERS = {
	'icy-notice1': '<BR>This stream requires Winamp<BR>',
	'icy-notice2':
		'SHOUTcast Distributed Network Audio Server/Linux v1.9.8<BR>',
	'icy-name': 'E2E radio',
};

const ICECAST_PAGE =
	'<!DOCTYPE html><html><head><title>Icecast Streaming Media Server</title></head>' +
	'<body><h3>Mount Point /live.mp3</h3></body></html>';

/**
 * An ICY metadata block: its length in 16-byte units, then the text padded
 * with NULs.
 *
 * @param {string} title Song.
 * @return {Buffer} Block.
 */
function icyBlock( title ) {
	const text = Buffer.from( `StreamTitle='${ title }';` );
	const length = Math.ceil( text.length / 16 );
	const block = Buffer.alloc( 1 + length * 16 );
	block[ 0 ] = length;
	text.copy( block, 1 );
	return block;
}

/**
 * The pages and playlists of "Test Stream", by path.
 *
 * @param {number} port  Port of the origin.
 * @param {string} title Song of the live mount.
 * @return {Object} `{ type, body, server? }` by path.
 */
function testStreamPages( port, title ) {
	return {
		'/listen.pls': {
			type: 'audio/x-scpls',
			body: '[playlist]\nNumberOfEntries=1\nFile1=http://stream.example.test/live.mp3\nTitle1=E2E radio\nVersion=2\n',
		},
		'/listen.m3u': {
			type: 'audio/x-mpegurl',
			body: `#EXTM3U\n#EXTINF:-1,E2E radio\nhttp://localhost:${ port }/live.mp3\n#EXTINF:-1,E2E radio HQ\nhttp://stream.example.test/hq.mp3\n`,
		},
		'/icecast/': {
			type: 'text/html; charset=utf-8',
			body: ICECAST_PAGE,
			server: 'Icecast 2.4.4',
		},
		// One live mount and one without a source (no server_type), which the
		// probe does not propose.
		'/status-json.xsl': {
			type: 'application/json; charset=utf-8',
			body: JSON.stringify( {
				icestats: {
					source: [
						{
							listenurl: `http://localhost:${ port }/live.mp3`,
							server_name: 'E2E radio',
							server_type: 'audio/mpeg',
							title,
						},
						{ listenurl: `http://localhost:${ port }/off` },
					],
				},
			} ),
			server: 'Icecast 2.4.4',
		},
		'/shoutcast/': {
			type: 'text/html; charset=utf-8',
			body: SHOUTCAST_PAGE,
		},
		'/page.html': {
			type: 'text/html; charset=utf-8',
			body: '<!DOCTYPE html><html><head><title>My radio</title></head><body><a href="/live.mp3">Listen</a></body></html>',
		},
	};
}

/**
 * Sends tone.mp3's audio frames in a loop, with no length, until the client leaves or, with
 * `cutAfterMs`, until the server cuts the connection. With `song`, an ICY
 * block with its title every ICY_METAINT bytes of audio.
 *
 * @param {Object}              res        Response.
 * @param {Object}              headers    CORS headers of the origin, and any other.
 * @param {number|null}         cutAfterMs Milliseconds before the cut, or null.
 * @param {(() => string)|null} song       Title of each ICY block, or null.
 */
function sendLive( res, headers, cutAfterMs, song = null ) {
	const data = mp3Frames( readFileSync( join( AUDIO_DIR, 'tone.mp3' ) ) );
	res.writeHead( 200, {
		...headers,
		'Content-Type': 'audio/mpeg',
		'Cache-Control': 'no-cache, no-store',
		...( song ? { 'icy-metaint': String( ICY_METAINT ) } : {} ),
	} );

	let offset = 0;
	let untilBlock = ICY_METAINT;
	const writeAudio = ( chunk ) => {
		if ( ! song ) {
			res.write( chunk );
			return;
		}
		let at = 0;
		while ( at < chunk.length ) {
			const take = Math.min( untilBlock, chunk.length - at );
			res.write( chunk.subarray( at, at + take ) );
			at += take;
			untilBlock -= take;
			if ( untilBlock === 0 ) {
				res.write( icyBlock( song() ) );
				untilBlock = ICY_METAINT;
			}
		}
	};
	const write = () => {
		const end = Math.min( offset + LIVE_CHUNK, data.length );
		writeAudio( data.subarray( offset, end ) );
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
 * @param {'cors'|'nocors'|'icy'|'shoutcast'} kind       Kind of origin.
 * @param {number}                            cutAfterMs Milliseconds before `/cut.mp3` is cut.
 * @return {import('node:http').Server} Server, not listening yet.
 */
function createMediaServer( kind, cutAfterMs ) {
	const headers = {
		cors: CORS_HEADERS,
		nocors: {},
		icy: ICY_CORS_HEADERS,
		shoutcast: CORS_HEADERS,
	}[ kind ];
	let requests = {};
	let song = DEFAULT_SONG;
	const open = {};

	/**
	 * sendLive(), counting the response as open until it closes.
	 *
	 * @param {Object}      res      Response.
	 * @param {string}      pathname Path of the request.
	 * @param {Object}      extra    Headers besides the CORS ones.
	 * @param {number|null} cut      Milliseconds before the cut, or null.
	 * @param {boolean}     wantsIcy Whether the request asked for ICY blocks.
	 */
	const live = ( res, pathname, extra, cut, wantsIcy = false ) => {
		open[ pathname ] = ( open[ pathname ] ?? 0 ) + 1;
		res.on( 'close', () => ( open[ pathname ] -= 1 ) );
		sendLive(
			res,
			{ ...headers, ...extra },
			cut,
			wantsIcy ? () => song : null
		);
	};

	return createServer( ( req, res ) => {
		const { pathname } = new URL( req.url, 'http://localhost' );

		if ( pathname === '/__song' && req.method === 'POST' ) {
			song =
				new URL( req.url, 'http://localhost' ).searchParams.get(
					'title'
				) ?? DEFAULT_SONG;
			res.writeHead( 204 );
			res.end();
			return;
		}
		if ( pathname === '/__open' ) {
			res.writeHead( 200, { 'Content-Type': 'application/json' } );
			res.end( JSON.stringify( open ) );
			return;
		}
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

		// A lookup of the current song by ICY counts apart (spec 0020); WebKit's
		// <audio> also asks for ICY, so its loads (Sec-Fetch-Dest: audio) do not.
		const counted =
			req.headers[ 'icy-metadata' ] === '1' &&
			req.headers[ 'sec-fetch-dest' ] !== 'audio'
				? `${ pathname } (Icy-MetaData)`
				: pathname;
		requests[ counted ] = ( requests[ counted ] ?? 0 ) + 1;

		if ( pathname === '/live.mp3' ) {
			live(
				res,
				pathname,
				{},
				null,
				req.headers[ 'icy-metadata' ] === '1'
			);
			return;
		}
		if ( pathname === '/cut.mp3' ) {
			live( res, pathname, {}, cutAfterMs );
			return;
		}
		if ( pathname === '/;' ) {
			live( res, pathname, SHOUTCAST_HEADERS, null );
			return;
		}
		if ( pathname === '/status-json.xsl' && kind === 'icy' ) {
			res.writeHead( 404, headers );
			res.end();
			return;
		}
		if ( pathname === '/status-json.xsl' && kind === 'shoutcast' ) {
			live( res, pathname, SHOUTCAST_HEADERS, null );
			return;
		}
		const page = testStreamPages( req.socket.localPort, song )[ pathname ];
		if ( page ) {
			res.writeHead( 200, {
				...headers,
				'Content-Type': page.type,
				...( page.server ? { Server: page.server } : {} ),
			} );
			res.end( req.method === 'HEAD' ? undefined : page.body );
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
 * Starts the media origins.
 *
 * @param {Object} [options]            Options.
 * @param {number} [options.cors]       Port of the origin with CORS (8901).
 * @param {number} [options.noCors]     Port of the origin without CORS (8902).
 * @param {number} [options.icy]        Port of the origin with readable ICY (8903).
 * @param {number} [options.shoutcast]  Port of the Shoutcast-like origin (8904).
 * @param {number} [options.cutAfterMs] Milliseconds before `/cut.mp3` is cut.
 * @return {Promise<Object>} `cors`, `noCors`, `icy` and `shoutcast` (the ports) and `close()`.
 */
export async function startMediaServers( {
	cors = MEDIA_PORT,
	noCors = MEDIA_NOCORS_PORT,
	icy = MEDIA_ICY_PORT,
	shoutcast = MEDIA_SHOUTCAST_PORT,
	cutAfterMs = 2000,
} = {} ) {
	const servers = [
		createMediaServer( 'cors', cutAfterMs ),
		createMediaServer( 'nocors', cutAfterMs ),
		createMediaServer( 'icy', cutAfterMs ),
		createMediaServer( 'shoutcast', cutAfterMs ),
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
			listen( servers[ 2 ], icy ),
			listen( servers[ 3 ], shoutcast ),
		] );
		return {
			cors: ports[ 0 ],
			noCors: ports[ 1 ],
			icy: ports[ 2 ],
			shoutcast: ports[ 3 ],
			close,
		};
	} catch ( error ) {
		await close();
		throw error;
	}
}
