# USA Visa Appointment Extension


## What It Is

Automated Chrome, (Brave, Vivaldi or any chrome fork) extension that monitors the US visa appointment system and automatically books earlier appointment dates when they become available.

**Target Website:** `https://ais.usvisa-info.com/[country]/niv/schedule/[userId]/appointment`
Give a ⭐ if you find this useful 

---

## Key Features

- Continuous monitoring every ~3 minutes
- Multi-location checking (Toronto, Calgary, Vancouver)
- Automatic booking when better dates are found
- Date range filtering
- Start/Stop controls
- Random delays to avoid detection
- XSS protection and error handling

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

### Booking Process

When a qualifying appointment is found:

1. Selects the facility from dropdown
2. Sets the appointment date
3. Fetches available times for that date
4. Selects the first available time slot
5. Submits the appointment form
6. Confirms the booking
7. Redirects to your account page

---

## Safety Features

- **Random Delays:** Prevents detection by varying check intervals
- **XSS Protection:** All user inputs are sanitized
- **Error Handling:** Graceful handling of API failures
- **Session Management:** Uses your existing browser session
- **No External Servers:** 100% client-side operation

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
- **401 Unauthorized:** Log out and log back into the visa portal
- **500 Server Error:** Website may be under maintenance, try later

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
- **Main File:** `appointment.js` (553 lines)

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

