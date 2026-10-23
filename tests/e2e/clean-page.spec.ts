import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { APIRequestContext } from '@playwright/test';
import { expect, test } from './fixtures';
import { ADMIN_STATE, readSeed, seededId, type SeedUrlKey } from './seed';
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
 * Writes a raw schedule meta on station-minimal, which the save never would
 * (radplapag_sanitize_station_schedule() rejects it), with a draft program,
 * runs the callback and restores the station.
 *
 * @param callback Receives the program IDs as strings.
 */
async function withRawSchedule(
	callback: ( ids: {
		a: string;
		b: string;
		c: string;
		draft: string;
	} ) => Promise< void >
) {
	const station = seededId( 'station-minimal' );
	const a = seededId( 'program-A' );
	const b = seededId( 'program-B' );
	const c = seededId( 'program-C' );
	const draft = wpCli(
		'post',
		'create',
		'--post_type=radplapag_program',
		'--post_status=draft',
		'--post_title=E2E Draft Program',
		'--porcelain'
	);
	const slot = ( programId: unknown, start: string, end: string ) => ( {
		program_id: programId,
		start,
		end,
	} );

	try {
		wpCli(
			'post',
			'meta',
			'update',
			station,
			'radplapag_station_schedule',
			JSON.stringify( {
				monday: [
					{
						...slot( '<b>tagged</b> id', '06:00', '07:00' ),
						is_rerun: 'yes',
					},
					{ ...slot( ` ${ b }`, '07:00', '08:00' ), is_rerun: 0 },
					slot( c, '', '09:00' ),
					slot( a, '0', '10:00' ),
					'not a slot',
					slot( draft, '10:00', '11:00' ),
				],
				tuesday: 'not a day',
				wednesday: [ slot( a, '08:00', '' ) ],
				friday: [
					{
						...slot( Number( a ), '12:00', '13:00' ),
						is_rerun: true,
					},
				],
			} )
		);
		await callback( { a, b, c, draft } );
	} finally {
		wpCli(
			'post',
			'meta',
			'delete',
			station,
			'radplapag_station_schedule'
		);
		wpCli( 'post', 'delete', draft, '--force' );
	}
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

	test( 'decodes the entities of a title saved through kses (K21)', async ( {
		request,
		page,
	} ) => {
		const url = readSeed().urls.entities;
		const html = await getHtml( request, url );

		expect( html ).toContain( '<title>Rock &amp; Roll</title>' );
		expect( rawGlobals( html ).RADPLAPAG_CONFIG ).toContain(
			'"siteTitle":"Rock \\u0026 Roll"'
		);

		await page.goto( url );
		await expect( page.getByRole( 'heading', { level: 1 } ) ).toHaveText(
			'Rock & Roll'
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

	test( 'skips the raw schedule entries that cannot be printed', async ( {
		request,
	} ) => {
		await withRawSchedule( async ( { a, b, draft } ) => {
			const html = await getHtml( request, readSeed().urls.minimal );

			// Tuesday is not an array and Wednesday ends up empty: both go.
			expect( readGlobals( html ).RADPLAPAG_SCHEDULE ).toEqual( {
				monday: [
					// Not numeric: sanitize_text_field(); "yes" is a rerun.
					{
						program_id: 'tagged id',
						start: '06:00',
						end: '07:00',
						is_rerun: true,
					},
					// Numeric with a leading space: cast to int.
					{
						program_id: b,
						start: '07:00',
						end: '08:00',
						is_rerun: false,
					},
					// The slot of a draft program stays (C10).
					{
						program_id: draft,
						start: '10:00',
						end: '11:00',
						is_rerun: false,
					},
				],
				friday: [
					{
						program_id: a,
						start: '12:00',
						end: '13:00',
						is_rerun: true,
					},
				],
			} );
		} );
	} );

	test( 'currently lists the program of a slot left out of the schedule (K78)', async ( {
		request,
	} ) => {
		await withRawSchedule( async ( { a, b, c } ) => {
			const html = await getHtml( request, readSeed().urls.minimal );

			// C only has a slot without start, which RADPLAPAG_SCHEDULE drops;
			// A's first slot has start '0'. The draft program is left out (C10).
			expect(
				readGlobals( html ).RADPLAPAG_PROGRAMS.map(
					( program ) => program.id
				)
			).toEqual( [ b, c, a ] );
		} );
	} );

	test( "falls back to the site name when the station title is '0'", async ( {
		request,
	} ) => {
		const station = seededId( 'station-minimal' );
		const title = wpCli( 'post', 'get', station, '--field=post_title' );
		const siteName = wpCli( 'option', 'get', 'blogname' );

		try {
			wpCli( 'post', 'update', station, '--post_title=0' );
			const html = await getHtml( request, readSeed().urls.minimal );

			expect( readGlobals( html ).RADPLAPAG_CONFIG.siteTitle ).toBe(
				siteName
			);
			expect( html ).toContain( `<title>${ siteName }</title>` );
		} finally {
			wpCli( 'post', 'update', station, `--post_title=${ title }` );
		}
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

/**
 * Asserts that the response is the theme's page, not the clean page.
 *
 * @param html Response body.
 */
function expectThemePage( html: string ) {
	// wp_generator() runs on wp_head.
	expect( html ).toContain( '<meta name="generator" content="WordPress' );
	expect( html ).not.toContain( 'id="root"' );
	expect( html ).not.toContain( 'RADPLAPAG_CONFIG' );
}

test.describe( 'pages the plugin does not intercept (HTTP)', () => {
	test.skip(
		( { browserName } ) => browserName !== 'chromium',
		'HTTP only: the response does not depend on the browser'
	);

	// Each one has a valid station except no-station.
	for ( const key of [
		'password',
		'not-a-page',
		'no-station',
	] as SeedUrlKey[] ) {
		test( `serves the theme for ${ key }`, async ( { request } ) => {
			expectThemePage( await getHtml( request, readSeed().urls[ key ] ) );
		} );
	}

	test( 'serves the theme for a draft, even to the admin', async ( {
		playwright,
		baseURL,
	} ) => {
		const admin = await playwright.request.newContext( {
			baseURL,
			storageState: ADMIN_STATE,
		} );
		try {
			const html = await getHtml( admin, readSeed().urls.draft );
			expect( html ).toContain( 'E2E Draft Page' );
			expectThemePage( html );
		} finally {
			await admin.dispose();
		}
	} );
} );

/**
 * The wp_die() paths need another player/dist: .wp-env.tests.json mounts the
 * repo again as two inactive plugins, each with its player/dist replaced by
 * tests/fixtures/player-dist/<case>/. The test swaps the active plugin.
 */
test.describe( 'clean page without a usable manifest (HTTP)', () => {
	test.skip(
		( { browserName } ) => browserName !== 'chromium',
		'HTTP only: the response does not depend on the browser'
	);

	for ( const [ variant, message ] of [
		[
			'radplapag-no-manifest',
			'The player compilation file (manifest.json) could not be found.',
		],
		[
			'radplapag-no-main-entry',
			'The main JS file was not found in the Vite manifest.',
		],
	] ) {
		test( `dies with ${ variant }`, async ( { request } ) => {
			try {
				wpCli( 'plugin', 'deactivate', 'radio-player-page' );
				wpCli( 'plugin', 'activate', variant );
				const response = await request.get( readSeed().urls.mp3 );
				const html = await response.text();

				expect( response.status() ).toBe( 500 );
				expect( html ).toContain(
					`<div class="wp-die-message">${ message }</div>`
				);
				expect( html ).not.toContain( 'id="root"' );
				expect( html ).not.toContain( 'RADPLAPAG_CONFIG' );
			} finally {
				wpCli( 'plugin', 'deactivate', variant );
				wpCli( 'plugin', 'activate', 'radio-player-page' );
			}
		} );
	}
} );

/**
 * Robots and text direction (K23, SPEC.md §3.3). The headers are read by the
 * test mu-plugin (tests/e2e/mu-plugins/radplapag-e2e.php): one adds a marker
 * through wp_robots, the other makes the request right-to-left. The theme page
 * of no-station shows that each switch works.
 */
test.describe( 'clean page robots and direction (HTTP)', () => {
	test.skip(
		( { browserName } ) => browserName !== 'chromium',
		'HTTP only: the response does not depend on the browser'
	);

	const ROBOTS = { 'X-Radplapag-E2e-Robots': '1' };
	const RTL = { 'X-Radplapag-E2e-Rtl': '1' };

	test( 'prints noindex, nofollow without wp_robots with blog_public = 0 (K23)', async ( {
		request,
	} ) => {
		const seed = readSeed();
		try {
			wpCli( 'option', 'update', 'blog_public', '0' );
			const theme = await (
				await request.get( seed.urls[ 'no-station' ], {
					headers: ROBOTS,
				} )
			).text();
			const html = await (
				await request.get( seed.urls.mp3, { headers: ROBOTS } )
			).text();

			expect( theme ).toContain( 'noindex, nofollow' );
			expect( theme ).toContain( 'radplapag-e2e' );
			expect( html ).toContain( 'RADPLAPAG_CONFIG' );
			expect( meta( html, 'robots' ) ).toBe( 'noindex, nofollow' );
			expect( html.match( /name="robots"/g ) ).toHaveLength( 1 );
			expect( html ).not.toContain( 'radplapag-e2e' );
		} finally {
			wpCli( 'option', 'update', 'blog_public', '1' );
		}
	} );

	test( 'prints no robots meta with blog_public = 1 (K23)', async ( {
		request,
	} ) => {
		const seed = readSeed();
		const theme = await (
			await request.get( seed.urls[ 'no-station' ], { headers: ROBOTS } )
		).text();
		const html = await (
			await request.get( seed.urls.mp3, { headers: ROBOTS } )
		).text();

		expect( theme ).toContain( 'radplapag-e2e' );
		expect( html ).toContain( 'RADPLAPAG_CONFIG' );
		expect( html ).not.toContain( 'name="robots"' );
		expect( html ).not.toContain( 'radplapag-e2e' );
	} );

	test( 'prints dir="rtl" on a right-to-left site', async ( { request } ) => {
		const seed = readSeed();
		const theme = await (
			await request.get( seed.urls[ 'no-station' ], { headers: RTL } )
		).text();
		const html = await (
			await request.get( seed.urls.mp3, { headers: RTL } )
		).text();

		expect( theme ).toMatch( /<html [^>]*dir="rtl"/ );
		expect( html ).toContain( '<html lang="en-US" dir="rtl"><head>' );
	} );

	test( 'prints no dir on a left-to-right site', async ( { request } ) => {
		const html = await getHtml( request, readSeed().urls.mp3 );

		expect( html ).toContain( '<html lang="en-US"><head>' );
	} );
} );

test.describe( 'clean page feed, embed and trackback (HTTP)', () => {
	test.skip(
		( { browserName } ) => browserName !== 'chromium',
		'HTTP only: the response does not depend on the browser'
	);

	for ( const suffix of [ 'feed/', 'embed/', 'trackback/' ] ) {
		test( `currently serves the player on the page's ${ suffix } (K26)`, async ( {
			request,
		} ) => {
			const html =
				await // A GET of trackback/ redirects to the page once it is not intercepted.
				(
					await request.get( readSeed().urls.mp3 + suffix, {
						maxRedirects: 0,
					} )
				).text();

			expect( html ).toContain( 'RADPLAPAG_CONFIG' );
		} );
	}
} );
