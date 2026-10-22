import { expect, test } from './fixtures';
import { ADMIN_STATE, readSeed } from './seed';

test.describe( 'player page (smoke)', () => {
	test( 'serves the clean page and mounts the player', async ( { page } ) => {
		const { playerPageUrl } = readSeed();

		const response = await page.goto( playerPageUrl );

		expect( response?.status() ).toBe( 200 );
		await expect( page ).toHaveTitle( 'Fixture Radio Station' );
		await expect(
			page.locator( '#root' ).getByRole( 'button', { name: 'Play' } )
		).toBeVisible();
	} );
} );

test.describe( 'e2e seed (smoke)', () => {
	// The draft page is only visible with a session.
	test.use( { storageState: ADMIN_STATE } );

	test( 'every seeded URL responds 200', async ( { page } ) => {
		const { urls } = readSeed();

		for ( const [ key, url ] of Object.entries( urls ) ) {
			const response = await page.request.get( url );
			expect( response.status(), key ).toBe( 200 );
		}
	} );

	test( 'the admin session lists the seeded stations', async ( { page } ) => {
		// Searched: with the entities station the seed has more stations than one list page.
		await page.goto(
			'/wp-admin/edit.php?post_type=radplapag_station&s=E2E'
		);

		const titles = page.locator( '#the-list .row-title' );

		await expect( titles.filter( { hasText: /^E2E / } ) ).toHaveCount( 20 );
		// The markup characters survive the save (wptexturize curls the quotes).
		await expect(
			titles.filter( { hasText: /^E2E Minimal <>&/ } )
		).toHaveCount( 1 );
	} );
} );
