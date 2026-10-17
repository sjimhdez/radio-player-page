import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { readSeed } from './seed';
import { stationInstant, type StationDay } from './support/clock';
import {
	audioState,
	mediaRequests,
	resetMediaRequests,
	startPlayback,
} from './support/player';

/**
 * Scenario 5 (spec 0002 §4.4): current and next program on the player page,
 * with the grid of docs/known-issues.md seeded in `E2E MP3`, and the schedule
 * being informative only (invariant 4).
 */

// A browser timezone other than the station's, so the station clock shows.
test.use( { timezoneId: 'UTC' } );

/**
 * Opens the MP3 station with the browser clock at the station's `day` `time`,
 * and checks that the station clock of the page reads `time`.
 *
 * @param page Player page.
 * @param day  Station day.
 * @param time Station time, `HH:MM`.
 */
async function openAt( page: Page, day: StationDay, time: string ) {
	await page.clock.install( { time: stationInstant( day, time ) } );
	await page.goto( readSeed().urls.mp3 );
	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeVisible();
	await expect(
		page.getByText( 'Broadcast Timezone', { exact: true } ).locator( '..' )
	).toHaveText( `Broadcast Timezone${ time }+5.5` );
}

/**
 * The "On Air" line: its label, the program name and the rerun label.
 *
 * @param page Player page.
 */
function onAir( page: Page ) {
	return page.getByText( 'On Air:', { exact: true } ).locator( '..' );
}

/**
 * The "Next" line: its label, the program name, the rerun label, the minutes
 * left and the time range.
 *
 * @param page Player page.
 */
function next( page: Page ) {
	return page.getByText( 'Next:', { exact: true } ).locator( '..' );
}

test( 'shows the program of a normal slot (vector 2)', async ( { page } ) => {
	await openAt( page, 'monday', '06:00' );

	await expect( onAir( page ) ).toHaveText( 'On Air:E2E Program A' );
	await expect( next( page ) ).toHaveCount( 0 );
} );

test( 'shows a rerun as such (vector 5)', async ( { page } ) => {
	await openAt( page, 'monday', '10:00' );

	await expect( onAir( page ) ).toHaveText( 'On Air:E2E Program B(Rerun)' );
	await expect( next( page ) ).toHaveCount( 0 );
} );

test( 'shows the previous day slot crossing midnight (vector 7)', async ( {
	page,
} ) => {
	await openAt( page, 'tuesday', '01:00' );

	await expect( onAir( page ) ).toHaveText( 'On Air:E2E Program C' );
	await expect( next( page ) ).toHaveCount( 0 );
} );

test( 'shows no program in an empty slot', async ( { page } ) => {
	await openAt( page, 'thursday', '12:00' );

	await expect(
		page.getByText( 'E2E Program', { exact: false } )
	).toHaveCount( 0 );
	await expect( onAir( page ) ).toHaveCount( 0 );
	await expect( next( page ) ).toHaveCount( 0 );
} );

test( 'currently shows the slot of its own day crossing midnight early on Monday (C16, vector 13)', async ( {
	page,
} ) => {
	await openAt( page, 'monday', '00:10' );

	// The vector expects E (Sunday 23:55–00:30, still on air); 3.4.2 takes
	// Monday's 22:00–02:00 as active from midnight.
	await expect( onAir( page ) ).toHaveText( 'On Air:E2E Program C' );
} );

test( 'announces the next program 10 minutes ahead (vector 3)', async ( {
	page,
} ) => {
	await openAt( page, 'monday', '09:50' );

	await expect( onAir( page ) ).toHaveText( 'On Air:E2E Program A' );
	await expect( next( page ) ).toHaveText(
		'Next:E2E Program B(Rerun)(in 10 minutes) 10:00-14:00'
	);
} );

test( 'changes the program shown without touching playback', async ( {
	page,
} ) => {
	await resetMediaRequests();
	await openAt( page, 'monday', '09:50' );
	await startPlayback( page );
	const before = await audioState( page );
	const requests = await mediaRequests();

	await page.clock.fastForward( '10:00' );

	await expect( onAir( page ) ).toHaveText( 'On Air:E2E Program B(Rerun)' );
	await expect( next( page ) ).toHaveCount( 0 );
	const after = await audioState( page );
	expect( after.paused ).toBe( false );
	expect( after.src ).toBe( before.src );
	expect( await mediaRequests() ).toEqual( requests );
	await expect( page.getByRole( 'button', { name: 'Pause' } ) ).toBeVisible();
} );
