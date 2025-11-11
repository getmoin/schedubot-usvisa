let country = window.location.href.split("/")[3];

function log(e) {
  return console.log(e), e;
}

// Note: ERR_BLOCKED_BY_CLIENT errors for external scripts (trustwave, newrelic)
// are from the visa website itself and blocked by ad blockers. They are harmless.

// REMOVED: reload() function had infinite recursion bug
// The code after window.location.reload() is unreachable
// This function is not needed - we use scheduled refresh instead

// Auto-continue on reschedule page
if (
  "Reschedule Appointment" ===
    document.querySelector("#main > div.subTitleBackground > div > div > div")
      ?.innerText &&
  "Continue" === document.getElementsByName("commit")[0]?.value
) {
  document.getElementsByName("commit")[0].click();
}

try {
  // Handle confirmed limit message
  if (document.getElementById("confirmed_limit_message")) {
    document.getElementById("confirmed_limit_message").checked = true;
    document.getElementsByName("commit")[0].click();
  }

  // Initialize variables - delay will be set dynamically
  let checkInterval = 1000; // Initial value, will be updated by getRandomDelay()
  let maxChecksPerCycle = 10; // MODIFIED: Always enabled (was license-restricted)
  let facilityId = window.localStorage.getItem("facilityId");
  let userEmail = window.localStorage.getItem("user_email");
  let remainingAttempts = window.localStorage.getItem("remainingAttempts");
  const monthsToCheck = remainingAttempts ? 1.7 * remainingAttempts : 12;
  let userId = window.localStorage.getItem("userId");
  let currentAppointmentDate = window.localStorage.getItem(
    "currentAppointmentDate"
  )
    ? new Date(window.localStorage.getItem("currentAppointmentDate"))
    : new Date(864000000000);
  let nearDate = currentAppointmentDate;

  // Control flags for start/stop
  let isRunning = window.localStorage.getItem("automationRunning") !== "false";
  let currentCheckingFacility = null;

  // V2 Enhancement: Tracking variables
  let bookingInProgress = false;
  let bookingAttempts = 0;
  let lastBookingError = null;
  const MAX_BOOKING_RETRIES = 3;
  const API_RETRY_ATTEMPTS = 3;

  // V2.1 Enhancement: Track last successful API call for proactive token refresh
  let lastSuccessfulApiCall = Date.now();
  const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes

  // V2 Enhancement: Audio alert system
  function playAlert(type) {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      if (type === 'found') {
        // Exciting sound for appointment found
        oscillator.frequency.value = 800;
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
        setTimeout(() => {
          const osc2 = audioContext.createOscillator();
          const gain2 = audioContext.createGain();
          osc2.connect(gain2);
          gain2.connect(audioContext.destination);
          osc2.frequency.value = 1000;
          gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
          osc2.start();
          osc2.stop(audioContext.currentTime + 0.2);
        }, 150);
      } else if (type === 'success') {
        // Success sound
        oscillator.frequency.value = 1200;
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
      } else if (type === 'error') {
        // Error sound
        oscillator.frequency.value = 300;
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.2);
      }
    } catch (e) {
      log(`Audio alert failed: ${e.message}`);
    }
  }

  // V2 Enhancement: Retry wrapper for API calls with 401 handling
  async function retryApiCall(apiFunction, retries = API_RETRY_ATTEMPTS) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await apiFunction();
      } catch (error) {
        log(`API call attempt ${attempt}/${retries} failed: ${error.message}`);

        // Check for 401 and refresh page if needed
        const canContinue = await handleApiError(error, "API retry");
        if (!canContinue) {
          // Page will refresh, stop retrying
          throw error;
        }

        if (attempt === retries) {
          throw error;
        }
        // Wait before retry: 1s, 2s, 3s
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  // V2 Enhancement: Session validation with auto-refresh
  async function validateSession() {
    try {
      const response = await fetch(
        `https://ais.usvisa-info.com/${country}/niv/schedule/${userId}/appointment`,
        {
          method: "HEAD",
          credentials: "include",
          redirect: "manual"
        }
      );

      // If redirected to login, session is invalid - refresh to get new token
      if (response.status === 302 || response.status === 401) {
        log("⚠️ SESSION EXPIRED - Refreshing page to get new token...");
        playAlert('error');

        // Refresh the page to get new session token
        setTimeout(() => {
          window.location.reload();
        }, 2000);

        return false;
      }

      return true;
    } catch (error) {
      log(`Session validation failed: ${error.message}`);
      return true; // Continue on error to avoid false positives
    }
  }

  // V2 Enhancement: Handle 401 errors in API calls with page refresh
  async function handleApiError(error, context = "API call") {
    log(`❌ ${context} error: ${error.message}`);

    // Check if it's a 401 error
    if (error.message.includes("401") || error.message.includes("Unauthorized")) {
      log("🔄 401 Unauthorized detected - Refreshing page to renew session...");
      playAlert('error');

      // Wait a bit then refresh to get new token
      setTimeout(() => {
        log("Refreshing page now...");
        window.location.reload();
      }, 3000);

      return false;
    }

    return true; // Continue for other errors
  }

  // Location mapping - ONLY the 3 locations we care about
  const locationMap = {
    "94": "Toronto",
    "89": "Calgary",
    "95": "Vancouver"
  };

  // Set default facilities if not already set
  if (!window.localStorage.getItem("facilitiesToCheck")) {
    const facilitiesToCheck = "94,89,95";
    window.localStorage.setItem("facilitiesToCheck", facilitiesToCheck);
  }

  // Configuration loaded from localStorage

  // Create progress popup element
  let progressPopup = document.createElement("div");
  progressPopup.id = "progressPopup";
  document.body.appendChild(progressPopup);

  // Handle maintenance page
  if (
    document.getElementsByTagName("h1")[0] &&
    document.getElementsByTagName("h1")[0].innerHTML.includes("Maintenance")
  ) {
    window.location.href = `https://ais.usvisa-info.com/${country}/niv/users/sign_in`;
  }

  // Handle facility selection - NO DYNAMIC DISCOVERY
  if (document.getElementById("appointments_consulate_appointment_facility_id")) {
    const facilityDropdown = document.getElementById("appointments_consulate_appointment_facility_id");

    if (facilityId) {
      facilityDropdown.value = facilityId;
    } else {
      facilityId = facilityDropdown.value;
    }

    facilityDropdown.onchange = (e) => {
      facilityId = facilityDropdown.value;
      window.localStorage.setItem("facilityId", facilityId);
    };
  }

  // Extract remaining attempts from page
  if (document.getElementById("confirmed_limit_message")) {
    const limitText = document.getElementsByTagName("p")[0].innerText;
    const attemptsMatch = limitText.match(/You have (\d+)/);
    if (attemptsMatch) {
      const attempts = parseInt(attemptsMatch[1], 10);
      window.localStorage.setItem("remainingAttempts", attempts);
    }
    document.getElementById("confirmed_limit_message").checked = true;
    document.getElementsByName("commit")[0].click();
  }

  // MODIFIED: Simplified progress popup - HARDCODED 3 locations only
  function updateProgressPopup(message, startDate, endDate, currentFacility = null, targetDate = null, bookingStatus = null) {
    const minDelay = window.localStorage.getItem("minDelay") || "5";
    const maxDelay = window.localStorage.getItem("maxDelay") || "30";
    const isRunning = window.localStorage.getItem("automationRunning") !== "false";

    // Helper function to sanitize text for safe HTML insertion
    function sanitizeText(text) {
      const div = document.createElement('div');
      div.textContent = String(text);
      return div.innerHTML;
    }

    // Get selected locations from localStorage
    const facilitiesStr = window.localStorage.getItem("facilitiesToCheck") || "94,89,95";
    const facilities = facilitiesStr.split(",").map(f => f.trim()).filter(f => f);
    const selectedLocations = facilities.map(id => locationMap[id] || `ID: ${id}`).join(", ");

    const currentLocationName = currentFacility ?
      (locationMap[currentFacility] || `ID: ${currentFacility}`) :
      "Not yet started";

    // Sanitize all inputs to prevent XSS
    const safeMessage = sanitizeText(message);
    const safeStartDate = sanitizeText(startDate);
    const safeEndDate = sanitizeText(endDate);
    const safeTargetDate = sanitizeText(targetDate || 'End date or current appointment');
    const safeLocationName = sanitizeText(currentLocationName);
    const safeMinDelay = sanitizeText(minDelay);
    const safeMaxDelay = sanitizeText(maxDelay);

    // No additional facilities help needed
    const facilitiesHelpHtml = ``;

    progressPopup.innerHTML = `
      <style>
        @keyframes blink {
          0% { opacity: 0; }
          50% { opacity: .5; }
          100% { opacity: 1; }
        }
        .control-btn {
          padding: 6px 12px;
          border: none;
          cursor: pointer;
          font-weight: bold;
          border-radius: 4px;
          margin-right: 4px;
        }
        .start-btn { background-color: #28a745; color: white; }
        .stop-btn { background-color: #dc3545; color: white; }
        .info-section {
          margin-top: 8px;
          padding: 6px;
          background-color: #f8f9fa;
          border-left: 3px solid #007bff;
          font-size: 13px;
        }
      </style>
      <div style="position: fixed; top: 0; left: 0; background-color: white; padding: 10px; border: 2px solid #007bff; z-index: 100000; width: 420px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); max-height: 90vh; overflow-y: auto;">
        <div style="font-weight: bold; color: #007bff; margin-bottom: 10px; font-size: 16px;">USA Visa Appointment Automation</div>

        <!-- Status Section -->
        <div class="info-section">
          <div style="font-weight: bold; margin-bottom: 4px;">Status: ${isRunning ? '<span style="color: green;">✓ RUNNING</span>' : '<span style="color: red;">⊗ STOPPED</span>'}</div>
          <div>${safeMessage}</div>
        </div>

        <!-- Current Activity Section -->
        <div class="info-section" style="border-left-color: #28a745;">
          <div style="font-weight: bold; margin-bottom: 4px;">Current Activity:</div>
          <div><strong>Checking Location:</strong> ${safeLocationName}</div>
          <div><strong>Looking for dates before:</strong> ${safeTargetDate}</div>
          <div><strong>Current appointment:</strong> ${sanitizeText(currentAppointmentDate.toLocaleDateString())}</div>
        </div>

        <!-- Booking Status Section (V2 Enhancement) -->
        ${bookingStatus ? `
        <div class="info-section" style="border-left-color: ${bookingStatus.type === 'success' ? '#28a745' : bookingStatus.type === 'error' ? '#dc3545' : '#ffc107'}; background-color: ${bookingStatus.type === 'success' ? '#d4edda' : bookingStatus.type === 'error' ? '#f8d7da' : '#fff3cd'};">
          <div style="font-weight: bold; margin-bottom: 4px;">
            ${bookingStatus.type === 'progress' ? '⏳' : bookingStatus.type === 'success' ? '✅' : '❌'}
            ${sanitizeText(bookingStatus.title)}
          </div>
          <div style="font-size: 12px;">${sanitizeText(bookingStatus.message)}</div>
          ${bookingStatus.attempts ? `<div style="font-size: 11px; margin-top: 4px;">Attempt: ${bookingStatus.attempts}/${MAX_BOOKING_RETRIES}</div>` : ''}
        </div>
        ` : ''}

        <!-- Locations Being Monitored -->
        <div class="info-section" style="border-left-color: #28a745;">
          <div style="font-weight: bold; margin-bottom: 4px;">Locations Being Monitored:</div>
          <div style="font-size: 16px; color: #28a745; font-weight: bold; margin-top: 4px;">${selectedLocations}</div>
          ${facilitiesHelpHtml}
        </div>

        <!-- Date Filters -->
        <div class="info-section">
          <div style="font-weight: bold; margin-bottom: 4px;">Date Filters (Optional):</div>
          <div style="margin-top: 4px;">
            <label style="display: inline-block; width: 80px;">Start Date:</label>
            <input type="text" id="startDate" placeholder="YYYY-MM-DD" autocomplete="off" value="${safeStartDate}" style="padding: 4px; width: 140px;" />
          </div>
          <div style="margin-top: 4px;">
            <label style="display: inline-block; width: 80px;">End Date:</label>
            <input type="text" id="endDate" placeholder="YYYY-MM-DD" autocomplete="off" value="${safeEndDate}" style="padding: 4px; width: 140px;" />
          </div>
        </div>

        <!-- Random Delay Settings -->
        <div class="info-section" style="border-left-color: #6f42c1;">
          <div style="font-weight: bold; margin-bottom: 4px;">Random Delay Settings:</div>
          <div style="margin-top: 4px;">
            <label style="display: inline-block; width: 80px;">Min (sec):</label>
            <input type="number" id="minDelay" value="${safeMinDelay}" min="1" max="300" style="padding: 4px; width: 60px;" />
            <label style="display: inline-block; width: 80px; margin-left: 10px;">Max (sec):</label>
            <input type="number" id="maxDelay" value="${safeMaxDelay}" min="1" max="300" style="padding: 4px; width: 60px;" />
          </div>
          <div style="margin-top: 2px; font-size: 11px; color: #6c757d;">Random delay between checks to avoid detection</div>
        </div>

        <!-- Auto-Booking Info -->
        <div class="info-section" style="border-left-color: #17a2b8;">
          <div style="font-weight: bold; margin-bottom: 4px;">Auto-Booking:</div>
          <div style="font-size: 12px;">✓ Will automatically book if a date is found that is:</div>
          <div style="font-size: 12px; margin-left: 15px;">• Earlier than your current appointment</div>
          <div style="font-size: 12px; margin-left: 15px;">• Before the end date (if specified)</div>
          <div style="font-size: 12px; margin-left: 15px;">• After the start date (if specified)</div>
        </div>

        <!-- Control Buttons -->
        <div style="margin-top: 10px; display: flex; gap: 8px;">
          <input type="button" id="startBtn" value="▶ START" class="control-btn start-btn" onclick="(() => {
            window.localStorage.setItem('automationRunning', 'true');
            window.location.reload();
          })()" ${isRunning ? 'disabled style=\"opacity: 0.5; cursor: not-allowed;\"' : ''} />

          <input type="button" id="stopBtn" value="⊗ STOP" class="control-btn stop-btn" onclick="(() => {
            window.localStorage.setItem('automationRunning', 'false');
            alert('Automation stopped. Click START to resume.');
            window.location.reload();
          })()" ${!isRunning ? 'disabled style=\"opacity: 0.5; cursor: not-allowed;\"' : ''} />

          <input type="button" id="saveSettings" value="💾 Save Settings" class="control-btn" style="background-color: #007bff; color: white; flex: 1;" onclick="(() => {
            window.localStorage.setItem('startDate', document.getElementById('startDate').value);
            window.localStorage.setItem('endDate', document.getElementById('endDate').value);
            window.localStorage.setItem('minDelay', document.getElementById('minDelay').value);
            window.localStorage.setItem('maxDelay', document.getElementById('maxDelay').value);
            alert('Settings saved successfully!');
          })()" />
        </div>

        <div style="margin-top: 8px;">
          <input type="button" id="differentAccount" value="Select Different Group" style="padding: 4px 8px; background-color: #6c757d; color: white; border: none; cursor: pointer; width: 100%;" onclick="(() => {
            window.localStorage.removeItem('userId');
            window.localStorage.removeItem('currentAppointmentDate');
            window.location.href = window.location.href.split('/niv/')[0] + '/niv/';
          })()" />
        </div>
      </div>
    `;
  }

  function addMonths(date, months) {
    var day = date.getDate();
    date.setMonth(date.getMonth() + +months);
    if (date.getDate() != day) {
      date.setDate(0);
    }
    return date;
  }

  async function getAppointmentTime(date, facilityIdOverride = null) {
    const facilityToUse = facilityIdOverride || facilityId;

    const response = await fetch(
      `https://ais.usvisa-info.com/${country}/niv/schedule/${userId}/appointment/times/${facilityToUse}.json?date=${date}&appointments[expedite]=false`,
      {
        headers: {
          accept: "application/json, text/javascript, */*; q=0.01",
          "accept-language": "en-GB,en;q=0.9",
          "sec-ch-ua":
            '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "x-requested-with": "XMLHttpRequest",
        },
        referrer: `https://ais.usvisa-info.com/${country}/niv/schedule/${userId}/appointment?confirmed_limit_message=1&commit=Continue`,
        referrerPolicy: "strict-origin-when-cross-origin",
        body: null,
        method: "GET",
        mode: "cors",
        credentials: "include",
      }
    );

    if (response.status === 304) {
      return null;
    }

    if (!response.ok) {
      const error = new Error(`Network response was not ok: ${response.status}`);

      // Handle 401 errors specifically
      if (response.status === 401) {
        await handleApiError(error, "getAppointmentTime");
      }

      throw error;
    }

    const reader = response.body.getReader();
    let result = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += new TextDecoder().decode(value);
    }

    return JSON.parse(result);
  }

  async function checkFacilityForAppointments(facilityIdToCheck, startDateFilter, endDateFilter) {
    try {
      currentCheckingFacility = facilityIdToCheck;
      const locationName = locationMap[facilityIdToCheck] || `ID: ${facilityIdToCheck}`;
      log(`Checking ${locationName} (Facility ID: ${facilityIdToCheck})...`);

      const response = await fetch(
        `https://ais.usvisa-info.com/${country}/niv/schedule/${userId}/appointment/days/${facilityIdToCheck}.json?appointments[expedite]=false`,
        {
          headers: {
            accept: "application/json, text/javascript, */*; q=0.01",
            "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
            "sec-ch-ua":
              '"Chromium";v="130", "Google Chrome";v="130", "Not-A.Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-requested-with": "XMLHttpRequest",
          },
          referrer: `https://ais.usvisa-info.com/${country}/niv/schedule/${userId}/appointment`,
          referrerPolicy: "strict-origin-when-cross-origin",
          body: null,
          method: "GET",
          mode: "cors",
          credentials: "include",
        }
      );

      if (response.status === 304) {
        log(`${locationName}: No changes (304)`);
        return null;
      }

      if (!response.ok) {
        log(`${locationName}: Error ${response.status}`);

        // Handle 401 errors specifically
        if (response.status === 401) {
          await handleApiError(new Error(`Network response was not ok: ${response.status}`), `${locationName} check`);
        }

        return null;
      }

      const reader = response.body.getReader();
      let result = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += new TextDecoder().decode(value);
      }

      const availableDates = JSON.parse(result);

      // V2.1: Track successful API call
      lastSuccessfulApiCall = Date.now();

      // FIXED: Add null/array check to prevent crashes
      if (!Array.isArray(availableDates) || availableDates.length === 0) {
        log(`${locationName}: No appointments available`);
        return null;
      }

      const firstAvailable = availableDates[0];

      if (firstAvailable && firstAvailable.date) {
        log(`${locationName}: First available appointment: ${firstAvailable.date}`);

        const availableDate = new Date(firstAvailable.date);
        let maxDate = addMonths(new Date(), monthsToCheck);

        // Apply date filters if provided
        if (startDateFilter?.getTime() && endDateFilter?.getTime()) {
          maxDate = endDateFilter;
        }

        // Check if available date is better than current appointment
        const isEarlier = availableDate.getTime() < currentAppointmentDate.getTime();
        const inRange = startDateFilter?.getTime() && endDateFilter?.getTime()
          ? startDateFilter.getTime() <= availableDate.getTime() &&
            availableDate.getTime() <= endDateFilter.getTime()
          : availableDate.getTime() <= maxDate.getTime();

        if (isEarlier && inRange) {
          log(`*** ${locationName}: FOUND BETTER DATE - ${firstAvailable.date} ***`);
          return { facilityId: facilityIdToCheck, date: firstAvailable.date, locationName };
        } else {
          log(`${locationName}: Date ${firstAvailable.date} doesn't meet criteria`);
        }
      } else {
        log(`${locationName}: No appointments available`);
      }

      return null;
    } catch (error) {
      console.error(`Error checking facility ${facilityIdToCheck}:`, error);
      return null;
    }
  }

  // V2 Enhancement: Advanced booking function with retry and multiple time slots
  async function attemptBooking(appointment, retryCount = 0) {
    bookingInProgress = true;
    bookingAttempts = retryCount + 1;

    const statusUpdate = {
      type: 'progress',
      title: 'Booking Appointment',
      message: `Trying to book ${appointment.locationName} on ${appointment.date}`,
      attempts: bookingAttempts
    };

    updateProgressPopup(
      `Attempting to book appointment (Try ${bookingAttempts}/${MAX_BOOKING_RETRIES})...`,
      window.localStorage.getItem("startDate") || "",
      window.localStorage.getItem("endDate") || "",
      appointment.facilityId,
      appointment.date,
      statusUpdate
    );

    try {
      log(`🎯 BOOKING ATTEMPT ${bookingAttempts}/${MAX_BOOKING_RETRIES} - ${appointment.locationName} on ${appointment.date}`);

      // Update facility dropdown
      const facilityDropdown = document.getElementById("appointments_consulate_appointment_facility_id");
      if (facilityDropdown) {
        facilityDropdown.value = appointment.facilityId;
        facilityId = appointment.facilityId;
      }

      // Update date field
      const dateField = document.getElementById("appointments_consulate_appointment_date");
      if (!dateField) {
        throw new Error("Date field not found on page");
      }
      dateField.value = appointment.date;
      if (dateField.click) dateField.click();

      // Wait a bit for page to update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Fetch available times with retry logic
      const timesData = await retryApiCall(async () => {
        return await getAppointmentTime(appointment.date, appointment.facilityId);
      });

      if (!timesData || !timesData.available_times || timesData.available_times.length === 0) {
        throw new Error("No time slots available for this date");
      }

      log(`✓ Found ${timesData.available_times.length} time slot(s): ${timesData.available_times.join(", ")}`);

      // V2 Enhancement: Try ALL available time slots, not just the first one
      for (let timeIndex = 0; timeIndex < timesData.available_times.length; timeIndex++) {
        const timeSlot = timesData.available_times[timeIndex];
        log(`Trying time slot ${timeIndex + 1}/${timesData.available_times.length}: ${timeSlot}`);

        try {
          const timeDropdown = document.getElementById("appointments_consulate_appointment_time");
          if (!timeDropdown) {
            throw new Error("Time dropdown not found");
          }

          // Clear existing options and add new one
          timeDropdown.innerHTML = '<option value="">Select Time</option>';
          const timeOption = document.createElement("option");
          timeOption.value = timeSlot;
          timeOption.textContent = timeSlot;
          timeDropdown.appendChild(timeOption);
          timeDropdown.value = timeSlot;

          log(`Selected time: ${timeSlot}`);

          // Try to submit
          const submitButton = document.getElementById("appointments_submit");
          if (!submitButton) {
            throw new Error("Submit button not found");
          }

          submitButton.disabled = false;
          submitButton.click();

          // Wait for confirmation dialog
          await new Promise(resolve => setTimeout(resolve, 1500));

          const confirmButton = document.querySelector("a.alert");
          if (confirmButton) {
            log("✅ BOOKING SUCCESSFUL! Confirming...");
            playAlert('success');

            const successStatus = {
              type: 'success',
              title: 'Booking Successful!',
              message: `Booked ${appointment.locationName} on ${appointment.date} at ${timeSlot}`,
              attempts: bookingAttempts
            };

            updateProgressPopup(
              "✅ Booking confirmed! Redirecting...",
              window.localStorage.getItem("startDate") || "",
              window.localStorage.getItem("endDate") || "",
              appointment.facilityId,
              appointment.date,
              successStatus
            );

            confirmButton.click();

            setTimeout(() => {
              document.location.href = `https://ais.usvisa-info.com/${country}/niv/account`;
            }, 3000);

            bookingInProgress = false;
            return true; // Success!
          }

          // If no confirm button, try next time slot
          log(`Time slot ${timeSlot} didn't work, trying next...`);

        } catch (timeSlotError) {
          log(`Error with time slot ${timeSlot}: ${timeSlotError.message}`);
          // Continue to next time slot
        }
      }

      // If we exhausted all time slots, throw error
      throw new Error("All time slots failed or were unavailable");

    } catch (error) {
      lastBookingError = error.message;
      log(`❌ Booking attempt ${bookingAttempts} failed: ${error.message}`);

      // Retry if we haven't exceeded max retries
      if (bookingAttempts < MAX_BOOKING_RETRIES) {
        log(`Retrying in 2 seconds... (${bookingAttempts}/${MAX_BOOKING_RETRIES})`);
        playAlert('error');

        const retryStatus = {
          type: 'error',
          title: 'Booking Failed - Retrying',
          message: `${error.message}. Retrying...`,
          attempts: bookingAttempts
        };

        updateProgressPopup(
          `Booking failed. Retrying (${bookingAttempts}/${MAX_BOOKING_RETRIES})...`,
          window.localStorage.getItem("startDate") || "",
          window.localStorage.getItem("endDate") || "",
          appointment.facilityId,
          appointment.date,
          retryStatus
        );

        await new Promise(resolve => setTimeout(resolve, 2000));
        return await attemptBooking(appointment, bookingAttempts);
      } else {
        log(`❌ BOOKING FAILED after ${MAX_BOOKING_RETRIES} attempts`);
        playAlert('error');

        const failStatus = {
          type: 'error',
          title: 'Booking Failed',
          message: `Could not book after ${MAX_BOOKING_RETRIES} attempts: ${error.message}`,
          attempts: bookingAttempts
        };

        updateProgressPopup(
          `Booking failed after ${MAX_BOOKING_RETRIES} attempts`,
          window.localStorage.getItem("startDate") || "",
          window.localStorage.getItem("endDate") || "",
          appointment.facilityId,
          appointment.date,
          failStatus
        );

        bookingInProgress = false;
        return false;
      }
    }
  }

  async function readStreamToJSON(startDateFilter, endDateFilter) {
    if (maxChecksPerCycle === 10) {
      try {
        // V2.1 Enhancement: Proactive token refresh if too much time has passed
        const timeSinceLastSuccess = Date.now() - lastSuccessfulApiCall;
        if (timeSinceLastSuccess > TOKEN_REFRESH_THRESHOLD) {
          log(`⏱️ ${Math.floor(timeSinceLastSuccess / 60000)} minutes since last successful API call - refreshing to renew token...`);
          setTimeout(() => {
            window.location.reload();
          }, 2000);
          return;
        }

        // V2 Enhancement: Validate session before checking
        const sessionValid = await validateSession();
        if (!sessionValid) {
          log("Session invalid, page will refresh");
          return;
        }

        // Get the list of facilities to check
        const facilitiesStr = window.localStorage.getItem("facilitiesToCheck") || "94,89,95";
        const facilities = facilitiesStr.split(",").map(f => f.trim()).filter(f => f);

        log("=".repeat(50));
        log(`🔍 Checking ${facilities.length} location(s): ${facilities.map(id => locationMap[id] || id).join(", ")}`);
        log("=".repeat(50));

        // V2 Enhancement: Parallel facility checking for SPEED!
        log("🚀 Running parallel checks for maximum speed...");
        const checkPromises = facilities.map(facilityToCheck =>
          checkFacilityForAppointments(facilityToCheck, startDateFilter, endDateFilter)
        );

        const results = await Promise.allSettled(checkPromises);

        // Find the best appointment from all results
        let bestAppointment = null;
        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            if (!bestAppointment || new Date(result.value.date) < new Date(bestAppointment.date)) {
              bestAppointment = result.value;
            }
          } else if (result.status === 'rejected') {
            log(`Facility ${facilities[index]} check failed: ${result.reason}`);
          }
        });

        // If we found a better appointment, book it with V2 enhanced booking
        if (bestAppointment) {
          log("=".repeat(50));
          log(`🎉 *** BETTER APPOINTMENT FOUND ***`);
          log(`📍 Location: ${bestAppointment.locationName}`);
          log(`📅 Date: ${bestAppointment.date}`);
          log("=".repeat(50));

          // Play exciting alert sound
          playAlert('found');

          // Store appointment details
          window.localStorage.setItem("available_date", bestAppointment.date);
          window.localStorage.setItem("facilityId", bestAppointment.facilityId);

          // V2: Use enhanced booking function with retry logic
          const bookingSuccess = await attemptBooking(bestAppointment);

          if (!bookingSuccess) {
            // If booking failed after all retries, continue checking
            log("⚠️ Booking failed, will continue checking for appointments");
            checkInterval = getRandomDelay();
          }
        } else {
          checkInterval = getRandomDelay();
          log("=".repeat(50));
          log(`ℹ️ No better appointments found. Next check in ${Math.floor(checkInterval / 1000)} seconds`);
          log("=".repeat(50));
        }
      } catch (error) {
        console.error("❌ Error during appointment check:", error);
        lastBookingError = error.message;
        checkInterval = getRandomDelay();
      }
    }
  }

  function getRandomDelay() {
    // Add randomness to avoid detection
    const minDelay = parseInt(window.localStorage.getItem("minDelay") || "5", 10);
    const maxDelay = parseInt(window.localStorage.getItem("maxDelay") || "30", 10);
    const minMs = minDelay * 1000;
    const maxMs = maxDelay * 1000;
    return minMs + Math.floor(Math.random() * (maxMs - minMs));
  }

  // MODIFIED: Removed license validation function entirely
  // All users now have full access

  function runLoop() {
    // Check if automation is running
    const isRunning = window.localStorage.getItem("automationRunning") !== "false";

    let message = `Checking again in ${Math.floor(checkInterval / 1000)} seconds`;

    // Get date filters with validation
    const startDateStr = window.localStorage.getItem("startDate");
    if (startDateStr && document.getElementById("startDate")) {
      document.getElementById("startDate").value = startDateStr;
    }
    // FIXED: Validate date before using it
    let startDateFilter = null;
    if (startDateStr) {
      const tempDate = new Date(startDateStr);
      if (!isNaN(tempDate.getTime())) {
        startDateFilter = tempDate;
      }
    }

    const endDateStr = window.localStorage.getItem("endDate");
    if (endDateStr && document.getElementById("endDate")) {
      document.getElementById("endDate").value = endDateStr;
    }
    // FIXED: Validate date before using it
    let endDateFilter = null;
    if (endDateStr) {
      const tempDate = new Date(endDateStr);
      if (!isNaN(tempDate.getTime())) {
        endDateFilter = tempDate;
      }
    }

    // MODIFIED: Always show success status
    maxChecksPerCycle = 10; // Full functionality enabled

    // Determine target date for display
    let targetDate = null;
    if (endDateFilter) {
      targetDate = endDateFilter.toLocaleDateString();
    } else {
      targetDate = currentAppointmentDate.toLocaleDateString();
    }

    updateProgressPopup(
      message,
      window.localStorage.getItem("startDate") || "",
      window.localStorage.getItem("endDate") || "",
      currentCheckingFacility,
      targetDate
    );

    if (isRunning) {
      setTimeout(async () => {
        await readStreamToJSON(startDateFilter, endDateFilter);
        runLoop();
      }, checkInterval);
    } else {
      // If stopped, just update UI every 5 seconds
      setTimeout(() => {
        runLoop();
      }, 5000);
    }
  }

  // Start the automation loop
  runLoop();

  // Refresh page every 10 minutes to maintain session
  setTimeout(() => {
    window.location.href = `https://ais.usvisa-info.com/${country}/niv/schedule/${userId}/appointment`;
  }, 600000);
} catch (exception) {
  console.error("Extension error:", exception);
  // FIXED: Removed reload() call - it had infinite recursion
  // Just log the error and let the scheduled refresh handle it
}
