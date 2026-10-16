/**
 * External dependencies
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const ADMIN_SCRIPTS = [
	'admin/js/station-admin.js',
	'admin/js/program-admin.js',
];

/**
 * Minimal browser globals for a screen where none of the admin markup exists.
 *
 * @return {Object} Sandbox for `runInNewContext`.
 */
function emptyScreen() {
	const document = {
		getElementById: () => null,
		querySelector: () => null,
		querySelectorAll: () => [],
		addEventListener: () => {},
	};
	const window = { document, addEventListener: () => {} };
	window.window = window;
	return { window, document, console };
}

describe( 'admin scripts (smoke)', () => {
	it.each( ADMIN_SCRIPTS )(
		'%s loads on a screen without its markup',
		( file ) => {
			const source = readFileSync(
				resolve( __dirname, '../../..', file ),
				'utf8'
			);

			expect( () =>
				runInNewContext( source, emptyScreen() )
			).not.toThrow();
		}
	);
} );
