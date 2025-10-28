# Developer Guide - USA Visa Appointment Extension

**Version:** 2.1 Secure & Reliable
**Last Updated:** 2025-10-27
**Target:** Chrome/Chromium Extension (Manifest V3)

---

## 📖 Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Architecture](#architecture)
4. [Code Structure](#code-structure)
5. [Key Components](#key-components)
6. [Data Flow](#data-flow)
7. [Configuration](#configuration)
8. [Development Setup](#development-setup)
9. [Modification Guide](#modification-guide)
10. [Troubleshooting](#troubleshooting)
11. [Security Considerations](#security-considerations)

---

## 📋 Overview

### **Purpose**
Automated Chrome extension that monitors the US visa appointment system and automatically books earlier appointment dates when they become available.

### **Target Website**
`https://ais.usvisa-info.com/[country]/niv/schedule/[userId]/appointment`

### **Monitored Locations** (Hardcoded)
- **Toronto** (Facility ID: 94)
- **Calgary** (Facility ID: 89)
- **Vancouver** (Facility ID: 95)

### **Key Features**
- ✅ Continuous monitoring every ~3 minutes
- ✅ Multi-location checking (3 locations simultaneously)
- ✅ Automatic booking when criteria met
- ✅ Date range filtering
- ✅ Start/Stop controls
- ✅ Session maintenance
- ✅ Random delay to avoid detection
- ✅ XSS protection and error handling

---

## 🔍 How It Works

### **High-Level Flow**

```
┌─────────────────────────────────────────────────────────┐
│ 1. User logs into visa portal                          │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 2. User navigates to appointment scheduling page       │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Extension content script (appointment.js) injects   │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Initialization:                                      │
│    - Extract userId from URL                            │
│    - Get current appointment date from page             │
│    - Force config to Toronto, Calgary, Vancouver        │
│    - Create UI control panel                            │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Main Loop (runLoop):                                │
│    - Check if automation is running                     │
│    - Wait for configured interval (3 min + random)      │
│    - Call checkAllFacilities()                          │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 6. For each facility (94, 89, 95):                     │
│    - API call to get available dates                    │
│    - Check if date is earlier than current              │
│    - Check if date is within user's range               │
│    - Track best (earliest) appointment found            │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 7. If better appointment found:                        │
│    - Get available times for that date                  │
│    - Fill out the appointment form                      │
│    - Submit the form                                     │
│    - Confirm booking                                     │
│    - Redirect to account page                           │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 8. If no better appointment:                           │
│    - Log result                                          │
│    - Wait for next check interval                       │
│    - Repeat from step 5                                 │
└─────────────────────────────────────────────────────────┘
```

### **Booking Logic**

An appointment is automatically booked when ALL conditions are met:

```javascript
if (
  availableDate < currentAppointmentDate &&  // Earlier than current
  availableDate >= startDate &&               // After start filter (if set)
  availableDate <= endDate                    // Before end filter (if set)
) {
  // BOOK IT!
}
```

---

## 🏗️ Architecture

### **Extension Type**
Chrome Extension (Manifest V3)

### **Architecture Pattern**
**Content Script Injection** - The extension injects JavaScript into the visa appointment page.

### **Components**

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                            │
│  ┌───────────────────────────────────────────────────┐  │
│  │              User's Tab                           │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  Visa Portal Page (DOM)                     │  │  │
│  │  │  https://ais.usvisa-info.com/...            │  │  │
│  │  └────────────┬────────────────────────────────┘  │  │
│  │               │                                   │  │
│  │               │ Injects                           │  │
│  │               ▼                                   │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  appointment.js (Content Script)            │  │  │
│  │  │  - Monitors DOM                              │  │  │
│  │  │  - Makes API calls                           │  │  │
│  │  │  - Updates UI                                │  │  │
│  │  │  - Books appointments                        │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │         Chrome Extension Storage                  │  │
│  │  - localStorage (user settings)                   │  │
│  │  - facilityId, userId, dates, etc.               │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### **No Backend**
This extension is **100% client-side**. No server, no database, no external services.

---

## 📁 Code Structure

### **File Organization**

```
US Visa/
├── manifest.json                 # Extension configuration
├── appointment.js                # MAIN FILE - Core automation logic
├── instructions.js               # Extracts current appointment date
├── home.js                       # Handles group selection page
├── signin.js                     # Auto-login handler
├── presignin.js                  # Pre-login page handler
├── continue.js                   # Navigation helper
├── instructions_redirect.js      # Redirect handler
├── background.js                 # Service worker (minimal)
├── popup.html                    # Extension popup (not used)
├── popup.js                      # Popup logic (not used)
├── enctypt_decrypt.js            # License generator (not used)
│
├── icons/                        # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
│
└── Documentation/
    ├── README.md                 # User guide
    ├── DEVELOPER_GUIDE.md        # This file
    ├── FIXES_APPLIED.md          # Security fixes documentation
    ├── ENHANCEMENTS.md           # Feature enhancements
    ├── FACILITY_ID_GUIDE.md      # Facility ID discovery
    └── FINAL_CONFIGURATION.md    # Hardcoded config details
```

### **Main File: appointment.js (553 lines)**

**Structure:**
```javascript
// Lines 1-5: Globals and utility functions
let country = ...;
function log(e) { ... }

// Lines 11-22: Initial page handlers (reschedule, maintenance)
if ("Reschedule Appointment" === ...) { ... }

// Lines 24-552: Main try-catch block containing:
try {
  // Lines 31-63: Variable initialization
  // Lines 65-68: UI popup creation
  // Lines 70-92: Page handlers
  // Lines 94-103: Extract remaining attempts
  // Lines 106-250: updateProgressPopup() function
  // Lines 252-260: addMonths() utility
  // Lines 262-304: getAppointmentTime() API call
  // Lines 306-434: checkFacilityForAppointments() API call
  // Lines 436-526: readStreamToJSON() - main checking logic
  // Lines 528-533: getRandomDelay() utility
  // Lines 535-596: runLoop() - main automation loop
  // Lines 598-602: Page refresh scheduler

} catch (exception) {
  // Error handler
}
```

---

## 🔑 Key Components

### **1. Initialization (Lines 31-68)**

```javascript
// Extract variables from URL and localStorage
let userId = window.localStorage.getItem("userId");
let currentAppointmentDate = ...;

// HARDCODED configuration
const locationMap = {
  "94": "Toronto",
  "89": "Calgary",
  "95": "Vancouver"
};

const facilitiesToCheck = "94,89,95";

// Create UI popup
let progressPopup = document.createElement("div");
progressPopup.id = "progressPopup";
document.body.appendChild(progressPopup);
```

**Purpose:** Set up all variables and create the control panel UI.

---

### **2. UI Control Panel (Lines 106-250)**

**Function:** `updateProgressPopup(message, startDate, endDate, currentFacility, targetDate)`

**Purpose:**
- Displays current status
- Shows locations being monitored
- Provides Start/Stop controls
- Allows date range configuration
- Shows random delay settings

**Key Features:**
- XSS protection via `sanitizeText()`
- Event listeners for buttons
- Real-time status updates

**UI Sections:**
1. Status (Running/Stopped)
2. Current Activity (which location, target date)
3. Locations Being Monitored (Toronto, Calgary, Vancouver)
4. Date Filters (optional start/end dates)
5. Random Delay Settings (min/max seconds)
6. Auto-Booking Info (criteria explanation)
7. Control Buttons (Start, Stop, Save Settings)

---

### **3. API: Get Appointment Times (Lines 262-304)**

**Function:** `async getAppointmentTime(date)`

**Purpose:** Fetch available time slots for a specific date at a specific facility.

**API Endpoint:**
```
GET /niv/schedule/{userId}/appointment/times/{facilityId}.json?date={date}&appointments[expedite]=false
```

**Response:**
```json
{
  "available_times": ["10:00", "14:30", "16:00"]
}
```

**Error Handling:**
- Returns `null` on 304 (not modified)
- Returns `null` on error
- Uses streaming for memory efficiency

---

### **4. API: Check Facility (Lines 306-434)**

**Function:** `async checkFacilityForAppointments(facilityId, startDateFilter, endDateFilter)`

**Purpose:** Check if a specific facility has any appointments that meet the criteria.

**API Endpoint:**
```
GET /niv/schedule/{userId}/appointment/days/{facilityId}.json?appointments[expedite]=false
```

**Response:**
```json
[
  { "date": "2025-11-15", "business_day": true },
  { "date": "2025-11-22", "business_day": true },
  ...
]
```

**Logic:**
1. Make API call to get available dates
2. Validate response is an array
3. Get first available date
4. Check if it's earlier than current appointment
5. Check if it's within user's date range
6. Return appointment details if it qualifies, else null

**Returns:**
```javascript
{
  facilityId: "94",
  date: "2025-11-15",
  locationName: "Toronto"
}
// or null
```

---

### **5. Main Checking Logic (Lines 436-526)**

**Function:** `async readStreamToJSON(startDateFilter, endDateFilter)`

**Purpose:** Check ALL configured facilities and book the best appointment found.

**Algorithm:**
```javascript
1. For each facility in [94, 89, 95]:
   a. Call checkFacilityForAppointments()
   b. If appointment found, compare with bestAppointment
   c. Keep track of earliest appointment
   d. Wait 1 second between facilities

2. If bestAppointment found:
   a. Update facility dropdown
   b. Set appointment date
   c. Get available times
   d. Select first available time
   e. Submit form
   f. Confirm booking
   g. Redirect to account page

3. If no appointment found:
   a. Log result
   b. Schedule next check (3 min + random delay)
```

**Booking Process (Lines 443-518):**
```javascript
// 1. Set facility
facilityDropdown.value = bestAppointment.facilityId;

// 2. Set date
dateField.value = bestAppointment.date;
dateField.click();

// 3. Get and set time
const timesData = await getAppointmentTime(bestAppointment.date);
timeDropdown.value = timesData.available_times[0];

// 4. Submit
submitButton.click();

// 5. Confirm
confirmButton.click();

// 6. Redirect
window.location.href = .../account
```

---

### **6. Random Delay (Lines 528-533)**

**Function:** `getRandomDelay()`

**Purpose:** Add randomness to avoid detection by the visa website.

**Logic:**
```javascript
function getRandomDelay() {
  const minDelay = localStorage.getItem("minDelay") || "5";  // default 5 sec
  const maxDelay = localStorage.getItem("maxDelay") || "30"; // default 30 sec

  const minMs = minDelay * 1000;
  const maxMs = maxDelay * 1000;

  return minMs + Math.floor(Math.random() * (maxMs - minMs));
}
```

**Example:**
- Min: 5 sec, Max: 30 sec
- Result: Random value between 5000ms and 30000ms
- Typical: ~17500ms (17.5 seconds)

---

### **7. Main Automation Loop (Lines 535-596)**

**Function:** `runLoop()`

**Purpose:** The infinite loop that keeps the automation running.

**Flow:**
```javascript
async function runLoop() {
  // 1. Check if automation is running
  const isRunning = localStorage.getItem("automationRunning") !== "false";

  // 2. Get date filters
  let startDateFilter = parseDate(localStorage.getItem("startDate"));
  let endDateFilter = parseDate(localStorage.getItem("endDate"));

  // 3. Update UI
  updateProgressPopup(...);

  // 4. If running, check facilities after interval
  if (isRunning) {
    setTimeout(async () => {
      await readStreamToJSON(startDateFilter, endDateFilter);
      runLoop(); // Repeat
    }, checkInterval); // 3 min + random delay
  } else {
    // If stopped, just update UI every 5 seconds
    setTimeout(runLoop, 5000);
  }
}
```

**Starts:** Line 603 (called once at initialization)

---

## 🔄 Data Flow

### **1. User Settings → LocalStorage**

```
User Input (UI) → Save Button → localStorage
                                      ↓
                               Persisted across sessions
                                      ↓
                            Retrieved on next page load
```

**Storage Keys:**
- `facilitiesToCheck`: "94,89,95" (hardcoded)
- `startDate`: "2025-11-01" (optional)
- `endDate`: "2025-12-31" (optional)
- `minDelay`: "5" (seconds)
- `maxDelay`: "30" (seconds)
- `automationRunning`: "true" or "false"
- `userId`: Extracted from URL
- `facilityId`: Current facility selection
- `currentAppointmentDate`: Current appointment date

---

### **2. Page → Extension**

```
Visa Portal DOM
     ↓
Content Script reads:
  - userId (from URL)
  - currentAppointmentDate (from page text)
  - facilityId (from dropdown)
     ↓
Stored in variables and localStorage
```

---

### **3. Extension → API → Extension**

```
Extension
    ↓
API Call: GET /appointment/days/{facilityId}.json
    ↓
Response: [{ date: "2025-11-15" }, ...]
    ↓
Extension Logic: Check if date qualifies
    ↓
If YES: API Call: GET /appointment/times/{facilityId}.json?date=...
    ↓
Response: { available_times: ["10:00", ...] }
    ↓
Extension: Book appointment
```

---

### **4. Extension → DOM (Booking)**

```
Extension finds qualifying appointment
    ↓
1. document.getElementById("facility_dropdown").value = facilityId
2. document.getElementById("appointment_date").value = date
3. document.getElementById("appointment_date").click()
4. document.getElementById("appointment_time").value = time
5. document.getElementById("submit_button").click()
6. document.querySelector("a.alert").click() // Confirm
7. window.location.href = .../account // Redirect
```

---

## ⚙️ Configuration

### **Hardcoded Configuration**

**Locations (Cannot be changed via UI):**
```javascript
const facilitiesToCheck = "94,89,95";

const locationMap = {
  "94": "Toronto",
  "89": "Calgary",
  "95": "Vancouver"
};
```

**To change locations:**
1. Edit line 55 in `appointment.js`
2. Edit lines 51-54 in `appointment.js`
3. Reload extension

---

### **User-Configurable Settings**

**Via UI Control Panel:**

| Setting | Default | Range | Purpose |
|---------|---------|-------|---------|
| Start Date | None | Any valid date | Earliest acceptable date |
| End Date | None | Any valid date | Latest acceptable date |
| Min Delay | 5 sec | 1-300 sec | Minimum random delay |
| Max Delay | 30 sec | 1-300 sec | Maximum random delay |

**Via Start/Stop Buttons:**
- `automationRunning`: "true" or "false"

---

### **System Constants**

```javascript
// Base check interval (3 minutes)
checkInterval = 180000; // ms

// Delay between facility checks (1 second)
await new Promise(resolve => setTimeout(resolve, 1000));

// Page refresh interval (10 minutes)
setTimeout(..., 600000);

// Far future date (if no appointment exists)
new Date(864000000000); // ~27 years
```

---

## 🛠️ Development Setup

### **Prerequisites**
- Google Chrome or Chromium-based browser
- Basic knowledge of JavaScript
- Text editor (VS Code recommended)

### **Installation**

1. **Clone/Download the code:**
   ```
   C:\Users\Moin\Downloads\US Visa\
   ```

2. **Open Chrome Extensions:**
   ```
   chrome://extensions/
   ```

3. **Enable Developer Mode:**
   - Toggle switch in top-right corner

4. **Load Extension:**
   - Click "Load unpacked"
   - Select folder: `C:\Users\Moin\Downloads\US Visa`

5. **Verify:**
   - Extension appears in list
   - Icon shows in toolbar (optional)

---

### **Development Workflow**

1. **Make changes** to `appointment.js` or other files

2. **Reload extension:**
   ```
   chrome://extensions/ → Click refresh icon
   ```

3. **Test:**
   - Navigate to visa appointment page
   - Open DevTools (F12)
   - Check Console for logs

4. **Debug:**
   - Add `console.log()` statements
   - Use Chrome DevTools debugger
   - Monitor Network tab for API calls

---

### **Testing Checklist**

```
□ Extension loads without errors
□ UI control panel appears in top-left
□ Console shows "FORCED CONFIGURATION: ..." message
□ Console shows "Checking 3 location(s): Toronto, Calgary, Vancouver"
□ Network tab shows API calls to 94.json, 89.json, 95.json
□ Start/Stop buttons work
□ Date filters can be set and saved
□ Random delay settings can be changed
□ Automation runs continuously when "RUNNING"
□ Automation stops when "STOPPED"
```

---

## 🔧 Modification Guide

### **Common Modifications**

#### **1. Add a New Location**

**File:** `appointment.js`

**Lines to modify:**
```javascript
// Line 51-55: Add new location to map
const locationMap = {
  "94": "Toronto",
  "89": "Calgary",
  "95": "Vancouver",
  "99": "New Location"  // ADD THIS
};

// Line 55: Add to facilities list
const facilitiesToCheck = "94,89,95,99";  // ADD 99
```

**Result:** Extension will now check 4 locations.

---

#### **2. Change Check Interval**

**File:** `appointment.js`

**Line to modify:**
```javascript
// Line 520 (inside readStreamToJSON function)

// BEFORE:
checkInterval = 180000 + getRandomDelay(); // 3 minutes

// AFTER (e.g., 5 minutes):
checkInterval = 300000 + getRandomDelay(); // 5 minutes
```

---

#### **3. Change Default Random Delay**

**File:** `appointment.js`

**Lines to modify:**
```javascript
// Line 108-109 (inside updateProgressPopup function)

// BEFORE:
const minDelay = window.localStorage.getItem("minDelay") || "5";
const maxDelay = window.localStorage.getItem("maxDelay") || "30";

// AFTER (e.g., 10-60 seconds):
const minDelay = window.localStorage.getItem("minDelay") || "10";
const maxDelay = window.localStorage.getItem("maxDelay") || "60";
```

---

#### **4. Disable Automatic Booking (Manual Mode)**

**File:** `appointment.js`

**Lines to modify:**
```javascript
// Line 443-518: Comment out booking code

// if (bestAppointment) {
//   // Entire booking logic commented out
//   log("*** WOULD BOOK: " + bestAppointment.locationName + " - " + bestAppointment.date + " ***");
// }
```

**Result:** Extension logs appointments but doesn't book them.

---

#### **5. Add More Logging**

```javascript
// Add after any line for debugging

log("DEBUG: Variable value = " + someVariable);
console.log("Detailed object:", someObject);
```

**View:** F12 → Console tab

---

#### **6. Change UI Colors**

**File:** `appointment.js`

**Lines to modify:**
```javascript
// Line 156-250: Update inline styles

// Example: Change blue theme to green
style="border: 2px solid #28a745;"  // Green instead of #007bff (blue)
style="color: #28a745;"              // Green text
```

---

### **Advanced Modifications**

#### **Make Locations Configurable (Remove Hardcoding)**

**Current:** Locations are hardcoded on line 55

**To make configurable:**

1. **Remove forced reset:**
   ```javascript
   // Line 55-59: Comment out or remove
   // const facilitiesToCheck = "94,89,95";
   // window.localStorage.setItem("facilitiesToCheck", facilitiesToCheck);
   ```

2. **Add back input field:**
   ```javascript
   // In updateProgressPopup(), line 189-193
   // Uncomment the input field for facilitiesToCheck
   <input type="text" id="facilitiesToCheck" value="${facilitiesStr}" />
   ```

3. **Restore Save button functionality:**
   ```javascript
   // Line 231: Add back
   window.localStorage.setItem('facilitiesToCheck', document.getElementById('facilitiesToCheck').value);
   ```

---

#### **Add Parallel API Calls (Performance)**

**Current:** Sequential (one at a time)
```javascript
for (const facilityId of facilities) {
  await checkFacilityForAppointments(facilityId);
}
```

**Optimized:** Parallel (all at once)
```javascript
const results = await Promise.all(
  facilities.map(id => checkFacilityForAppointments(id, startDateFilter, endDateFilter))
);
```

**Benefit:** 3x faster (checks 3 locations in ~1 second instead of 3+ seconds)

---

## 🐛 Troubleshooting

### **Extension Not Loading**

**Symptoms:** Extension doesn't appear in chrome://extensions/

**Solutions:**
1. Check manifest.json syntax (use JSON validator)
2. Ensure all files exist in the folder
3. Check Chrome version (need v88+)
4. Try different folder location

---

### **No Console Logs**

**Symptoms:** Console is empty, no logs appear

**Solutions:**
1. Press F12 to open DevTools
2. Click "Console" tab
3. Ensure you're on the appointment page
4. Refresh the page
5. Check if extension is enabled

---

### **API Calls Failing**

**Symptoms:** Network tab shows 403, 401, or 500 errors

**Solutions:**
1. **403 Forbidden:** Rate limited or blocked
   - Increase random delays
   - Reduce check frequency

2. **401 Unauthorized:** Session expired
   - Log out and log back in
   - Check cookies are enabled

3. **500 Server Error:** Website issues
   - Wait and try again
   - Check if website is under maintenance

---

### **Booking Not Happening**

**Symptoms:** Appointments found but not booked

**Possible causes:**
1. **Date doesn't meet criteria:**
   - Check console logs
   - Verify date filters

2. **DOM elements not found:**
   - Check for "ERROR: ... not found" in console
   - Website structure may have changed

3. **Times not available:**
   - Check "No available times found" in console
   - Appointment may have been taken

---

### **UI Not Appearing**

**Symptoms:** Control panel doesn't show

**Solutions:**
1. Check if progressPopup is created: `document.getElementById('progressPopup')`
2. Check z-index (should be 100000)
3. Check if other elements are blocking it
4. Inspect page to see if div exists

---

## 🔒 Security Considerations

### **Input Sanitization**

**All user inputs are sanitized** to prevent XSS:

```javascript
function sanitizeText(text) {
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}
```

**Used for:**
- Date inputs
- Delay values
- Messages
- All text displayed in UI

---

### **localStorage Security**

**Stored Data:**
- User settings (dates, delays)
- Session data (userId, facilityId)
- No passwords or sensitive credentials

**Risk:** Other scripts on same domain can access

**Mitigation:**
- Only runs on official visa website
- No external scripts loaded

---

### **API Security**

**Credentials:**
- Uses browser's session cookies
- `credentials: "include"` in fetch calls
- No API keys or tokens stored

**HTTPS:**
- All API calls use HTTPS
- Certificate validation by browser

---

### **Code Injection Prevention**

**Protected against:**
- XSS via sanitizeText()
- Script injection via textContent (not innerHTML)
- SQL injection (N/A - no database)

**Vulnerable to:**
- Website structure changes (DOM changes)
- API endpoint changes

---

## 📝 Notes for Future Development

### **Potential Improvements**

1. **Performance:**
   - Implement parallel API calls
   - Add response caching
   - Debounce UI updates

2. **Features:**
   - Email notifications
   - Multiple user profiles
   - Historical appointment tracking
   - Statistics dashboard

3. **Code Quality:**
   - Refactor into modules
   - Add TypeScript
   - Unit tests
   - E2E tests

4. **User Experience:**
   - Better error messages
   - Loading indicators
   - Sound notifications
   - Dark mode

---

### **Known Limitations**

1. **Website Dependent:**
   - Breaks if website structure changes
   - Breaks if API endpoints change

2. **Session Dependent:**
   - Requires active browser session
   - Needs periodic login

3. **Detection Risk:**
   - Website may detect automation
   - Account suspension possible

4. **Single Browser:**
   - Only works in Chrome/Chromium
   - Manifest V3 only

---

### **Migration to Manifest V4 (Future)**

When Chrome releases Manifest V4:

**Current issues:**
- Content scripts may have new restrictions
- Service worker changes
- Storage API changes

**Preparation:**
- Keep code modular
- Minimize use of deprecated APIs
- Follow Chrome extension best practices

---

## 📚 Additional Resources

### **Chrome Extension Docs:**
- [Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
- [Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)

### **JavaScript Resources:**
- [MDN Web Docs](https://developer.mozilla.org/)
- [Async/Await](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Async_await)
- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)

### **Security:**
- [XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

---

## ✅ Summary

### **What You've Learned:**

1. ✅ Extension monitors 3 Canadian visa locations
2. ✅ Checks every ~3 minutes with random delays
3. ✅ Automatically books when criteria met
4. ✅ All code in appointment.js (553 lines)
5. ✅ Uses localStorage for settings
6. ✅ No backend/server required
7. ✅ XSS protection and error handling
8. ✅ Start/Stop controls for user

### **Quick Reference:**

| Component | Lines | Purpose |
|-----------|-------|---------|
| Initialization | 31-68 | Setup variables, create UI |
| UI Control Panel | 106-250 | Display status, controls |
| Get Times API | 262-304 | Fetch available time slots |
| Check Facility | 306-434 | Check if facility has appointments |
| Main Logic | 436-526 | Check all facilities, book best |
| Random Delay | 528-533 | Anti-detection timing |
| Main Loop | 535-596 | Infinite automation loop |

---

**Developer Guide Version:** 1.0
**Last Updated:** 2025-10-27
**Maintained By:** Development Team
**Status:** Production Ready ✅

---

**Happy Coding! 🚀**
