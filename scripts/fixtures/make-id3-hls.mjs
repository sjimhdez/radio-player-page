#!/usr/bin/env node
/**
 * Generates an HLS stream with ID3 song titles into
 * tests/fixtures/audio/hls-id3/ (committed) for the e2e of the current song
 * (spec 0020, A12; ADR 0068 §13). Rewrite of the spike's Python generator
 * (docs/spikes/0020-phase-0.md, R3), packed audio only:
 *
 *   index.m3u8   VOD playlist of four 2 s segments
 *   seg-NNN.aac  ADTS audio with an ID3v2.4 tag in front: the Apple PRIV
 *                timestamp (com.apple.streaming.transportStreamTimestamp, the
 *                33-bit PTS of its first sample), TIT2 and TPE1
 *
 * Segments 0-1 say "E2E Artist - First Song" and 2-3 "E2E Artist - Second
 * Song". hls.js gives no cue for the tag of the first segment (spike 0020,
 * R3): the first title shows with the second segment.
 *
 * Requires ffmpeg (8 s of a 440 Hz tone, 64 kbps AAC). No dependencies;
 * the output is bit-exact, so a re-run does not dirty the tree. Called by
 * make-audio.sh, which first empties tests/fixtures/audio/.
 */
import { execFileSync } from 'node:child_process';
import {
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(
	new URL( '../../tests/fixtures/audio/hls-id3/', import.meta.url )
);
const SAMPLE_RATE = 44100;
// Samples in an AAC frame.
const FRAME_SAMPLES = 1024;
const SONGS = [
	[ 'E2E Artist', 'First Song' ],
	[ 'E2E Artist', 'Second Song' ],
];

/**
 * A 28-bit number as four 7-bit bytes (ID3v2 "synchsafe").
 *
 * @param {number} n Number.
 * @return {Buffer} Four bytes.
 */
function syncsafe( n ) {
	return Buffer.from(
		[ 2 ** 21, 2 ** 14, 2 ** 7, 1 ].map(
			( unit ) => Math.floor( n / unit ) % 128
		)
	);
}

/**
 * An ID3v2.4 frame.
 *
 * @param {string} id   Frame ID.
 * @param {Buffer} body Frame body.
 * @return {Buffer} Frame.
 */
function frame( id, body ) {
	return Buffer.concat( [
		Buffer.from( id, 'latin1' ),
		syncsafe( body.length ),
		Buffer.from( [ 0, 0 ] ),
		body,
	] );
}

/**
 * A text frame in UTF-8 (encoding byte 3), NUL-terminated.
 *
 * @param {string} id   Frame ID.
 * @param {string} text Text.
 * @return {Buffer} Frame.
 */
function textFrame( id, text ) {
	return frame(
		id,
		Buffer.concat( [
			Buffer.from( [ 3 ] ),
			Buffer.from( text ),
			Buffer.from( [ 0 ] ),
		] )
	);
}

/**
 * The ID3 tag of a segment of packed audio.
 *
 * @param {string} artist Artist (TPE1).
 * @param {string} title  Title (TIT2).
 * @param {bigint} pts    PTS of the first sample, in 90 kHz ticks.
 * @return {Buffer} Tag.
 */
function id3Tag( artist, title, pts ) {
	const timestamp = Buffer.alloc( 8 );
	// The PTS has 33 bits.
	timestamp.writeBigUInt64BE( pts % 2n ** 33n );
	const frames = Buffer.concat( [
		frame(
			'PRIV',
			Buffer.concat( [
				Buffer.from(
					'com.apple.streaming.transportStreamTimestamp\0',
					'latin1'
				),
				timestamp,
			] )
		),
		textFrame( 'TIT2', title ),
		textFrame( 'TPE1', artist ),
	] );
	return Buffer.concat( [
		Buffer.from( [ 0x49, 0x44, 0x33, 4, 0, 0 ] ),
		syncsafe( frames.length ),
		frames,
	] );
}

/**
 * The number of ADTS frames in a segment.
 *
 * @param {Buffer} data Segment.
 * @return {number} Frames.
 */
function countAdtsFrames( data ) {
	let count = 0;
	let at = 0;
	while (
		at + 7 <= data.length &&
		data[ at ] === 0xff &&
		data[ at + 1 ] >= 0xf0
	) {
		// The 13-bit frame length: the last 2 bits of byte 3, byte 4 and the
		// first 3 bits of byte 5.
		at +=
			( data[ at + 3 ] % 4 ) * 2 ** 11 +
			data[ at + 4 ] * 2 ** 3 +
			Math.floor( data[ at + 5 ] / 2 ** 5 );
		count += 1;
	}
	return count;
}

rmSync( OUT, { recursive: true, force: true } );
mkdirSync( OUT, { recursive: true } );

execFileSync( 'ffmpeg', [
	...[ '-v', 'error', '-y', '-f', 'lavfi' ],
	...[ '-i', 'sine=frequency=440:duration=8' ],
	...[
		'-fflags',
		'+bitexact',
		'-map_metadata',
		'-1',
		'-flags:a',
		'+bitexact',
	],
	...[
		'-ac',
		'1',
		'-ar',
		String( SAMPLE_RATE ),
		'-b:a',
		'64k',
		'-c:a',
		'aac',
	],
	...[ '-f', 'segment', '-segment_time', '2', '-segment_format', 'adts' ],
	join( OUT, 'seg-%03d.aac' ),
] );

const playlist = [
	'#EXTM3U',
	'#EXT-X-VERSION:3',
	'#EXT-X-TARGETDURATION:2',
	'#EXT-X-MEDIA-SEQUENCE:0',
	'#EXT-X-PLAYLIST-TYPE:VOD',
];
let samples = 0;
readdirSync( OUT )
	.filter( ( name ) => /^seg-\d{3}\.aac$/.test( name ) )
	.sort()
	.forEach( ( name, index ) => {
		const file = join( OUT, name );
		const data = readFileSync( file );
		const [ artist, title ] =
			SONGS[ Math.min( Math.floor( index / 2 ), SONGS.length - 1 ) ];
		const pts = ( BigInt( samples ) * 90000n ) / BigInt( SAMPLE_RATE );
		writeFileSync(
			file,
			Buffer.concat( [ id3Tag( artist, title, pts ), data ] )
		);
		const frames = countAdtsFrames( data );
		samples += frames * FRAME_SAMPLES;
		playlist.push(
			`#EXTINF:${ ( ( frames * FRAME_SAMPLES ) / SAMPLE_RATE ).toFixed(
				6
			) },`,
			name
		);
	} );
playlist.push( '#EXT-X-ENDLIST', '' );
writeFileSync( join( OUT, 'index.m3u8' ), playlist.join( '\n' ) );
