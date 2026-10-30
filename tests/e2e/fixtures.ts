import { test as base, expect } from '@playwright/test';

/**
 * No test reaches the internet (spec 0001 §5.2): any request to an origin other
 * than the test site or the local media servers (media-server.mjs) is
 * aborted and fails the test.
 */
export const test = base.extend< { blockExternalRequests: void } >( {
	blockExternalRequests: [
		async ( { page, baseURL }, use ) => {
			// Dynamic import: see global-setup.ts.
			const {
				MEDIA_ICY_PORT,
				MEDIA_NOCORS_PORT,
				MEDIA_PORT,
				MEDIA_SHOUTCAST_PORT,
			} = await import( './media-server.mjs' );
			const allowed = [
				new URL( baseURL ?? '' ).origin,
				`http://localhost:${ MEDIA_PORT }`,
				`http://localhost:${ MEDIA_NOCORS_PORT }`,
				`http://localhost:${ MEDIA_ICY_PORT }`,
				`http://localhost:${ MEDIA_SHOUTCAST_PORT }`,
			];
			const blocked: string[] = [];

			await page.route( '**/*', ( route ) => {
				const url = route.request().url();
				const { origin } = new URL( url );
				if (
					allowed.includes( origin ) ||
					url.startsWith( 'data:' ) ||
					url.startsWith( 'blob:' )
				) {
					return route.continue();
				}
				blocked.push( url );
				return route.abort( 'blockedbyclient' );
			} );

			await use();

			expect( blocked, 'external requests' ).toEqual( [] );
		},
		{ auto: true },
	],
} );

export { expect };
