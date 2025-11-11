# USA Visa Scheduler V3 - Dockerized Headless Automation

**Version:** 3.0.0
**Architecture:** Node.js + TypeScript + Playwright + PostgreSQL
**Deployment:** Single `docker-compose up` command

---

## 🎯 What is This?

A fully automated, dockerized application that:
- ✅ Runs 24/7 on your server (no browser window needed)
- ✅ Automatically logs into the visa portal
- ✅ Checks for earlier appointment dates (7pm-5am EST only)
- ✅ Books appointments automatically when better dates are found
- ✅ **Continues checking even after booking** to find even earlier dates
- ✅ Self-healing: Auto-recovers from errors and session expiry
- ✅ Full audit trail: All checks and bookings logged to PostgreSQL database

---

## 🚀 Quick Start (5 Minutes)

### Prerequisites
- Docker & Docker Compose installed
- Server with outbound internet access
- 2GB RAM minimum

### Step 1: Clone and Navigate
```bash
cd v3-scheduler
```

### Step 2: Configure Environment
```bash
cp .env.example .env
nano .env  # or use any text editor
```

**Fill in these required fields:**
```bash
# Your visa portal credentials
VISA_EMAIL=your_email@example.com
VISA_PASSWORD=your_password

# Database password (set to anything secure)
DB_PASSWORD=choose_secure_password_here

# Encryption key (32 characters - generate with: openssl rand -hex 16)
ENCRYPTION_KEY=your_32_character_encryption_key
```

### Step 3: Run!
```bash
docker-compose up -d
```

### Step 4: Monitor
```bash
# Watch logs
docker-compose logs -f scheduler

# Check status
docker-compose ps
```

**That's it!** The application is now running and will:
1. Log in to the visa portal
2. Wait until 7pm EST
3. Check for appointments every 5 minutes
4. Book automatically when better dates found
5. Keep checking for even earlier dates

---

## 📋 Configuration Options

Edit `.env` file to customize:

### Visa Portal Settings
```bash
VISA_EMAIL=your_email@example.com      # Your portal login email
VISA_PASSWORD=your_password             # Your portal password
COUNTRY_CODE=ca                         # Country code (ca for Canada)
USER_ID=                                # Optional: auto-extracted if empty
```

### Target Facilities
```bash
FACILITIES=94,89,95                     # Comma-separated facility IDs
                                        # 94=Toronto, 89=Calgary, 95=Vancouver
```

### Scheduling
```bash
TZ=America/New_York                     # Timezone (must be EST)
CHECK_START_HOUR=19                     # Start checking at 7pm EST
CHECK_END_HOUR=5                        # Stop checking at 5am EST
CHECK_INTERVAL_MIN=5                    # Check every 5 minutes
```

### Booking Filters
```bash
START_DATE_FILTER=2025-01-15            # Optional: earliest acceptable date
END_DATE_FILTER=2025-03-30              # Optional: latest acceptable date
MAX_BOOKING_RETRIES=3                   # Retry up to 3 times
```

### Database
```bash
DB_PASSWORD=your_secure_password        # Set a strong password
DB_NAME=visa_scheduler                  # Database name
DB_USER=visabot                         # Database user
```

### Security
```bash
# Generate with: openssl rand -hex 16
ENCRYPTION_KEY=your_32_character_key    # MUST be exactly 32 characters
```

---

## 🔧 Docker Commands

### Start Services
```bash
# Start in background
docker-compose up -d

# Start and see logs
docker-compose up
```

### View Logs
```bash
# All services
docker-compose logs -f

# Just scheduler
docker-compose logs -f scheduler

# Just database
docker-compose logs -f postgres
```

### Stop Services
```bash
# Stop all
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

### Restart Scheduler
```bash
docker-compose restart scheduler
```

### Rebuild After Code Changes
```bash
docker-compose up --build
```

---

## 📊 Database Access

### Option 1: PgAdmin (Web UI)
```bash
# Start with PgAdmin
docker-compose --profile debug up -d

# Access at: http://localhost:5050
# Email: admin@visascheduler.local
# Password: admin (change in .env: PGADMIN_PASSWORD)
```

### Option 2: Command Line
```bash
# Connect to database
docker-compose exec postgres psql -U visabot -d visa_scheduler

# View recent checks
SELECT * FROM appointment_checks ORDER BY check_time DESC LIMIT 10;

# View booking attempts
SELECT * FROM booking_attempts ORDER BY attempt_time DESC LIMIT 10;

# View current appointment
SELECT * FROM current_appointment WHERE is_active = true;

# Exit
\q
```

### Useful Queries
```sql
-- Check statistics (last 24 hours)
SELECT * FROM check_statistics;

-- Recent booking attempts
SELECT * FROM recent_booking_attempts;

-- All errors
SELECT * FROM error_logs ORDER BY error_time DESC LIMIT 20;

-- Session status
SELECT * FROM sessions ORDER BY created_at DESC LIMIT 1;
```

---

## 🐛 Troubleshooting

### Logs Show "Login Failed"
**Problem:** Invalid credentials or CAPTCHA required

**Solution:**
1. Verify email/password in `.env` are correct
2. Try logging in manually on the website
3. If CAPTCHA appears, you may need to log in manually once

### "401 Unauthorized" Errors
**Problem:** Session expired

**Solution:**
- This is normal! The app auto-detects and refreshes the session
- Just wait, it will re-login automatically
- Check logs for "Session refreshed successfully"

### "Database connection refused"
**Problem:** Database not ready yet

**Solution:**
```bash
# Wait for postgres healthcheck (takes ~10 seconds)
docker-compose logs postgres

# Should see: "database system is ready to accept connections"
```

### "ENCRYPTION_KEY must be 32 characters"
**Problem:** Invalid encryption key

**Solution:**
```bash
# Generate a proper key
openssl rand -hex 16

# Copy output to .env file
ENCRYPTION_KEY=<paste_output_here>
```

### Application Crashes on Startup
**Problem:** Configuration error

**Solution:**
```bash
# Check logs for specific error
docker-compose logs scheduler

# Validate .env file has all required fields
# Rebuild and restart
docker-compose down
docker-compose up --build
```

### No Appointments Being Checked
**Problem:** Outside time window

**Solution:**
- Check logs: "Outside checking window, waiting..."
- Application only runs 7pm-5am EST
- Wait for window to open, or change CHECK_START_HOUR in .env

### Browser/Playwright Errors
**Problem:** Chromium failed to download

**Solution:**
```bash
# Rebuild with fresh Playwright install
docker-compose down
docker-compose build --no-cache scheduler
docker-compose up -d
```

---

## 📈 How It Works

### 1. Startup Sequence
```
1. Validate configuration (.env file)
2. Connect to PostgreSQL database
3. Save encrypted credentials to DB
4. Initialize headless Chrome browser (Playwright)
5. Login to visa portal
6. Extract userId from URL
7. Save session cookies to database
8. Wait for time window (if outside 7pm-5am EST)
9. Start cron scheduler
```

### 2. Checking Cycle (Every 5 Minutes)
```
1. Validate session is still active
2. Check all facilities in parallel (Toronto, Calgary, Vancouver)
3. Compare dates with current appointment
4. Apply date range filters (if configured)
5. Log check results to database
6. If better date found → Book it!
7. If booked successfully → Check again immediately for even earlier date
8. If no better date → Wait for next scheduled check
```

### 3. Booking Process
```
1. Navigate to appointment page
2. Select facility from dropdown
3. Set date field
4. Fetch available time slots (with retry)
5. Try EACH time slot sequentially until one succeeds
6. Submit form
7. Click confirmation button
8. Update database with new appointment
9. Log success
10. IMMEDIATELY check again for even earlier dates
```

### 4. Error Recovery
- **401/Session Expired:** Auto-refresh page and re-login
- **Network Error:** Retry up to 3 times with exponential backoff
- **Booking Failed:** Try all time slots, retry 3 times, then continue checking
- **Crash:** Docker restart policy brings it back up automatically

---

## 🔒 Security Features

✅ **Encrypted Credentials:** Passwords encrypted with AES-256 before storing in database
✅ **Session Cookies:** Stored securely in database, not in files
✅ **No External Services:** 100% local operation, no data sent to third parties
✅ **Secure Container:** Runs in isolated Docker container with minimal permissions
✅ **Input Sanitization:** All inputs validated and sanitized
✅ **HTTPS Only:** All API calls use HTTPS

---

## 📦 What's Inside

```
v3-scheduler/
├── docker-compose.yml          # Docker orchestration
├── .env.example                # Configuration template
├── README.md                   # This file
│
├── db/
│   └── init.sql                # Database schema (auto-loaded)
│
└── scheduler/
    ├── Dockerfile              # Node.js + Playwright container
    ├── package.json            # Dependencies
    ├── tsconfig.json           # TypeScript config
    │
    ├── src/
    │   ├── index.ts            # Main entry point
    │   │
    │   ├── config/
    │   │   └── env.ts          # Environment variable handling
    │   │
    │   ├── database/
    │   │   ├── client.ts       # PostgreSQL connection pool
    │   │   └── queries.ts      # Database operations
    │   │
    │   ├── browser/
    │   │   ├── init.ts         # Playwright initialization
    │   │   ├── login.ts        # Login flow
    │   │   ├── session.ts      # Session management
    │   │   └── booking.ts      # Booking logic (ported from V2)
    │   │
    │   ├── scheduler/
    │   │   ├── cron.ts         # Cron job setup
    │   │   └── loop.ts         # Main checking loop
    │   │
    │   └── utils/
    │       ├── logger.ts       # Winston logging
    │       ├── crypto.ts       # Encryption/decryption
    │       └── time.ts         # Time window helpers
    │
    └── logs/                   # Application logs (auto-created)
```

---

## 🎯 Key Differences from V2 Extension

| Feature | V2 (Extension) | V3 (Dockerized) |
|---------|----------------|-----------------|
| **Deployment** | Manual browser install | `docker-compose up` |
| **Browser** | User's browser must stay open | Headless, runs in background |
| **Session** | User must stay logged in | Auto-login, auto-refresh |
| **Database** | localStorage (browser) | PostgreSQL with full history |
| **Scheduling** | Always running (wastes resources) | Only runs 7pm-5am EST |
| **Monitoring** | Browser console | Logs + database queries |
| **Reliability** | Depends on browser staying open | Auto-restart, self-healing |
| **Scalability** | Single user | Can run multiple accounts |
| **Server Deployment** | ❌ No | ✅ Yes |

---

## 📊 Database Tables

### `credentials`
Encrypted user credentials (email, password, userId)

### `appointment_checks`
Historical log of every facility check with timestamps, dates found, and response times

### `booking_attempts`
All booking attempts with success/failure status and error messages

### `current_appointment`
Your currently active appointment information

### `sessions`
Browser session cookies for maintaining login state

### `app_state`
Application state and configuration

### `error_logs`
Detailed error logs for debugging

---

## 🔄 Continuous Improvement Loop

```javascript
while (true) {
  const currentAppt = await getCurrentAppointment();
  const betterAppt = await findBetterAppointment(currentAppt);

  if (betterAppt) {
    const success = await bookAppointment(betterAppt);

    if (success) {
      // Update current appointment in DB
      await updateCurrentAppointment(betterAppt);

      // IMMEDIATELY check again for even better date!
      continue; // Skip wait, check now
    }
  }

  // Wait for next scheduled check
  await waitForNextInterval();
}
```

---

## 🛑 Stopping the Application

```bash
# Graceful shutdown
docker-compose down

# This will:
# 1. Stop the scheduler
# 2. Close browser and save session
# 3. Close database connections
# 4. Clean up containers
```

---

## 🆘 Support & Debugging

### Enable Debug Logs
```bash
# In .env file
LOG_LEVEL=debug

# Restart
docker-compose restart scheduler
```

### Take Screenshot (for debugging)
The application automatically takes screenshots on errors:
```bash
# Find screenshots in logs/
docker-compose exec scheduler ls -la /app/logs/
```

### Check Docker Resource Usage
```bash
docker stats
```

### Clean Everything and Start Fresh
```bash
# Stop and remove everything
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Rebuild and start
docker-compose up --build -d
```

---

## ✅ Success Criteria

When everything is working, you should see:

```
✅ Configuration valid
✅ Database connected
✅ Credentials saved (encrypted)
✅ Browser initialized
✅ Logged in successfully (User ID: 12345678)
✅ Within checking window - starting immediately
✅ Scheduler started
🎯 V3 Scheduler is now running!
```

Then periodically:
```
⏰ Scheduled check triggered at 2025-11-10 19:05:00
🔍 Checking 3 location(s): Toronto, Calgary, Vancouver
ℹ️ No better appointments found
✅ Check cycle completed
```

And when a better date is found:
```
🎉 *** BETTER APPOINTMENT FOUND ***
📍 Location: Toronto
📅 Date: 2025-12-15
🎯 BOOKING ATTEMPT 1/3 - Toronto on 2025-12-15
✅ BOOKING SUCCESSFUL! Confirming...
✅ BOOKING CONFIRMED: Toronto on 2025-12-15 at 10:00
⏰ Will check again immediately for even better dates...
```

---

## 📝 License

Use at your own risk. This tool is for personal use only.

---

## 🎉 Congratulations!

You now have a fully automated, production-ready visa appointment scheduler running on your server!

**No more:**
- ❌ Keeping browser open 24/7
- ❌ Manually checking for appointments
- ❌ Missing slots because you weren't fast enough
- ❌ Session expiry issues
- ❌ Forgetting to check during peak times

**Now you have:**
- ✅ 24/7 automated checking
- ✅ Instant booking when slots appear
- ✅ Continuous improvement (keeps finding earlier dates)
- ✅ Full audit trail in database
- ✅ Self-healing and resilient
- ✅ Peace of mind 😌

---

**Happy Scheduling! 🚀**
