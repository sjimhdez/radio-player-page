/**
 * Stream test rules for the admin: pure functions over data, no DOM.
 * station-admin.js asks the server (radplapag_probe_stream), runs the browser
 * test these rules choose and paints the verdict they return (spec 0018).
 *
 * The server report is { kind, status, cors, streams, mounts, variant, notes }
 * (ADR 0064 §8), or null when the request failed.
 *
 * Exposed as window.radplapagStreamRules (internal, not a public API).
 */
( function () {
	// Without an answer from the server, the browser still tries the URL.
	const NO_ANSWER = [ 'unreachable', 'blocked' ];
	// What the player can play (an https variant of one of these is the fix).
	const PLAYABLE = [ 'audio', 'hls', 'dash' ];

	/**
	 * Lower-case scheme of a URL, without the colon.
	 *
	 * @param {string} url URL.
	 * @return {string} Scheme, or '' if it does not parse.
	 */
	function scheme( url ) {
		try {
			return new URL( url ).protocol.slice( 0, -1 );
		} catch {
			return '';
		}
	}

	/**
	 * Whether an http stream would be blocked on an https site (C13).
	 *
	 * @param {string} url        Stream URL.
	 * @param {string} siteScheme Scheme of the site (`data-site-scheme`).
	 * @return {boolean} Mixed content.
	 */
	function isMixed( url, siteScheme ) {
		return siteScheme === 'https' && scheme( url ) === 'http';
	}

	/**
	 * Whether the URL names an HLS or DASH manifest.
	 *
	 * @param {string} url URL.
	 * @return {boolean} Manifest.
	 */
	function isManifestUrl( url ) {
		try {
			return /\.(m3u8|mpd)$/i.test( new URL( url ).pathname );
		} catch {
			return false;
		}
	}

	/**
	 * Which test the browser runs after the server: an Audio element, a CORS
	 * fetch of the manifest, or none (the server already said what it is).
	 *
	 * @param {string}      url        Stream URL.
	 * @param {Object|null} server     Server report, or null.
	 * @param {string}      siteScheme Scheme of the site.
	 * @return {?string} `'audio'`, `'manifest'` or null.
	 */
	function browserTest( url, server, siteScheme ) {
		if ( isMixed( url, siteScheme ) ) {
			return null;
		}
		const kind = server ? server.kind : null;
		if ( kind === null || NO_ANSWER.indexOf( kind ) !== -1 ) {
			return isManifestUrl( url ) ? 'manifest' : 'audio';
		}
		if ( kind === 'audio' ) {
			return 'audio';
		}
		return kind === 'hls' || kind === 'dash' ? 'manifest' : null;
	}

	/**
	 * Whether the browser loaded the stream: `'cors'`, `'no-cors'` or null.
	 *
	 * @param {Object|null} browser Browser result.
	 * @return {?string} How it plays, or null if it did not.
	 */
	function browserPlays( browser ) {
		if ( ! browser ) {
			return null;
		}
		if ( browser.test === 'audio' ) {
			return browser.result === 'cors' || browser.result === 'no-cors'
				? browser.result
				: null;
		}
		return browser.status >= 200 && browser.status < 300 ? 'cors' : null;
	}

	/**
	 * Shoutcast's /; on the root of the stream's host and port.
	 *
	 * @param {string} url Stream URL.
	 * @return {string} URL with /;.
	 */
	function shoutcastRoot( url ) {
		return new URL( url ).origin + '/;';
	}

	/**
	 * Code and fix from the server report alone, when the browser did not
	 * play the stream (or did not test it).
	 *
	 * @param {string}      url     Stream URL.
	 * @param {Object|null} server  Server report, or null.
	 * @param {Object|null} browser Browser result, or null.
	 * @return {Object} `{ code, status, fix }`.
	 */
	function fromServer( url, server, browser ) {
		const kind = server ? server.kind : null;
		const notes = server ? server.notes : [];
		if ( kind === 'playlist' ) {
			return server.streams.length
				? { code: 'playlist', fix: { urls: server.streams } }
				: { code: 'playlist-empty' };
		}
		if ( kind === 'icecast-page' ) {
			return server.mounts.length
				? { code: 'icecast-mounts', fix: { mounts: server.mounts } }
				: { code: 'icecast-no-mounts' };
		}
		if ( kind === 'shoutcast-page' ) {
			return { code: 'shoutcast', fix: { urls: server.streams } };
		}
		if ( kind === 'html' ) {
			return { code: 'not-a-stream' };
		}
		if ( kind === 'http-error' ) {
			return { code: 'http-error', status: server.status };
		}
		// The browser got an HTTP error for the manifest.
		if ( browser && browser.status ) {
			return { code: 'http-error', status: browser.status };
		}
		if ( kind === 'audio' ) {
			return notes.indexOf( 'shoutcast-server' ) !== -1
				? { code: 'shoutcast', fix: { urls: [ shoutcastRoot( url ) ] } }
				: { code: 'server-only' };
		}
		if ( kind === 'hls' || kind === 'dash' ) {
			return { code: server.cors ? 'server-only' : 'manifest-no-cors' };
		}
		return { code: 'unreachable' };
	}

	/**
	 * Combines the server report and the browser result into a verdict.
	 *
	 * @param {Object}      input            Test.
	 * @param {string}      input.url        Stream URL.
	 * @param {string}      input.siteScheme Scheme of the site.
	 * @param {Object|null} input.server     Server report, or null.
	 * @param {Object|null} input.browser    Browser result, or null: `{ test:
	 *                                       'audio', result }` with `cors`,
	 *                                       `no-cors`, `error` or `timeout`;
	 *                                       `{ test: 'manifest', status }`;
	 *                                       or `{ test: 'manifest', failed }`.
	 * @return {{code: string, status: ?number, fix: ?Object, notes: string[]}}
	 * Verdict; `fix` is `{ urls }` or `{ mounts }` to choose from.
	 */
	function verdict( input ) {
		const server = input.server;
		let result;
		if ( isMixed( input.url, input.siteScheme ) ) {
			const variant = server && server.variant;
			result =
				variant && PLAYABLE.indexOf( variant.kind ) !== -1
					? {
							code: 'mixed-content-variant',
							fix: { urls: [ variant.url ] },
						}
					: { code: 'mixed-content' };
		} else {
			const plays = browserPlays( input.browser );
			if ( plays ) {
				result = {
					code: plays === 'cors' ? 'plays' : 'plays-no-visualizer',
				};
			} else {
				result = fromServer( input.url, server, input.browser );
			}
		}
		return {
			code: result.code,
			status: result.status || null,
			fix: result.fix || null,
			notes: server ? server.notes : [],
		};
	}

	const rules = {
		isMixed,
		browserTest,
		verdict,
	};

	window.radplapagStreamRules = rules;

	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = rules;
	}
} )();
