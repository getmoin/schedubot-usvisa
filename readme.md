# USA Visa Appointment Extension V2

## What It Is

Automated Chrome, (Brave, Vivaldi or any chrome fork) extension that monitors the US visa appointment system and automatically books earlier appointment dates when they become available.

**Target Website:** `https://ais.usvisa-info.com/[country]/niv/schedule/[userId]/appointment`
Give a ⭐ if you find this useful

---

## Key Features

### Core Features
- **Lightning-fast parallel checking** - Checks all locations simultaneously for maximum speed
- Multi-location checking (Toronto, Calgary, Vancouver)
- Automatic booking when better dates are found
- Date range filtering
- Start/Stop controls
- Fully customizable delay settings (1 second to 5 minutes)

### V2 Enhancements (New!)
- 🚀 **Parallel Facility Checking** - All locations checked simultaneously instead of sequentially
- 🔄 **Smart Retry Logic** - Up to 3 automatic retry attempts if booking fails
- 🎯 **Multiple Time Slot Attempts** - Tries ALL available time slots, not just the first one
- 🔐 **Session Validation** - Automatically checks if you're still logged in
- 🔔 **Audio Alerts** - Sound notifications when appointments are found or booking succeeds/fails
- 📊 **Real-time Status Updates** - See exactly what's happening with booking attempts
- 🛡️ **Enhanced Error Recovery** - Robust error handling for edge cases and race conditions
- 📝 **Detailed Logging** - Better debugging with emoji-enhanced console logs

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

1. Every ~3 minutes (plus random delay), the extension:
   - Checks all 3 locations for available appointments
   - Compares dates with your current appointment
   - Applies your date range filters
   - Identifies the best (earliest) appointment

### Booking Process (V2 Enhanced)

When a qualifying appointment is found:

1. **Sound Alert** - Plays an audio notification
2. **Session Validation** - Verifies you're still logged in
3. **Facility Selection** - Selects the facility from dropdown
4. **Date Selection** - Sets the appointment date
5. **Fetch Time Slots** - Gets all available times with retry logic (up to 3 attempts)
6. **Smart Time Selection** - Tries ALL available time slots until one succeeds
7. **Form Submission** - Submits the appointment form
8. **Confirmation** - Confirms the booking
9. **Success Alert** - Plays success sound and shows status
10. **Redirect** - Redirects to your account page

**If Booking Fails:**
- Automatically retries up to 3 times
- Tries different time slots on each attempt
- Shows detailed error messages
- Continues checking for more appointments if all retries fail

---

## Safety Features

- **Random Delays:** Prevents detection by varying check intervals (fully customizable from UI)
- **XSS Protection:** All user inputs are sanitized
- **Error Handling:** Graceful handling of API failures with automatic retry
- **Session Management:** Uses your existing browser session with automatic validation
- **No External Servers:** 100% client-side operation
- **Rate Limiting Protection:** Configurable delays and retry logic to avoid triggering security measures

---

## V2 Performance Optimizations

### For Peak Times (7pm EST slot openings)

When slots open at 7pm EST, every millisecond counts. V2 is optimized for these scenarios:

1. **Set Aggressive Timing:**
   - Min Delay: 1-2 seconds
   - Max Delay: 2-5 seconds

2. **Parallel Checking:**
   - All 3 locations checked simultaneously
   - No sequential delays between facilities

3. **Race Condition Handling:**
   - If someone books the slot before you, automatically tries next time slot
   - Up to 3 retry attempts
   - Tries all available times, not just the first one

4. **Speed Improvements:**
   - Reduced wait times between steps
   - Parallel API calls where possible
   - Immediate booking attempt when slot found

**Example Configuration for Peak Times:**
```
Min Delay: 1 second
Max Delay: 3 seconds
Result: Checks every 1-3 seconds across all locations
```

---

## Troubleshooting

### Extension Not Working

- Ensure you're logged into the visa portal
- Check that you're on the appointment scheduling page
- Open DevTools (F12) and check Console for errors
- Verify extension is enabled in `chrome://extensions/`

### No Appointments Found

- This is normal - appointments may not be available
- The extension will keep checking automatically
- Check console logs for detailed status

### API Errors

- **403 Forbidden:** Increase random delays or reduce check frequency
- **401 Unauthorized:** Extension will auto-detect and stop. Log back in and restart
- **500 Server Error:** Website may be under maintenance, try later

### Audio Not Working

- Check browser permissions - allow sound for the visa website
- Some browsers require user interaction before playing audio
- Click on the page once to activate audio context

### Booking Attempts Failing

- Check console logs for detailed error messages
- V2 shows real-time status in the control panel
- Extension will retry automatically up to 3 times
- If all retries fail, it continues checking for new appointments

---

## Important Notes

- **Active Session Required:** Keep your browser open and logged in
- **Detection Risk:** Use reasonable delay settings to avoid triggering security measures
- **Website Changes:** Extension may break if the visa website structure changes
- **Responsibility:** Use this tool responsibly and at your own risk

---

## Technical Details

- **No Backend:** Runs entirely in your browser
- **Storage:** Uses localStorage for settings (no passwords stored)
- **Security:** All API calls use HTTPS with your session cookies
- **Main File:** `appointment.js` (~770 lines with V2 enhancements)
- **V2 Architecture:**
  - Parallel async operations with `Promise.allSettled`
  - Recursive retry logic with exponential backoff
  - Web Audio API for sound notifications
  - Session validation via HEAD requests

---

## What's New in V2

### Speed & Reliability
- **3x faster checking** - Parallel facility checks instead of sequential
- **Race condition resistant** - Tries multiple time slots and retries automatically
- **No more missed slots** - Even if first time fails, tries all available times

### User Experience
- **Real-time feedback** - See exactly what's happening
- **Audio alerts** - Know when appointments are found without watching
- **Better error messages** - Understand what went wrong and what's being tried

### Technical Improvements
- **Session monitoring** - Auto-detects when you're logged out
- **API retry logic** - Handles temporary network failures
- **Enhanced logging** - Emoji-enhanced console logs for easier debugging
- **Robust error recovery** - Continues working even after failures

---

## Configuration Files

- `manifest.json` - Extension configuration
- `appointment.js` - Main automation logic
- `instructions.js` - Extracts current appointment date
- `home.js`, `signin.js` - Navigation helpers

---

## Support

For detailed technical documentation, see `docs/dev_docs.md`

---

## License

Use at your own risk. This tool is for personal use only.

---

