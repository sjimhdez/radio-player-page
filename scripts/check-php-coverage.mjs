#!/usr/bin/env node
/**
 * Applies the PHP coverage minimums of spec 0002 (§4.5) and ADR 0028 to a
 * PHPUnit `--coverage-xml` report. The zones live in
 * tests/coverage/php-zones.json and are measured in order. Each one has a
 * `min`, an `include` list and an optional `exclude` list of globs:
 *
 * - `{ file }` or `{ file, functions }`: a whole file or some of its global
 *   functions. The XML report gives per-function totals; the clover report of
 *   PHPUnit 9.6 does not.
 * - A glob: the lines of each matching file that earlier zones did not take,
 *   unless the file matches an `exclude` glob.
 *
 * Files that match no zone are not measured. Each zone fails below its `min`
 * (percent of executable lines), with no executable lines, or when a listed
 * file or function is missing from the report (renamed or not loaded).
 *
 * Usage: node scripts/check-php-coverage.mjs <coverage-xml-dir> [--zones <file>]
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_ZONES = fileURLToPath(
	new URL( '../tests/coverage/php-zones.json', import.meta.url )
);

/**
 * Attributes of an XML start tag as an object.
 *
 * @param {string} tag Start tag, e.g. `<lines executable="3" executed="2"/>`.
 * @return {Object} Attribute values by name.
 */
function attributes( tag ) {
	const result = {};
	for ( const [ , name, value ] of tag.matchAll( /([\w-]+)="([^"]*)"/g ) ) {
		result[ name ] = value;
	}
	return result;
}

/**
 * Line totals of every file in the report, with its global functions.
 *
 * @param {string} xmlDir Directory written by `--coverage-xml`.
 * @return {Map<string, Object>} By path relative to the plugin root.
 */
function readReport( xmlDir ) {
	const index = join( xmlDir, 'index.xml' );
	if ( ! existsSync( index ) ) {
		throw new Error( `${ index } not found: run the coverage first.` );
	}
	const files = new Map();
	const hrefs = readFileSync( index, 'utf8' ).matchAll(
		/<file [^>]*href="([^"]+)\.xml"/g
	);
	for ( const [ , path ] of hrefs ) {
		const xml = readFileSync( join( xmlDir, `${ path }.xml` ), 'utf8' );
		const lines = attributes( xml.match( /<lines [^>]*>/ )[ 0 ] );
		const functions = new Map();
		for ( const [ tag ] of xml.matchAll( /<function [^>]*>/g ) ) {
			const fn = attributes( tag );
			functions.set( fn.name, {
				executable: Number( fn.executable ),
				executed: Number( fn.executed ),
			} );
		}
		files.set( path, {
			executable: Number( lines.executable ),
			executed: Number( lines.executed ),
			functions,
		} );
	}
	return files;
}

/**
 * Regular expression for a glob with `*` (one segment) and `**` (any depth).
 *
 * @param {string} glob Path glob relative to the plugin root.
 * @return {RegExp} Anchored expression.
 */
function globToRegExp( glob ) {
	const source = glob
		.split( '**' )
		.map( ( part ) =>
			part
				.replace( /[.+?^${}()|[\]\\]/g, '\\$&' )
				.replace( /\*/g, '[^/]*' )
		)
		.join( '.*' );
	return new RegExp( `^${ source }$` );
}

/**
 * Adds a part (file or function totals) to a zone and claims it in its file.
 *
 * @param {Object} zone    Totals of the zone.
 * @param {Map}    claimed Claimed lines per file.
 * @param {string} file    Path of the file the part belongs to.
 * @param {Object} part    Executable and executed lines.
 */
function take( zone, claimed, file, part ) {
	const taken = claimed.get( file ) ?? { executable: 0, executed: 0 };
	zone.executable += part.executable;
	zone.executed += part.executed;
	taken.executable += part.executable;
	taken.executed += part.executed;
	claimed.set( file, taken );
}

/**
 * Measures each zone against the report, in the order of the definition.
 *
 * An `include` entry is a glob or a `{ file, functions? }` object. A glob
 * takes what earlier zones left of each matching file, except the files that
 * match an `exclude` glob, which stay for the zones that follow.
 *
 * @param {string} xmlDir Directory written by `--coverage-xml`.
 * @param {Object} zones  Definition, as in tests/coverage/php-zones.json.
 * @return {{ok: boolean, errors: string[], zones: Object}} Result per zone.
 */
export function measureZones( xmlDir, zones ) {
	const files = readReport( xmlDir );
	const errors = [];
	// Lines per file already taken by a zone, so the next ones skip them.
	const claimed = new Map();
	const result = {};

	for ( const [ name, zone ] of Object.entries( zones ) ) {
		const totals = { executable: 0, executed: 0 };
		const globs = zone.include.filter(
			( entry ) => typeof entry === 'string'
		);

		for ( const { file, functions } of zone.include.filter(
			( entry ) => typeof entry !== 'string'
		) ) {
			const fileTotals = files.get( file );
			if ( ! fileTotals ) {
				errors.push(
					`${ name }: file ${ file } not found in the report`
				);
				continue;
			}
			if ( ! functions ) {
				take( totals, claimed, file, fileTotals );
				continue;
			}
			for ( const fnName of functions ) {
				const fn = fileTotals.functions.get( fnName );
				if ( fn ) {
					take( totals, claimed, file, fn );
				} else {
					errors.push(
						`${ name }: function ${ fnName } not found in ${ file }`
					);
				}
			}
		}

		const patterns = globs.map( globToRegExp );
		const excluded = ( zone.exclude ?? [] ).map( globToRegExp );
		for ( const [ path, fileTotals ] of files ) {
			if (
				! patterns.some( ( pattern ) => pattern.test( path ) ) ||
				excluded.some( ( pattern ) => pattern.test( path ) )
			) {
				continue;
			}
			const taken = claimed.get( path ) ?? { executable: 0, executed: 0 };
			take( totals, claimed, path, {
				executable: fileTotals.executable - taken.executable,
				executed: fileTotals.executed - taken.executed,
			} );
		}

		const percent =
			totals.executable === 0
				? 0
				: ( totals.executed / totals.executable ) * 100;
		if ( totals.executable === 0 ) {
			errors.push( `${ name }: no executable lines` );
		}
		result[ name ] = {
			...totals,
			percent,
			min: zone.min,
			ok: totals.executable > 0 && percent >= zone.min,
		};
	}

	return {
		ok:
			errors.length === 0 &&
			Object.values( result ).every( ( z ) => z.ok ),
		errors,
		zones: result,
	};
}

/**
 * Command-line entry point.
 *
 * @param {string[]} args Arguments after the script name.
 * @return {number} Exit code.
 */
function main( args ) {
	const zonesFlag = args.indexOf( '--zones' );
	const zonesFile =
		zonesFlag === -1 ? DEFAULT_ZONES : resolve( args[ zonesFlag + 1 ] );
	const xmlDir = args.find(
		( arg, i ) =>
			! arg.startsWith( '--' ) &&
			( zonesFlag === -1 || i !== zonesFlag + 1 )
	);
	if ( ! xmlDir ) {
		process.stderr.write(
			'Usage: node scripts/check-php-coverage.mjs <coverage-xml-dir> [--zones <file>]\n'
		);
		return 1;
	}

	let result;
	try {
		result = measureZones(
			resolve( xmlDir ),
			JSON.parse( readFileSync( zonesFile, 'utf8' ) )
		);
	} catch ( error ) {
		process.stderr.write( `${ error.message }\n` );
		return 1;
	}

	for ( const [ name, zone ] of Object.entries( result.zones ) ) {
		const line = `${ name }: ${ zone.percent.toFixed( 2 ) } % (${
			zone.executed
		}/${ zone.executable } lines), minimum ${ zone.min } %\n`;
		if ( zone.ok ) {
			process.stdout.write( line );
		} else {
			process.stderr.write( `FAIL ${ line }` );
		}
	}
	for ( const error of result.errors ) {
		process.stderr.write( `FAIL ${ error }\n` );
	}
	return result.ok ? 0 : 1;
}

if ( import.meta.url === pathToFileURL( process.argv[ 1 ] ).href ) {
	process.exitCode = main( process.argv.slice( 2 ) );
}
