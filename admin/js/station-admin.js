/**
 * Station CPT edit screen.
 * Station details (Player Page, Streaming URL, etc.) in a meta box with
 * .radplapag-field-wrap[data-field="player_page"] and [data-field="stream_url"].
 * Schedule meta box is inside #radplapag-station-cpt-container.
 */
( function () {
	const l10n = window.radplapagAdmin || {};
	const programsList = l10n.programs || [];
	const s = l10n.strings || {};
	const assignedPlayerPages = Array.isArray( l10n.assignedPlayerPages )
		? l10n.assignedPlayerPages
		: [];
	const container = document.getElementById(
		'radplapag-station-cpt-container'
	);
	const form = document.getElementById( 'post' );

	function applyDisabledPlayerPages( selectEl ) {
		if ( ! selectEl || ! assignedPlayerPages.length ) {
			return;
		}
		const assignedSet = {};
		assignedPlayerPages.forEach( function ( id ) {
			assignedSet[ String( id ) ] = true;
		} );
		Array.from( selectEl.options ).forEach( function ( option ) {
			if ( option.value && assignedSet[ option.value ] ) {
				option.disabled = true;
			}
		} );
	}

	if ( form ) {
		const playerPageWrap = form.querySelector(
			'[data-field="player_page"]'
		);
		const streamUrlWrap = form.querySelector( '[data-field="stream_url"]' );
		const playerPageSelectEl = form.querySelector(
			'#radplapag_station_player_page'
		);
		if ( playerPageSelectEl ) {
			applyDisabledPlayerPages( playerPageSelectEl );
		}
		if ( playerPageWrap && playerPageSelectEl ) {
			playerPageSelectEl.addEventListener( 'change', function () {
				if ( playerPageSelectEl.value ) {
					clearFieldError( playerPageWrap );
				}
			} );
		}
		if ( streamUrlWrap ) {
			const streamUrlInputEl = form.querySelector(
				'#radplapag_station_stream_url'
			);
			const testButton = streamUrlWrap.querySelector(
				'.radplapag-stream-test'
			);
			if ( streamUrlInputEl && testButton ) {
				testButton.addEventListener( 'click', function () {
					// aria-disabled while a test runs (K130).
					if (
						testButton.getAttribute( 'aria-disabled' ) === 'true'
					) {
						return;
					}
					const val = streamUrlInputEl.value.trim();
					const problem = streamUrlError( val );
					if ( problem ) {
						showFieldError( streamUrlWrap, problem );
						return;
					}
					runStreamTest(
						val,
						streamUrlWrap.getAttribute( 'data-site-scheme' ),
						testButton,
						streamUrlInputEl
					);
				} );
			}
			if ( streamUrlInputEl ) {
				streamUrlInputEl.addEventListener( 'input', function () {
					// A test of the previous value no longer applies.
					streamTestRun++;
					if ( testButton ) {
						testButton.removeAttribute( 'aria-disabled' );
					}
					const val = streamUrlInputEl.value.trim();
					updateMixedContentNotice(
						streamUrlWrap,
						streamUrlInputEl,
						val
					);
					if ( ! val ) {
						clearFieldError( streamUrlWrap );
						return;
					}
					if ( streamUrlProblem( val ) === null ) {
						clearFieldError( streamUrlWrap );
					}
				} );
			}
		}
	}

	// "Test stream" (spec 0018): the server first, then the browser test the
	// rules choose; neither plays anything.
	const BROWSER_TIMEOUT_MS = 8000;
	// Bumped by each test and each edit of the field: a late verdict is dropped.
	let streamTestRun = 0;

	function streamRules() {
		return window.radplapagStreamRules;
	}

	/**
	 * Asks radplapag_probe_stream for the server report (ADR 0064).
	 *
	 * @param {string} url Stream URL.
	 * @return {Promise<?Object>} The report, or null if the request failed.
	 */
	function askServer( url ) {
		const probe = l10n.probe || {};
		const body = new window.URLSearchParams( {
			action: 'radplapag_probe_stream',
			_ajax_nonce: probe.nonce || '',
			url,
		} );
		return window
			.fetch( probe.ajaxUrl, {
				method: 'POST',
				credentials: 'same-origin',
				body,
			} )
			.then( function ( response ) {
				return response.json();
			} )
			.then( function ( json ) {
				return json && json.success ? json.data : null;
			} )
			.catch( function () {
				return null;
			} );
	}

	/**
	 * Loads the stream in a muted Audio that is never played nor attached,
	 * waits for its metadata, an error or the timeout, and frees it (R3).
	 *
	 * @param {string}  url  Stream URL.
	 * @param {boolean} cors Whether to ask with crossOrigin = 'anonymous'.
	 * @return {Promise<string>} `'loaded'`, `'error'` or `'timeout'`.
	 */
	function loadAudio( url, cors ) {
		return new Promise( function ( resolve ) {
			const audio = new window.Audio();
			const events = {
				loadedmetadata: 'loaded',
				canplay: 'loaded',
				error: 'error',
			};
			let timer = null;
			function finish( result ) {
				window.clearTimeout( timer );
				Object.keys( events ).forEach( function ( name ) {
					audio.removeEventListener( name, handlers[ name ] );
				} );
				audio.removeAttribute( 'src' );
				audio.load();
				resolve( result );
			}
			const handlers = {};
			Object.keys( events ).forEach( function ( name ) {
				handlers[ name ] = function () {
					finish( events[ name ] );
				};
				audio.addEventListener( name, handlers[ name ] );
			} );
			timer = window.setTimeout( function () {
				finish( 'timeout' );
			}, BROWSER_TIMEOUT_MS );
			audio.muted = true;
			audio.preload = 'auto';
			if ( cors ) {
				audio.crossOrigin = 'anonymous';
			}
			audio.src = url;
		} );
	}

	/**
	 * The Audio test: with CORS and, after an error, without it (ADR 0033).
	 *
	 * @param {string} url Stream URL.
	 * @return {Promise<Object>} `{ test: 'audio', result }`: `cors`,
	 * `no-cors`, `error` or `timeout`.
	 */
	function probeAudio( url ) {
		return loadAudio( url, true )
			.then( function ( first ) {
				if ( first !== 'error' ) {
					return first === 'loaded' ? 'cors' : first;
				}
				return loadAudio( url, false ).then( function ( second ) {
					return second === 'loaded' ? 'no-cors' : second;
				} );
			} )
			.then( function ( result ) {
				return { test: 'audio', result };
			} );
	}

	/**
	 * Fetches an HLS or DASH manifest as hls.js and dashjs do (cors mode).
	 *
	 * @param {string} url Manifest URL.
	 * @return {Promise<Object>} `{ test: 'manifest', status }`, or `{ test:
	 * 'manifest', failed: true }` without CORS, a network error or the timeout.
	 */
	function probeManifest( url ) {
		const controller = new window.AbortController();
		const timer = window.setTimeout( function () {
			controller.abort();
		}, BROWSER_TIMEOUT_MS );
		return window
			.fetch( url, {
				mode: 'cors',
				credentials: 'omit',
				cache: 'no-store',
				signal: controller.signal,
			} )
			.then(
				function ( response ) {
					return { test: 'manifest', status: response.status };
				},
				function () {
					return { test: 'manifest', failed: true };
				}
			)
			.finally( function () {
				window.clearTimeout( timer );
			} );
	}

	/**
	 * Runs the browser test the rules choose for the server report.
	 *
	 * @param {string}      url        Stream URL.
	 * @param {Object|null} server     Server report, or null.
	 * @param {string}      siteScheme Scheme of the site.
	 * @return {Promise<?Object>} Browser result, or null if none ran.
	 */
	function probeBrowser( url, server, siteScheme ) {
		const test = streamRules().browserTest( url, server, siteScheme );
		if ( test === 'audio' ) {
			return probeAudio( url );
		}
		return test === 'manifest'
			? probeManifest( url )
			: Promise.resolve( null );
	}

	/**
	 * Key of a code's message in `radplapagAdmin.strings`:
	 * `plays-no-visualizer` → `streamPlaysNoVisualizer`.
	 *
	 * @param {string} prefix `stream` or `streamNote`.
	 * @param {string} code   Verdict or note code.
	 * @return {string} String key.
	 */
	function streamKey( prefix, code ) {
		return (
			prefix +
			code
				.split( '-' )
				.map( function ( part ) {
					return part.charAt( 0 ).toUpperCase() + part.slice( 1 );
				} )
				.join( '' )
		);
	}

	/**
	 * The message of a code in `radplapagAdmin.strings`, as text.
	 *
	 * @param {string} prefix `stream` or `streamNote`.
	 * @param {string} code   Verdict or note code (`plays-no-visualizer`).
	 * @return {string} Text, or '' if there is none.
	 */
	function streamMessage( prefix, code ) {
		return decodeEntities( s[ streamKey( prefix, code ) ] || '' );
	}

	/**
	 * One URL to choose: its label (a mount's name and type), the URL as
	 * code and "Use this URL", which fills the field and fires `input` (C13)
	 * without saving. The server's values are always text (ADR 0066 §4).
	 *
	 * @param {Object}      option `{ url, name?, type? }`.
	 * @param {number}      index  Position in the list.
	 * @param {HTMLElement} input  Stream URL input.
	 * @return {HTMLElement} List item.
	 */
	function buildFixItem( option, index, input ) {
		const id = 'radplapag_stream_fix_' + index;
		const use = createElement(
			'button',
			{
				type: 'button',
				class: 'button button-small',
				'aria-describedby': id,
			},
			[ decodeEntities( s.streamUseUrl || '' ) ]
		);
		use.addEventListener( 'click', function () {
			input.value = option.url;
			input.dispatchEvent(
				new window.Event( 'input', { bubbles: true } )
			);
			input.focus();
		} );
		const children = [
			createElement( 'code', { id }, [ option.url ] ),
			' ',
			use,
		];
		let label = option.name || '';
		if ( label && option.type ) {
			label = decodeEntities( s.streamMountLabel || '%1$s (%2$s)' )
				.replace( '%1$s', function () {
					return option.name;
				} )
				.replace( '%2$s', function () {
					return option.type;
				} );
		}
		if ( label ) {
			children.unshift( createElement( 'span', {}, [ label ] ), ' ' );
		}
		return createElement( 'li', {}, children );
	}

	/**
	 * Paints a verdict: its message, the URLs to choose from and the notes.
	 *
	 * @param {HTMLElement} region  Result region (`role="status"`).
	 * @param {Object}      verdict Verdict of `radplapagStreamRules.verdict()`.
	 * @param {HTMLElement} input   Stream URL input.
	 */
	function paintVerdict( region, verdict, input ) {
		region.textContent = '';
		region.append(
			createElement( 'p', {}, [
				streamMessage( 'stream', verdict.code ).replace(
					'%d',
					function () {
						return String( verdict.status );
					}
				),
			] )
		);
		const fix = verdict.fix;
		const options = fix
			? fix.mounts ||
				fix.urls.map( function ( url ) {
					return { url };
				} )
			: [];
		if ( options.length ) {
			region.append(
				createElement(
					'ul',
					{ class: 'radplapag-stream-fix' },
					options.map( function ( option, index ) {
						return buildFixItem( option, index, input );
					} )
				)
			);
		}
		verdict.notes.forEach( function ( note ) {
			const text = streamMessage( 'streamNote', note );
			if ( text ) {
				region.append( createElement( 'p', {}, [ text ] ) );
			}
		} );
	}

	/**
	 * Tests a stream URL and shows the verdict in the result region. The
	 * button stays aria-disabled until then, or until the field changes:
	 * disabled would send its focus to the body (K130).
	 *
	 * @param {string}      url        Trimmed field value.
	 * @param {string}      siteScheme Scheme of the site.
	 * @param {HTMLElement} button     "Test stream" button.
	 * @param {HTMLElement} input      Stream URL input.
	 */
	function runStreamTest( url, siteScheme, button, input ) {
		const region = document.getElementById(
			'radplapag_stream_test_result'
		);
		const run = ++streamTestRun;
		button.setAttribute( 'aria-disabled', 'true' );
		region.textContent = decodeEntities( s.streamTesting || '' );
		askServer( url )
			.then( function ( server ) {
				return probeBrowser( url, server, siteScheme ).then(
					function ( browser ) {
						return streamRules().verdict( {
							url,
							siteScheme,
							server,
							browser,
						} );
					}
				);
			} )
			.then( function ( verdict ) {
				if ( run !== streamTestRun ) {
					return;
				}
				button.removeAttribute( 'aria-disabled' );
				paintVerdict( region, verdict, input );
			} )
			.catch( function () {
				// A test that throws must not leave the button aria-disabled.
				if ( run !== streamTestRun ) {
					return;
				}
				button.removeAttribute( 'aria-disabled' );
				paintVerdict(
					region,
					{ code: 'unreachable', fix: null, notes: [] },
					input
				);
			} );
	}

	// Read when used, not on load: the rules are a separate script.
	function scheduleRules() {
		return window.radplapagScheduleRules;
	}

	function programIds() {
		return programsList.map( function ( p ) {
			return p.id;
		} );
	}

	function fieldValue( programRow, selector ) {
		const field = programRow.querySelector( selector );
		return field ? field.value : '';
	}

	function selectedProgramName( programRow ) {
		const select = programRow.querySelector( '.radplapag-program-id' );
		const option = select ? select.options[ select.selectedIndex ] : null;
		return option ? option.text : '';
	}

	/**
	 * Reads the schedule rows under root into the data the rules check.
	 *
	 * @param {Element} root Element that holds the schedule days.
	 * @return {Object} { schedule, rows }: day → slots, and day → row elements
	 *                  in the same order.
	 */
	function readSchedule( root ) {
		const schedule = {};
		const rows = {};
		root.querySelectorAll( '.radplapag-schedule-day' ).forEach(
			function ( dayWrapper ) {
				const day = dayWrapper.getAttribute( 'data-day' );
				rows[ day ] = Array.prototype.slice.call(
					dayWrapper.querySelectorAll( '.radplapag-program-row' )
				);
				schedule[ day ] = rows[ day ].map( function ( row ) {
					return {
						programId: fieldValue( row, '.radplapag-program-id' ),
						name: selectedProgramName( row ),
						start: fieldValue( row, '.radplapag-program-start' ),
						end: fieldValue( row, '.radplapag-program-end' ),
						hidden:
							window.getComputedStyle( row ).display === 'none',
					};
				} );
			}
		);
		return { schedule, rows };
	}

	function applyWrites( writes, rows ) {
		const rules = scheduleRules();
		writes.forEach( function ( item ) {
			const row = rows[ item.day ][ item.index ];
			if ( item.error ) {
				setRowError( row, rules.message( item.error, s ) );
			} else {
				clearRowError( row );
			}
		} );
	}

	function validateProgramRow( programRow ) {
		const day = programRow
			.closest( '.radplapag-schedule-day' )
			.getAttribute( 'data-day' );
		const read = readSchedule(
			programRow.closest( '.radplapag-schedule-wrapper' )
		);
		const writes = scheduleRules().checkSlot(
			read.schedule,
			day,
			read.rows[ day ].indexOf( programRow ),
			programIds()
		);
		applyWrites( writes, read.rows );
		// The row's own write is always the last one.
		return { valid: ! writes[ writes.length - 1 ].error };
	}

	function rowErrorId( row ) {
		const dayWrapper = row.closest( '.radplapag-schedule-day' );
		return (
			'radplapag-slot-' +
			( dayWrapper ? dayWrapper.getAttribute( 'data-day' ) : '' ) +
			'-' +
			row.getAttribute( 'data-program-index' ) +
			'-error'
		);
	}

	function setRowError( row, message ) {
		row.classList.add( 'radplapag-error' );
		const errorId = rowErrorId( row );
		row.querySelectorAll(
			'.radplapag-program-id, .radplapag-program-start, .radplapag-program-end'
		).forEach( function ( el ) {
			el.classList.add( 'radplapag-error' );
			el.setAttribute( 'aria-invalid', 'true' );
			el.setAttribute( 'aria-describedby', errorId );
		} );
		const existingError = row.querySelector(
			'.radplapag-program-error-message'
		);
		if ( existingError ) {
			existingError.remove();
		}
		const errorMsg = document.createElement( 'div' );
		errorMsg.className = 'radplapag-program-error-message show';
		errorMsg.id = errorId;
		errorMsg.textContent = message;
		row.appendChild( errorMsg );
	}

	function clearRowError( row ) {
		row.classList.remove( 'radplapag-error' );
		const inputs = row.querySelectorAll( 'input, select' );
		inputs.forEach( function ( el ) {
			el.classList.remove( 'radplapag-error' );
			el.removeAttribute( 'aria-invalid' );
			el.removeAttribute( 'aria-describedby' );
		} );
		const errorMsg = row.querySelector(
			'.radplapag-program-error-message'
		);
		if ( errorMsg ) {
			errorMsg.remove();
		}
	}

	function showFieldError( fieldWrap, message ) {
		if ( ! fieldWrap ) {
			return;
		}
		fieldWrap.classList.add( 'radplapag-error' );
		const input = fieldWrap.querySelector( 'input, select' );
		if ( input ) {
			input.classList.add( 'radplapag-error' );
		}
		const msgEl = fieldWrap.querySelector(
			'.radplapag-field-error-message'
		);
		if ( msgEl ) {
			msgEl.textContent = message;
		}
	}

	/**
	 * What is wrong with a non-empty stream URL (K42). `new URL()` reads
	 * `host:port/path` as a URL with the host as its scheme.
	 *
	 * @param {string} value Trimmed field value.
	 * @return {?string} `'invalid'`, `'scheme'` or null when it is fine.
	 */
	function streamUrlProblem( value ) {
		let url;
		try {
			url = new URL( value );
		} catch {
			return 'invalid';
		}
		return url.protocol === 'http:' || url.protocol === 'https:'
			? null
			: 'scheme';
	}

	/**
	 * The error message of a stream URL, as the submit shows it.
	 *
	 * @param {string} value Trimmed field value.
	 * @return {?string} Message, or null when the URL is fine.
	 */
	function streamUrlError( value ) {
		if ( ! value ) {
			return s.streamUrlRequired || 'This field is required.';
		}
		const problem = streamUrlProblem( value );
		if ( problem === 'invalid' ) {
			return s.streamUrlInvalid || 'Please enter a valid URL.';
		}
		if ( problem === 'scheme' ) {
			return (
				s.streamUrlScheme ||
				'Please enter a URL that starts with http:// or https://.'
			);
		}
		return null;
	}

	/**
	 * Shows the notice printed by PHP when the stream is http and the site
	 * https, or hides it (C13). It never blocks the submit.
	 *
	 * @param {Element} fieldWrap Wrapper with `data-site-scheme`.
	 * @param {Element} input     Stream URL input.
	 * @param {string}  value     Trimmed field value.
	 */
	function updateMixedContentNotice( fieldWrap, input, value ) {
		const notice = fieldWrap.querySelector( '.radplapag-field-notice' );
		if ( ! notice ) {
			return;
		}
		let mixed = false;
		if ( fieldWrap.getAttribute( 'data-site-scheme' ) === 'https' ) {
			try {
				mixed = new URL( value ).protocol === 'http:';
			} catch {}
		}
		notice.hidden = ! mixed;
		if ( mixed ) {
			input.setAttribute( 'aria-describedby', notice.id );
		} else {
			input.removeAttribute( 'aria-describedby' );
		}
	}

	function clearFieldError( fieldWrap ) {
		if ( ! fieldWrap ) {
			return;
		}
		fieldWrap.classList.remove( 'radplapag-error' );
		const input = fieldWrap.querySelector( 'input, select' );
		if ( input ) {
			input.classList.remove( 'radplapag-error' );
		}
		const msgEl = fieldWrap.querySelector(
			'.radplapag-field-error-message'
		);
		if ( msgEl ) {
			msgEl.textContent = '';
		}
	}

	function validateStationFields() {
		const playerPageWrap = form
			? form.querySelector( '[data-field="player_page"]' )
			: null;
		const streamUrlWrap = form
			? form.querySelector( '[data-field="stream_url"]' )
			: null;
		if ( playerPageWrap ) {
			clearFieldError( playerPageWrap );
		}
		if ( streamUrlWrap ) {
			clearFieldError( streamUrlWrap );
		}
		const playerPageSelect = form
			? form.querySelector( '#radplapag_station_player_page' )
			: null;
		const streamUrlInput = form
			? form.querySelector( '#radplapag_station_stream_url' )
			: null;
		const playerPageVal = playerPageSelect ? playerPageSelect.value : '';
		const streamUrlVal = streamUrlInput ? streamUrlInput.value.trim() : '';
		if ( ! playerPageVal ) {
			if ( playerPageWrap ) {
				showFieldError(
					playerPageWrap,
					s.playerPageRequired || 'This field is required.'
				);
			}
			return { valid: false, firstErrorElement: playerPageWrap };
		}
		const playerPageNum = Number( playerPageVal );
		if ( assignedPlayerPages.indexOf( playerPageNum ) !== -1 ) {
			if ( playerPageWrap ) {
				showFieldError(
					playerPageWrap,
					s.playerPageAlreadyAssigned ||
						'This Player Page is already assigned to another station. Please choose a different page.'
				);
			}
			return { valid: false, firstErrorElement: playerPageWrap };
		}
		const streamUrlMessage = streamUrlError( streamUrlVal );
		if ( streamUrlMessage ) {
			if ( streamUrlWrap ) {
				showFieldError( streamUrlWrap, streamUrlMessage );
			}
			return { valid: false, firstErrorElement: streamUrlWrap };
		}
		return { valid: true };
	}

	function dayRows( scheduleWrapper, day ) {
		const dayWrapper = scheduleWrapper.querySelector(
			'.radplapag-schedule-day[data-day="' + day + '"]'
		);
		return dayWrapper
			? dayWrapper.querySelectorAll( '.radplapag-program-row' )
			: [];
	}

	/**
	 * Validates every row of a day, in order.
	 *
	 * @param {Element} scheduleWrapper Element that holds the schedule days.
	 * @param {string}  day             Day key.
	 * @param {Object}  [options]       except: row left out; skipHidden: leave
	 *                                  out the hidden rows.
	 */
	function revalidateDay( scheduleWrapper, day, options ) {
		const opts = options || {};
		dayRows( scheduleWrapper, day ).forEach( function ( row ) {
			if ( row === opts.except ) {
				return;
			}
			if (
				opts.skipHidden &&
				window.getComputedStyle( row ).display === 'none'
			) {
				return;
			}
			validateProgramRow( row );
		} );
	}

	/**
	 * Validates the visible rows of the next day, then of the previous one,
	 * wrapping the week.
	 *
	 * @param {Element} scheduleWrapper Element that holds the schedule days.
	 * @param {string}  day             Day key.
	 */
	function revalidateAround( scheduleWrapper, day ) {
		const rules = scheduleRules();
		if ( rules.DAYS.indexOf( day ) === -1 ) {
			return;
		}
		const neighbour = { skipHidden: true };
		revalidateDay( scheduleWrapper, rules.nextDay( day ), neighbour );
		revalidateDay( scheduleWrapper, rules.prevDay( day ), neighbour );
	}

	// Text as the HTML strings of 3.4 showed it: entities decoded (risk 1 of spec
	// 0005; K21 is for 0012). The inert document runs no scripts and loads
	// nothing; `<body>` keeps leading whitespace.
	function decodeEntities( text ) {
		return new window.DOMParser().parseFromString(
			'<body>' + text,
			'text/html'
		).body.textContent;
	}

	function escapeName( text ) {
		return text
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' )
			.replace( /"/g, '&quot;' );
	}

	function createElement( tag, attributes, children ) {
		const el = document.createElement( tag );
		Object.keys( attributes ).forEach( function ( name ) {
			el.setAttribute( name, attributes[ name ] );
		} );
		( children || [] ).forEach( function ( child ) {
			el.append( child );
		} );
		return el;
	}

	function scheduleFieldName( day, index, field ) {
		return (
			'radplapag_station_schedule[' +
			day +
			'][' +
			index +
			'][' +
			field +
			']'
		);
	}

	function buildProgramSelect( day, index ) {
		const selectProgramOpt = s.selectProgram || 'Select a Radio Show';
		const options = [
			createElement( 'option', { value: '' }, [
				decodeEntities( selectProgramOpt ),
			] ),
		];
		programsList.forEach( function ( p ) {
			const id =
				p.id !== null && p.id !== undefined ? String( p.id ) : '';
			const name = p.name ? String( p.name ) : '';
			// The label carries the status of a program that is not public.
			const label = p.label ? String( p.label ) : name;
			if ( id !== '' && name !== '' ) {
				options.push(
					createElement(
						'option',
						{ value: decodeEntities( escapeName( id ) ) },
						[ decodeEntities( escapeName( label ) ) ]
					)
				);
			}
		} );
		return createElement(
			'select',
			{
				name: scheduleFieldName( day, index, 'program_id' ),
				class: 'radplapag-program-id',
				style: 'width: 200px; margin-right: 24px;',
			},
			options
		);
	}

	/**
	 * Shows the notice of a row whose program is not public, or removes it
	 * (ADR 0045). A program without `public` counts as public.
	 *
	 * @param {Element} programRow Program row.
	 */
	function updateProgramNotice( programRow ) {
		const programId = fieldValue( programRow, '.radplapag-program-id' );
		const program = programsList.find( function ( p ) {
			return String( p.id ) === programId;
		} );
		let notice = programRow.querySelector( '.radplapag-program-notice' );
		if ( ! program || program.public !== false ) {
			if ( notice ) {
				notice.remove();
			}
			return;
		}
		if ( ! notice ) {
			notice = createElement( 'div', {
				class: 'radplapag-program-notice',
			} );
			programRow.appendChild( notice );
		}
		notice.textContent = decodeEntities(
			s.programNotPublished ||
				'This radio show is not published; this time slot is not shown on the site.'
		);
	}

	// The highest index + 1, not the row count: after a removal the count
	// would reuse the field names of a kept row (K15).
	function nextIndex( dayWrapper ) {
		let next = 0;
		dayWrapper
			.querySelectorAll( '.radplapag-program-row' )
			.forEach( function ( row ) {
				const index = parseInt(
					row.getAttribute( 'data-program-index' ),
					10
				);
				if ( index >= next ) {
					next = index + 1;
				}
			} );
		return next;
	}

	// The accessible name of a slot field, as the PHP rows print it (AX3, AX4).
	function buildScreenReaderLabel( id, text ) {
		return createElement(
			'label',
			{ class: 'screen-reader-text', for: id },
			[ decodeEntities( text ) ]
		);
	}

	function buildProgramRow( day, index ) {
		const toLabel = decodeEntities( s.to || 'to' );
		const removeLabel = decodeEntities( s.remove || 'Remove' );
		const removeTimeSlot = decodeEntities(
			s.removeTimeSlot || 'Remove Time Slot'
		);
		const rerunLabel = decodeEntities( s.scheduleRerun || 'Rerun' );
		const fieldId = 'radplapag-slot-' + day + '-' + index + '-';
		const select = buildProgramSelect( day, index );
		select.id = fieldId + 'program';
		const newRow = document.createElement( 'div' );
		newRow.className = 'radplapag-program-row';
		newRow.setAttribute( 'data-program-index', index );
		newRow.append(
			buildScreenReaderLabel(
				fieldId + 'program',
				s.programLabel || 'Radio Show'
			),
			select,
			buildScreenReaderLabel(
				fieldId + 'start',
				s.startTimeLabel || 'Start time'
			),
			createElement( 'input', {
				type: 'time',
				name: scheduleFieldName( day, index, 'start' ),
				value: '',
				class: 'radplapag-program-start',
				style: 'width: 100px; margin-right: 5px;',
				id: fieldId + 'start',
			} ),
			createElement( 'span', { style: 'margin-right: 5px;' }, [
				' ' + toLabel + ' ',
			] ),
			buildScreenReaderLabel(
				fieldId + 'end',
				s.endTimeLabel || 'End time'
			),
			createElement( 'input', {
				type: 'time',
				name: scheduleFieldName( day, index, 'end' ),
				value: '',
				class: 'radplapag-program-end',
				style: 'width: 100px; margin-right: 10px;',
				id: fieldId + 'end',
			} ),
			createElement(
				'label',
				{
					class: 'radplapag-program-is-rerun-label',
					style: 'margin-right: 10px;',
				},
				[
					createElement( 'input', {
						type: 'checkbox',
						name: scheduleFieldName( day, index, 'is_rerun' ),
						value: '1',
						class: 'radplapag-program-is-rerun',
					} ),
					' ' + rerunLabel,
				]
			),
			createElement( 'div', { class: 'radplapag-schedule-remove-cell' }, [
				createElement(
					'a',
					{
						href: '#',
						class: 'submitdelete radplapag-remove-program',
						'aria-label': removeTimeSlot,
					},
					[ removeLabel ]
				),
			] ),
			createElement( 'div', {
				class: 'radplapag-program-error-message',
				style: 'display: none;',
			} )
		);
		return newRow;
	}

	function initScheduleManagement() {
		function sortProgramsByStartTime( dayProgramsList ) {
			if ( ! dayProgramsList || ! dayProgramsList.querySelectorAll ) {
				return;
			}
			const rows = Array.prototype.slice.call(
				dayProgramsList.querySelectorAll( '.radplapag-program-row' )
			);
			if ( ! rows || rows.length <= 1 ) {
				return;
			}
			rows.sort( function ( a, b ) {
				const startA =
					( a.querySelector( '.radplapag-program-start' ) || {} )
						.value || '';
				const startB =
					( b.querySelector( '.radplapag-program-start' ) || {} )
						.value || '';
				if ( ! startA && ! startB ) {
					return 0;
				}
				if ( ! startA ) {
					return 1;
				}
				if ( ! startB ) {
					return -1;
				}
				return startA.localeCompare( startB );
			} );
			// appendChild detaches each row: give the focus back if it was in
			// the list (K39).
			const doc = dayProgramsList.ownerDocument;
			const focused = dayProgramsList.contains( doc.activeElement )
				? doc.activeElement
				: null;
			rows.forEach( function ( row ) {
				dayProgramsList.appendChild( row );
			} );
			if ( focused && doc.activeElement !== focused ) {
				focused.focus( { preventScroll: true } );
			}
		}

		function setupGroupValidation( programRow ) {
			programRow.addEventListener( 'focusout', function ( e ) {
				const relatedTarget = e.relatedTarget;
				const isStillInGroup =
					relatedTarget && programRow.contains( relatedTarget );
				if ( ! isStillInGroup ) {
					setTimeout( function () {
						if ( ! programRow.parentNode ) {
							return;
						}
						const activeElement =
							programRow.ownerDocument.activeElement;
						if ( ! programRow.contains( activeElement ) ) {
							validateProgramRow( programRow );
							const dayWrapper = programRow.closest(
								'.radplapag-schedule-day'
							);
							const scheduleWrapper = programRow.closest(
								'.radplapag-schedule-wrapper'
							);
							const day = dayWrapper.getAttribute( 'data-day' );
							revalidateDay( scheduleWrapper, day, {
								except: programRow,
							} );
							revalidateAround( scheduleWrapper, day );
							const dayProgramsList = dayWrapper.querySelector(
								'.radplapag-programs-list'
							);
							if ( dayProgramsList ) {
								sortProgramsByStartTime( dayProgramsList );
							}
						}
					}, 10 );
				}
			} );
		}

		if ( container ) {
			container
				.querySelectorAll( '.radplapag-program-row' )
				.forEach( function ( programRow ) {
					setupGroupValidation( programRow );
				} );

			container.addEventListener( 'change', function ( e ) {
				if ( e.target.classList.contains( 'radplapag-program-id' ) ) {
					updateProgramNotice(
						e.target.closest( '.radplapag-program-row' )
					);
				}
			} );

			container.addEventListener( 'click', function ( e ) {
				if ( e.target.classList.contains( 'radplapag-add-program' ) ) {
					e.preventDefault();
					const day = e.target.getAttribute( 'data-day' );
					const dayWrapper = e.target.closest(
						'.radplapag-schedule-day'
					);
					const dayProgramsList = dayWrapper
						? dayWrapper.querySelector( '.radplapag-programs-list' )
						: null;
					if ( ! dayWrapper || ! dayProgramsList ) {
						return;
					}
					const newRow = buildProgramRow(
						day,
						nextIndex( dayWrapper )
					);
					dayProgramsList.appendChild( newRow );
					setupGroupValidation( newRow );
				}

				if (
					e.target.classList.contains( 'radplapag-remove-program' )
				) {
					e.preventDefault();
					const programRow = e.target.closest(
						'.radplapag-program-row'
					);
					if ( programRow ) {
						const dayWrapper = programRow.closest(
							'.radplapag-schedule-day'
						);
						const scheduleWrapper = programRow.closest(
							'.radplapag-schedule-wrapper'
						);
						const nextRow = programRow.nextElementSibling;
						programRow.remove();
						if ( scheduleWrapper && dayWrapper ) {
							const day = dayWrapper.getAttribute( 'data-day' );
							revalidateDay( scheduleWrapper, day );
							revalidateAround( scheduleWrapper, day );
						}
						// Keep the keyboard focus in the day (K39).
						const focusTarget =
							( nextRow &&
								nextRow.querySelector(
									'.radplapag-program-id'
								) ) ||
							( dayWrapper &&
								dayWrapper.querySelector(
									'.radplapag-add-program'
								) );
						if ( focusTarget ) {
							focusTarget.focus();
						}
					}
				}
			} );
		}
	}

	if ( form ) {
		form.addEventListener( 'submit', function ( e ) {
			let hasErrors = false;
			let firstErrorElement = null;
			if ( form.querySelector( '[data-field="player_page"]' ) ) {
				const stationResult = validateStationFields();
				if ( ! stationResult.valid ) {
					hasErrors = true;
					firstErrorElement = stationResult.firstErrorElement;
				}
			}
			if ( container && ! hasErrors ) {
				const read = readSchedule( container );
				const result = scheduleRules().checkSchedule(
					read.schedule,
					programIds()
				);
				applyWrites( result.writes, read.rows );
				if ( result.first ) {
					hasErrors = true;
					firstErrorElement =
						read.rows[ result.first.day ][ result.first.index ];
				}
			}
			if ( hasErrors ) {
				e.preventDefault();
				if ( firstErrorElement ) {
					// A collapsed meta box would hide the error.
					const box = firstErrorElement.closest( '.postbox.closed' );
					if ( box ) {
						box.classList.remove( 'closed' );
						const toggle = box.querySelector( '.handlediv' );
						if ( toggle ) {
							toggle.setAttribute( 'aria-expanded', 'true' );
						}
					}
					const focusTarget =
						firstErrorElement.querySelector(
							'.radplapag-program-id'
						) || firstErrorElement.querySelector( 'input, select' );
					if ( focusTarget ) {
						focusTarget.focus( { preventScroll: true } );
					}
					firstErrorElement.scrollIntoView( {
						behavior: 'smooth',
						block: 'center',
					} );
				}
				return false;
			}
		} );
	}

	initScheduleManagement();
	// Logo and background image handling: same markup/classes as Programs; program-admin.js handles it (loaded on station screen).
} )();
