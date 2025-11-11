# USA Visa Appointment Extension V2.1

## What It Is

Automated Chrome extension that monitors the US visa appointment system and **automatically books earlier appointment dates** when they become available.

**Target Website:** `https://ais.usvisa-info.com/[country]/niv/schedule/[userId]/appointment`

⭐ Give a star if you find this useful!

---

## Why You Need This

**The Problem:**
- Visa appointments are released randomly, often at 7pm EST
- Slots get booked in seconds before you can react
- You miss appointments because you're not fast enough

**The Solution:**
- This extension checks 24/7 for earlier appointments
- Books automatically the moment a slot appears
- **3x faster** than manual checking
- Handles race conditions (tries all time slots)
- Never gives up (retries 3 times if booking fails)

---

## Key Features

### Speed & Reliability
- ⚡ **3x Faster** - Checks all 3 locations simultaneously (not one by one)
- 🎯 **Race Condition Proof** - Tries ALL available time slots, not just the first
- 🔄 **Smart Retry** - Automatically retries up to 3 times if booking fails
- 🔐 **Auto Token Refresh** - Detects expired sessions and refreshes automatically
- 🛡️ **Never Stops** - Continues checking even after failures

### User Experience
- 📊 **Real-time Status** - See exactly what's happening
- 🔔 **Audio Alerts** - Optional sounds when appointments found (never blocks booking)
- ⚙️ **Fully Customizable** - Set check frequency from 1 second to 5 minutes
- 🎨 **Clean Console** - No false errors or noise

### Smart Features
- **Date Range Filtering** - Only book appointments in your preferred date range
- **Multi-location** - Checks Toronto, Calgary, and Vancouver simultaneously
- **Start/Stop Controls** - Pause and resume anytime
- **Session Safe** - Uses your browser session, no passwords stored

---

## How It Works

### Quick Overview

1. **Login** to the visa portal and navigate to the appointment scheduling page
2. **Extension activates** automatically and injects a control panel
3. **Configure** your preferences (optional date range, delays)
4. **Click Start** to begin monitoring
5. **Automatic booking** when a better appointment is found

### Booking Criteria

An appointment is automatically booked when ALL conditions are met:

- Date is **earlier** than your current appointment
- Date is **within** your specified date range (if set)
- Available time slot exists for that date

---

## Installation

1. **Download or clone** this repository
2. **Open Chrome Extensions:** `chrome://extensions/`
3. **Enable Developer Mode** (toggle in top-right corner)
4. **Click "Load unpacked"**
5. **Select the extension folder**

---

## Usage

### Basic Setup

1. Log into the US visa appointment website
2. Navigate to your appointment scheduling page
3. The control panel appears automatically in the top-left corner
4. Click **"Start Automation"** to begin monitoring

### Configuration (Optional)

**Date Range Filters:**
- **Start Date:** Earliest acceptable appointment date
- **End Date:** Latest acceptable appointment date
- Leave blank to accept any earlier date

**Random Delay Settings:**
- **Min Delay:** Minimum seconds between checks (default: 5)
- **Max Delay:** Maximum seconds between checks (default: 30)
- Used to avoid detection by the visa system

### Monitored Locations

The extension automatically checks these Canadian locations:

- **Toronto** (Facility ID: 94)
- **Calgary** (Facility ID: 89)
- **Vancouver** (Facility ID: 95)

---

## Control Panel

The control panel shows:

- **Status:** Running/Stopped
- **Current Activity:** Which location is being checked
- **Target Date:** Your current appointment date
- **Locations:** All monitored facilities
- **Date Filters:** Your configured date range
- **Delay Settings:** Current random delay configuration

---

## How Automation Works

### Checking Process

The extension checks based on your configured delay (default: every 5-30 seconds):
- Checks all 3 locations **simultaneously** for speed
- Compares dates with your current appointment
- Applies your date range filters
- Finds the earliest available appointment

### Booking Process

When an earlier appointment is found:

1. **Alert** - Optional sound notification (never blocks booking)
2. **Select Location** - Picks the facility with the earlier date
3. **Select Date** - Sets the appointment date
4. **Get Time Slots** - Fetches all available times (retries up to 3 times if needed)
5. **Try Each Time** - Attempts to book each available time slot until one succeeds
6. **Confirm** - Completes the booking
7. **Done** - Shows success status and redirects to your account

**If Booking Fails:**
- Tries different time slots automatically
- Retries up to 3 times
- Continues checking for new appointments if all attempts fail

---

## Safety & Security

- **Random Delays:** Customizable delays between checks to avoid detection
- **Session Safe:** Uses your existing browser login, no passwords stored
- **Auto Token Refresh:** Detects when you're logged out and refreshes automatically
- **100% Local:** Runs entirely in your browser, no external servers
- **Input Sanitization:** All settings are validated and sanitized
- **Error Recovery:** Handles failures gracefully and keeps running

---

## Tips for Peak Times (7pm EST)

When new slots open at 7pm EST, they get booked in seconds. Here's how to maximize your chances:

**Recommended Settings:**
- **Min Delay:** 1 second
- **Max Delay:** 3 seconds
- **Result:** Checks every 1-3 seconds across all locations

**Why This Works:**
- All 3 locations checked at the same time (not one by one)
- If someone books before you, automatically tries the next available time
- Retries up to 3 times if booking fails
- Never stops checking until you get an appointment

**Before Peak Time:**
- Log into the visa portal
- Navigate to the appointment page
- Start the extension
- Leave the browser window open

---

## Troubleshooting

### Extension Not Showing Up

- Make sure you're logged into the visa portal
- Navigate to the appointment scheduling page
- Check extension is enabled at `chrome://extensions/`
- Refresh the page if needed

### No Appointments Found

- This is normal - appointments may not be available right now
- The extension keeps checking automatically
- Be patient and let it run

### Session Expired / Logged Out

- Extension detects this automatically
- It will refresh the page to get a new session
- If you see "401 Unauthorized", just log back in and restart

### Booking Failed

- Extension tries up to 3 times automatically
- It tries different time slots if first one fails
- Check console (F12) for detailed status
- If all attempts fail, it continues checking for new appointments

### Audio Errors

- Audio is optional and never blocks booking
- If you see audio errors, you can ignore them
- The extension works perfectly fine without sound

---

## Important Notes

- **Active Session Required:** Keep your browser open and logged in
- **Detection Risk:** Use reasonable delay settings to avoid triggering security measures
- **Website Changes:** Extension may break if the visa website structure changes
- **Responsibility:** Use this tool responsibly and at your own risk

---

## What's New in V2.1

### Major Improvements
- **3x Faster** - Checks all locations at the same time instead of one by one
- **Race Condition Proof** - If someone books before you, tries the next time slot automatically
- **Smart Retry** - Automatically retries up to 3 times with different time slots
- **Auto Session Refresh** - Detects when you're logged out and refreshes automatically
- **Audio Alerts** - Optional sound notifications (never blocks booking)
- **Real-time Status** - See exactly what's happening in the control panel

### Bug Fixes
- Fixed delay settings not being applied correctly
- Fixed session expiry causing infinite retry loops
- Made audio completely optional to prevent errors
- Removed intermittent network errors from console

---

## Technical Details

For developers and technical users:

- **Architecture:** Chrome Extension Manifest V3
- **Main Logic:** [appointment.js](appointment.js) (~800 lines)
- **Key Technologies:**
  - Parallel async operations with `Promise.allSettled`
  - Retry logic with 3 attempts
  - Web Audio API for optional sound alerts
  - 401 error detection for auto token refresh
- **Storage:** localStorage for settings only (no passwords)
- **Security:** Uses your existing browser session cookies
- **No Backend:** 100% client-side operation

---

## Files

- [manifest.json](manifest.json) - Extension configuration
- [appointment.js](appointment.js) - Main automation logic (~800 lines)
- [instructions.js](instructions.js) - Extracts current appointment date
- [home.js](home.js), [signin.js](signin.js) - Navigation helpers

---

## License

Use at your own risk. This tool is for personal use only.

---

