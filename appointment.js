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
  function updateProgressPopup(message, startDate, endDate, currentFacility = null, targetDate = null) {
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

  async function getAppointmentTime(date) {
    const response = await fetch(
      `https://ais.usvisa-info.com/${country}/niv/schedule/${userId}/appointment/times/${facilityId}.json?date=${date}&appointments[expedite]=false`,
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
      throw new Error("Network response was not ok");
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

  async function readStreamToJSON(startDateFilter, endDateFilter) {
    if (maxChecksPerCycle === 10) {
      try {
        // Get the list of facilities to check - ONLY Toronto, Calgary, Vancouver
        const facilitiesStr = window.localStorage.getItem("facilitiesToCheck") || "94,89,95";
        const facilities = facilitiesStr.split(",").map(f => f.trim()).filter(f => f);

        log("=".repeat(50));
        log(`Checking ${facilities.length} location(s): ${facilities.map(id => locationMap[id] || id).join(", ")}`);
        log("=".repeat(50));

        // Check all facilities
        let bestAppointment = null;
        for (const facilityToCheck of facilities) {
          const result = await checkFacilityForAppointments(facilityToCheck, startDateFilter, endDateFilter);

          if (result) {
            if (!bestAppointment || new Date(result.date) < new Date(bestAppointment.date)) {
              bestAppointment = result;
            }
          }

          // Add a small delay between facility checks to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // If we found a better appointment, book it
        if (bestAppointment) {
          log("=".repeat(50));
          log(`*** BOOKING BEST APPOINTMENT FOUND ***`);
          log(`Location: ${bestAppointment.locationName}`);
          log(`Date: ${bestAppointment.date}`);
          log("=".repeat(50));

          window.localStorage.setItem("available_date", bestAppointment.date);
          window.localStorage.setItem("facilityId", bestAppointment.facilityId);

          // Update the facility dropdown if it exists
          const facilityDropdown = document.getElementById("appointments_consulate_appointment_facility_id");
          if (facilityDropdown) {
            facilityDropdown.value = bestAppointment.facilityId;
          }

          // Set the date field with error handling
          const dateField = document.getElementById("appointments_consulate_appointment_date");
          if (!dateField) {
            log("ERROR: Date field not found, cannot book appointment");
            return;
          }
          dateField.value = bestAppointment.date;

          setTimeout(async () => {
            try {
              // Trigger date selection
              if (dateField) dateField.click();

              // Get available times for the date
              const timesData = await getAppointmentTime(bestAppointment.date);

              // FIXED: Add null check for timesData
              if (!timesData || !timesData.available_times || timesData.available_times.length === 0) {
                log("ERROR: No available times found");
                return;
              }

              log("Available times: " + timesData.available_times[0]);
              window.localStorage.setItem("available_time", timesData.available_times);

              // Add time option to dropdown
              const timeDropdown = document.getElementById("appointments_consulate_appointment_time");
              if (!timeDropdown) {
                log("ERROR: Time dropdown not found");
                return;
              }

              const timeOption = document.createElement("option");
              timeOption.value = timesData.available_times[0];
              timeOption.textContent = timesData.available_times[0]; // FIXED: Use textContent instead of innerHTML
              timeDropdown.appendChild(timeOption);

              // Select the time
              timeDropdown.selectedIndex = 1;
              timeDropdown.value = timesData.available_times[0];

              log("Selected time: " + timeDropdown.value);

              // Enable and click submit button
              const submitButton = document.getElementById("appointments_submit");
              if (submitButton) {
                submitButton.disabled = false;
                submitButton.click();

                // Confirm booking
                setTimeout(() => {
                  const confirmButton = document.querySelector("a.alert");
                  if (confirmButton) {
                    confirmButton.click();
                    setTimeout(() => {
                      document.location.href = `https://ais.usvisa-info.com/${country}/niv/account`;
                    }, 5000);
                  }
                }, 1000);
              } else {
                log("ERROR: Submit button not found");
              }
            } catch (error) {
              console.error("Error during booking process:", error);
            }
          }, 1000);
        } else {
          checkInterval = getRandomDelay();
          log("=".repeat(50));
          log(`No better appointments found across all locations. Next check in ${Math.floor(checkInterval / 1000)} seconds`);
          log("=".repeat(50));
        }
      } catch (error) {
        console.error("Error reading stream:", error);
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
