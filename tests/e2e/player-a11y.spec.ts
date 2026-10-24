import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { readSeed } from './seed';

/**
 * Audit of zone 5 (spec 0002, task 4.6): what axe does not see on the player
 * page, or sees only in a state the a11y scenarios do not reach (loading, a
 * program expanded). Characterization only: each test fixes a K/AX row of
 * docs/known-issues.md.
 */

/**
 * Tag and accessible name of the focused element, or `BODY`.
 *
 * @param page Player page.
 */
function focused( page: Page ) {
	return page.evaluate( () => {
		const element = document.body.ownerDocument.activeElement;
		if ( ! element || element === document.body ) {
			return 'BODY';
		}
		return `${ element.tagName }:${ element.getAttribute( 'aria-label' ) }`;
	} );
}

/**
 * Presses Enter on Play and waits until the audio is past its first second.
 *
 * @param page Player page.
 */
async function playWithKeyboard( page: Page ) {
	await page.getByRole( 'button', { name: 'Play' } ).focus();
	const playing = page.waitForFunction( () => {
		const audio = document.querySelector( 'audio' );
		return !! audio && ! audio.paused && audio.currentTime > 1;
	} );
	await page.keyboard.press( 'Enter' );
	await playing;
}

test( 'keeps the focus on the button when Play turns into Pause (K56)', async ( {
	page,
} ) => {
	await page.goto( readSeed().urls.live );

	await playWithKeyboard( page );

	await expect( page.getByRole( 'button', { name: 'Pause' } ) ).toBeVisible();
	expect( await focused( page ) ).toBe( 'BUTTON:Pause' );
} );

test( 'names no progressbar and announces "Connecting..." in a status region (AX6, K59)', async ( {
	page,
} ) => {
	// Hold the stream back so the loading state lasts.
	let release = () => {};
	const held = new Promise< void >( ( done ) => ( release = done ) );
	await page.route( '**/live.mp3', async ( route ) => {
		await held;
		await route.continue().catch( () => {} );
	} );
	await page.goto( readSeed().urls.live );
	// The status region is there before anything changes, so that screen
	// readers pick up the change.
	await expect( page.getByRole( 'status' ) ).toHaveCount( 1 );
	await expect( page.getByRole( 'status' ) ).toHaveText( '' );

	await page.getByRole( 'button', { name: 'Play' } ).click();
	await expect(
		page.getByRole( 'button', { name: 'Pause' } )
	).toHaveAttribute( 'aria-busy', 'true' );
	await expect( page.getByRole( 'status' ) ).toHaveText( 'Connecting...' );

	const results = await new AxeBuilder( { page } )
		.withRules( [ 'aria-progressbar-name' ] )
		.analyze();
	expect( results.violations ).toEqual( [] );
	await expect( page.getByRole( 'progressbar' ) ).toHaveCount( 0 );

	release();
} );

for ( const name of [ 'Radio Schedule', 'Radio Shows' ] ) {
	for ( const close of [ 'Escape', 'Close' ] ) {
		test( `gives the focus back to its button after closing the ${ name } modal with ${ close } (K57)`, async ( {
			page,
		} ) => {
			await page.goto( readSeed().urls.always );

			await page.getByRole( 'button', { name } ).focus();
			await page.keyboard.press( 'Enter' );
			await expect( page.getByRole( 'dialog' ) ).toBeVisible();
			if ( close === 'Escape' ) {
				await page.keyboard.press( 'Escape' );
			} else {
				await page
					.getByRole( 'dialog' )
					.getByRole( 'button', { name: 'Close' } )
					.click();
			}
			await expect( page.getByRole( 'dialog' ) ).toHaveCount( 0 );

			await expect
				.poll( () => focused( page ) )
				.toBe( `BUTTON:${ name }` );
		} );
	}
}

test( 'currently loses the focus when the sleep timer is cancelled (K58)', async ( {
	page,
} ) => {
	await page.goto( readSeed().urls.live );
	await playWithKeyboard( page );
	await page.getByRole( 'button', { name: 'Sleep mode' } ).click();
	await page.getByRole( 'menuitem', { name: '30 mins' } ).click();

	await page.getByRole( 'button', { name: 'Cancel sleep mode' } ).focus();
	await page.keyboard.press( 'Enter' );

	await expect(
		page.getByRole( 'button', { name: 'Cancel sleep mode' } )
	).toHaveCount( 0 );
	expect( await focused( page ) ).toBe( 'BODY' );
} );

for ( const name of [ 'Radio Schedule', 'Radio Shows' ] ) {
	test( `currently blinks "On Air" forever in the ${ name } modal (K60)`, async ( {
		page,
	} ) => {
		await page.goto( readSeed().urls.always );

		await page.getByRole( 'button', { name } ).click();
		await expect(
			page.getByRole( 'dialog' ).getByText( 'On Air' ).first()
		).toBeVisible();

		const blink = await page.evaluate( () =>
			document
				.getAnimations()
				.filter(
					( animation ) =>
						( animation as CSSAnimation ).animationName ===
						'scheduleLiveBlink'
				)
				.map(
					( animation ) => animation.effect?.getTiming().iterations
				)
		);
		expect( blink.length ).toBeGreaterThan( 0 );
		expect( blink.every( ( iterations ) => iterations === Infinity ) ).toBe(
			true
		);
	} );
}

test( 'currently skips heading levels in an expanded program of the Radio Shows modal (AX2)', async ( {
	page,
} ) => {
	await page.goto( readSeed().urls.always );
	await page.getByRole( 'button', { name: 'Radio Shows' } ).click();

	await page.getByRole( 'button', { name: 'Show more' } ).first().click();

	const results = await new AxeBuilder( { page } )
		.include( '[role="dialog"]' )
		.withRules( [ 'heading-order' ] )
		.analyze();
	expect(
		results.violations.flatMap( ( violation ) =>
			violation.nodes.map( ( node ) => node.target.join( ' ' ) )
		)
	).toEqual( [ 'h5' ] );
} );

test( 'currently covers the station name with the station clock at 320 × 256 (K61)', async ( {
	page,
} ) => {
	await page.setViewportSize( { width: 320, height: 256 } );
	await page.goto( readSeed().urls.always );
	const title = page.getByRole( 'heading', { level: 1 } );
	const clock = page.getByText( 'Broadcast Timezone' );
	await expect( title ).toBeVisible();
	await expect( clock ).toBeVisible();

	// The clock is the card around its label. The title slides into place
	// (0.8 s transition), so wait for the boxes to meet.
	const card = clock.locator(
		'xpath=ancestor::*[contains(@class,"MuiPaper-root")][1]'
	);
	await expect
		.poll( async () => {
			const a = await title.boundingBox();
			const b = await card.boundingBox();
			return (
				!! a &&
				!! b &&
				a.x < b.x + b.width &&
				b.x < a.x + a.width &&
				a.y < b.y + b.height &&
				b.y < a.y + a.height
			);
		} )
		.toBe( true );
} );
