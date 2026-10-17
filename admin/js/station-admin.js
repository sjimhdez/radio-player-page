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

	const dayLabels = {
		monday: s.monday || 'Monday',
		tuesday: s.tuesday || 'Tuesday',
		wednesday: s.wednesday || 'Wednesday',
		thursday: s.thursday || 'Thursday',
		friday: s.friday || 'Friday',
		saturday: s.saturday || 'Saturday',
		sunday: s.sunday || 'Sunday',
	};

	function formatOverlapMessage( programName, dayKey, startTime, endTime ) {
		const dayLabel = dayLabels[ dayKey ] || dayKey;
		const timeRange = startTime + ' - ' + endTime;
		return programName + ' (' + dayLabel + ', ' + timeRange + ')';
	}

	function validateTimeFormat( timeString ) {
		const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
		if ( ! timeString || ! timeRegex.test( timeString ) ) {
			return {
				valid: false,
				message:
					s.invalidTimeFormat ||
					'Invalid time format. Times must be in HH:MM format.',
			};
		}
		return { valid: true };
	}

	function validateTimeRange( startTime, endTime ) {
		if ( ! startTime || ! endTime ) {
			return {
				valid: false,
				message:
					s.completeTimeFields || 'Please complete all time fields.',
			};
		}
		const startFormatValidation = validateTimeFormat( startTime );
		if ( ! startFormatValidation.valid ) {
			return startFormatValidation;
		}
		const endFormatValidation = validateTimeFormat( endTime );
		if ( ! endFormatValidation.valid ) {
			return endFormatValidation;
		}
		const start = timeToMinutes( startTime );
		const end = timeToMinutes( endTime );
		if ( start === end ) {
			return {
				valid: false,
				message:
					s.startEndSame || 'Start and end times cannot be the same',
			};
		}
		return { valid: true };
	}

	function timeToMinutes( timeString ) {
		if ( ! timeString || timeString.length < 5 ) {
			return 0;
		}
		const parts = timeString.split( ':' );
		return parseInt( parts[ 0 ], 10 ) * 60 + parseInt( parts[ 1 ], 10 );
	}

	function checkOverlaps( dayWrapper, currentRow, excludeIndex ) {
		const currentStart = currentRow.querySelector(
			'.radplapag-program-start'
		).value;
		const currentEnd = currentRow.querySelector(
			'.radplapag-program-end'
		).value;
		if ( ! currentStart || ! currentEnd ) {
			return { valid: true };
		}
		const allRows = dayWrapper.querySelectorAll( '.radplapag-program-row' );
		const currentStartMin = timeToMinutes( currentStart );
		const currentEndMin = timeToMinutes( currentEnd );

		for ( let i = 0; i < allRows.length; i++ ) {
			if ( i === excludeIndex ) {
				continue;
			}
			const row = allRows[ i ];
			if ( window.getComputedStyle( row ).display === 'none' ) {
				continue;
			}
			const otherStart = row.querySelector(
				'.radplapag-program-start'
			).value;
			const otherEnd = row.querySelector(
				'.radplapag-program-end'
			).value;
			if ( ! otherStart || ! otherEnd ) {
				continue;
			}
			const otherStartMin = timeToMinutes( otherStart );
			const otherEndMin = timeToMinutes( otherEnd );
			let currentEndForOverlap = currentEndMin;
			let otherEndForOverlap = otherEndMin;
			if ( currentEndMin <= currentStartMin ) {
				currentEndForOverlap = 24 * 60;
			}
			if ( otherEndMin <= otherStartMin ) {
				otherEndForOverlap = 24 * 60;
			}
			if (
				currentStartMin < otherEndForOverlap &&
				currentEndForOverlap > otherStartMin
			) {
				const otherSel = row.querySelector( '.radplapag-program-id' );
				let otherName =
					otherSel && otherSel.options[ otherSel.selectedIndex ]
						? otherSel.options[ otherSel.selectedIndex ].text
						: s.unnamedProgram || 'Unnamed program';
				if ( ! otherName ) {
					otherName = s.unnamedProgram || 'Unnamed program';
				}
				const dayKey = dayWrapper.getAttribute( 'data-day' );
				const formattedMessage = formatOverlapMessage(
					otherName,
					dayKey,
					otherStart,
					otherEnd
				);
				return {
					valid: false,
					message: (
						s.timeSlotOverlapsWithMessage ||
						'This time slot overlaps with: %s'
					).replace( '%s', formattedMessage ),
				};
			}
		}
		return { valid: true };
	}

	function checkCrossDayOverlaps( programRow ) {
		const startInput = programRow.querySelector(
			'.radplapag-program-start'
		);
		const endInput = programRow.querySelector( '.radplapag-program-end' );
		const programIdSelect = programRow.querySelector(
			'.radplapag-program-id'
		);
		if ( ! startInput || ! endInput || ! programIdSelect ) {
			return { valid: true };
		}
		const start = startInput.value;
		const end = endInput.value;
		const programId = programIdSelect.value;
		const name = programIdSelect.options[ programIdSelect.selectedIndex ]
			? programIdSelect.options[ programIdSelect.selectedIndex ].text
			: '';
		if ( ! start || ! end || ! programId ) {
			return { valid: true };
		}
		const startMin = timeToMinutes( start );
		const endMin = timeToMinutes( end );
		if ( endMin > startMin ) {
			return { valid: true };
		}
		const scheduleWrapper = programRow.closest(
			'.radplapag-schedule-wrapper'
		);
		if ( ! scheduleWrapper ) {
			return { valid: true };
		}
		const currentDayWrapper = programRow.closest(
			'.radplapag-schedule-day'
		);
		if ( ! currentDayWrapper ) {
			return { valid: true };
		}
		const currentDay = currentDayWrapper.getAttribute( 'data-day' );
		if ( ! currentDay ) {
			return { valid: true };
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
		const nextDay = dayMap[ currentDay ];
		if ( ! nextDay ) {
			return { valid: true };
		}
		const nextDayWrapper = scheduleWrapper.querySelector(
			'.radplapag-schedule-day[data-day="' + nextDay + '"]'
		);
		if ( ! nextDayWrapper ) {
			return { valid: true };
		}
		const nextDayRows = nextDayWrapper.querySelectorAll(
			'.radplapag-program-row'
		);
		for ( let i = 0; i < nextDayRows.length; i++ ) {
			const nextRow = nextDayRows[ i ];
			if ( window.getComputedStyle( nextRow ).display === 'none' ) {
				continue;
			}
			const nextStartInput = nextRow.querySelector(
				'.radplapag-program-start'
			);
			const nextEndInput = nextRow.querySelector(
				'.radplapag-program-end'
			);
			const nextProgramIdSelect = nextRow.querySelector(
				'.radplapag-program-id'
			);
			if ( ! nextStartInput || ! nextEndInput || ! nextProgramIdSelect ) {
				continue;
			}
			const nextStart = nextStartInput.value;
			const nextEnd = nextEndInput.value;
			const nextProgramId = nextProgramIdSelect.value;
			const nextName = nextProgramIdSelect.options[
				nextProgramIdSelect.selectedIndex
			]
				? nextProgramIdSelect.options[
						nextProgramIdSelect.selectedIndex
					].text
				: '';
			if ( ! nextStart || ! nextEnd || ! nextProgramId ) {
				continue;
			}
			const nextStartMin = timeToMinutes( nextStart );
			if ( endMin > nextStartMin ) {
				const nextFormattedMessage = formatOverlapMessage(
					nextName,
					nextDay,
					nextStart,
					nextEnd
				);
				const currentFormattedMessage = formatOverlapMessage(
					name,
					currentDay,
					start,
					end
				);
				showProgramError(
					nextRow,
					(
						s.timeSlotOverlapsWithMessage ||
						'This time slot overlaps with: %s'
					).replace( '%s', currentFormattedMessage )
				);
				return {
					valid: false,
					message: (
						s.timeSlotOverlapsWithMessage ||
						'This time slot overlaps with: %s'
					).replace( '%s', nextFormattedMessage ),
				};
			}
		}
		return { valid: true };
	}

	function validateProgramRow( programRow ) {
		const programIdSelect = programRow.querySelector(
			'.radplapag-program-id'
		);
		const programId = programIdSelect ? programIdSelect.value : '';
		const start = programRow.querySelector( '.radplapag-program-start' )
			? programRow.querySelector( '.radplapag-program-start' ).value
			: '';
		const end = programRow.querySelector( '.radplapag-program-end' )
			? programRow.querySelector( '.radplapag-program-end' ).value
			: '';
		const hasData = programId || start || end;
		if ( ! hasData ) {
			clearProgramError( programRow );
			return { valid: true, isEmpty: true };
		}
		if ( ( start || end ) && ! programId ) {
			const errorMessage =
				s.pleaseSelectProgram || 'Please select a program.';
			showProgramError( programRow, errorMessage );
			return { valid: false, message: errorMessage };
		}
		if ( programId ) {
			const found = programsList.some( function ( p ) {
				return String( p.id ) === String( programId );
			} );
			if ( ! found ) {
				const errMsg =
					s.pleaseSelectProgram || 'Please select a valid program.';
				showProgramError( programRow, errMsg );
				return { valid: false, message: errMsg };
			}
		}
		if ( start ) {
			const startFormatValidation = validateTimeFormat( start );
			if ( ! startFormatValidation.valid ) {
				showProgramError( programRow, startFormatValidation.message );
				return { valid: false, message: startFormatValidation.message };
			}
		}
		if ( end ) {
			const endFormatValidation = validateTimeFormat( end );
			if ( ! endFormatValidation.valid ) {
				showProgramError( programRow, endFormatValidation.message );
				return { valid: false, message: endFormatValidation.message };
			}
		}
		if ( start && end ) {
			const timeRangeValidation = validateTimeRange( start, end );
			if ( ! timeRangeValidation.valid ) {
				showProgramError( programRow, timeRangeValidation.message );
				return { valid: false, message: timeRangeValidation.message };
			}
		}
		if ( ! programId || ! start || ! end ) {
			const errMsg = s.allFieldsRequired || 'All fields are required.';
			showProgramError( programRow, errMsg );
			return { valid: false, message: errMsg };
		}
		const dayWrapper = programRow.closest( '.radplapag-schedule-day' );
		const allRows = dayWrapper.querySelectorAll( '.radplapag-program-row' );
		const currentIndex = Array.prototype.indexOf.call(
			allRows,
			programRow
		);
		const overlapCheck = checkOverlaps(
			dayWrapper,
			programRow,
			currentIndex
		);
		if ( ! overlapCheck.valid ) {
			showProgramError( programRow, overlapCheck.message );
			return { valid: false, message: overlapCheck.message };
		}
		const crossDayOverlapCheck = checkCrossDayOverlaps( programRow );
		if ( ! crossDayOverlapCheck.valid ) {
			showProgramError( programRow, crossDayOverlapCheck.message );
			return { valid: false, message: crossDayOverlapCheck.message };
		}
		const prevDayOverlapCheck = checkPrevDayCrossOverlaps( programRow );
		if ( ! prevDayOverlapCheck.valid ) {
			showProgramError( programRow, prevDayOverlapCheck.message );
			return { valid: false, message: prevDayOverlapCheck.message };
		}
		clearProgramError( programRow );
		return { valid: true };
	}

	function checkPrevDayCrossOverlaps( programRow ) {
		const startInput = programRow.querySelector(
			'.radplapag-program-start'
		);
		const endInput = programRow.querySelector( '.radplapag-program-end' );
		const programIdSelect = programRow.querySelector(
			'.radplapag-program-id'
		);
		if ( ! startInput || ! endInput || ! programIdSelect ) {
			return { valid: true };
		}
		const start = startInput.value;
		const end = endInput.value;
		const programId = programIdSelect.value;
		const name = programIdSelect.options[ programIdSelect.selectedIndex ]
			? programIdSelect.options[ programIdSelect.selectedIndex ].text
			: '';
		if ( ! start || ! end || ! programId ) {
			return { valid: true };
		}
		const scheduleWrapper = programRow.closest(
			'.radplapag-schedule-wrapper'
		);
		if ( ! scheduleWrapper ) {
			return { valid: true };
		}
		const currentDayWrapper = programRow.closest(
			'.radplapag-schedule-day'
		);
		if ( ! currentDayWrapper ) {
			return { valid: true };
		}
		const currentDay = currentDayWrapper.getAttribute( 'data-day' );
		if ( ! currentDay ) {
			return { valid: true };
		}
		const prevDayMap = {
			monday: 'sunday',
			tuesday: 'monday',
			wednesday: 'tuesday',
			thursday: 'wednesday',
			friday: 'thursday',
			saturday: 'friday',
			sunday: 'saturday',
		};
		const prevDay = prevDayMap[ currentDay ];
		if ( ! prevDay ) {
			return { valid: true };
		}
		const prevDayWrapper = scheduleWrapper.querySelector(
			'.radplapag-schedule-day[data-day="' + prevDay + '"]'
		);
		if ( ! prevDayWrapper ) {
			return { valid: true };
		}
		const prevDayRows = prevDayWrapper.querySelectorAll(
			'.radplapag-program-row'
		);
		const startMin = timeToMinutes( start );
		for ( let i = 0; i < prevDayRows.length; i++ ) {
			const prevRow = prevDayRows[ i ];
			if ( window.getComputedStyle( prevRow ).display === 'none' ) {
				continue;
			}
			const prevStartInput = prevRow.querySelector(
				'.radplapag-program-start'
			);
			const prevEndInput = prevRow.querySelector(
				'.radplapag-program-end'
			);
			const prevProgramIdSelect = prevRow.querySelector(
				'.radplapag-program-id'
			);
			if ( ! prevStartInput || ! prevEndInput || ! prevProgramIdSelect ) {
				continue;
			}
			const prevStart = prevStartInput.value;
			const prevEnd = prevEndInput.value;
			const prevProgramId = prevProgramIdSelect.value;
			const prevName = prevProgramIdSelect.options[
				prevProgramIdSelect.selectedIndex
			]
				? prevProgramIdSelect.options[
						prevProgramIdSelect.selectedIndex
					].text
				: '';
			if ( ! prevStart || ! prevEnd || ! prevProgramId ) {
				continue;
			}
			const prevStartMin = timeToMinutes( prevStart );
			const prevEndMin = timeToMinutes( prevEnd );
			if ( prevEndMin > prevStartMin ) {
				continue;
			}
			if ( prevEndMin > startMin ) {
				const prevFormattedMessage = formatOverlapMessage(
					prevName,
					prevDay,
					prevStart,
					prevEnd
				);
				const currentFormattedMessage = formatOverlapMessage(
					name,
					currentDay,
					start,
					end
				);
				showProgramError(
					prevRow,
					(
						s.timeSlotOverlapsWithMessage ||
						'This time slot overlaps with: %s'
					).replace( '%s', currentFormattedMessage )
				);
				return {
					valid: false,
					message: (
						s.timeSlotOverlapsWithMessage ||
						'This time slot overlaps with: %s'
					).replace( '%s', prevFormattedMessage ),
				};
			}
		}
		return { valid: true };
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

	function buildProgramSelectHtml( day, nextIndex ) {
		const selectProgramOpt = s.selectProgram || 'Select Radio Show';
		let opts = '<option value="">' + selectProgramOpt + '</option>';
		programsList.forEach( function ( p ) {
			const id =
				p.id !== null && p.id !== undefined ? String( p.id ) : '';
			const name = p.name ? String( p.name ) : '';
			if ( id !== '' && name !== '' ) {
				opts +=
					'<option value="' +
					id.replace( /"/g, '&quot;' ) +
					'">' +
					name
						.replace( /</g, '&lt;' )
						.replace( />/g, '&gt;' )
						.replace( /"/g, '&quot;' ) +
					'</option>';
			}
		} );
		const nameAttr =
			'radplapag_station_schedule[' +
			day +
			'][' +
			nextIndex +
			'][program_id]';
		return (
			'<select name="' +
			nameAttr +
			'" class="radplapag-program-id" style="width: 200px; margin-right: 24px;">' +
			opts +
			'</select>'
		);
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
					const selectHtml = buildProgramSelectHtml( day, nextIndex );
					const toLabel = s.to || 'to';
					const removeTimeSlot =
						s.removeTimeSlot || 'Remove Time Slot';
					const rerunLabel = s.scheduleRerun || 'Rerun';
					const startName =
						'radplapag_station_schedule[' +
						day +
						'][' +
						nextIndex +
						'][start]';
					const endName =
						'radplapag_station_schedule[' +
						day +
						'][' +
						nextIndex +
						'][end]';
					const isRerunName =
						'radplapag_station_schedule[' +
						day +
						'][' +
						nextIndex +
						'][is_rerun]';
					const newRow = document.createElement( 'div' );
					newRow.className = 'radplapag-program-row';
					newRow.setAttribute( 'data-program-index', nextIndex );
					newRow.innerHTML =
						selectHtml +
						'<input type="time" name="' +
						startName +
						'" value="" class="radplapag-program-start" style="width: 100px; margin-right: 5px;">' +
						'<span style="margin-right: 5px;"> ' +
						toLabel +
						' </span>' +
						'<input type="time" name="' +
						endName +
						'" value="" class="radplapag-program-end" style="width: 100px; margin-right: 10px;">' +
						'<label class="radplapag-program-is-rerun-label" style="margin-right: 10px;"><input type="checkbox" name="' +
						isRerunName +
						'" value="1" class="radplapag-program-is-rerun"> ' +
						rerunLabel +
						'</label>' +
						'<div class="radplapag-schedule-remove-cell"><a href="#" class="submitdelete radplapag-remove-program">' +
						removeTimeSlot +
						'</a></div>' +
						'<div class="radplapag-program-error-message" style="display: none;"></div>';
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
				container
					.querySelectorAll( '.radplapag-program-row' )
					.forEach( function ( row ) {
						if (
							window.getComputedStyle( row ).display === 'none'
						) {
							return;
						}
						const validation = validateProgramRow( row );
						if ( ! validation.valid ) {
							hasErrors = true;
							if ( ! firstErrorElement ) {
								firstErrorElement = row;
							}
						}
					} );
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
