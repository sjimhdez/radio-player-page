import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { readSeed } from './seed';
import { buttonGaps } from './support/player';

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

test( 'gives the focus to "Sleep mode" when the sleep timer is cancelled (K58)', async ( {
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
	await expect.poll( () => focused( page ) ).toBe( 'BUTTON:Sleep mode' );
} );

/**
 * Names of the CSS animations running on the page.
 *
 * @param page Player page.
 */
function animationNames( page: Page ) {
	return page.evaluate( () =>
		document
			.getAnimations()
			.map( ( animation ) => ( animation as CSSAnimation ).animationName )
	);
}

for ( const name of [ 'Radio Schedule', 'Radio Shows' ] ) {
	test( `does not blink "On Air" in the ${ name } modal (K60)`, async ( {
		page,
	} ) => {
		await page.goto( readSeed().urls.always );

		await page.getByRole( 'button', { name } ).click();
		await expect(
			page.getByRole( 'dialog' ).getByText( 'On Air' ).first()
		).toBeVisible();

		expect( await animationNames( page ) ).not.toContain(
			'scheduleLiveBlink'
		);
	} );
}

test( 'does not blink "Connecting..." (K60)', async ( { page } ) => {
	// Hold the stream back so the loading state lasts.
	let release = () => {};
	const held = new Promise< void >( ( done ) => ( release = done ) );
	await page.route( '**/live.mp3', async ( route ) => {
		await held;
		await route.continue().catch( () => {} );
	} );
	await page.goto( readSeed().urls.live );

	await page.getByRole( 'button', { name: 'Play' } ).click();
	await expect( page.getByRole( 'status' ) ).toHaveText( 'Connecting...' );

	expect( await animationNames( page ) ).not.toContain( 'blink' );

	release();
} );

test( 'runs no playing-dot animation while stopped (K60)', async ( {
	page,
} ) => {
	await page.goto( readSeed().urls.live );
	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeVisible();

	expect( await animationNames( page ) ).not.toContain( 'animatePlayingDot' );
} );

test( 'animates the playing dots only until Pause (K60)', async ( {
	page,
	browserName,
} ) => {
	// WebKit never visualizes, so the dots stand in for the visualizer.
	test.skip( browserName !== 'webkit', 'The dots only show in WebKit' );
	await page.goto( readSeed().urls.live );

	await playWithKeyboard( page );
	await expect
		.poll( () => animationNames( page ) )
		.toContain( 'animatePlayingDot' );

	await page.getByRole( 'button', { name: 'Pause' } ).click();
	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeVisible();
	await expect
		.poll( () => animationNames( page ) )
		.not.toContain( 'animatePlayingDot' );
} );

test( 'does not skip heading levels in an expanded program of the Radio Shows modal (AX2)', async ( {
	page,
} ) => {
	await page.goto( readSeed().urls.always );
	await page.getByRole( 'button', { name: 'Radio Shows' } ).click();

	await page.getByRole( 'button', { name: 'Show more' } ).first().click();
	await expect(
		page
			.getByRole( 'dialog' )
			.getByRole( 'heading', { level: 3, name: 'Broadcast Times' } )
			.first()
	).toBeVisible();

	const results = await new AxeBuilder( { page } )
		.include( '[role="dialog"]' )
		.withRules( [ 'heading-order' ] )
		.analyze();
	expect(
		results.violations.flatMap( ( violation ) =>
			violation.nodes.map( ( node ) => node.target.join( ' ' ) )
		)
	).toEqual( [] );
} );

test( 'keeps the clock, title, program and controls apart at 320 × 256 and scrolls (K61)', async ( {
	page,
} ) => {
	await page.setViewportSize( { width: 320, height: 256 } );
	await page.goto( readSeed().urls.always );
	const title = page.getByRole( 'heading', { level: 1 } );
	const clock = page.getByRole( 'banner' );
	const program = page.locator( '.MuiTypography-h4' );
	const controls = page.getByRole( 'region', { name: 'Player controls' } );
	await expect( title ).toBeVisible();
	await expect( clock ).toContainText( 'Broadcast Timezone' );
	await expect( program ).toBeVisible();
	await expect( controls ).toBeVisible();

	// Boxes are in document coordinates, so scrolling does not matter.
	const overlap = async (
		a: typeof title,
		b: typeof title
	): Promise< boolean > => {
		const boxA = await a.boundingBox();
		const boxB = await b.boundingBox();
		if ( ! boxA || ! boxB ) {
			throw new Error( 'Missing bounding box' );
		}
		return (
			boxA.x < boxB.x + boxB.width &&
			boxB.x < boxA.x + boxA.width &&
			boxA.y < boxB.y + boxB.height &&
			boxB.y < boxA.y + boxA.height
		);
	};
	expect( await overlap( title, clock ) ).toBe( false );
	expect( await overlap( program, controls ) ).toBe( false );
	expect(
		await page.evaluate(
			() => document.documentElement.scrollHeight > window.innerHeight
		)
	).toBe( true );
} );

test( 'fills the window width with the player grid at 1280 × 800 (K91)', async ( {
	page,
} ) => {
	await page.setViewportSize( { width: 1280, height: 800 } );
	await page.goto( readSeed().urls.always );
	const grid = page.locator( '#root > :first-child' );
	await expect( grid ).toBeVisible();

	const box = await grid.boundingBox();
	if ( ! box ) {
		throw new Error( 'Missing bounding box' );
	}
	const width = await page.evaluate(
		() => document.documentElement.clientWidth
	);
	expect( box.x ).toBeCloseTo( 0, 0 );
	expect( Math.abs( box.width - width ) ).toBeLessThanOrEqual( 1 );
} );

/**
 * Box of the station info (the child of `main` with the h1: logo, name and
 * program), in window coordinates.
 *
 * @param page Player page.
 */
function stationInfoBox( page: Page ) {
	return page.evaluate( () => {
		const main = document.querySelector( 'main' );
		const title = document.querySelector( 'h1' );
		const block = Array.from( main?.children ?? [] ).find( ( child ) =>
			child.contains( title )
		);
		if ( ! block ) {
			throw new Error( 'Missing the station info' );
		}
		const { top, bottom, height } = block.getBoundingClientRect();
		return { top, bottom, center: top + height / 2 };
	} );
}

/**
 * Bottom of the header and top of the controls region, in window
 * coordinates; the header bottom is `null` without the station clock.
 *
 * @param page Player page.
 */
function layoutEdges( page: Page ) {
	return page.evaluate( () => {
		const header = document.querySelector( 'header' );
		const controls = document.querySelector( 'section[aria-label]' );
		if ( ! controls ) {
			throw new Error( 'Missing the controls region' );
		}
		return {
			headerBottom: header ? header.getBoundingClientRect().bottom : null,
			controlsTop: controls.getBoundingClientRect().top,
		};
	} );
}

// Reference sizes of spec 0016: desktop, then iPhone and Android (M1).
const referenceViewports = [
	{ width: 1440, height: 900 },
	{ width: 1024, height: 768 },
	{ width: 390, height: 844 },
	{ width: 360, height: 800 },
];

// Spec 0016 (S1): the station info centered in the window, not in the gap
// between the clock and the controls (ADR 0055).
for ( const [ clock, timezoneId ] of [
	[ 'with', 'UTC' ],
	[ 'without', 'Asia/Kolkata' ],
] as const ) {
	test.describe( `${ clock } the station clock`, () => {
		test.use( { timezoneId } );

		for ( const viewport of referenceViewports ) {
			for ( const station of [
				'live',
				'always',
				'hidden-title',
			] as const ) {
				test( `centers the ${ station } station info in the window at ${ viewport.width } × ${ viewport.height } (S1)`, async ( {
					page,
				} ) => {
					await page.setViewportSize( viewport );
					await page.goto( readSeed().urls[ station ] );
					await expect( page.getByRole( 'banner' ) ).toHaveCount(
						clock === 'with' ? 1 : 0
					);

					const box = await stationInfoBox( page );
					expect(
						Math.abs( box.center - viewport.height / 2 )
					).toBeLessThanOrEqual( 2 );
				} );
			}
		}

		// Spec 0016 (S3): at the top while the visualizer draws.
		for ( const viewport of referenceViewports ) {
			test( `puts the station info at the top while the visualizer draws at ${ viewport.width } × ${ viewport.height } (S3)`, async ( {
				page,
				browserName,
			} ) => {
				// WebKit never visualizes (K82).
				test.skip(
					browserName === 'webkit',
					'No visualizer in WebKit'
				);
				await page.setViewportSize( viewport );
				await page.goto( readSeed().urls.live );
				await playWithKeyboard( page );

				const { headerBottom } = await layoutEdges( page );
				const expected = clock === 'with' ? headerBottom : 16;
				expect( expected ).not.toBeNull();
				await expect
					.poll( async () =>
						Math.abs(
							( await stationInfoBox( page ) ).top - expected!
						)
					)
					.toBeLessThanOrEqual( 2 );
			} );
		}
	} );
}

test.describe( 'with the station clock, in a low window', () => {
	test.use( { timezoneId: 'UTC' } );

	// Spec 0016 (S2): with no room to stay centered, the station info stops at
	// the controls and grows upwards, over neither the clock nor the controls.
	test( 'raises the station info above the controls with no room (S2)', async ( {
		page,
	} ) => {
		await page.setViewportSize( { width: 1024, height: 450 } );
		await page.goto( readSeed().urls.always );
		await expect( page.getByRole( 'banner' ) ).toBeVisible();

		const box = await stationInfoBox( page );
		const { headerBottom, controlsTop } = await layoutEdges( page );
		expect( box.top ).toBeGreaterThanOrEqual( headerBottom! - 0.5 );
		expect( box.bottom ).toBeLessThanOrEqual( controlsTop + 0.5 );
		// It all fits in 450 px, so the page does not scroll.
		expect(
			await page.evaluate(
				() =>
					document.documentElement.scrollHeight <= window.innerHeight
			)
		).toBe( true );
	} );
} );

/**
 * Transition of the player grid, which moves the station info between the
 * middle of the window and the top (K92; ADR 0055: the rows of the grid, no
 * longer a spacer's `flex-grow`), the gap between the top of the window and
 * the title, and the distance from the center of the station info to the
 * center of the window.
 *
 * @param page Player page.
 */
function stationInfoMotion( page: Page ) {
	return page.evaluate( () => {
		const grid = document.querySelector( '#root > :first-child' );
		const main = document.querySelector( 'main' );
		const title = document.querySelector( 'h1' );
		if ( ! grid || ! main || ! title ) {
			throw new Error( 'Missing the grid, main or the title' );
		}
		const block = Array.from( main.children ).find( ( child ) =>
			child.contains( title )
		);
		if ( ! block ) {
			throw new Error( 'Missing the station info' );
		}
		const style = getComputedStyle( grid );
		const box = block.getBoundingClientRect();
		const header = grid.firstElementChild;
		// The first row at `0fr` shrinks to its minimum: the header, or 16px
		// with no clock (ADR 0055).
		const topRowMinimum = Math.max(
			16,
			header ? header.getBoundingClientRect().height : 0
		);
		return {
			property: style.transitionProperty,
			duration: style.transitionDuration,
			timing: style.transitionTimingFunction,
			topRowSlack: parseFloat( style.gridTemplateRows ) - topRowMinimum,
			titleOffset: title.getBoundingClientRect().top,
			offCenter: Math.abs(
				box.top + box.height / 2 - window.innerHeight / 2
			),
		};
	} );
}

test( 'slides the station name up while the visualizer draws, and back (K92)', async ( {
	page,
	browserName,
} ) => {
	await page.setViewportSize( { width: 1280, height: 800 } );
	await page.goto( readSeed().urls.live );

	const stopped = await stationInfoMotion( page );
	expect( stopped ).toMatchObject( {
		property: 'grid-template-rows',
		duration: '0.8s',
		timing: 'ease',
	} );
	expect( stopped.offCenter ).toBeLessThanOrEqual( 2 );
	expect( stopped.topRowSlack ).toBeGreaterThan( 100 );

	await playWithKeyboard( page );
	// WebKit never visualizes (K82), so the name stays in the middle.
	test.skip( browserName === 'webkit', 'No visualizer in WebKit' );
	await expect
		.poll( async () => ( await stationInfoMotion( page ) ).topRowSlack )
		.toBeLessThanOrEqual( 1 );
	await expect
		.poll( async () => ( await stationInfoMotion( page ) ).titleOffset )
		.toBeLessThan( 100 );

	await page.getByRole( 'button', { name: 'Pause' } ).click();
	await expect
		.poll( async () => ( await stationInfoMotion( page ) ).titleOffset )
		.toBeGreaterThan( stopped.titleOffset - 2 );
} );

test( 'moves the station name with no transition under "reduce motion" (K92)', async ( {
	page,
} ) => {
	await page.emulateMedia( { reducedMotion: 'reduce' } );
	await page.goto( readSeed().urls.live );

	const motion = await stationInfoMotion( page );
	expect( motion.offCenter ).toBeLessThanOrEqual( 2 );
	expect( motion.duration ).toBe( '0s' );
} );

// Spec 0016 (B1): 16px more between "schedule" and "programs" than in the
// baseline of task 1.1 (0, 8 and 8 at 1440 × 900); Play keeps its 8px on each
// side (user's decision, 2026-10-26).
for ( const viewport of referenceViewports ) {
	test( `spaces the buttons of the Play row at ${ viewport.width } × ${ viewport.height } (B1)`, async ( {
		page,
	} ) => {
		await page.setViewportSize( viewport );
		await page.goto( readSeed().urls.always );
		await expect(
			page.getByRole( 'button', { name: 'Play' } )
		).toBeVisible();

		const gaps = await buttonGaps( page );
		expect(
			Math.abs( gaps[ 'schedule-programs' ] - 16 )
		).toBeLessThanOrEqual( 1 );
		expect( Math.abs( gaps[ 'programs-play' ] - 8 ) ).toBeLessThanOrEqual(
			1
		);
		expect( Math.abs( gaps[ 'play-sleep' ] - 8 ) ).toBeLessThanOrEqual( 1 );
	} );

	// Spec 0016 (1.5): the Play button is square, so its hover and its loading
	// spinner are round (user's request, 2026-10-26).
	for ( const station of [ 'always', 'live' ] as const ) {
		test( `keeps the Play button square on the ${ station } station at ${ viewport.width } × ${ viewport.height }`, async ( {
			page,
		} ) => {
			await page.setViewportSize( viewport );
			await page.goto( readSeed().urls[ station ] );
			const box = await page
				.getByRole( 'button', { name: 'Play' } )
				.boundingBox();
			expect( box ).not.toBeNull();
			expect( Math.abs( box!.width - box!.height ) ).toBeLessThanOrEqual(
				1
			);
		} );
	}
}

// Spec 0016 (B2): the wider Play row never scrolls sideways.
for ( const viewport of [
	...referenceViewports,
	{ width: 320, height: 256 },
] ) {
	test( `fits the Play row with no horizontal scroll at ${ viewport.width } × ${ viewport.height } (B2)`, async ( {
		page,
	} ) => {
		await page.setViewportSize( viewport );
		await page.goto( readSeed().urls.always );
		await expect(
			page.getByRole( 'button', { name: 'Play' } )
		).toBeVisible();

		expect(
			await page.evaluate(
				() =>
					document.documentElement.scrollWidth <=
					document.documentElement.clientWidth
			)
		).toBe( true );
	} );
}

test( 'runs no animation while playing with a dialog open under "reduce motion"', async ( {
	page,
} ) => {
	await page.emulateMedia( { reducedMotion: 'reduce' } );
	await page.goto( readSeed().urls.mp3 );

	await playWithKeyboard( page );
	await page.getByRole( 'button', { name: 'Radio Schedule' } ).click();
	await expect( page.getByRole( 'dialog' ) ).toBeVisible();

	// CSS animations and transitions alike; the visualizer draws by
	// requestAnimationFrame and is not one of them.
	expect(
		await page.evaluate( () =>
			document
				.getAnimations()
				.filter( ( animation ) => animation.playState === 'running' )
				.map(
					( animation ) =>
						( animation as CSSAnimation ).animationName ??
						( animation as CSSTransition ).transitionProperty
				)
		)
	).toEqual( [] );
} );

// Pre-release review (spec 0014, review.md §1), pinned as it is.
for ( const [ button, name ] of [
	[ 'Radio Schedule', 'Radio Schedule Close' ],
	[ 'Radio Shows', 'Radio Shows Close' ],
] ) {
	test( `currently names the ${ button } dialog with its Close button (R-a11y-8 a)`, async ( {
		page,
	} ) => {
		await page.goto( readSeed().urls.always );

		await page.getByRole( 'button', { name: button } ).click();

		await expect(
			page.getByRole( 'dialog', { name, exact: true } )
		).toBeVisible();
	} );
}
