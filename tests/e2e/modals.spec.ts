import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { readSeed } from './seed';
import { stationInstant, type StationDay } from './support/clock';

/**
 * Scenario 6 (spec 0002 §4.4): the schedule and all-programs modals, with the
 * grid of docs/known-issues.md seeded in `E2E MP3`.
 */

/**
 * Opens the MP3 station with the browser clock at the station's `day` `time`.
 *
 * @param page Player page.
 * @param day  Station day.
 * @param time Station time, `HH:MM`.
 */
async function openAt( page: Page, day: StationDay, time: string ) {
	await page.clock.install( { time: stationInstant( day, time ) } );
	await page.goto( readSeed().urls.mp3 );
	await expect( page.getByRole( 'button', { name: 'Play' } ) ).toBeVisible();
}

/**
 * Opens the schedule modal and returns it.
 *
 * @param page Player page.
 */
async function openSchedule( page: Page ) {
	await page.getByRole( 'button', { name: 'Radio Schedule' } ).click();
	const dialog = page.getByRole( 'dialog' );
	await expect( dialog ).toBeVisible();
	return dialog;
}

/**
 * Opens the all-programs modal and returns it.
 *
 * @param page Player page.
 */
async function openAllPrograms( page: Page ) {
	await page.getByRole( 'button', { name: 'Radio Shows' } ).click();
	const dialog = page.getByRole( 'dialog' );
	await expect( dialog ).toBeVisible();
	return dialog;
}

/**
 * The card of a program inside a modal.
 *
 * @param dialog  Open modal.
 * @param program Program name.
 */
function card( dialog: ReturnType< Page[ 'getByRole' ] >, program: string ) {
	return dialog
		.locator( '.MuiCard-root' )
		.filter( { has: dialog.page().getByText( program, { exact: true } ) } );
}

test( 'closes the schedule modal with Escape', async ( { page } ) => {
	await openAt( page, 'monday', '06:00' );
	const dialog = await openSchedule( page );

	await page.keyboard.press( 'Escape' );

	await expect( dialog ).toBeHidden();
} );

test( 'closes the schedule modal with its button', async ( { page } ) => {
	await openAt( page, 'monday', '06:00' );
	const dialog = await openSchedule( page );

	await dialog.getByRole( 'button', { name: 'Close' } ).click();

	await expect( dialog ).toBeHidden();
} );

test( 'lists the days from today, skipping empty ones, with the rerun marked', async ( {
	page,
} ) => {
	await openAt( page, 'tuesday', '01:00' );
	const dialog = await openSchedule( page );

	await expect( dialog.locator( 'h6' ) ).toHaveText( [
		'Tuesday',
		'Wednesday',
		'Saturday',
		'Sunday',
		'Monday',
	] );
	await expect( card( dialog, 'E2E Program B' ) ).toContainText(
		'10:00-14:00(Rerun)'
	);
	await expect( card( dialog, 'E2E Program A' ) ).not.toContainText(
		'(Rerun)'
	);
} );

test( 'currently does not mark the previous day slot crossing midnight as on air in the schedule modal (C4)', async ( {
	page,
} ) => {
	await openAt( page, 'tuesday', '01:00' );
	const dialog = await openSchedule( page );

	// C (Monday 22:00–02:00) is on air; the modal only checks today's slots.
	await expect( card( dialog, 'E2E Program C' ) ).toBeVisible();
	await expect( dialog.getByText( 'On Air', { exact: true } ) ).toHaveCount(
		0
	);
} );

test( 'marks the previous day slot crossing midnight as on air in the all-programs modal (C4)', async ( {
	page,
} ) => {
	await openAt( page, 'tuesday', '01:00' );
	const dialog = await openAllPrograms( page );

	await expect( dialog.getByText( 'On Air', { exact: true } ) ).toHaveCount(
		1
	);
	await expect( card( dialog, 'E2E Program C' ) ).toContainText( 'On Air' );
} );

test( 'currently shows "Show more" without an extended description and hides the times until expanded (C6)', async ( {
	page,
} ) => {
	await openAt( page, 'tuesday', '01:00' );
	const dialog = await openAllPrograms( page );
	const programH = card( dialog, 'E2E Program H' );
	const times = programH.getByText( 'Broadcast Times', { exact: true } );
	const slot = programH.getByText( 'Wednesday 00:05-01:00', { exact: true } );

	await expect( programH ).toContainText( 'Program H description.' );
	await expect( programH ).not.toContainText( 'extended description' );
	await expect( times ).toBeHidden();
	await expect( slot ).toBeHidden();

	await programH.getByRole( 'button', { name: 'Show more' } ).click();

	await expect( times ).toBeVisible();
	await expect( slot ).toBeVisible();
	await expect(
		programH.getByRole( 'button', { name: 'Show less' } )
	).toBeVisible();
} );
