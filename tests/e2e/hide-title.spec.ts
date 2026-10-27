import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { readSeed } from './seed';

/**
 * Spec 0015 (task 1.13, H7 and H8): the station seeded with
 * radplapag_station_hide_title keeps its name as the page's h1, for screen
 * readers, but hidden from view; the title, the social tags, the Media Session
 * and the alt of the logo keep the name (ADR 0054). axe on this page is in
 * a11y.spec.ts ("player · hidden title").
 */

const NAME = 'E2E Hidden Title';

/**
 * Opens the hidden title station.
 *
 * @param page Player page.
 */
async function openPlayer( page: Page ) {
	await page.goto( readSeed().urls[ 'hidden-title' ] );
	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeVisible();
}

test( 'keeps the station name as the h1, hidden from view (H7)', async ( {
	page,
} ) => {
	await openPlayer( page );

	const heading = page.getByRole( 'heading', { level: 1, name: NAME } );
	await expect( heading ).toBeAttached();
	await expect( heading ).not.toHaveAttribute( 'aria-hidden' );
	const box = await heading.boundingBox();
	expect( box ).not.toBeNull();
	expect( box!.width ).toBeLessThanOrEqual( 1 );
	expect( box!.height ).toBeLessThanOrEqual( 1 );
	expect(
		await page.evaluate(
			() =>
				(
					window as unknown as {
						RADPLAPAG_CONFIG: { hideTitle: boolean };
					}
				 ).RADPLAPAG_CONFIG.hideTitle
		)
	).toBe( true );
} );

test( 'keeps the name in the title, the social tags, the Media Session and the logo (H8)', async ( {
	page,
} ) => {
	await openPlayer( page );

	await expect( page ).toHaveTitle( NAME );
	await expect( page.locator( 'meta[name="description"]' ) ).toHaveAttribute(
		'content',
		`Listen to ${ NAME } live`
	);
	await expect( page.locator( 'meta[property="og:title"]' ) ).toHaveAttribute(
		'content',
		NAME
	);
	await expect(
		page.locator( 'meta[name="twitter:title"]' )
	).toHaveAttribute( 'content', NAME );
	expect(
		await page.evaluate( () => navigator.mediaSession.metadata?.title )
	).toBe( NAME );
	await expect(
		page.getByRole( 'img', { name: new RegExp( NAME ) } )
	).toBeVisible();
} );

test( 'lays out the logo and the controls without the name (risk 2)', async ( {
	page,
}, testInfo ) => {
	// Screenshots for a manual review, at desktop and phone width.
	for ( const [ label, viewport ] of [
		[ 'desktop', { width: 1280, height: 800 } ],
		[ 'phone', { width: 375, height: 667 } ],
	] as const ) {
		await page.setViewportSize( viewport );
		await openPlayer( page );
		await expect(
			page.getByRole( 'img', { name: new RegExp( NAME ) } )
		).toBeInViewport();
		await testInfo.attach( `hidden-title-${ label }`, {
			body: await page.screenshot(),
			contentType: 'image/png',
		} );
	}
} );
