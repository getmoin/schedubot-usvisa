# V3 Continue Implementation Guide

## ✅ What's Been Completed

### Infrastructure (100%)
- [x] Project structure and folders
- [x] Docker Compose with PostgreSQL, Scheduler, PgAdmin
- [x] Database schema (7 tables, views, triggers)
- [x] TypeScript configuration
- [x] Dockerfile for Node.js + Playwright

### Core Utilities (100%)
- [x] Environment configuration with validation
- [x] Winston logger with daily rotation
- [x] AES-256 encryption/decryption
- [x] Time window helpers
- [x] Database connection pool

## 🚧 What Remains

### 1. Database Queries Layer (database/queries.ts)
**Estimated: 200 lines**

Need to implement:
```typescript
// Credentials
- saveCredentials(email, password, country, userId)
- getCredentials()

// Appointment checks
- logAppointmentCheck(facilityId, date, slots, duration, status)
- getRecentChecks(limit)

// Booking attempts
- logBookingAttempt(facilityId, date, timeSlot, attempt, status)
- getBookingHistory()

// Current appointment
- getCurrentAppointment()
- updateCurrentAppointment(facilityId, date, timeSlot)

// Sessions
- saveSession(cookies)
- getSession()
- invalidateSession()

// App state
- getAppState(key)
- setAppState(key, value)
```

### 2. Browser Automation (browser/*.ts)
**Estimated: 600 lines** (ported from V2)

#### browser/init.ts
- Initialize Playwright with headless Chrome
- Load saved cookies if available
- Configure browser context

#### browser/login.ts
- Navigate to visa portal
- Fill email/password
- Handle 2FA if needed
- Extract userId from URL
- Save session cookies

#### browser/session.ts
- Validate session is active
- Detect 401 errors
- Refresh login when needed
- Save/restore cookies from database

#### browser/booking.ts
- `checkFacilityForAppointments()` - Port from V2
- `getAppointmentTimes()` - Port from V2
- `attemptBooking()` - Port from V2 with all retry logic
- Parallel facility checking

### 3. Scheduler (scheduler/*.ts)
**Estimated: 150 lines**

#### scheduler/cron.ts
- Setup cron job: `*/5 19-23,0-5 * * *`
- Validate time window before running
- Call main checking loop

#### scheduler/loop.ts
- Main continuous checking loop
- Check all facilities in parallel
- If better appointment found → book it
- If booked → immediately check again
- Handle errors and continue

### 4. Main Entry Point (index.ts)
**Estimated: 100 lines**

```typescript
async function main() {
  // 1. Validate configuration
  // 2. Initialize database
  // 3. Initialize logger
  // 4. Save encrypted credentials to DB
  // 5. Initialize browser
  // 6. Login to visa portal
  // 7. Start scheduler
  // 8. Handle graceful shutdown
}
```

## 📝 Implementation Order (Recommended)

### Step 1: Database Queries (30 min)
Create `src/database/queries.ts` with all CRUD operations.

### Step 2: Browser Init & Login (45 min)
- `src/browser/init.ts` - Playwright setup
- `src/browser/login.ts` - Login flow
- Test: Can log in and save cookies

### Step 3: Session Management (20 min)
- `src/browser/session.ts` - Cookie save/restore
- Test: Can resume session from cookies

### Step 4: Port Booking Logic (60 min)
- `src/browser/booking.ts` - Port all V2 logic
- Keep same parallel checking
- Keep same retry logic
- Test: Can check and find appointments

### Step 5: Scheduler (30 min)
- `src/scheduler/cron.ts` - Cron setup
- `src/scheduler/loop.ts` - Main loop
- Test: Runs only in time window

### Step 6: Main Entry (20 min)
- `src/index.ts` - Tie everything together
- Test: Full flow end-to-end

### Step 7: Documentation (15 min)
- Create v3-scheduler/README.md with setup steps
- Test: Follow README from scratch

**Total Estimated Time: 3-4 hours**

## 🚀 Quick Commands for Testing

### Test Database
```bash
cd v3-scheduler
docker-compose up postgres -d
docker-compose logs postgres
```

### Build Scheduler (after code complete)
```bash
cd scheduler
npm install
npm run build
```

### Test TypeScript Compilation
```bash
cd scheduler
npm run build
# Should compile without errors
```

### Full Stack Test
```bash
cd v3-scheduler
docker-compose up --build
# Watch logs for errors
```

## 🐛 Common Issues & Solutions

### Issue: "Cannot find module 'pg'"
**Solution:** Run `npm install` in scheduler/ directory

### Issue: "ENCRYPTION_KEY must be 32 characters"
**Solution:** Generate with `openssl rand -hex 16` (gives 32 chars)

### Issue: "Database connection refused"
**Solution:** Wait for postgres healthcheck (takes ~10 seconds)

### Issue: Playwright fails to download chromium
**Solution:** Run `npx playwright install chromium` in Dockerfile

## 📋 V2 to V3 Migration Notes

### What's Different:
1. **No localStorage** → Use PostgreSQL
2. **No window.location** → Use Playwright page.goto()
3. **No document.querySelector** → Use page.locator()
4. **No Audio API** → Log to database + external notifications later
5. **No UI popup** → Logs + database records

### What's the Same:
1. **Same booking logic** - Try all time slots, 3 retries
2. **Same parallel checking** - Promise.allSettled
3. **Same session handling** - 401 detection
4. **Same continuous loop** - Check → Book → Check again

## 🎯 Next Steps (Choose One)

### Option A: I Continue Implementation
Tell me "continue implementing" and I'll create all remaining files in sequence.

### Option B: You Want to Implement
I'll provide detailed pseudo-code for each file and you implement.

### Option C: Collaborative
I create skeletons, you fill in V2-specific logic.

**Recommendation:** Option A - Let me finish implementation (3-4 hours worth of code), then you test and customize.

---

**Current Progress:** 70% Complete
**Remaining Work:** ~1000 lines of TypeScript
**Estimated Completion Time:** 3-4 hours of focused work
**Status:** Ready to continue! 🚀
