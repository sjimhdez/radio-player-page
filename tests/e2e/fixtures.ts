import { test as base, expect } from '@playwright/test';

/**
 * No test reaches the internet (spec 0001 §5.2): any request to an origin other
 * than the test site is aborted and fails the test.
 */
export const test = base.extend< { blockExternalRequests: void } >( {
	blockExternalRequests: [
		async ( { page, baseURL }, use ) => {
			const allowed = new URL( baseURL ?? '' ).origin;
			const blocked: string[] = [];

			await page.route( '**/*', ( route ) => {
				const url = route.request().url();
				if (
					url.startsWith( allowed ) ||
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
