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
			if ( streamUrlInputEl ) {
				streamUrlInputEl.addEventListener( 'input', function () {
					const val = streamUrlInputEl.value.trim();
					if ( ! val ) {
						clearFieldError( streamUrlWrap );
						return;
					}
					try {
						new URL( val );
						clearFieldError( streamUrlWrap );
					} catch {}
				} );
			}
		}
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
				showProgramError( row, rules.message( item.error, s ) );
			} else {
				clearProgramError( row );
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

	function showProgramError( programRow, message ) {
		programRow.classList.add( 'radplapag-error' );
		const startInput = programRow.querySelector(
			'.radplapag-program-start'
		);
		const endInput = programRow.querySelector( '.radplapag-program-end' );
		const programIdSelect = programRow.querySelector(
			'.radplapag-program-id'
		);
		if ( startInput ) {
			startInput.classList.add( 'radplapag-error' );
		}
		if ( endInput ) {
			endInput.classList.add( 'radplapag-error' );
		}
		if ( programIdSelect ) {
			programIdSelect.classList.add( 'radplapag-error' );
		}
		const existingError = programRow.querySelector(
			'.radplapag-program-error-message'
		);
		if ( existingError ) {
			existingError.remove();
		}
		const errorMsg = document.createElement( 'div' );
		errorMsg.className = 'radplapag-program-error-message show';
		errorMsg.textContent = message;
		programRow.appendChild( errorMsg );
	}

	function clearProgramError( programRow ) {
		programRow.classList.remove( 'radplapag-error' );
		const inputs = programRow.querySelectorAll( 'input, select' );
		inputs.forEach( function ( el ) {
			el.classList.remove( 'radplapag-error' );
		} );
		const errorMsg = programRow.querySelector(
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
		if ( ! streamUrlVal ) {
			if ( streamUrlWrap ) {
				showFieldError(
					streamUrlWrap,
					s.streamUrlRequired || 'This field is required.'
				);
			}
			return { valid: false, firstErrorElement: streamUrlWrap };
		}
		try {
			new URL( streamUrlVal );
		} catch {
			if ( streamUrlWrap ) {
				showFieldError(
					streamUrlWrap,
					s.streamUrlInvalid || 'Please enter a valid URL.'
				);
			}
			return { valid: false, firstErrorElement: streamUrlWrap };
		}
		return { valid: true };
	}

	function revalidateAdjacentDays( programRow, scheduleWrapper, dayWrapper ) {
		if ( ! scheduleWrapper || ! dayWrapper ) {
			return;
		}
		const currentDay = dayWrapper.getAttribute( 'data-day' );
		if ( ! currentDay ) {
			return;
		}
		const dayMap = {
			monday: 'tuesday',
			tuesday: 'wednesday',
			wednesday: 'thursday',
			thursday: 'friday',
			friday: 'saturday',
			saturday: 'sunday',
			sunday: 'monday',
		};
		const prevDayMap = {
			monday: 'sunday',
			tuesday: 'monday',
			wednesday: 'tuesday',
			thursday: 'wednesday',
			friday: 'thursday',
			saturday: 'friday',
			sunday: 'saturday',
		};
		const nextDay = dayMap[ currentDay ];
		if ( nextDay ) {
			const nextDayWrapper = scheduleWrapper.querySelector(
				'.radplapag-schedule-day[data-day="' + nextDay + '"]'
			);
			if ( nextDayWrapper ) {
				nextDayWrapper
					.querySelectorAll( '.radplapag-program-row' )
					.forEach( function ( row ) {
						if (
							window.getComputedStyle( row ).display !== 'none'
						) {
							validateProgramRow( row );
						}
					} );
			}
		}
		const prevDay = prevDayMap[ currentDay ];
		if ( prevDay ) {
			const prevDayWrapper = scheduleWrapper.querySelector(
				'.radplapag-schedule-day[data-day="' + prevDay + '"]'
			);
			if ( prevDayWrapper ) {
				prevDayWrapper
					.querySelectorAll( '.radplapag-program-row' )
					.forEach( function ( row ) {
						if (
							window.getComputedStyle( row ).display !== 'none'
						) {
							validateProgramRow( row );
						}
					} );
			}
		}
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

	function buildProgramSelect( day, nextIndex ) {
		const selectProgramOpt = s.selectProgram || 'Select Radio Show';
		const options = [
			createElement( 'option', { value: '' }, [
				decodeEntities( selectProgramOpt ),
			] ),
		];
		programsList.forEach( function ( p ) {
			const id =
				p.id !== null && p.id !== undefined ? String( p.id ) : '';
			const name = p.name ? String( p.name ) : '';
			if ( id !== '' && name !== '' ) {
				options.push(
					createElement(
						'option',
						{ value: decodeEntities( escapeName( id ) ) },
						[ decodeEntities( escapeName( name ) ) ]
					)
				);
			}
		} );
		return createElement(
			'select',
			{
				name: scheduleFieldName( day, nextIndex, 'program_id' ),
				class: 'radplapag-program-id',
				style: 'width: 200px; margin-right: 24px;',
			},
			options
		);
	}

	function buildProgramRow( day, nextIndex ) {
		const toLabel = decodeEntities( s.to || 'to' );
		const removeTimeSlot = decodeEntities(
			s.removeTimeSlot || 'Remove Time Slot'
		);
		const rerunLabel = decodeEntities( s.scheduleRerun || 'Rerun' );
		const newRow = document.createElement( 'div' );
		newRow.className = 'radplapag-program-row';
		newRow.setAttribute( 'data-program-index', nextIndex );
		newRow.append(
			buildProgramSelect( day, nextIndex ),
			createElement( 'input', {
				type: 'time',
				name: scheduleFieldName( day, nextIndex, 'start' ),
				value: '',
				class: 'radplapag-program-start',
				style: 'width: 100px; margin-right: 5px;',
			} ),
			createElement( 'span', { style: 'margin-right: 5px;' }, [
				' ' + toLabel + ' ',
			] ),
			createElement( 'input', {
				type: 'time',
				name: scheduleFieldName( day, nextIndex, 'end' ),
				value: '',
				class: 'radplapag-program-end',
				style: 'width: 100px; margin-right: 10px;',
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
						name: scheduleFieldName( day, nextIndex, 'is_rerun' ),
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
					},
					[ removeTimeSlot ]
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
			rows.forEach( function ( row ) {
				dayProgramsList.appendChild( row );
			} );
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
							if ( dayWrapper ) {
								dayWrapper
									.querySelectorAll(
										'.radplapag-program-row'
									)
									.forEach( function ( row ) {
										if ( row !== programRow ) {
											validateProgramRow( row );
										}
									} );
							}
							const scheduleWrapper = programRow.closest(
								'.radplapag-schedule-wrapper'
							);
							if ( scheduleWrapper && dayWrapper ) {
								revalidateAdjacentDays(
									programRow,
									scheduleWrapper,
									dayWrapper
								);
							}
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
					const existingPrograms = dayProgramsList.querySelectorAll(
						'.radplapag-program-row'
					);
					const nextIndex = existingPrograms
						? existingPrograms.length
						: 0;
					const newRow = buildProgramRow( day, nextIndex );
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
						programRow.remove();
						if ( dayWrapper ) {
							dayWrapper
								.querySelectorAll( '.radplapag-program-row' )
								.forEach( function ( row ) {
									validateProgramRow( row );
								} );
						}
						if ( scheduleWrapper && dayWrapper ) {
							const currentDay =
								dayWrapper.getAttribute( 'data-day' );
							const days = [
								'monday',
								'tuesday',
								'wednesday',
								'thursday',
								'friday',
								'saturday',
								'sunday',
							];
							const currentDayIndex = days.indexOf( currentDay );
							if ( currentDayIndex < days.length - 1 ) {
								const nextDay = days[ currentDayIndex + 1 ];
								const nextDayWrapper =
									scheduleWrapper.querySelector(
										'.radplapag-schedule-day[data-day="' +
											nextDay +
											'"]'
									);
								if ( nextDayWrapper ) {
									nextDayWrapper
										.querySelectorAll(
											'.radplapag-program-row'
										)
										.forEach( function ( row ) {
											validateProgramRow( row );
										} );
								}
							}
							if ( currentDayIndex > 0 ) {
								const prevDay = days[ currentDayIndex - 1 ];
								const prevDayWrapper =
									scheduleWrapper.querySelector(
										'.radplapag-schedule-day[data-day="' +
											prevDay +
											'"]'
									);
								if ( prevDayWrapper ) {
									prevDayWrapper
										.querySelectorAll(
											'.radplapag-program-row'
										)
										.forEach( function ( row ) {
											validateProgramRow( row );
										} );
								}
							}
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
