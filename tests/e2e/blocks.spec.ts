import type { FrameLocator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { ADMIN_STATE, readSeed, seededId } from './seed';

/**
 * Scenario 11 (spec 0002 §4.4): the three blocks on the front end and in the
 * editor. The PHP resolves "now" with the real clock, so the front end checks
 * the structure the grid gives (days, programs), never which program is on air.
 */

const BLOCKS = [
	'radplapag/now-playing',
	'radplapag/schedule',
	'radplapag/programs-list',
] as const;

/** Grid programs of tests/e2e/fixtures/seed-e2e.php. */
const LETTERS = [ 'A', 'B', 'C', 'D', 'E', 'G', 'H' ];

/** Days of the grid that have slots, Monday to Sunday. */
const GRID_DAYS = [ 'monday', 'tuesday', 'wednesday', 'saturday', 'sunday' ];

const SCHEDULED_STATION = 'E2E MP3';
const UNSCHEDULED_STATION = 'E2E Live';

test.describe( 'blocks: front end', () => {
	test( 'the seeded page renders the three blocks for the station', async ( {
		page,
	} ) => {
		await page.goto( readSeed().urls.blocks );

		const schedule = page.locator( '.wp-block-radplapag-schedule' );
		await expect( schedule ).toHaveCount( 1 );
		const days = await schedule
			.locator( 'section[data-day]' )
			.evaluateAll( ( sections ) =>
				sections.map( ( section ) =>
					section.getAttribute( 'data-day' )
				)
			);
		expect( [ ...days ].sort() ).toEqual( [ ...GRID_DAYS ].sort() );
		await expect(
			schedule.locator( 'section[data-day="monday"] li' )
		).toHaveText( [
			/E2E Program A – 06:00-10:00/,
			/E2E Program B \(Rerun\) – 10:00-14:00/,
			/E2E Program C – 22:00-02:00/,
		] );

		const programsList = page.locator(
			'.wp-block-radplapag-programs-list'
		);
		await expect( programsList ).toHaveCount( 1 );
		const programIds = LETTERS.map( ( letter ) =>
			seededId( `program-${ letter }` )
		);
		const articles = programsList.locator( 'article[data-program-id]' );
		const listedIds = await articles.evaluateAll( ( nodes ) =>
			nodes.map( ( node ) => node.getAttribute( 'data-program-id' ) )
		);
		expect( [ ...listedIds ].sort() ).toEqual( [ ...programIds ].sort() );
		for ( const letter of LETTERS ) {
			await expect(
				programsList.locator( 'header', {
					hasText: `E2E Program ${ letter }`,
				} )
			).toHaveCount( 1 );
		}

		// On air or starting within 10 minutes renders a program of the grid;
		// otherwise the front end prints nothing (no empty notice).
		const nowPlaying = page.locator( '.wp-block-radplapag-now-playing' );
		await expect( page.locator( '.is-empty' ) ).toHaveCount( 0 );
		if ( ( await nowPlaying.count() ) > 0 ) {
			const shown = await nowPlaying
				.locator( 'article[data-program-id]' )
				.evaluateAll( ( nodes ) =>
					nodes.map( ( node ) =>
						node.getAttribute( 'data-program-id' )
					)
				);
			expect( shown.length ).toBeGreaterThan( 0 );
			for ( const id of shown ) {
				expect( programIds ).toContain( id );
			}
		}
	} );
} );

/**
 * The editor canvas: an iframe when every block in the post is apiVersion 3
 * and nothing forces the legacy canvas, the page itself otherwise.
 *
 * @param page Editor page.
 */
async function editorCanvas( page: Page ): Promise< Page | FrameLocator > {
	const iframe = page.locator( 'iframe[name="editor-canvas"]' );
	return ( await iframe.count() ) > 0
		? page.frameLocator( 'iframe[name="editor-canvas"]' )
		: page;
}

/**
 * Opens a new post in the block editor without the welcome guide and with the
 * block settings sidebar open.
 *
 * @param page Admin page.
 */
async function openNewPost( page: Page ) {
	await page.goto( '/wp-admin/post-new.php' );
	await page.waitForFunction(
		() =>
			// @ts-expect-error -- wp is the editor global.
			window.wp?.data?.select( 'core/editor' )?.getCurrentPostId?.() > 0
	);
	await page.evaluate( () => {
		// @ts-expect-error -- wp is the editor global.
		const { dispatch } = window.wp.data;
		dispatch( 'core/preferences' ).set(
			'core/edit-post',
			'welcomeGuide',
			false
		);
	} );
	const guide = page.locator( '.edit-post-welcome-guide' );
	if ( await guide.isVisible() ) {
		await page.keyboard.press( 'Escape' );
	}
	await expect( guide ).toBeHidden();
}

/**
 * Inserts the three blocks and returns their client IDs by name.
 *
 * @param page Editor page.
 */
function insertBlocks( page: Page ) {
	return page.evaluate( ( names ) => {
		// @ts-expect-error -- wp is the editor global.
		const { blocks, data } = window.wp;
		const created = names.map( ( name ) => blocks.createBlock( name ) );
		data.dispatch( 'core/block-editor' ).insertBlocks( created );
		return Object.fromEntries(
			created.map( ( block: { name: string; clientId: string } ) => [
				block.name,
				block.clientId,
			] )
		) as Record< string, string >;
	}, BLOCKS );
}

/**
 * Station index stored in a block's attributes.
 *
 * @param page     Editor page.
 * @param clientId Block client ID.
 */
function stationIndexOf( page: Page, clientId: string ) {
	return page.evaluate(
		( id ) =>
			// @ts-expect-error -- wp is the editor global.
			window.wp.data
				.select( 'core/block-editor' )
				.getBlockAttributes( id ).stationIndex as number,
		clientId
	);
}

/**
 * Selects a block and picks a station in its inspector.
 *
 * Right after `selectBlock` the inspector may still show the block selected
 * before (insertBlocks selects the last one), so it waits for the block card
 * and checks the attribute landed on this block.
 *
 * @param page     Editor page.
 * @param clientId Block client ID.
 * @param station  Station title, as the select lists it.
 */
async function chooseStation( page: Page, clientId: string, station: string ) {
	const { name, title } = await page.evaluate( ( id ) => {
		// @ts-expect-error -- wp is the editor global.
		const { blocks, data } = window.wp;
		data.dispatch( 'core/block-editor' ).selectBlock( id );
		( data.dispatch( 'core/editor' ).openGeneralSidebar
			? data.dispatch( 'core/editor' )
			: data.dispatch( 'core/edit-post' )
		).openGeneralSidebar( 'edit-post/block' );
		const blockName = data
			.select( 'core/block-editor' )
			.getBlockName( id ) as string;
		return {
			name: blockName,
			title: blocks.getBlockType( blockName ).title as string,
		};
	}, clientId );
	const inspector = page.locator( '.block-editor-block-inspector' );
	await expect(
		inspector.locator( '.block-editor-block-card__title' )
	).toHaveText( title );
	const select = inspector.getByRole( 'combobox', {
		name: 'Radio Station',
		exact: true,
	} );
	const index = await select.evaluate(
		( element: HTMLSelectElement, label ) =>
			Number(
				[ ...element.options ].find(
					( option ) => option.text === label
				)?.value ?? -1
			),
		station
	);
	expect( index, station ).toBeGreaterThanOrEqual( 0 );
	// ServerSideRender fetches the preview debounced; leaving the block before
	// the request goes out loses it (WP 6.6), so wait for this block's request.
	const preview = page.waitForResponse( ( response ) => {
		const url = decodeURIComponent( response.url() );
		return (
			url.includes( `/block-renderer/${ name }?` ) &&
			url.includes( `attributes[stationIndex]=${ index }&` )
		);
	} );
	await select.selectOption( { label: station } );
	await preview;
	await expect.poll( () => stationIndexOf( page, clientId ) ).toBe( index );
}

test.describe( 'blocks: editor', () => {
	test.use( { storageState: ADMIN_STATE } );

	test( 'the three blocks are inserted and preview the chosen station', async ( {
		page,
	} ) => {
		await openNewPost( page );
		const ids = await insertBlocks( page );
		for ( const name of BLOCKS ) {
			expect( ids[ name ], name ).toBeTruthy();
		}

		await chooseStation(
			page,
			ids[ 'radplapag/schedule' ],
			SCHEDULED_STATION
		);
		await chooseStation(
			page,
			ids[ 'radplapag/programs-list' ],
			SCHEDULED_STATION
		);
		await chooseStation(
			page,
			ids[ 'radplapag/now-playing' ],
			UNSCHEDULED_STATION
		);

		const canvas = await editorCanvas( page );
		const block = ( name: string ) =>
			canvas.locator( `[data-type="${ name }"]` );

		const schedule = block( 'radplapag/schedule' );
		for ( const day of GRID_DAYS ) {
			await expect(
				schedule.locator( `section[data-day="${ day }"]` )
			).toHaveCount( 1 );
		}
		await expect( schedule.locator( 'section[data-day]' ) ).toHaveCount(
			GRID_DAYS.length
		);

		await expect(
			block( 'radplapag/programs-list' ).locator(
				'article[data-program-id]'
			)
		).toHaveCount( LETTERS.length );

		// In the REST preview a station with nothing on air gets a notice.
		await expect(
			block( 'radplapag/now-playing' ).locator(
				'.wp-block-radplapag-now-playing.is-empty'
			)
		).toContainText( 'Now Playing: nothing to show' );
	} );
} );
