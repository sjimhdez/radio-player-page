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
				programsList.locator( '.wp-block-title', {
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

/** What each block previews for a station that is gone (K47). */
const EMPTY_PREVIEW: Record< ( typeof BLOCKS )[ number ], string > = {
	'radplapag/now-playing': 'Now Playing: nothing to show',
	'radplapag/schedule': 'No radio schedule for this station.',
	'radplapag/programs-list': 'No radio shows for this station.',
};

const MISSING_NOTICE =
	'This radio station no longer exists or is not published. Choose another one.';

/**
 * Opens an editor screen without the welcome guide, once the post is loaded.
 *
 * @param page Admin page.
 * @param path Editor URL (`post-new.php` or `post.php?post=…&action=edit`).
 */
async function openEditor( page: Page, path: string ) {
	await page.goto( path );
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
 * Opens a new post in the block editor without the welcome guide and with the
 * block settings sidebar open.
 *
 * @param page Admin page.
 */
function openNewPost( page: Page ) {
	return openEditor( page, '/wp-admin/post-new.php' );
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
 * Inserts a block with the given attributes and returns its client ID.
 *
 * @param page       Editor page.
 * @param name       Block name.
 * @param attributes Block attributes.
 */
function insertBlock(
	page: Page,
	name: string,
	attributes: Record< string, number >
) {
	return page.evaluate(
		( [ blockName, attrs ] ) => {
			// @ts-expect-error -- wp is the editor global.
			const { blocks, data } = window.wp;
			const block = blocks.createBlock( blockName, attrs );
			data.dispatch( 'core/block-editor' ).insertBlocks( [ block ] );
			return block.clientId as string;
		},
		[ name, attributes ] as const
	);
}

/**
 * Station attributes stored in a block.
 *
 * @param page     Editor page.
 * @param clientId Block client ID.
 */
function stationAttributesOf( page: Page, clientId: string ) {
	return page.evaluate( ( id ) => {
		// @ts-expect-error -- wp is the editor global.
		const { stationId, stationIndex } = window.wp.data
			.select( 'core/block-editor' )
			.getBlockAttributes( id );
		return { stationId, stationIndex } as {
			stationId: number;
			stationIndex: number;
		};
	}, clientId );
}

/**
 * Position and ID of a station in the editor data, by its title.
 *
 * @param page    Editor page.
 * @param station Station title.
 */
async function editorStation( page: Page, station: string ) {
	const found = await page.evaluate( ( label ) => {
		const stations =
			// @ts-expect-error -- the editor data of the block.
			window.radplapagScheduleBlock.stations as {
				label: string;
				id: number;
			}[];
		const index = stations.findIndex(
			( candidate ) => candidate.label === label
		);
		return {
			stationId: index < 0 ? 0 : Number( stations[ index ].id ),
			stationIndex: index,
		};
	}, station );
	expect( found.stationIndex, station ).toBeGreaterThanOrEqual( 0 );
	return found;
}

/**
 * Selects a block and shows its settings in the inspector.
 *
 * Right after `selectBlock` the inspector may still show the block selected
 * before (insertBlocks selects the last one), so it waits for the block card.
 *
 * @param page     Editor page.
 * @param clientId Block client ID.
 */
async function inspectBlock( page: Page, clientId: string ) {
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
	return {
		name,
		inspector,
		select: inspector.getByRole( 'combobox', {
			name: 'Radio Station',
			exact: true,
		} ),
	};
}

/**
 * Selects a block and picks a station in its inspector, then checks the
 * attributes landed on this block: the ID and the index of that moment (D3).
 *
 * @param page     Editor page.
 * @param clientId Block client ID.
 * @param station  Station title, as the select lists it.
 */
async function chooseStation( page: Page, clientId: string, station: string ) {
	const { name, select } = await inspectBlock( page, clientId );
	const expected = await editorStation( page, station );
	const attribute = `attributes[stationId]=${ expected.stationId }&`;
	// ServerSideRender fetches the preview debounced; leaving the block before
	// the request goes out loses it (WP 6.6), so wait for this block's request.
	const preview = page.waitForResponse( ( response ) => {
		const url = decodeURIComponent( response.url() );
		return (
			url.includes( `/block-renderer/${ name }?` ) &&
			url.includes( attribute )
		);
	} );
	await select.selectOption( { label: station } );
	await preview;
	await expect
		.poll( () => stationAttributesOf( page, clientId ) )
		.toEqual( expected );
	await expect( select ).toHaveValue( String( expected.stationId ) );
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

	// K47: a station that is gone (an unknown ID, or no ID and an index past the
	// last station) gets a notice and the empty option, and the preview shows
	// what the front end prints, never another station.
	for ( const name of BLOCKS ) {
		for ( const [ label, attributes, query ] of [
			[
				'an out-of-range station index',
				{ stationIndex: 999 },
				'attributes[stationIndex]=999&',
			],
			[
				'an unknown station ID',
				{ stationId: 999999, stationIndex: 0 },
				'attributes[stationId]=999999&',
			],
		] as const ) {
			test( `${ name } warns and previews the empty block for ${ label } (K47)`, async ( {
				page,
			} ) => {
				await openNewPost( page );
				const preview = page.waitForResponse( ( response ) =>
					decodeURIComponent( response.url() ).includes(
						`/block-renderer/${ name }?`
					)
				);
				const clientId = await insertBlock( page, name, attributes );

				expect(
					decodeURIComponent( ( await preview ).url() )
				).toContain( query );
				const { inspector, select } = await inspectBlock(
					page,
					clientId
				);
				await expect( inspector ).toContainText( MISSING_NOTICE );
				await expect( select ).toHaveValue( '' );
				const canvas = await editorCanvas( page );
				await expect(
					canvas.locator( `[data-type="${ name }"] .is-empty` )
				).toContainText( EMPTY_PREVIEW[ name ] );
				expect( await stationAttributesOf( page, clientId ) ).toEqual( {
					stationId: 0,
					stationIndex: 0,
					...attributes,
				} );
			} );
		}

		test( `${ name }: choosing a station from the notice stores its ID and index (D3)`, async ( {
			page,
		} ) => {
			await openNewPost( page );
			// Choosing before the first preview arrives can lose the next one
			// (ServerSideRender), so wait for it as a user would.
			const first = page.waitForResponse( ( response ) =>
				decodeURIComponent( response.url() ).includes(
					`/block-renderer/${ name }?`
				)
			);
			const clientId = await insertBlock( page, name, {
				stationIndex: 999,
			} );
			await first;
			const { inspector } = await inspectBlock( page, clientId );
			await expect( inspector ).toContainText( MISSING_NOTICE );

			await chooseStation( page, clientId, SCHEDULED_STATION );

			await expect( inspector ).not.toContainText( MISSING_NOTICE );
			await expect( inspector ).not.toContainText( 'by its position' );
			// now-playing depends on the clock: the request with the ID, checked
			// by chooseStation, is what it previews.
			const canvas = await editorCanvas( page );
			const block = canvas.locator( `[data-type="${ name }"]` );
			if ( name === 'radplapag/schedule' ) {
				await expect(
					block.locator( 'section[data-day]' )
				).toHaveCount( GRID_DAYS.length );
			} else if ( name === 'radplapag/programs-list' ) {
				await expect(
					block.locator( 'article[data-program-id]' )
				).toHaveCount( LETTERS.length );
			}
		} );

		test( `${ name }: choosing a heading level stores it and previews it (K53)`, async ( {
			page,
		} ) => {
			await openNewPost( page );
			const station = await editorStation( page, SCHEDULED_STATION );
			// Choosing before the first preview arrives can lose the next one
			// (ServerSideRender), so wait for it as a user would.
			const first = page.waitForResponse( ( response ) =>
				decodeURIComponent( response.url() ).includes(
					`/block-renderer/${ name }?`
				)
			);
			const clientId = await insertBlock( page, name, station );
			await first;
			const { inspector } = await inspectBlock( page, clientId );
			const level = inspector.getByRole( 'combobox', {
				name: 'Heading level',
				exact: true,
			} );
			await expect( level ).toHaveValue( '2' );

			const preview = page.waitForResponse( ( response ) => {
				const url = decodeURIComponent( response.url() );
				return (
					url.includes( `/block-renderer/${ name }?` ) &&
					url.includes( 'attributes[headingLevel]=4' )
				);
			} );
			await level.selectOption( { label: 'H4' } );
			await preview;
			await expect
				.poll( () =>
					page.evaluate(
						( id ) =>
							// @ts-expect-error -- wp is the editor global.
							window.wp.data
								.select( 'core/block-editor' )
								.getBlockAttributes( id )
								.headingLevel as number,
						clientId
					)
				)
				.toBe( 4 );
			await expect( level ).toHaveValue( '4' );
			// now-playing depends on the clock: the request with the level is
			// what it previews.
			if ( name !== 'radplapag/now-playing' ) {
				const canvas = await editorCanvas( page );
				const block = canvas.locator( `[data-type="${ name }"]` );
				await expect( block.locator( 'h4' ).first() ).toBeVisible();
				await expect( block.locator( 'h2' ) ).toHaveCount( 0 );
			}
		} );
	}

	// K54: the titles and descriptions core translates from block.json reach
	// the inserter. The test mu-plugin prefixes them with the header.
	test( 'the inserter shows the translated block titles and descriptions (K54)', async ( {
		page,
	} ) => {
		await page.setExtraHTTPHeaders( { 'X-Radplapag-E2e-Translate': '1' } );
		await openNewPost( page );
		const items = await page.evaluate( ( names ) => {
			// @ts-expect-error -- wp is the editor global.
			const { data } = window.wp;
			return (
				data.select( 'core/block-editor' ).getInserterItems() as {
					name: string;
					title: string;
					description: string;
				}[]
			 )
				.filter( ( item ) => names.includes( item.name ) )
				.map( ( { name, title, description } ) => ( {
					name,
					title,
					description,
				} ) );
		}, BLOCKS );

		expect( items.map( ( item ) => item.name ).sort() ).toEqual(
			[ ...BLOCKS ].sort()
		);
		for ( const item of items ) {
			expect( item.title, item.name ).toMatch( /^\[E2E\] RPP: / );
			expect( item.description, item.name ).toMatch(
				/^\[E2E\] Display /
			);
		}
	} );

	test( 'a block saved without a station ID shows help and stays unchanged (D2)', async ( {
		page,
	} ) => {
		await openEditor(
			page,
			`/wp-admin/post.php?post=${ seededId(
				'page-blocks-legacy'
			) }&action=edit`
		);
		const { clientId, first } = await page.evaluate( () => {
			// @ts-expect-error -- wp is the editor global.
			const { data } = window.wp;
			return {
				clientId: data.select( 'core/block-editor' ).getBlocks()[ 0 ]
					.clientId as string,
				// @ts-expect-error -- the editor data of the block.
				first: window.radplapagScheduleBlock.stations[ 0 ]
					.label as string,
			};
		} );
		const { inspector, select } = await inspectBlock( page, clientId );

		await expect( inspector ).toContainText(
			`Showing “${ first }” by its position in the list of stations. Choose a station to keep it.`
		);
		await expect( inspector ).not.toContainText( MISSING_NOTICE );
		await expect( select ).toHaveValue( '' );
		expect( await stationAttributesOf( page, clientId ) ).toEqual( {
			stationId: 0,
			stationIndex: 0,
		} );
		expect(
			await page.evaluate(
				() =>
					// @ts-expect-error -- wp is the editor global.
					window.wp.data
						.select( 'core/editor' )
						.isEditedPostDirty() as boolean
			)
		).toBe( false );
	} );
} );
