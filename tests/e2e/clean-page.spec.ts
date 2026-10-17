import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { APIRequestContext } from '@playwright/test';
import { expect, test } from './fixtures';
import { readSeed } from './seed';
import { wpCli } from './support/wp-cli';

/**
 * The clean page over HTTP (radplapag_output_clean_page(), SPEC.md §3 and §4):
 * no browser runs the player here, so it only runs in Chromium.
 */

const DIST_PATH = '/wp-content/plugins/radio-player-page/player/dist/';

interface Globals {
	RADPLAPAG_CONFIG: Record< string, unknown >;
	RADPLAPAG_PROGRAMS: Array< { id: string; name: string } >;
	RADPLAPAG_SCHEDULE: Record< string, Array< { program_id: string } > >;
}

/**
 * Requests a URL and returns its body, failing unless it answers 200.
 *
 * @param request Playwright request context.
 * @param url     Page URL.
 */
async function getHtml( request: APIRequestContext, url: string ) {
	const response = await request.get( url );
	expect( response.status(), url ).toBe( 200 );
	return response.text();
}

/**
 * Returns the raw JSON printed for each `window.RADPLAPAG_*` global.
 *
 * @param html Clean page HTML.
 */
function rawGlobals( html: string ): Record< keyof Globals, string > {
	const raw: Record< string, string > = {};
	for ( const [ , name, json ] of html.matchAll(
		/window\.(RADPLAPAG_\w+) = (.*?);(?=window\.|<\/script>)/g
	) ) {
		raw[ name ] = json;
	}
	expect( Object.keys( raw ) ).toEqual( [
		'RADPLAPAG_CONFIG',
		'RADPLAPAG_PROGRAMS',
		'RADPLAPAG_SCHEDULE',
	] );
	return raw as Record< keyof Globals, string >;
}

/**
 * Parses the three `window.RADPLAPAG_*` globals.
 *
 * @param html Clean page HTML.
 */
function readGlobals( html: string ): Globals {
	const raw = rawGlobals( html );
	return {
		RADPLAPAG_CONFIG: JSON.parse( raw.RADPLAPAG_CONFIG ),
		RADPLAPAG_PROGRAMS: JSON.parse( raw.RADPLAPAG_PROGRAMS ),
		RADPLAPAG_SCHEDULE: JSON.parse( raw.RADPLAPAG_SCHEDULE ),
	};
}

/**
 * Returns the (still escaped) content of a `<meta>` tag, or null.
 *
 * @param html Clean page HTML.
 * @param key  Value of its `name` or `property` attribute.
 */
function meta( html: string, key: string ) {
	const match = html.match(
		new RegExp( `<meta (?:name|property)="${ key }" content="([^"]*)">` )
	);
	return match ? match[ 1 ] : null;
}

/**
 * Returns the `href` of the favicon `<link>`, or null.
 *
 * @param html Clean page HTML.
 */
function favicon( html: string ) {
	const match = html.match( /<link rel="icon" href="([^"]*)" \/>/ );
	return match ? match[ 1 ] : null;
}

/**
 * Returns the ID the seeder gave a stable name.
 *
 * @param name Stable name (`station-minimal`, `attachment-artwork`…).
 */
function seededId( name: string ) {
	const entry = Object.entries( readSeed().ids ).find(
		( [ , value ] ) => value === name
	);
	expect( entry, name ).toBeDefined();
	return ( entry as [ string, string ] )[ 0 ];
}

test.describe( 'clean page (HTTP)', () => {
	test.skip(
		( { browserName } ) => browserName !== 'chromium',
		'HTTP only: the response does not depend on the browser'
	);

	for ( const key of [ 'mp3', 'minimal' ] as const ) {
		test( `matches the snapshot of ${ key }`, async ( {
			request,
			baseURL,
		} ) => {
			// Dynamic import: see global-setup.ts.
			const { MEDIA_NOCORS_PORT, MEDIA_PORT } =
				await import( './media-server.mjs' );
			const { normalize } = await import( './support/normalize.mjs' );
			const html = await getHtml( request, readSeed().urls[ key ] );

			expect(
				normalize( html, {
					site: new URL( baseURL ?? '' ).origin,
					media: `http://localhost:${ MEDIA_PORT }`,
					mediaNoCors: `http://localhost:${ MEDIA_NOCORS_PORT }`,
					ids: readSeed().ids,
				} )
			).toMatchSnapshot( `${ key }.html` );
		} );
	}

	test( 'prints a bare document, without wp_head() or wp_footer()', async ( {
		request,
	} ) => {
		const html = await getHtml( request, readSeed().urls.mp3 );

		expect( html ).toMatch(
			/^<!DOCTYPE html><html lang="[^"]+"><head><meta charset="utf-8">/
		);
		expect( html ).toMatch(
			/<\/head><body><div id="root"><\/div><script type="module" src="[^"]+"><\/script><\/body><\/html>$/
		);
		// Only the globals and the player entry; only the player stylesheet.
		expect( html.match( /<script/g ) ).toHaveLength( 2 );
		expect( html.match( /<link/g ) ).toHaveLength( 1 );
		for ( const themeMark of [
			'wp-includes',
			'wp-json',
			'name="generator"',
			'wp-emoji',
			'admin-bar',
			'wp-block-library',
			'wp-theme',
		] ) {
			expect( html ).not.toContain( themeMark );
		}
	} );

	test( 'prints the language, title, description and social tags', async ( {
		request,
	} ) => {
		const seed = readSeed();
		const html = await getHtml( request, seed.urls.mp3 );
		const { RADPLAPAG_CONFIG: config } = readGlobals( html );

		expect( html ).toContain( '<html lang="en-US">' );
		expect( html ).toContain( '<title>E2E MP3</title>' );
		expect( meta( html, 'description' ) ).toBe( 'Listen to E2E MP3 live' );
		expect( meta( html, 'og:title' ) ).toBe( 'E2E MP3' );
		expect( meta( html, 'og:description' ) ).toBe(
			'Listen to E2E MP3 live'
		);
		expect( meta( html, 'og:url' ) ).toBe( seed.urls.mp3 );
		expect( meta( html, 'og:type' ) ).toBe( 'website' );
		expect( meta( html, 'og:site_name' ) ).toBe(
			wpCli( 'option', 'get', 'blogname' )
		);
		expect( meta( html, 'og:locale' ) ).toBe( 'en_US' );
		expect( meta( html, 'twitter:card' ) ).toBe( 'summary_large_image' );
		expect( meta( html, 'twitter:title' ) ).toBe( 'E2E MP3' );
		expect( meta( html, 'twitter:description' ) ).toBe(
			'Listen to E2E MP3 live'
		);
		// The logo comes first in the social image chain.
		expect( meta( html, 'og:image' ) ).toBe( config.logoImage );
		expect( meta( html, 'twitter:image' ) ).toBe( config.logoImage );
		// The test site has no site icon.
		expect( favicon( html ) ).toBeNull();
	} );

	test( 'escapes the title in the tags and in the globals', async ( {
		request,
	} ) => {
		const html = await getHtml( request, readSeed().urls.minimal );
		const escaped = 'E2E Minimal &lt;&gt;&amp;&#039;&quot;';

		expect( html ).toContain( `<title>${ escaped }</title>` );
		expect( meta( html, 'og:title' ) ).toBe( escaped );
		expect( meta( html, 'twitter:title' ) ).toBe( escaped );
		expect( meta( html, 'description' ) ).toBe(
			`Listen to ${ escaped } live`
		);
		// JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT.
		expect( rawGlobals( html ).RADPLAPAG_CONFIG ).toContain(
			'"siteTitle":"E2E Minimal \\u003C\\u003E\\u0026\\u0027\\u0022"'
		);
		expect( readGlobals( html ).RADPLAPAG_CONFIG.siteTitle ).toBe(
			`E2E Minimal <>&'"`
		);
	} );

	test( 'prints no social image without logo, background or favicon', async ( {
		request,
	} ) => {
		const html = await getHtml( request, readSeed().urls.minimal );

		expect( meta( html, 'twitter:card' ) ).toBe( 'summary' );
		expect( meta( html, 'og:image' ) ).toBeNull();
		expect( meta( html, 'twitter:image' ) ).toBeNull();
		expect( favicon( html ) ).toBeNull();
	} );

	test( 'falls back from logo to background to favicon for the social image', async ( {
		request,
	} ) => {
		const url = readSeed().urls.minimal;
		const station = seededId( 'station-minimal' );
		const artwork = seededId( 'attachment-artwork' );
		// A second image with another URL: the dev station's artwork (seed.php).
		const otherImage = wpCli(
			'post',
			'list',
			'--post_type=attachment',
			'--post_mime_type=image/jpeg',
			'--field=ID'
		)
			.split( '\n' )
			.find( ( id ) => ! ( id in readSeed().ids ) );
		expect( otherImage, 'dev seed image' ).toBeDefined();

		try {
			wpCli( 'option', 'update', 'site_icon', artwork );
			let html = await getHtml( request, url );
			const icon = favicon( html );
			expect( icon ).toMatch( /station-artwork-1/ );
			expect( meta( html, 'og:image' ) ).toBe( icon );
			expect( meta( html, 'twitter:card' ) ).toBe(
				'summary_large_image'
			);

			wpCli(
				'post',
				'meta',
				'update',
				station,
				'radplapag_station_background_id',
				otherImage as string
			);
			html = await getHtml( request, url );
			const background = readGlobals( html ).RADPLAPAG_CONFIG
				.backgroundImage as string;
			expect( background ).not.toBe( icon );
			expect( meta( html, 'og:image' ) ).toBe( background );

			wpCli(
				'post',
				'meta',
				'update',
				station,
				'radplapag_station_logo_id',
				artwork
			);
			html = await getHtml( request, url );
			const logo = readGlobals( html ).RADPLAPAG_CONFIG.logoImage;
			expect( logo ).not.toBe( background );
			expect( meta( html, 'og:image' ) ).toBe( logo );
			expect( meta( html, 'twitter:image' ) ).toBe( logo );
		} finally {
			wpCli( 'option', 'delete', 'site_icon' );
			wpCli(
				'post',
				'meta',
				'delete',
				station,
				'radplapag_station_background_id'
			);
			wpCli(
				'post',
				'meta',
				'delete',
				station,
				'radplapag_station_logo_id'
			);
		}
	} );

	test( 'lists the programs in order of first appearance in the schedule', async ( {
		request,
	} ) => {
		const html = await getHtml( request, readSeed().urls.mp3 );
		const { RADPLAPAG_PROGRAMS: programs, RADPLAPAG_SCHEDULE: schedule } =
			readGlobals( html );

		const firstAppearance = [
			...new Set(
				Object.values( schedule ).flatMap( ( slots ) =>
					slots.map( ( slot ) => slot.program_id )
				)
			),
		];
		expect( programs.map( ( program ) => program.id ) ).toEqual(
			firstAppearance
		);
		// Monday A, B, C; Tuesday D; Wednesday H; Saturday G; Sunday E.
		expect( programs.map( ( program ) => program.name ) ).toEqual(
			[ 'A', 'B', 'C', 'D', 'H', 'G', 'E' ].map(
				( letter ) => `E2E Program ${ letter }`
			)
		);
	} );

	test( 'omits the empty days from the schedule', async ( { request } ) => {
		const html = await getHtml( request, readSeed().urls.mp3 );
		const { RADPLAPAG_SCHEDULE: schedule } = readGlobals( html );

		expect( Object.keys( schedule ) ).toEqual( [
			'monday',
			'tuesday',
			'wednesday',
			'saturday',
			'sunday',
		] );
		for ( const slots of Object.values( schedule ) ) {
			expect( slots.length ).toBeGreaterThan( 0 );
		}
	} );

	test( 'currently prints an empty schedule as a JSON array (K17)', async ( {
		request,
	} ) => {
		const html = await getHtml( request, readSeed().urls.minimal );
		const raw = rawGlobals( html );

		expect( raw.RADPLAPAG_PROGRAMS ).toBe( '[]' );
		expect( raw.RADPLAPAG_SCHEDULE ).toBe( '[]' );
	} );

	test( 'prints timezoneOffset as a number fixed per request (C9)', async ( {
		request,
	} ) => {
		const html = await getHtml( request, readSeed().urls.mp3 );

		// Asia/Kolkata: the offset itself, not the zone or its transitions.
		expect( rawGlobals( html ).RADPLAPAG_CONFIG ).toContain(
			'"timezoneOffset":5.5}'
		);
		expect( readGlobals( html ).RADPLAPAG_CONFIG.timezoneOffset ).toBe(
			5.5
		);
		expect(
			Object.keys( readGlobals( html ).RADPLAPAG_CONFIG )
		).not.toContain( 'timezone' );
	} );

	test( 'loads the stylesheet and the entry named in the manifest', async ( {
		request,
		baseURL,
	} ) => {
		const manifest = JSON.parse(
			readFileSync(
				join( __dirname, '../../player/dist/manifest.json' ),
				'utf8'
			)
		);
		const entry = manifest[ 'src/main.tsx' ];
		const dist = new URL( DIST_PATH, baseURL ).href;
		const html = await getHtml( request, readSeed().urls.mp3 );

		expect( html ).toContain(
			`<link rel="stylesheet" href="${ dist }${ entry.css[ 0 ] }">`
		);
		expect( html ).toContain(
			`<script type="module" src="${ dist }${ entry.file }"></script>`
		);
		for ( const file of [ entry.css[ 0 ], entry.file ] ) {
			expect( ( await request.get( dist + file ) ).status(), file ).toBe(
				200
			);
		}
	} );
} );
