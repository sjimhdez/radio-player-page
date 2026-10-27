/**
 * External dependencies
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve( __dirname, '../..' );

/**
 * Reads a file of the plugin.
 *
 * @param {string} path Path relative to the plugin root.
 * @return {string} Contents.
 */
function read( path ) {
	return readFileSync( join( ROOT, path ), 'utf8' );
}

/**
 * Returns the first capture of a pattern, or fails naming what was missing.
 *
 * @param {string} text  Text to search.
 * @param {RegExp} regex Pattern with one capture group.
 * @param {string} what  Description for the error.
 * @return {string} The capture.
 */
function capture( text, regex, what ) {
	const match = text.match( regex );
	if ( ! match ) {
		throw new Error( `${ what } not found` );
	}
	return match[ 1 ];
}

/**
 * Bodies of every wp_enqueue_* / wp_register_* call, up to the matching
 * closing parenthesis (string literals are skipped so a ')' inside one
 * does not end the call).
 *
 * @param {string} source PHP source.
 * @return {string[]} Argument lists, without the outer parentheses.
 */
function enqueueCalls( source ) {
	const calls = [];
	const start = /\bwp_(?:enqueue|register)_(?:script|style)\s*\(/g;
	while ( start.exec( source ) !== null ) {
		let depth = 1;
		let quote = null;
		let i = start.lastIndex;
		for ( ; i < source.length && depth > 0; i++ ) {
			const char = source[ i ];
			if ( quote ) {
				if ( char === '\\' ) {
					i++;
				} else if ( char === quote ) {
					quote = null;
				}
			} else if ( char === "'" || char === '"' ) {
				quote = char;
			} else if ( char === '(' ) {
				depth++;
			} else if ( char === ')' ) {
				depth--;
			}
		}
		calls.push( source.slice( start.lastIndex, i - 1 ) );
	}
	return calls;
}

/**
 * Version literals ('x.y.z') passed to the enqueue calls of a PHP file.
 *
 * @param {string} path Path relative to the plugin root.
 * @return {string[]} Versions found, one per literal.
 */
function enqueueVersions( path ) {
	return enqueueCalls( read( path ) ).flatMap( ( args ) =>
		[ ...args.matchAll( /['"](\d+\.\d+\.\d+)['"]/g ) ].map(
			( literal ) => literal[ 1 ]
		)
	);
}

/**
 * Version prefix of every file the player build lists.
 *
 * @return {string[]} One version per file or stylesheet of the manifest.
 */
function manifestVersions() {
	const manifest = JSON.parse( read( 'player/dist/manifest.json' ) );
	return Object.values( manifest ).flatMap( ( chunk ) =>
		[ chunk.file, ...( chunk.css || [] ) ].map( ( file ) =>
			capture(
				file,
				/^radio-player-page-(\d+\.\d+\.\d+)[-.]/,
				`version prefix in player/dist/${ file }`
			)
		)
	);
}

// R7 of spec 0014: every place that carries the release version agrees with
// the plugin header, so a release cannot ship half-bumped.
describe( 'release version', () => {
	const header = capture(
		read( 'radio-player-page.php' ),
		/^\s*\*\s*Version:\s*(\S+)\s*$/m,
		'Version header'
	);

	it( 'reads a semantic version from the plugin header', () => {
		expect( header ).toMatch( /^\d+\.\d+\.\d+$/ );
	} );

	it( 'matches the readme Stable tag', () => {
		expect(
			capture(
				read( 'readme.txt' ),
				/^Stable tag:\s*(\S+)\s*$/m,
				'Stable tag'
			)
		).toBe( header );
	} );

	// G2 of spec 0015: the generator meta prints this constant (ADR 0053).
	it( 'matches the RADPLAPAG_VERSION constant', () => {
		expect(
			capture(
				read( 'radio-player-page.php' ),
				/define\(\s*'RADPLAPAG_VERSION',\s*'([^']*)'\s*\)/,
				'RADPLAPAG_VERSION constant'
			)
		).toBe( header );
	} );

	it.each( [ 'package.json', 'player/package.json' ] )(
		'matches the version of %s',
		( path ) => {
			expect( JSON.parse( read( path ) ).version ).toBe( header );
		}
	);

	it( 'matches the prefix of every player/dist asset in the manifest', () => {
		const versions = manifestVersions();
		expect( versions.length ).toBeGreaterThan( 0 );
		expect( new Set( versions ) ).toEqual( new Set( [ header ] ) );
	} );

	it( 'matches every version literal of the admin enqueues', () => {
		const versions = [
			...enqueueVersions( 'admin/admin.php' ),
			...enqueueVersions( 'includes/radplapag-program-cpt.php' ),
		];
		expect( versions.length ).toBeGreaterThanOrEqual( 5 );
		expect( new Set( versions ) ).toEqual( new Set( [ header ] ) );
	} );
} );
