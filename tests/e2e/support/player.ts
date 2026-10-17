import type { Page } from '@playwright/test';

/**
 * Helpers to drive the player and read the media servers (media-server.mjs).
 * They wait on media events, not on fixed timeouts.
 */

/** Snapshot of the page's `<audio>` element. */
export interface AudioState {
	src: string;
	currentTime: number;
	paused: boolean;
	errorCode: number | null;
	/** `[start, end]` of each buffered range, in seconds. */
	buffered: Array< [ number, number ] >;
}

/**
 * Reads the state of the player's `<audio>` element.
 *
 * @param page Player page.
 */
export function audioState( page: Page ): Promise< AudioState > {
	return page.evaluate( () => {
		const audio = document.querySelector( 'audio' );
		if ( ! audio ) {
			throw new Error( 'no <audio> element' );
		}
		const buffered: Array< [ number, number ] > = [];
		for ( let i = 0; i < audio.buffered.length; i++ ) {
			buffered.push( [
				audio.buffered.start( i ),
				audio.buffered.end( i ),
			] );
		}
		return {
			src: audio.src,
			currentTime: audio.currentTime,
			paused: audio.paused,
			errorCode: audio.error?.code ?? null,
			buffered,
		};
	} );
}

/**
 * Resolves once the `<audio>` element has fired `playing` and `currentTime`
 * has gone past `seconds` (on `timeupdate`).
 *
 * @param page    Player page.
 * @param seconds Position to wait for.
 */
export function waitForPlayback( page: Page, seconds: number ) {
	return page.evaluate(
		( target ) =>
			new Promise< void >( ( done ) => {
				const audio = document.querySelector( 'audio' );
				if ( ! audio ) {
					throw new Error( 'no <audio> element' );
				}
				let playing = ! audio.paused && audio.readyState > 2;
				const check = () => {
					if ( playing && audio.currentTime > target ) {
						audio.removeEventListener( 'timeupdate', check );
						done();
					}
				};
				audio.addEventListener( 'playing', () => {
					playing = true;
					check();
				} );
				audio.addEventListener( 'timeupdate', check );
				check();
			} ),
		seconds
	);
}

/**
 * Presses Play and waits until the audio is playing past the first second.
 *
 * @param page Player page.
 */
export async function startPlayback( page: Page ) {
	const playback = waitForPlayback( page, 1 );
	await page.getByRole( 'button', { name: 'Play' } ).click();
	await playback;
}

/**
 * Resolves on the next `name` event of the `<audio>` element.
 *
 * @param page Player page.
 * @param name Media event (`stalled`, `waiting`…).
 */
export function waitForAudioEvent( page: Page, name: string ) {
	return page.evaluate(
		( event ) =>
			new Promise< void >( ( done ) => {
				document
					.querySelector( 'audio' )
					?.addEventListener( event, () => done(), { once: true } );
			} ),
		name
	);
}

/** One of the two media origins of media-server.mjs. */
export type MediaOrigin = 'cors' | 'nocors';

/**
 * Port of a media origin (dynamic import: see global-setup.ts).
 *
 * @param origin The origin with CORS headers or the one without.
 */
async function mediaPort( origin: MediaOrigin ): Promise< number > {
	const { MEDIA_NOCORS_PORT, MEDIA_PORT } =
		await import( '../media-server.mjs' );
	return origin === 'cors' ? MEDIA_PORT : MEDIA_NOCORS_PORT;
}

/**
 * Request count by path on a media origin.
 *
 * @param origin The origin with CORS headers (default) or the one without.
 */
export async function mediaRequests(
	origin: MediaOrigin = 'cors'
): Promise< Record< string, number > > {
	const response = await fetch(
		`http://localhost:${ await mediaPort( origin ) }/__requests`
	);
	return ( await response.json() ) as Record< string, number >;
}

/**
 * Resets the request count of a media origin.
 *
 * @param origin The origin with CORS headers (default) or the one without.
 */
export async function resetMediaRequests( origin: MediaOrigin = 'cors' ) {
	await fetch( `http://localhost:${ await mediaPort( origin ) }/__requests`, {
		method: 'DELETE',
	} );
}
