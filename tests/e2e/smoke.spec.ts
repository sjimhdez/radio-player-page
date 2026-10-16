import { expect, test } from './fixtures';
import { readSeed } from './seed';

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
