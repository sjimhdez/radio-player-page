/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { normalize } from '../../e2e/support/normalize.mjs';

const ORIGINS = {
	site: 'http://localhost:8890',
	media: 'http://localhost:8901',
	mediaNoCors: 'http://localhost:8902',
};

const IDS = { 786: 'program-A', 793: 'page-mp3' };

/**
 * Normalizes with the default origins and ID map.
 *
 * @param {string} html      Page HTML.
 * @param {Object} [options] Overrides for the options.
 * @return {string} Normalized HTML.
 */
function run( html, options = {} ) {
	return normalize( html, { ...ORIGINS, ids: IDS, ...options } );
}

describe( 'normalize', () => {
	it( 'replaces the plain site and media origins', () => {
		expect(
			run(
				'<a href="http://localhost:8890/e2e-mp3/">' +
					'<a href="http://localhost:8901/tone.mp3">' +
					'<a href="http://localhost:8902/tone.mp3">'
			)
		).toBe(
			'<a href="{{SITE}}/e2e-mp3/">\n' +
				'<a href="{{MEDIA}}/tone.mp3">\n' +
				'<a href="{{MEDIA_NOCORS}}/tone.mp3">\n'
		);
	} );

	it( 'replaces the JSON-escaped origins', () => {
		expect(
			run(
				'{"a":"http:\\/\\/localhost:8890\\/x","b":"http:\\/\\/localhost:8901\\/tone.mp3","c":"http:\\/\\/localhost:8902\\/live.mp3"}'
			)
		).toBe(
			'{"a":"{{SITE}}\\/x","b":"{{MEDIA}}\\/tone.mp3","c":"{{MEDIA_NOCORS}}\\/live.mp3"}\n'
		);
	} );

	it( 'tells origins apart by port, not by prefix', () => {
		expect(
			run( 'http://localhost:890/a http://localhost:8901/b', {
				site: 'http://localhost:890',
			} )
		).toBe( '{{SITE}}/a {{MEDIA}}/b\n' );
	} );

	it( 'leaves other ports untouched', () => {
		expect( run( 'http://localhost:9999/a' ) ).toBe(
			'http://localhost:9999/a\n'
		);
	} );

	it( 'replaces the year and month of plain and escaped upload paths', () => {
		expect(
			run(
				'/wp-content/uploads/2026/10/a.jpg wp-content\\/uploads\\/2025\\/01\\/b.jpg'
			)
		).toBe(
			'/wp-content/uploads/{{YYYY}}/{{MM}}/a.jpg wp-content\\/uploads\\/{{YYYY}}\\/{{MM}}\\/b.jpg\n'
		);
	} );

	it( 'replaces mapped IDs in "id", "program_id" and ?page_id=', () => {
		expect(
			run(
				'{"id":"786","program_id":"786"} <a href="http://localhost:8890/?page_id=793">'
			)
		).toBe(
			'{"id":"{{ID:program-A}}","program_id":"{{ID:program-A}}"} <a href="{{SITE}}/?page_id={{ID:page-mp3}}">\n'
		);
	} );

	it( 'replaces unquoted numeric IDs too', () => {
		expect( run( '{"id":786}' ) ).toBe( '{"id":{{ID:program-A}}}\n' );
	} );

	it( 'throws on an ID missing from the map', () => {
		expect( () => run( '{"id":"999"}' ) ).toThrow( /999/ );
		expect( () => run( '{"program_id":"786"}', { ids: {} } ) ).toThrow(
			/786/
		);
		expect( () => run( '?page_id=5' ) ).toThrow( /5/ );
	} );

	it( 'does not normalize timezoneOffset (C9)', () => {
		expect( run( '{"visualizer":"bars","timezoneOffset":5.5}' ) ).toBe(
			'{"visualizer":"bars","timezoneOffset":5.5}\n'
		);
	} );

	it( 'puts one tag per line and ends with a newline', () => {
		expect( run( '<html><head><title>x</title></head></html>' ) ).toBe(
			'<html>\n<head>\n<title>x</title>\n</head>\n</html>\n'
		);
	} );

	it( 'is idempotent', () => {
		const html =
			'<html><head><meta property="og:image" content="http://localhost:8890/wp-content/uploads/2026/10/a.jpg">' +
			'<script>window.X = {"streamUrl":"http:\\/\\/localhost:8901\\/tone.mp3","id":"786","timezoneOffset":5.5};</script>' +
			'</head><body><a href="http://localhost:8890/?page_id=793">x</a></body></html>';
		const once = run( html );

		expect( run( once ) ).toBe( once );
	} );
} );
