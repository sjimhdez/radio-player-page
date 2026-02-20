(function () {
  var l10n = window.radplapagAdmin || {};
  var programsList = l10n.programs || [];
  var s = l10n.strings || {};
  var container = document.getElementById("radplapag-station-cpt-container");
  var form = document.getElementById("post");

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

  if (container) {
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
      var found = programsList.some(function (p) {
        return String(p.id) === String(programId);
      });
      if (!found) {
        var errMsg = s.pleaseSelectProgram || "Please select a valid program.";
        showProgramError(programRow, errMsg);
        return { valid: false, message: errMsg };
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
    var selectProgramOpt = s.selectProgram || "Select Program";
    var opts = '<option value="">' + selectProgramOpt + "</option>";
    programsList.forEach(function (p) {
      var id = p.id != null ? String(p.id) : "";
      var name = p.name ? String(p.name) : "";
      if (id !== "" && name !== "") {
        opts +=
          '<option value="' +
          id.replace(/"/g, "&quot;") +
          '">' +
          name
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;") +
          "</option>";
      }
    });
    var nameAttr =
      "radplapag_station_schedule[" + day + "][" + nextIndex + "][program_id]";
    return (
      '<select name="' + nameAttr + '" class="radplapag-program-id" style="width: 200px; margin-right: 24px;">' +
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
          var startName =
            "radplapag_station_schedule[" + day + "][" + nextIndex + "][start]";
          var endName =
            "radplapag_station_schedule[" + day + "][" + nextIndex + "][end]";
          var newRow = document.createElement("div");
          newRow.className = "radplapag-program-row";
          newRow.setAttribute("data-program-index", nextIndex);
          newRow.innerHTML =
            selectHtml +
            '<input type="time" name="' + startName + '" value="" class="radplapag-program-start" style="width: 100px; margin-right: 5px;">' +
            '<span style="margin-right: 5px;"> ' +
            toLabel +
            " </span>" +
            '<input type="time" name="' + endName + '" value="" class="radplapag-program-end" style="width: 100px; margin-right: 10px;">' +
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

  if (form && container) {
    form.addEventListener("submit", function (e) {
      var hasErrors = false;
      var firstErrorElement = null;
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
    // Program definitions removed: programs are now CPT (RPP → Programs). Schedule dropdown uses radplapagAdmin.programs.
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

  updatePageOptions();
  initScheduleManagement();
  initScheduleToggle();
  initProgramsManagement();
})();
