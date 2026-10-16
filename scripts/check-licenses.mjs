#!/usr/bin/env node
/**
 * Checks that every runtime (non-dev) dependency recorded in a project's
 * package-lock.json has a GPL-compatible license (spec 0001 §3, ADR 0019).
 * Everything bundled into player/dist or blocks/*\/build ends up in the
 * wordpress.org zip, so it must be GPL-compatible.
 *
 * Usage: node scripts/check-licenses.mjs <project-dir> [<project-dir> ...]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// SPDX identifiers accepted as GPL-2.0-or-later compatible.
const ALLOWED = new Set( [
	'0BSD',
	'Apache-2.0',
	'BSD-2-Clause',
	'BSD-3-Clause',
	'CC0-1.0',
	'GPL-2.0',
	'GPL-2.0-only',
	'GPL-2.0-or-later',
	'GPL-3.0',
	'GPL-3.0-only',
	'GPL-3.0-or-later',
	'ISC',
	'LGPL-2.1',
	'LGPL-2.1-or-later',
	'LGPL-3.0',
	'LGPL-3.0-or-later',
	'MIT',
	'MPL-2.0',
	'Unlicense',
	'Zlib',
] );

/**
 * Whether an SPDX expression is acceptable: every AND term must be allowed,
 * and at least one alternative of each OR group.
 *
 * @param {string} expression SPDX license expression.
 * @return {boolean} True when GPL-compatible.
 */
export function isAllowed( expression ) {
	const clean = expression.replace( /[()]/g, ' ' ).trim();
	return clean
		.split( /\s+AND\s+/i )
		.every( ( term ) =>
			term.split( /\s+OR\s+/i ).some( ( id ) => ALLOWED.has( id.trim() ) )
		);
}

let failures = 0;

for ( const dir of process.argv.slice( 2 ) ) {
	const lock = JSON.parse(
		readFileSync( join( dir, 'package-lock.json' ), 'utf8' )
	);
	let checked = 0;
	for ( const [ path, pkg ] of Object.entries( lock.packages ?? {} ) ) {
		if ( path === '' || pkg.dev || pkg.devOptional || pkg.link ) {
			continue;
		}
		checked++;
		const license =
			typeof pkg.license === 'string' ? pkg.license : 'UNKNOWN';
		if ( ! isAllowed( license ) ) {
			failures++;
			// eslint-disable-next-line no-console
			console.error(
				`${ dir }: ${ path.replace( /^.*node_modules\//, '' ) }@${
					pkg.version
				} has license "${ license }"`
			);
		}
	}
	// eslint-disable-next-line no-console
	console.log( `${ dir }: ${ checked } runtime packages checked` );
}

process.exit( failures ? 1 : 0 );
