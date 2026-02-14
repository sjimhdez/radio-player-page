(function () {
  var l10n = window.radplapagAdmin || {};
  var maxStations = l10n.maxStations != null ? l10n.maxStations : 10;
  var s = l10n.strings || {};
  var container = document.getElementById("radplapag-stations-container");
  var addBtn = document.getElementById("radplapag-add-station-btn");

  function updateAddButton() {
    var visibleStations = 0;
    if (!container) return;
    container
      .querySelectorAll(".radplapag-station-row")
      .forEach(function (row) {
        var style = window.getComputedStyle(row);
        if (style.display !== "none") {
          visibleStations++;
        }
      });

    if (addBtn) {
      if (visibleStations < maxStations) {
        addBtn.style.display = "inline-block";
      } else {
        addBtn.style.display = "none";
      }
    }
  }

  function updatePageOptions() {
    if (!container) return;
    var selectedPages = [];
    container
      .querySelectorAll(".radplapag-player-page")
      .forEach(function (select) {
        if (select.value) {
          selectedPages.push(select.value);
        }
      });

    container
      .querySelectorAll(".radplapag-player-page")
      .forEach(function (select) {
        var currentValue = select.value;
        Array.from(select.options).forEach(function (option) {
          if (option.value && option.value !== currentValue) {
            option.disabled = selectedPages.indexOf(option.value) !== -1;
          } else {
            option.disabled = false;
          }
        });
      });
  }

  function removeStation(index) {
    if (!container) return;
    var row = container.querySelector(
      '.radplapag-station-row[data-index="' + index + '"]',
    );
    if (row) {
      var urlInput = row.querySelector(".radplapag-stream-url");
      var pageSelect = row.querySelector(".radplapag-player-page");
      var titleInput = row.querySelector(".radplapag-station-title-input");

      if (urlInput) urlInput.value = "";
      if (pageSelect) pageSelect.value = "";
      if (titleInput) titleInput.value = "";

      ["player_page", "stream_url", "station_title"].forEach(
        function (fieldName) {
          var fieldTr = row.querySelector('tr[data-field="' + fieldName + '"]');
          if (fieldTr) {
            clearFieldError(fieldTr);
          }
        },
      );

      row
        .querySelectorAll(".radplapag-image-upload-wrapper")
        .forEach(function (wrapper) {
          var idEl = wrapper.querySelector(".radplapag-image-id");
          var preview = wrapper.querySelector(".radplapag-image-preview");
          var removeBtnEl = wrapper.querySelector(
            ".radplapag-remove-image-btn",
          );
          if (idEl) idEl.value = "";
          if (preview) preview.innerHTML = "";
          if (removeBtnEl) removeBtnEl.style.display = "none";
        });

      row.style.display = "none";
      updateAddButton();
      updatePageOptions();
    }
  }

  function addStation() {
    if (!container) return;
    var hiddenRows = Array.prototype.slice
      .call(container.querySelectorAll(".radplapag-station-row"))
      .filter(function (row) {
        return window.getComputedStyle(row).display === "none";
      });

    if (hiddenRows.length > 0) {
      var row = hiddenRows[0];
      row.style.display = "";
      var title = row.querySelector(".radplapag-station-title");
      if (title) {
        var visibleCount = 0;
        container
          .querySelectorAll(".radplapag-station-row")
          .forEach(function (r) {
            if (window.getComputedStyle(r).display !== "none") {
              visibleCount++;
            }
          });
        title.textContent = (s.stationNumberFormat || "Station %d").replace(
          "%d",
          String(visibleCount),
        );
      }
      updateAddButton();
      updatePageOptions();
    }
  }

  function initImageUpload() {
    var file_frame;
    if (!container) return;

    container.addEventListener("click", function (e) {
      if (e.target.classList.contains("radplapag-upload-btn")) {
        e.preventDefault();
        var wrapper = e.target.closest(".radplapag-image-upload-wrapper");
        var inputId = wrapper.querySelector(".radplapag-image-id");
        var preview = wrapper.querySelector(".radplapag-image-preview");
        var removeBtn = wrapper.querySelector(".radplapag-remove-image-btn");

        if (file_frame) {
          file_frame.open();
          return;
        }

        var frameTitle = s.selectImage || "Select Image";
        var frameButtonText = s.selectImage || "Select Image";
        file_frame = wp.media.frames.file_frame = wp.media({
          title: frameTitle,
          button: { text: frameButtonText },
          multiple: false,
        });

        file_frame.on("select", function () {
          var attachment = file_frame.state().get("selection").first().toJSON();
          inputId.value = attachment.id;
          preview.innerHTML =
            '<img src="' +
            attachment.url +
            '" alt="" style="max-width:150px;max-height:150px;display:block;">';
          removeBtn.style.display = "inline-block";
          file_frame = null;
        });

        file_frame.open();
      }

      if (e.target.classList.contains("radplapag-remove-image-btn")) {
        e.preventDefault();
        var wrapper = e.target.closest(".radplapag-image-upload-wrapper");
        var idEl = wrapper.querySelector(".radplapag-image-id");
        var previewEl = wrapper.querySelector(".radplapag-image-preview");
        if (idEl) idEl.value = "";
        if (previewEl) previewEl.innerHTML = "";
        e.target.style.display = "none";
      }
    });
  }

  if (addBtn) {
    addBtn.addEventListener("click", addStation);
  }

  if (container) {
    container
      .querySelectorAll(".radplapag-remove-station")
      .forEach(function (btn) {
        btn.addEventListener("click", function () {
          var index = this.getAttribute("data-index");
          removeStation(index);
        });
      });

    container
      .querySelectorAll(".radplapag-player-page")
      .forEach(function (select) {
        select.addEventListener("change", updatePageOptions);
      });
  }

  var stationFieldMessages = {
    streamUrlRequired: s.streamUrlRequired || "This field is required.",
    streamUrlInvalid: s.streamUrlInvalid || "Please enter a valid URL.",
    playerPageRequired: s.playerPageRequired || "This field is required.",
    stationTitleMax:
      s.stationTitleMax || "Station name must be 64 characters or less.",
  };

  function showFieldError(fieldTr, message) {
    var td = fieldTr.querySelector("td:last-child") || fieldTr.cells[1];
    if (!td) return;
    var input = td.querySelector("input, select");
    if (input) input.classList.add("radplapag-error");
    td.classList.add("radplapag-error");
    var existing = td.querySelector(".radplapag-field-error-message");
    if (existing) {
      existing.textContent = message;
      existing.classList.add("show");
    } else {
      var errorMsg = document.createElement("div");
      errorMsg.className = "radplapag-field-error-message show";
      errorMsg.textContent = message;
      td.appendChild(errorMsg);
    }
  }

  function clearFieldError(fieldTr) {
    var td = fieldTr.querySelector("td:last-child") || fieldTr.cells[1];
    if (!td) return;
    var input = td.querySelector("input, select");
    if (input) input.classList.remove("radplapag-error");
    td.classList.remove("radplapag-error");
    var existing = td.querySelector(".radplapag-field-error-message");
    if (existing) existing.remove();
  }

  function validateStreamUrl(value, isRequired) {
    var trimmed = (value || "").trim();
    if (isRequired && !trimmed) {
      return { valid: false, message: stationFieldMessages.streamUrlRequired };
    }
    if (trimmed) {
      try {
        new URL(trimmed);
      } catch (err) {
        return { valid: false, message: stationFieldMessages.streamUrlInvalid };
      }
    }
    return { valid: true };
  }

  function validatePlayerPage(value, isRequired) {
    if (isRequired && (!value || value === "")) {
      return { valid: false, message: stationFieldMessages.playerPageRequired };
    }
    return { valid: true };
  }

  function validateStationTitle(value) {
    if (value && value.length > 64) {
      return { valid: false, message: stationFieldMessages.stationTitleMax };
    }
    return { valid: true };
  }

  function validateStationRow(stationRow) {
    if (window.getComputedStyle(stationRow).display === "none") {
      return { valid: true };
    }
    var fields = ["player_page", "stream_url", "station_title"];
    for (var f = 0; f < fields.length; f++) {
      var fieldName = fields[f];
      var fieldTr = stationRow.querySelector(
        'tr[data-field="' + fieldName + '"]',
      );
      if (!fieldTr) continue;
      var td = fieldTr.querySelector("td:last-child") || fieldTr.cells[1];
      if (!td) continue;
      var input = td.querySelector("input, select");
      var value = input ? (input.value || "").trim() : "";
      if (fieldName === "player_page") value = input ? input.value : "";
      var result;
      if (fieldName === "player_page") {
        result = validatePlayerPage(value, true);
      } else if (fieldName === "stream_url") {
        result = validateStreamUrl(value, true);
      } else {
        result = validateStationTitle(value);
      }
      if (!result.valid) {
        showFieldError(fieldTr, result.message);
        return { valid: false, firstErrorTr: fieldTr };
      }
      clearFieldError(fieldTr);
    }
    return { valid: true };
  }

  if (container) {
    container.addEventListener("focusout", function (e) {
      var target = e.target;
      if (!target || !target.classList) return;
      var fieldTr = target.closest ? target.closest("tr[data-field]") : null;
      if (!fieldTr) return;
      var stationRow = target.closest(".radplapag-station-row");
      if (!stationRow || window.getComputedStyle(stationRow).display === "none")
        return;
      var fieldName = fieldTr.getAttribute("data-field");
      if (
        !fieldName ||
        ["player_page", "stream_url", "station_title"].indexOf(fieldName) === -1
      )
        return;
      var value = (target.value || "").trim();
      if (fieldName === "player_page") value = target.value || "";
      var result;
      if (fieldName === "player_page") {
        result = validatePlayerPage(value, true);
      } else if (fieldName === "stream_url") {
        result = validateStreamUrl(value, true);
      } else {
        result = validateStationTitle(value);
      }
      if (!result.valid) {
        showFieldError(fieldTr, result.message);
      } else {
        clearFieldError(fieldTr);
      }
    });
  }

  function setupProgramDefinitionGroupValidation(defRow) {
    defRow.addEventListener("focusout", function (e) {
      var relatedTarget = e.relatedTarget;
      var isStillInGroup = relatedTarget && defRow.contains(relatedTarget);
      if (!isStillInGroup) {
        setTimeout(function () {
          if (!defRow.parentNode) return;
          var activeElement = document.activeElement;
          if (!defRow.contains(activeElement)) {
            validateProgramDefinitionRow(defRow);
          }
        }, 10);
      }
    });
    var nameInput = defRow.querySelector(".radplapag-program-definition-name");
    if (nameInput) {
      nameInput.addEventListener("input", function () {
        var stationRow = defRow.closest(".radplapag-station-row");
        var stationIndex = stationRow
          ? stationRow.getAttribute("data-index")
          : null;
        if (stationIndex !== null) syncProgramSelects(stationIndex);
      });
    }
  }

  if (container) {
    container
      .querySelectorAll(".radplapag-program-definition-row")
      .forEach(function (defRow) {
        setupProgramDefinitionGroupValidation(defRow);
      });
  }

  var dayLabels = {
    monday: s.monday || "Monday",
    tuesday: s.tuesday || "Tuesday",
    wednesday: s.wednesday || "Wednesday",
    thursday: s.thursday || "Thursday",
    friday: s.friday || "Friday",
    saturday: s.saturday || "Saturday",
    sunday: s.sunday || "Sunday",
  };

  function formatOverlapMessage(programName, dayKey, startTime, endTime) {
    var dayLabel = dayLabels[dayKey] || dayKey;
    var timeRange = startTime + " - " + endTime;
    return programName + " (" + dayLabel + ", " + timeRange + ")";
  }

  function validateTimeFormat(timeString) {
    var timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeString || !timeRegex.test(timeString)) {
      return {
        valid: false,
        message:
          s.invalidTimeFormat ||
          "Invalid time format. Times must be in HH:MM format.",
      };
    }
    return { valid: true };
  }

  function validateTimeRange(startTime, endTime) {
    if (!startTime || !endTime) {
      return {
        valid: false,
        message: s.completeTimeFields || "Please complete all time fields.",
      };
    }
    var startFormatValidation = validateTimeFormat(startTime);
    if (!startFormatValidation.valid) return startFormatValidation;
    var endFormatValidation = validateTimeFormat(endTime);
    if (!endFormatValidation.valid) return endFormatValidation;
    var start = timeToMinutes(startTime);
    var end = timeToMinutes(endTime);
    if (start === end) {
      return {
        valid: false,
        message: s.startEndSame || "Start and end times cannot be the same",
      };
    }
    return { valid: true };
  }

  function timeToMinutes(timeString) {
    if (!timeString || timeString.length < 5) return 0;
    var parts = timeString.split(":");
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  function checkOverlaps(dayWrapper, currentRow, excludeIndex) {
    var allRows = dayWrapper.querySelectorAll(".radplapag-program-row");
    var currentStart = currentRow.querySelector(
      ".radplapag-program-start",
    ).value;
    var currentEnd = currentRow.querySelector(".radplapag-program-end").value;
    if (!currentStart || !currentEnd) return { valid: true };
    var currentStartMin = timeToMinutes(currentStart);
    var currentEndMin = timeToMinutes(currentEnd);

    for (var i = 0; i < allRows.length; i++) {
      if (i === excludeIndex) continue;
      var row = allRows[i];
      if (window.getComputedStyle(row).display === "none") continue;
      var otherStart = row.querySelector(".radplapag-program-start").value;
      var otherEnd = row.querySelector(".radplapag-program-end").value;
      if (!otherStart || !otherEnd) continue;
      var otherStartMin = timeToMinutes(otherStart);
      var otherEndMin = timeToMinutes(otherEnd);
      var currentEndForOverlap = currentEndMin;
      var otherEndForOverlap = otherEndMin;
      if (currentEndMin <= currentStartMin) currentEndForOverlap = 24 * 60;
      if (otherEndMin <= otherStartMin) otherEndForOverlap = 24 * 60;
      if (
        currentStartMin < otherEndForOverlap &&
        currentEndForOverlap > otherStartMin
      ) {
        var otherSel = row.querySelector(".radplapag-program-id");
        var otherName =
          otherSel && otherSel.options[otherSel.selectedIndex]
            ? otherSel.options[otherSel.selectedIndex].text
            : s.unnamedProgram || "Unnamed program";
        if (!otherName) otherName = s.unnamedProgram || "Unnamed program";
        var dayKey = dayWrapper.getAttribute("data-day");
        var formattedMessage = formatOverlapMessage(
          otherName,
          dayKey,
          otherStart,
          otherEnd,
        );
        return {
          valid: false,
          message: (
            s.timeSlotOverlapsWithMessage || "This time slot overlaps with: %s"
          ).replace("%s", formattedMessage),
        };
      }
    }
    return { valid: true };
  }

  function checkCrossDayOverlaps(programRow) {
    var startInput = programRow.querySelector(".radplapag-program-start");
    var endInput = programRow.querySelector(".radplapag-program-end");
    var programIdSelect = programRow.querySelector(".radplapag-program-id");
    if (!startInput || !endInput || !programIdSelect) return { valid: true };
    var start = startInput.value;
    var end = endInput.value;
    var programId = programIdSelect.value;
    var name = programIdSelect.options[programIdSelect.selectedIndex]
      ? programIdSelect.options[programIdSelect.selectedIndex].text
      : "";
    if (!start || !end || !programId) return { valid: true };
    var startMin = timeToMinutes(start);
    var endMin = timeToMinutes(end);
    if (endMin > startMin) return { valid: true };
    var scheduleWrapper = programRow.closest(".radplapag-schedule-wrapper");
    if (!scheduleWrapper) return { valid: true };
    var currentDayWrapper = programRow.closest(".radplapag-schedule-day");
    if (!currentDayWrapper) return { valid: true };
    var currentDay = currentDayWrapper.getAttribute("data-day");
    if (!currentDay) return { valid: true };
    var dayMap = {
      monday: "tuesday",
      tuesday: "wednesday",
      wednesday: "thursday",
      thursday: "friday",
      friday: "saturday",
      saturday: "sunday",
      sunday: "monday",
    };
    var nextDay = dayMap[currentDay];
    if (!nextDay) return { valid: true };
    var nextDayWrapper = scheduleWrapper.querySelector(
      '.radplapag-schedule-day[data-day="' + nextDay + '"]',
    );
    if (!nextDayWrapper) return { valid: true };
    var nextDayRows = nextDayWrapper.querySelectorAll(".radplapag-program-row");
    for (var i = 0; i < nextDayRows.length; i++) {
      var nextRow = nextDayRows[i];
      if (window.getComputedStyle(nextRow).display === "none") continue;
      var nextStartInput = nextRow.querySelector(".radplapag-program-start");
      var nextEndInput = nextRow.querySelector(".radplapag-program-end");
      var nextProgramIdSelect = nextRow.querySelector(".radplapag-program-id");
      if (!nextStartInput || !nextEndInput || !nextProgramIdSelect) continue;
      var nextStart = nextStartInput.value;
      var nextEnd = nextEndInput.value;
      var nextProgramId = nextProgramIdSelect.value;
      var nextName = nextProgramIdSelect.options[
        nextProgramIdSelect.selectedIndex
      ]
        ? nextProgramIdSelect.options[nextProgramIdSelect.selectedIndex].text
        : "";
      if (!nextStart || !nextEnd || !nextProgramId) continue;
      var nextStartMin = timeToMinutes(nextStart);
      var nextEndMin = timeToMinutes(nextEnd);
      var nextEndForOverlap = nextEndMin;
      if (nextEndMin <= nextStartMin) nextEndForOverlap = 24 * 60;
      if (endMin > nextStartMin) {
        var nextFormattedMessage = formatOverlapMessage(
          nextName,
          nextDay,
          nextStart,
          nextEnd,
        );
        var currentFormattedMessage = formatOverlapMessage(
          name,
          currentDay,
          start,
          end,
        );
        showProgramError(
          nextRow,
          (
            s.timeSlotOverlapsWithMessage || "This time slot overlaps with: %s"
          ).replace("%s", currentFormattedMessage),
        );
        return {
          valid: false,
          message: (
            s.timeSlotOverlapsWithMessage || "This time slot overlaps with: %s"
          ).replace("%s", nextFormattedMessage),
        };
      }
    }
    return { valid: true };
  }

  function validateProgramRow(programRow) {
    var programIdSelect = programRow.querySelector(".radplapag-program-id");
    var programId = programIdSelect ? programIdSelect.value : "";
    var start = programRow.querySelector(".radplapag-program-start")
      ? programRow.querySelector(".radplapag-program-start").value
      : "";
    var end = programRow.querySelector(".radplapag-program-end")
      ? programRow.querySelector(".radplapag-program-end").value
      : "";
    var hasData = programId || start || end;
    if (!hasData) {
      clearProgramError(programRow);
      return { valid: true, isEmpty: true };
    }
    if ((start || end) && !programId) {
      var errorMessage = s.pleaseSelectProgram || "Please select a program.";
      showProgramError(programRow, errorMessage);
      return { valid: false, message: errorMessage };
    }
    if (programId) {
      var stationRow = programRow.closest(".radplapag-station-row");
      var definitionsList = stationRow
        ? stationRow.querySelector(".radplapag-program-definitions-list")
        : null;
      var defRows = definitionsList
        ? definitionsList.querySelectorAll(".radplapag-program-definition-row")
        : [];
      // Find program definition by ID (not by index)
      var foundDefRow = null;
      for (var i = 0; i < defRows.length; i++) {
        var idField = defRows[i].querySelector(".radplapag-program-id-field");
        if (idField && idField.value === programId) {
          foundDefRow = defRows[i];
          break;
        }
      }
      if (foundDefRow) {
        var nameInput = foundDefRow.querySelector(".radplapag-program-definition-name");
        var programName = nameInput ? nameInput.value.trim() : "";
        if (programName === "") {
          var errMsg =
            s.pleaseSelectProgramWithName ||
            "Please select a program and enter a name. Program name is required for the schedule.";
          showProgramError(programRow, errMsg);
          return { valid: false, message: errMsg };
        }
      }
    }
    if (start) {
      var startFormatValidation = validateTimeFormat(start);
      if (!startFormatValidation.valid) {
        showProgramError(programRow, startFormatValidation.message);
        return { valid: false, message: startFormatValidation.message };
      }
    }
    if (end) {
      var endFormatValidation = validateTimeFormat(end);
      if (!endFormatValidation.valid) {
        showProgramError(programRow, endFormatValidation.message);
        return { valid: false, message: endFormatValidation.message };
      }
    }
    if (start && end) {
      var timeRangeValidation = validateTimeRange(start, end);
      if (!timeRangeValidation.valid) {
        showProgramError(programRow, timeRangeValidation.message);
        return { valid: false, message: timeRangeValidation.message };
      }
    }
    if (!programId || !start || !end) {
      var errMsg = s.allFieldsRequired || "All fields are required.";
      showProgramError(programRow, errMsg);
      return { valid: false, message: errMsg };
    }
    var dayWrapper = programRow.closest(".radplapag-schedule-day");
    var allRows = dayWrapper.querySelectorAll(".radplapag-program-row");
    var currentIndex = Array.prototype.indexOf.call(allRows, programRow);
    var overlapCheck = checkOverlaps(dayWrapper, programRow, currentIndex);
    if (!overlapCheck.valid) {
      showProgramError(programRow, overlapCheck.message);
      return { valid: false, message: overlapCheck.message };
    }
    var crossDayOverlapCheck = checkCrossDayOverlaps(programRow);
    if (!crossDayOverlapCheck.valid) {
      showProgramError(programRow, crossDayOverlapCheck.message);
      return { valid: false, message: crossDayOverlapCheck.message };
    }
    var prevDayOverlapCheck = checkPrevDayCrossOverlaps(programRow);
    if (!prevDayOverlapCheck.valid) {
      showProgramError(programRow, prevDayOverlapCheck.message);
      return { valid: false, message: prevDayOverlapCheck.message };
    }
    clearProgramError(programRow);
    return { valid: true };
  }

  function checkPrevDayCrossOverlaps(programRow) {
    var startInput = programRow.querySelector(".radplapag-program-start");
    var endInput = programRow.querySelector(".radplapag-program-end");
    var programIdSelect = programRow.querySelector(".radplapag-program-id");
    if (!startInput || !endInput || !programIdSelect) return { valid: true };
    var start = startInput.value;
    var end = endInput.value;
    var programId = programIdSelect.value;
    var name = programIdSelect.options[programIdSelect.selectedIndex]
      ? programIdSelect.options[programIdSelect.selectedIndex].text
      : "";
    if (!start || !end || !programId) return { valid: true };
    var startMin = timeToMinutes(start);
    var endMin = timeToMinutes(end);
    var scheduleWrapper = programRow.closest(".radplapag-schedule-wrapper");
    if (!scheduleWrapper) return { valid: true };
    var currentDayWrapper = programRow.closest(".radplapag-schedule-day");
    if (!currentDayWrapper) return { valid: true };
    var currentDay = currentDayWrapper.getAttribute("data-day");
    if (!currentDay) return { valid: true };
    var prevDayMap = {
      monday: "sunday",
      tuesday: "monday",
      wednesday: "tuesday",
      thursday: "wednesday",
      friday: "thursday",
      saturday: "friday",
      sunday: "saturday",
    };
    var prevDay = prevDayMap[currentDay];
    if (!prevDay) return { valid: true };
    var prevDayWrapper = scheduleWrapper.querySelector(
      '.radplapag-schedule-day[data-day="' + prevDay + '"]',
    );
    if (!prevDayWrapper) return { valid: true };
    var prevDayRows = prevDayWrapper.querySelectorAll(".radplapag-program-row");
    for (var i = 0; i < prevDayRows.length; i++) {
      var prevRow = prevDayRows[i];
      if (window.getComputedStyle(prevRow).display === "none") continue;
      var prevStartInput = prevRow.querySelector(".radplapag-program-start");
      var prevEndInput = prevRow.querySelector(".radplapag-program-end");
      var prevProgramIdSelect = prevRow.querySelector(".radplapag-program-id");
      if (!prevStartInput || !prevEndInput || !prevProgramIdSelect) continue;
      var prevStart = prevStartInput.value;
      var prevEnd = prevEndInput.value;
      var prevProgramId = prevProgramIdSelect.value;
      var prevName = prevProgramIdSelect.options[
        prevProgramIdSelect.selectedIndex
      ]
        ? prevProgramIdSelect.options[prevProgramIdSelect.selectedIndex].text
        : "";
      if (!prevStart || !prevEnd || !prevProgramId) continue;
      var prevStartMin = timeToMinutes(prevStart);
      var prevEndMin = timeToMinutes(prevEnd);
      if (prevEndMin > prevStartMin) continue;
      if (prevEndMin > startMin) {
        var prevFormattedMessage = formatOverlapMessage(
          prevName,
          prevDay,
          prevStart,
          prevEnd,
        );
        var currentFormattedMessage = formatOverlapMessage(
          name,
          currentDay,
          start,
          end,
        );
        showProgramError(
          prevRow,
          (
            s.timeSlotOverlapsWithMessage || "This time slot overlaps with: %s"
          ).replace("%s", currentFormattedMessage),
        );
        return {
          valid: false,
          message: (
            s.timeSlotOverlapsWithMessage || "This time slot overlaps with: %s"
          ).replace("%s", prevFormattedMessage),
        };
      }
    }
    return { valid: true };
  }

  function showProgramError(programRow, message) {
    programRow.classList.add("radplapag-error");
    var startInput = programRow.querySelector(".radplapag-program-start");
    var endInput = programRow.querySelector(".radplapag-program-end");
    var programIdSelect = programRow.querySelector(".radplapag-program-id");
    if (startInput) startInput.classList.add("radplapag-error");
    if (endInput) endInput.classList.add("radplapag-error");
    if (programIdSelect) programIdSelect.classList.add("radplapag-error");
    var existingError = programRow.querySelector(
      ".radplapag-program-error-message",
    );
    if (existingError) existingError.remove();
    var errorMsg = document.createElement("div");
    errorMsg.className = "radplapag-program-error-message show";
    errorMsg.textContent = message;
    programRow.appendChild(errorMsg);
  }

  function clearProgramError(programRow) {
    programRow.classList.remove("radplapag-error");
    var inputs = programRow.querySelectorAll("input, select");
    inputs.forEach(function (el) {
      el.classList.remove("radplapag-error");
    });
    var errorMsg = programRow.querySelector(".radplapag-program-error-message");
    if (errorMsg) errorMsg.remove();
  }

  function revalidateAdjacentDays(programRow, scheduleWrapper, dayWrapper) {
    if (!scheduleWrapper || !dayWrapper) return;
    var currentDay = dayWrapper.getAttribute("data-day");
    if (!currentDay) return;
    var dayMap = {
      monday: "tuesday",
      tuesday: "wednesday",
      wednesday: "thursday",
      thursday: "friday",
      friday: "saturday",
      saturday: "sunday",
      sunday: "monday",
    };
    var prevDayMap = {
      monday: "sunday",
      tuesday: "monday",
      wednesday: "tuesday",
      thursday: "wednesday",
      friday: "thursday",
      saturday: "friday",
      sunday: "saturday",
    };
    var nextDay = dayMap[currentDay];
    if (nextDay) {
      var nextDayWrapper = scheduleWrapper.querySelector(
        '.radplapag-schedule-day[data-day="' + nextDay + '"]',
      );
      if (nextDayWrapper) {
        nextDayWrapper
          .querySelectorAll(".radplapag-program-row")
          .forEach(function (row) {
            if (window.getComputedStyle(row).display !== "none")
              validateProgramRow(row);
          });
      }
    }
    var prevDay = prevDayMap[currentDay];
    if (prevDay) {
      var prevDayWrapper = scheduleWrapper.querySelector(
        '.radplapag-schedule-day[data-day="' + prevDay + '"]',
      );
      if (prevDayWrapper) {
        prevDayWrapper
          .querySelectorAll(".radplapag-program-row")
          .forEach(function (row) {
            if (window.getComputedStyle(row).display !== "none")
              validateProgramRow(row);
          });
      }
    }
  }

  function syncProgramSelects(stationIndex) {
    if (!container) return;
    var stationRow = container.querySelector(
      '.radplapag-station-row[data-index="' + stationIndex + '"]',
    );
    if (!stationRow) return;
    var definitionsList = stationRow.querySelector(
      ".radplapag-program-definitions-list",
    );
    if (!definitionsList) return;
    var defRows = definitionsList.querySelectorAll(
      ".radplapag-program-definition-row",
    );
    var programs = [];
    var validIds = {};
    defRows.forEach(function (row) {
      var nameInput = row.querySelector(".radplapag-program-definition-name");
      var idField = row.querySelector(".radplapag-program-id-field");
      var name = nameInput ? nameInput.value.trim() : "";
      var programId = idField ? idField.value.trim() : "";
      if (name !== "" && programId !== "") {
        programs.push({ id: programId, name: name });
        validIds[programId] = true;
      }
    });
    var scheduleWrapper = stationRow.querySelector(
      ".radplapag-schedule-wrapper",
    );
    if (!scheduleWrapper) return;
    var selects = scheduleWrapper.querySelectorAll(".radplapag-program-id");
    var selectProgramOpt = s.selectProgram || "Select Program";
    selects.forEach(function (sel) {
      var currentVal = sel.value;
      sel.innerHTML = '<option value="">' + selectProgramOpt + "</option>";
      programs.forEach(function (p) {
        var opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        sel.appendChild(opt);
      });
      if (currentVal !== "" && validIds[currentVal]) {
        sel.value = currentVal;
      } else {
        sel.value = "";
      }
    });
  }

  function buildProgramSelectHtml(stationIndex, day, nextIndex) {
    if (!container) return "";
    var stationRow = container.querySelector(
      '.radplapag-station-row[data-index="' + stationIndex + '"]',
    );
    if (!stationRow) return "";
    var definitionsList = stationRow.querySelector(
      ".radplapag-program-definitions-list",
    );
    if (!definitionsList) return "";
    var defRows = definitionsList.querySelectorAll(
      ".radplapag-program-definition-row",
    );
    var selectProgramOpt = s.selectProgram || "Select Program";
    var opts = '<option value="">' + selectProgramOpt + "</option>";
    defRows.forEach(function (row) {
      var nameInput = row.querySelector(".radplapag-program-definition-name");
      var idField = row.querySelector(".radplapag-program-id-field");
      var name = nameInput ? nameInput.value.trim() : "";
      var programId = idField ? idField.value.trim() : "";
      if (name !== "" && programId !== "") {
        opts +=
          '<option value="' +
          programId.replace(/"/g, "&quot;") +
          '">' +
          name
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;") +
          "</option>";
      }
    });
    return (
      '<select name="radplapag_settings[stations][' +
      stationIndex +
      "][schedule][" +
      day +
      "][" +
      nextIndex +
      '][program_id]" class="radplapag-program-id" style="width: 200px; margin-right: 24px;">' +
      opts +
      "</select>"
    );
  }

  function initScheduleManagement() {
    function sortProgramsByStartTime(programsList) {
      if (!programsList || !programsList.querySelectorAll) return;
      var rows = Array.prototype.slice.call(
        programsList.querySelectorAll(".radplapag-program-row"),
      );
      if (!rows || rows.length <= 1) return;
      rows.sort(function (a, b) {
        var startA =
          (a.querySelector(".radplapag-program-start") || {}).value || "";
        var startB =
          (b.querySelector(".radplapag-program-start") || {}).value || "";
        if (!startA && !startB) return 0;
        if (!startA) return 1;
        if (!startB) return -1;
        return startA.localeCompare(startB);
      });
      rows.forEach(function (row) {
        programsList.appendChild(row);
      });
    }

    function setupGroupValidation(programRow) {
      programRow.addEventListener("focusout", function (e) {
        var relatedTarget = e.relatedTarget;
        var isStillInGroup =
          relatedTarget && programRow.contains(relatedTarget);
        if (!isStillInGroup) {
          setTimeout(function () {
            if (!programRow.parentNode) return;
            var activeElement = document.activeElement;
            if (!programRow.contains(activeElement)) {
              validateProgramRow(programRow);
              var dayWrapper = programRow.closest(".radplapag-schedule-day");
              if (dayWrapper) {
                dayWrapper
                  .querySelectorAll(".radplapag-program-row")
                  .forEach(function (row) {
                    if (row !== programRow) validateProgramRow(row);
                  });
              }
              var scheduleWrapper = programRow.closest(
                ".radplapag-schedule-wrapper",
              );
              if (scheduleWrapper && dayWrapper)
                revalidateAdjacentDays(programRow, scheduleWrapper, dayWrapper);
              var programsList = dayWrapper.querySelector(
                ".radplapag-programs-list",
              );
              if (programsList) sortProgramsByStartTime(programsList);
            }
          }, 10);
        }
      });
    }

    if (container) {
      container
        .querySelectorAll(".radplapag-program-row")
        .forEach(function (programRow) {
          setupGroupValidation(programRow);
        });

      container.addEventListener("click", function (e) {
        if (e.target.classList.contains("radplapag-add-program")) {
          e.preventDefault();
          var day = e.target.getAttribute("data-day");
          var dayWrapper = e.target.closest(".radplapag-schedule-day");
          var programsList = dayWrapper
            ? dayWrapper.querySelector(".radplapag-programs-list")
            : null;
          if (!dayWrapper || !programsList) return;
          var stationIndex = e.target
            .closest(".radplapag-schedule-wrapper")
            .getAttribute("data-station-index");
          var existingPrograms = programsList.querySelectorAll(
            ".radplapag-program-row",
          );
          var nextIndex = existingPrograms ? existingPrograms.length : 0;
          var selectHtml = buildProgramSelectHtml(stationIndex, day, nextIndex);
          var toLabel = s.to || "to";
          var removeTimeSlot = s.removeTimeSlot || "Remove Time Slot";
          var newRow = document.createElement("div");
          newRow.className = "radplapag-program-row";
          newRow.setAttribute("data-program-index", nextIndex);
          newRow.innerHTML =
            selectHtml +
            '<input type="time" name="radplapag_settings[stations][' +
            stationIndex +
            "][schedule][" +
            day +
            "][" +
            nextIndex +
            '][start]" value="" class="radplapag-program-start" style="width: 100px; margin-right: 5px;">' +
            '<span style="margin-right: 5px;"> ' +
            toLabel +
            " </span>" +
            '<input type="time" name="radplapag_settings[stations][' +
            stationIndex +
            "][schedule][" +
            day +
            "][" +
            nextIndex +
            '][end]" value="" class="radplapag-program-end" style="width: 100px; margin-right: 10px;">' +
            '<div class="radplapag-schedule-remove-cell"><a href="#" class="submitdelete radplapag-remove-program">' +
            removeTimeSlot +
            "</a></div>" +
            '<div class="radplapag-program-error-message" style="display: none;"></div>';
          programsList.appendChild(newRow);
          setupGroupValidation(newRow);
        }

        if (e.target.classList.contains("radplapag-remove-program")) {
          e.preventDefault();
          var programRow = e.target.closest(".radplapag-program-row");
          if (programRow) {
            var dayWrapper = programRow.closest(".radplapag-schedule-day");
            var scheduleWrapper = programRow.closest(
              ".radplapag-schedule-wrapper",
            );
            programRow.remove();
            if (dayWrapper) {
              dayWrapper
                .querySelectorAll(".radplapag-program-row")
                .forEach(function (row) {
                  validateProgramRow(row);
                });
            }
            if (scheduleWrapper && dayWrapper) {
              var currentDay = dayWrapper.getAttribute("data-day");
              var days = [
                "monday",
                "tuesday",
                "wednesday",
                "thursday",
                "friday",
                "saturday",
                "sunday",
              ];
              var currentDayIndex = days.indexOf(currentDay);
              if (currentDayIndex < days.length - 1) {
                var nextDay = days[currentDayIndex + 1];
                var nextDayWrapper = scheduleWrapper.querySelector(
                  '.radplapag-schedule-day[data-day="' + nextDay + '"]',
                );
                if (nextDayWrapper)
                  nextDayWrapper
                    .querySelectorAll(".radplapag-program-row")
                    .forEach(function (row) {
                      validateProgramRow(row);
                    });
              }
              if (currentDayIndex > 0) {
                var prevDay = days[currentDayIndex - 1];
                var prevDayWrapper = scheduleWrapper.querySelector(
                  '.radplapag-schedule-day[data-day="' + prevDay + '"]',
                );
                if (prevDayWrapper)
                  prevDayWrapper
                    .querySelectorAll(".radplapag-program-row")
                    .forEach(function (row) {
                      validateProgramRow(row);
                    });
              }
            }
          }
        }
      });
    }
  }

  var form = document.getElementById("radplapag-settings-form");
  if (form && container) {
    form.addEventListener("submit", function (e) {
      var hasErrors = false;
      var firstErrorElement = null;
      container
        .querySelectorAll(".radplapag-station-row")
        .forEach(function (stationRow) {
          if (window.getComputedStyle(stationRow).display === "none") return;
          ["player_page", "stream_url", "station_title"].forEach(
            function (fieldName) {
              var fieldTr = stationRow.querySelector(
                'tr[data-field="' + fieldName + '"]',
              );
              if (fieldTr) clearFieldError(fieldTr);
            },
          );
        });
      container
        .querySelectorAll(".radplapag-station-row")
        .forEach(function (stationRow) {
          if (window.getComputedStyle(stationRow).display === "none") return;
          var validation = validateStationRow(stationRow);
          if (!validation.valid) {
            hasErrors = true;
            if (!firstErrorElement && validation.firstErrorTr)
              firstErrorElement = validation.firstErrorTr;
          }
        });
      container
        .querySelectorAll(".radplapag-program-definition-row")
        .forEach(function (defRow) {
          var stationRow = defRow.closest(".radplapag-station-row");
          if (
            !stationRow ||
            window.getComputedStyle(stationRow).display === "none"
          )
            return;
          var validation = validateProgramDefinitionRow(defRow);
          if (!validation.valid) {
            hasErrors = true;
            if (!firstErrorElement) firstErrorElement = defRow;
          }
        });
      container
        .querySelectorAll(".radplapag-program-row")
        .forEach(function (row) {
          if (window.getComputedStyle(row).display === "none") return;
          var validation = validateProgramRow(row);
          if (!validation.valid) {
            hasErrors = true;
            if (!firstErrorElement) firstErrorElement = row;
          }
        });
      if (hasErrors) {
        e.preventDefault();
        if (firstErrorElement)
          firstErrorElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        return false;
      }
    });
  }

  function initScheduleToggle() {
    if (!container) return;
    container.addEventListener("click", function (e) {
      if (e.target.closest(".radplapag-schedule-toggle")) {
        e.preventDefault();
        var toggle = e.target.closest(".radplapag-schedule-toggle");
        var stationIndex = toggle.getAttribute("data-station-index");
        var scheduleWrapper = container.querySelector(
          '.radplapag-schedule-wrapper[data-station-index="' +
            stationIndex +
            '"]',
        );
        if (!scheduleWrapper) return;
        var isExpanded = toggle.getAttribute("aria-expanded") === "true";
        var showLabel = s.showProgramSchedule || "Show Program Schedule";
        var hideLabel = s.hideProgramSchedule || "Hide Program Schedule";
        if (isExpanded) {
          scheduleWrapper.classList.add("radplapag-schedule-collapsed");
          toggle.setAttribute("aria-expanded", "false");
          toggle.innerHTML =
            '<span class="toggle-indicator" aria-hidden="true"></span>' +
            showLabel;
        } else {
          scheduleWrapper.classList.remove("radplapag-schedule-collapsed");
          toggle.setAttribute("aria-expanded", "true");
          toggle.innerHTML =
            '<span class="toggle-indicator" aria-hidden="true"></span>' +
            hideLabel;
        }
      }
    });
  }

  function initProgramsManagement() {
    if (!container) return;
    container.addEventListener("click", function (e) {
      if (e.target.closest(".radplapag-program-more-fields-toggle")) {
        e.preventDefault();
        var toggle = e.target.closest(".radplapag-program-more-fields-toggle");
        var programRow = toggle.closest(".radplapag-program-definition-row");
        if (!programRow) return;
        var extendedCell = programRow.querySelector(
          ".radplapag-program-definition-extended-cell",
        );
        if (!extendedCell) return;
        var wrapper = extendedCell.querySelector(
          ".radplapag-program-more-fields-wrapper",
        );
        if (!wrapper) return;
        var isExpanded = toggle.getAttribute("aria-expanded") === "true";
        var showLabel = s.showMoreFields || "Show more fields";
        var hideLabel = s.hideMoreFields || "Hide more fields";
        if (isExpanded) {
          wrapper.classList.add("radplapag-program-more-fields-collapsed");
          toggle.setAttribute("aria-expanded", "false");
          toggle.innerHTML =
            '<span class="toggle-indicator" aria-hidden="true"></span>' +
            showLabel;
        } else {
          wrapper.classList.remove("radplapag-program-more-fields-collapsed");
          toggle.setAttribute("aria-expanded", "true");
          toggle.innerHTML =
            '<span class="toggle-indicator" aria-hidden="true"></span>' +
            hideLabel;
        }
        return;
      }
      if (e.target.classList.contains("radplapag-add-program-definition")) {
        e.preventDefault();
        var stationIndex = e.target.getAttribute("data-station-index");
        var stationRow = container.querySelector(
          '.radplapag-station-row[data-index="' + stationIndex + '"]',
        );
        if (!stationRow) return;
        var list = stationRow.querySelector(
          ".radplapag-program-definitions-list",
        );
        if (!list) return;
        var defRows = list.querySelectorAll(
          ".radplapag-program-definition-row",
        );
        var nextIndex = defRows ? defRows.length : 0;
        // Generate unique ID for new program
        var newProgramId =
          "prog_" +
          Date.now() +
          "_" +
          Math.random().toString(36).substr(2, 9);
        var programNamePlaceholder = s.programName || "Program name";
        var programImageLabel = s.programImageLabel || "Program Image";
        var programDescriptionPlaceholder = s.programDescription || "e.g. Morning news with Howard Mallory and guests";
        var descriptionLabel = s.descriptionLabel || "Description";
        var programExtendedDescriptionPlaceholder =
          s.programExtendedDescription || "e.g. Join us every morning for in-depth interviews, breaking news analysis, and listener calls. Howard Mallory brings decades of experience to the microphone, covering local politics [...]";
        var extendedDescriptionLabel = s.extendedDescriptionLabel || "Extended Description";
        var showMoreFields = s.showMoreFields || "Show more fields";
        var hideMoreFields = s.hideMoreFields || "Hide more fields";
        var selectImage = s.selectImage || "Select Image";
        var removeImage = s.removeImage || "Remove Image";
        var recommendedProgramImageSize = s.recommendedProgramImageSize || "Recommended size: 256x256 pixels.";
        var removeProgram = s.removeProgram || "Remove Program";
        var newRow = document.createElement("div");
        newRow.className = "radplapag-program-definition-row";
        newRow.setAttribute("data-program-def-index", nextIndex);
        newRow.setAttribute("data-program-id", newProgramId);
        newRow.innerHTML =
          '<input type="hidden" name="radplapag_settings[stations][' +
          stationIndex +
          "][programs][" +
          nextIndex +
          '][id]" value="' +
          newProgramId.replace(/"/g, "&quot;") +
          '" class="radplapag-program-id-field">' +
          '<div class="radplapag-program-definition-line">' +
          '<div class="radplapag-program-definition-name-cell">' +
          '<input type="text" name="radplapag_settings[stations][' +
          stationIndex +
          "][programs][" +
          nextIndex +
          '][name]" value="" placeholder="' +
          programNamePlaceholder +
          '" class="radplapag-program-definition-name" maxlength="64" style="width: 200px;">' +
          '<button type="button" class="button-link radplapag-program-more-fields-toggle" aria-expanded="false">' +
          '<span class="toggle-indicator" aria-hidden="true"></span>' +
          showMoreFields +
          "</button>" +
          '<div class="radplapag-program-error-message" style="display: none;"></div>' +
          "</div>" +
          '<div class="radplapag-program-definition-remove-cell">' +
          '<a href="#" class="submitdelete radplapag-remove-program-definition" data-station-index="' +
          stationIndex +
          '" data-program-def-index="' +
          nextIndex +
          '">' +
          removeProgram +
          "</a>" +
          "</div>" +
          "</div>" +
          '<div class="radplapag-program-definition-extended-cell">' +
          '<div class="radplapag-program-more-fields-wrapper radplapag-program-more-fields-collapsed">' +
          '<div class="radplapag-program-more-fields-inner">' +
          '<div class="radplapag-field-group">' +
          '<div class="radplapag-field-label">' +
          programImageLabel +
          "</div>" +
          '<div class="radplapag-image-upload-wrapper">' +
          '<input type="hidden" name="radplapag_settings[stations][' +
          stationIndex +
          "][programs][" +
          nextIndex +
          '][logo_id]" value="0" class="radplapag-image-id">' +
          '<div class="radplapag-image-preview"></div>' +
          '<div class="radplapag-image-buttons">' +
          '<button type="button" class="button radplapag-upload-btn">' +
          selectImage +
          "</button>" +
          '<button type="button" class="button radplapag-remove-image-btn" style="display:none;">' +
          removeImage +
          "</button>" +
          "</div>" +
          '<p class="description">' +
          recommendedProgramImageSize +
          "</p>" +
          "</div>" +
          "</div>" +
          '<div class="radplapag-field-group">' +
          '<div class="radplapag-field-label">' +
          descriptionLabel +
          "</div>" +
          '<input type="text" name="radplapag_settings[stations][' +
          stationIndex +
          "][programs][" +
          nextIndex +
          '][description]" value="" placeholder="' +
          programDescriptionPlaceholder +
          '" class="radplapag-program-definition-description" maxlength="256">' +
          "</div>" +
          '<div class="radplapag-field-group">' +
          '<div class="radplapag-field-label">' +
          extendedDescriptionLabel +
          "</div>" +
          '<textarea name="radplapag_settings[stations][' +
          stationIndex +
          "][programs][" +
          nextIndex +
          '][extended_description]" rows="3" maxlength="512" placeholder="' +
          programExtendedDescriptionPlaceholder +
          '" class="radplapag-program-definition-extended-description"></textarea>' +
          "</div>" +
          "</div>" +
          "</div>" +
          "</div>";
        list.appendChild(newRow);
        setupProgramDefinitionGroupValidation(newRow);
        syncProgramSelects(stationIndex);
      }

      if (e.target.classList.contains("radplapag-remove-program-definition")) {
        e.preventDefault();
        var stationIndex = e.target.getAttribute("data-station-index");
        var stationRow = container.querySelector(
          '.radplapag-station-row[data-index="' + stationIndex + '"]',
        );
        if (!stationRow) return;
        var row = e.target.closest(".radplapag-program-definition-row");
        if (!row) return;
        row.remove();
        var list = stationRow.querySelector(
          ".radplapag-program-definitions-list",
        );
        if (!list) return;
        var defRows = list.querySelectorAll(
          ".radplapag-program-definition-row",
        );
        defRows.forEach(function (r, idx) {
          r.setAttribute("data-program-def-index", idx);
          var logoInput = r.querySelector(
            ".radplapag-image-upload-wrapper input.radplapag-image-id",
          );
          var nameInput = r.querySelector(".radplapag-program-definition-name");
          var descInput = r.querySelector(
            ".radplapag-program-definition-description",
          );
          var extendedDescInput = r.querySelector(
            ".radplapag-program-definition-extended-description",
          );
          var idField = r.querySelector(".radplapag-program-id-field");
          var removeBtn = r.querySelector(
            ".radplapag-remove-program-definition",
          );
          if (logoInput)
            logoInput.name =
              "radplapag_settings[stations][" +
              stationIndex +
              "][programs][" +
              idx +
              "][logo_id]";
          if (nameInput)
            nameInput.name =
              "radplapag_settings[stations][" +
              stationIndex +
              "][programs][" +
              idx +
              "][name]";
          if (descInput)
            descInput.name =
              "radplapag_settings[stations][" +
              stationIndex +
              "][programs][" +
              idx +
              "][description]";
          if (extendedDescInput)
            extendedDescInput.name =
              "radplapag_settings[stations][" +
              stationIndex +
              "][programs][" +
              idx +
              "][extended_description]";
          if (idField)
            idField.name =
              "radplapag_settings[stations][" +
              stationIndex +
              "][programs][" +
              idx +
              "][id]";
          if (removeBtn) removeBtn.setAttribute("data-program-def-index", idx);
        });
        syncProgramSelects(stationIndex);
      }
    });
  }

  function validateProgramDefinitionRow(defRow) {
    var nameInput = defRow.querySelector(".radplapag-program-definition-name");
    var logoInput = defRow.querySelector(
      ".radplapag-image-upload-wrapper input.radplapag-image-id",
    );
    var name = nameInput ? nameInput.value.trim() : "";
    var hasLogo = logoInput && parseInt(logoInput.value, 10) > 0;
    if (!name && !hasLogo) {
      clearProgramDefinitionError(defRow);
      return { valid: true };
    }
    if (!name) {
      showProgramDefinitionError(
        defRow,
        s.programNameRequired ||
          "Program name is required. Enter a name to use this program in the schedule.",
      );
      return { valid: false };
    }
    clearProgramDefinitionError(defRow);
    return { valid: true };
  }

  function showProgramDefinitionError(defRow, message) {
    defRow.classList.add("radplapag-error");
    var nameInput = defRow.querySelector(".radplapag-program-definition-name");
    if (nameInput) nameInput.classList.add("radplapag-error");
    var errorMsg = defRow.querySelector(".radplapag-program-error-message");
    if (errorMsg) {
      errorMsg.textContent = message;
      errorMsg.className = "radplapag-program-error-message show";
    } else {
      errorMsg = document.createElement("div");
      errorMsg.className = "radplapag-program-error-message show";
      errorMsg.textContent = message;
      if (nameInput && nameInput.nextSibling) {
        defRow.insertBefore(errorMsg, nameInput.nextSibling);
      } else {
        defRow.appendChild(errorMsg);
      }
    }
  }

  function clearProgramDefinitionError(defRow) {
    defRow.classList.remove("radplapag-error");
    var nameInput = defRow.querySelector(".radplapag-program-definition-name");
    if (nameInput) nameInput.classList.remove("radplapag-error");
    var errorMsg = defRow.querySelector(".radplapag-program-error-message");
    if (errorMsg) {
      errorMsg.textContent = "";
      errorMsg.className = "radplapag-program-error-message";
      errorMsg.style.display = "none";
    }
  }

  updateAddButton();
  updatePageOptions();
  initImageUpload();
  initScheduleManagement();
  initScheduleToggle();
  initProgramsManagement();
})();
