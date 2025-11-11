# V3 Sanity Check & Issue Analysis

**Date:** 2025-11-10
**Analyzed:** V2 Extension vs V3 Dockerized Application
**Focus Areas:** Security, Performance, Reliability, Resilience, Availability

---

## 🚨 CRITICAL ISSUE #1: Check Frequency Mismatch

### V2 Extension Behavior:
- **Random delay between checks:** 5-30 seconds (configurable via UI)
- **Default settings:** Min 5 sec, Max 30 sec
- **Actual frequency:** 4-6 checks per minute (randomized to avoid detection)
- **Code location:** `appointment.js:792-799`

```javascript
function getRandomDelay() {
  const minDelay = parseInt(window.localStorage.getItem("minDelay") || "5", 10);
  const maxDelay = parseInt(window.localStorage.getItem("maxDelay") || "30", 10);
  const minMs = minDelay * 1000;
  const maxMs = maxDelay * 1000;
  return minMs + Math.floor(Math.random() * (maxMs - minMs));
}
```

### V3 Current Behavior:
- **Check interval:** Every 5 **MINUTES** (not seconds!)
- **Frequency:** 0.2 checks per minute (300 seconds between checks)
- **Code location:** `.env.example:26`, `cron.ts:22-27`

```typescript
// V3 uses minutes, not seconds!
CHECK_INTERVAL_MIN=5  # Check every 5 MINUTES
```

### Impact:
- ❌ **60x SLOWER** than V2 extension
- ❌ Will miss appointment slots that appear and disappear quickly
- ❌ Much lower success rate for competitive appointments

### **FIX REQUIRED:** Change checking strategy

---

## 🚨 CRITICAL ISSUE #2: No Randomization in V3

### V2 Extension Behavior:
- **Randomized delays** between 5-30 seconds
- **Purpose:** Avoid detection as a bot
- **Anti-detection feature:** Each check happens at unpredictable intervals

### V3 Current Behavior:
- **Fixed cron schedule:** Runs at exact same time every 5 minutes
- **Example:** 19:00, 19:05, 19:10, 19:15 (perfectly predictable)
- **No randomization built into cron jobs**

### Impact:
- ❌ **Easily detectable** as automated bot
- ❌ Server could rate-limit or ban the IP
- ❌ Higher risk of being blocked

### **FIX REQUIRED:** Add random delay within checking loop

---

## 🚨 CRITICAL ISSUE #3: Page Refresh Missing

### V2 Extension Behavior:
- **Automatic page refresh** every 10 minutes (600 seconds)
- **Purpose:** Maintain session, prevent stale state
- **Code location:** `appointment.js:872-875`

```javascript
// Refresh page every 10 minutes to maintain session
setTimeout(() => {
  window.location.href = `https://ais.usvisa-info.com/${country}/niv/schedule/${userId}/appointment`;
}, 600000);
```

### V3 Current Behavior:
- **Session validation:** Every 10 minutes (checks if logged in)
- **No page navigation refresh:** Just validates cookies
- **Code location:** `session.ts:8-20`

```typescript
const VALIDATION_INTERVAL = 10 * 60 * 1000; // 10 minutes
// Only checks session validity, doesn't navigate
```

### Impact:
- ⚠️ **Session may become stale** even if cookies are valid
- ⚠️ Website might not recognize the session after long periods
- ⚠️ Could cause booking failures

### **FIX REQUIRED:** Add periodic page refresh/navigation

---

## 🚨 CRITICAL ISSUE #4: Continuous Loop Missing

### V2 Extension Behavior:
- **Runs in continuous loop:** `runLoop()` recursively calls itself
- **Never stops:** Always checking (within localStorage control)
- **Immediate retry:** After booking, checks again instantly
- **Code location:** `appointment.js:804-867`

```javascript
function runLoop() {
  // ... check logic ...
  setTimeout(async () => {
    await readStreamToJSON(startDateFilter, endDateFilter);
    runLoop(); // Recursive call
  }, checkInterval);
}
```

### V3 Current Behavior:
- **Cron-based scheduling:** Waits for next cron trigger
- **After booking:** Recursively calls `runCheckingLoop()` once, then waits for cron
- **Potential gap:** If cron doesn't align, could wait up to 5 minutes
- **Code location:** `loop.ts:29-38`, `cron.ts:33-56`

```typescript
if (booked) {
  await sleep(5000);
  await runCheckingLoop(); // Called once, then cron takes over
}
```

### Impact:
- ⚠️ **Not truly continuous** - relies on cron schedule
- ⚠️ After immediate retry, could wait 5 minutes for next check
- ⚠️ Less aggressive than V2

### **FIX REQUIRED:** Implement true continuous loop with shorter intervals

---

## ⚠️ ISSUE #5: Concurrent Run Prevention Too Strict

### V3 Current Behavior:
- **Prevents concurrent runs:** `if (isRunning) return;`
- **Problem:** If a check takes longer than 5 minutes, next check is skipped
- **Code location:** `cron.ts:40-44`

```typescript
if (isRunning) {
  logger.warn('Previous check still running, skipping this cycle');
  return;
}
```

### Impact:
- ⚠️ **Could skip checks** if network is slow or booking takes time
- ⚠️ Less resilient than V2's simpler approach

### **FIX RECOMMENDED:** Allow queuing or reduce check duration timeout

---

## ⚠️ ISSUE #6: No Audio Alerts

### V2 Extension Behavior:
- **Audio alerts** when appointment found, success, or error
- **User awareness:** Immediate notification via browser sounds
- **Code location:** `appointment.js:58-110`

### V3 Current Behavior:
- **Logs only:** Console and file logging
- **No notifications:** User must monitor logs manually

### Impact:
- ℹ️ **User not immediately notified** of important events
- ℹ️ Lower awareness of booking success

### **FIX OPTIONAL:** Add webhook notifications (Telegram, email, etc.)

---

## ✅ CORRECTLY IMPLEMENTED FEATURES

### 1. ✅ Parallel Facility Checking
- Both V2 and V3 use `Promise.allSettled()` to check all facilities simultaneously
- V2: `appointment.js:737-753`
- V3: `booking.ts:376-387`

### 2. ✅ Smart Retry Logic (3 attempts)
- Both implement MAX_RETRIES = 3
- Both try all time slots before giving up
- V2: `appointment.js:542-721`
- V3: `booking.ts:218-348`

### 3. ✅ 401 Error Detection
- Both detect unauthorized errors and refresh session
- V2: `appointment.js:142-160`
- V3: `session.ts:49-66`

### 4. ✅ Multiple Time Slot Attempts
- Both try ALL available time slots sequentially
- V2: `appointment.js:594-665`
- V3: `booking.ts:267-322`

### 5. ✅ Session Management
- Both maintain and refresh sessions
- V2: Refreshes page every 10 minutes
- V3: Validates session every 10 minutes

### 6. ✅ Date Range Filtering
- Both support start/end date filters
- V2: localStorage `startDate`, `endDate`
- V3: `.env` `START_DATE_FILTER`, `END_DATE_FILTER`

### 7. ✅ Database Persistence (V3 Enhancement)
- V3 adds full PostgreSQL tracking (V2 only had localStorage)
- Audit trail of all checks and bookings

### 8. ✅ Encrypted Credentials (V3 Enhancement)
- V3 uses AES-256-CBC encryption
- Better security than V2's plaintext localStorage

---

## 🔒 SECURITY ANALYSIS

### V2 Security:
- ❌ **Plaintext credentials** in localStorage (browser storage)
- ⚠️ **Visible to any extension** with storage permissions
- ✅ Randomized delays to avoid detection
- ✅ HTTPS-only connections

### V3 Security:
- ✅ **AES-256 encrypted credentials** in PostgreSQL
- ✅ **Docker isolation** - separate container
- ✅ **Database password protected**
- ✅ **No external services** - fully local
- ⚠️ **No randomization** - predictable pattern (can be detected)
- ⚠️ **Fixed schedule** - easier to fingerprint

### **Verdict:** V3 is more secure for credentials, but **less secure against bot detection** due to lack of randomization.

---

## 🚀 PERFORMANCE ANALYSIS

### V2 Performance:
- ✅ **Fast checks:** 4-6 per minute (randomized 5-30 sec)
- ✅ **Immediate response:** Runs in active browser tab
- ✅ **Parallel checking:** All facilities at once
- ⚠️ **Browser dependency:** Must keep browser open

### V3 Performance:
- ❌ **SLOW checks:** 0.2 per minute (every 5 minutes)
- ✅ **Parallel checking:** Same as V2
- ✅ **Background operation:** No browser UI needed
- ✅ **Server deployment:** Can run 24/7 headless
- ⚠️ **Playwright overhead:** Slightly slower API calls vs native fetch

### **Verdict:** V2 is **60x faster** for checking frequency. V3 needs urgent fix.

---

## 🛡️ RELIABILITY ANALYSIS

### V2 Reliability:
- ✅ **Simple architecture:** Direct DOM manipulation
- ✅ **Automatic retry:** 3 attempts with delays
- ✅ **401 handling:** Page refresh on auth error
- ✅ **Continuous loop:** Never stops checking
- ⚠️ **Browser crashes:** User must restart browser
- ⚠️ **Tab closure:** Stops automation

### V3 Reliability:
- ✅ **Docker restart policy:** Auto-restarts on crash
- ✅ **Database persistence:** Survives restarts
- ✅ **Health checks:** PostgreSQL monitored
- ✅ **Graceful shutdown:** SIGTERM/SIGINT handlers
- ✅ **Transaction support:** Database operations atomic
- ⚠️ **Cron dependency:** Less aggressive than continuous loop
- ⚠️ **Playwright dependency:** More failure points (browser, protocol)

### **Verdict:** V3 is more reliable for **long-term operation**, but V2 is more **aggressive** in checking.

---

## 🔄 RESILIENCE ANALYSIS

### V2 Resilience:
- ✅ **Auto-recovery:** Continues after errors
- ✅ **Error isolation:** One failed check doesn't stop loop
- ✅ **Session refresh:** Handles 401 automatically
- ⚠️ **No persistence:** Lost on browser restart

### V3 Resilience:
- ✅ **State persistence:** Database survives restarts
- ✅ **Error logging:** All errors tracked in DB
- ✅ **Session restoration:** Loads cookies from DB
- ✅ **Container isolation:** Crash doesn't affect host
- ✅ **Connection pooling:** Database reconnects automatically
- ⚠️ **Cron gaps:** Could miss slots during restart

### **Verdict:** V3 is **more resilient** for long-term deployment.

---

## 📊 AVAILABILITY ANALYSIS

### V2 Availability:
- ⚠️ **Requires user's browser** to stay open
- ⚠️ **User must stay logged in** to computer
- ⚠️ **Browser updates** can break extension
- ⚠️ **Computer sleep/shutdown** stops automation
- ✅ **Immediate start:** No deployment needed

### V3 Availability:
- ✅ **24/7 server operation:** Never stops
- ✅ **Independent of user:** Headless, no UI
- ✅ **Server-grade:** Can run on VPS, AWS, etc.
- ✅ **Docker deployment:** Easy to move/replicate
- ⚠️ **Requires server:** Cannot run on personal laptop easily
- ⚠️ **Docker dependency:** Must have Docker installed

### **Verdict:** V3 is **far superior** for 24/7 availability.

---

## 📋 WORKFLOW COMPARISON

### V2 Workflow:
1. User opens browser and logs into visa portal
2. Extension injects script into page
3. Script enters continuous loop:
   - Wait random delay (5-30 sec)
   - Check all facilities in parallel
   - If better date found → book immediately (try all time slots, retry 3x)
   - If booking succeeds → continue loop immediately
   - If no better date → continue loop after delay
4. Every 10 minutes: Refresh page to maintain session
5. Loop never stops until user clicks "STOP" button

### V3 Workflow:
1. User starts Docker container: `docker-compose up`
2. Application initializes:
   - Connects to PostgreSQL
   - Loads encrypted credentials
   - Launches headless browser
   - Logs into visa portal
   - Extracts userId and saves session
3. Waits for time window (7pm EST)
4. Cron job triggers **every 5 minutes**:
   - Validates session (every 10 min)
   - Check all facilities in parallel
   - If better date found → book immediately (try all time slots, retry 3x)
   - If booking succeeds → call `runCheckingLoop()` once more, then wait for next cron
   - If no better date → wait for next cron trigger
5. Session validated every 10 minutes (but **no page refresh**)
6. Runs until container stopped: `docker-compose down`

### **Key Differences:**
| Aspect | V2 | V3 |
|--------|----|----|
| Check frequency | Every 5-30 sec (random) | Every 5 **minutes** (fixed) |
| Randomization | ✅ Yes | ❌ No |
| Page refresh | ✅ Every 10 min | ❌ No (only validates) |
| Continuous loop | ✅ True loop | ⚠️ Cron-based |
| After booking | ✅ Immediate recheck | ⚠️ One recheck + wait for cron |

---

## 🔧 REQUIRED FIXES (Priority Order)

### 1. **CRITICAL - Fix Check Interval**
**Problem:** V3 checks every 5 minutes, V2 checks 4-6 times per minute
**Impact:** 60x slower, missing slots
**Fix:** Change from 5 minutes to **10-15 seconds** with randomization

```typescript
// Option A: Change .env default
CHECK_INTERVAL_MIN=0.2  // 12 seconds (5 * 0.2 = 1 minute / 5 checks)

// Option B: Switch to continuous loop (better)
// In loop.ts, replace cron with:
while (true) {
  await runCheckingLoop();
  const randomDelay = getRandomDelay(5, 30); // 5-30 seconds
  await sleep(randomDelay * 1000);
}
```

### 2. **CRITICAL - Add Randomization**
**Problem:** Fixed cron schedule is detectable
**Impact:** Could be rate-limited or banned
**Fix:** Add random delay within each check cycle

```typescript
// In loop.ts, before runCheckingLoop():
export async function runCheckingLoop(): Promise<void> {
  // Add random delay at start
  const randomDelay = getRandomDelay(0, 10); // 0-10 sec random
  await sleep(randomDelay * 1000);

  // ... rest of checking logic
}
```

### 3. **HIGH - Add Page Refresh**
**Problem:** Session may become stale without page navigation
**Impact:** Booking might fail due to stale state
**Fix:** Navigate to appointment page periodically

```typescript
// In session.ts, add to refreshSession():
export async function refreshSession(): Promise<void> {
  const page = getPage();

  // Navigate to appointment page to refresh state
  await page.goto(`https://ais.usvisa-info.com/${country}/niv/schedule/${userId}/appointment`, {
    waitUntil: 'networkidle'
  });

  await saveBrowserSession();
  // ... rest of validation
}
```

### 4. **HIGH - Implement True Continuous Loop**
**Problem:** Cron-based approach has gaps
**Impact:** Less aggressive than V2
**Fix:** Replace cron with continuous loop + time window check

```typescript
// In index.ts, replace startScheduler() with:
async function runContinuousChecking(): Promise<void> {
  while (true) {
    if (!isWithinCheckingWindow()) {
      await sleep(5 * 60 * 1000); // Check again in 5 min
      continue;
    }

    try {
      await runCheckingLoop();
    } catch (error) {
      logger.error('Error in check:', error);
    }

    // Random delay like V2
    const delay = getRandomDelay(5, 30);
    await sleep(delay * 1000);
  }
}
```

### 5. **MEDIUM - Relax Concurrent Run Prevention**
**Problem:** Skips checks if previous run is still going
**Impact:** Could miss slots
**Fix:** Add timeout or allow queuing

```typescript
// In cron.ts, add timeout:
const TIMEOUT = 4 * 60 * 1000; // 4 minutes max

const runPromise = Promise.race([
  runCheckingLoop(),
  sleep(TIMEOUT).then(() => { throw new Error('Check timeout'); })
]);
```

### 6. **LOW - Add Notification System**
**Problem:** No alerts like V2
**Impact:** User not immediately aware of bookings
**Fix:** Add webhook support (Telegram bot, email, etc.)

---

## 📝 RECOMMENDED CONFIGURATION

### For High Frequency Checking (Like V2):

**.env Changes:**
```bash
# Replace cron-based with continuous loop
CHECK_INTERVAL_MIN=0.15  # 9 seconds average (will be randomized)

# Randomization settings (add these)
MIN_DELAY_SEC=5          # Minimum delay between checks
MAX_DELAY_SEC=30         # Maximum delay between checks

# Session refresh interval
SESSION_REFRESH_MIN=10   # Refresh page navigation every 10 min
```

### Estimated Performance After Fix:
- **Checks per minute:** 4-6 (matches V2)
- **Randomization:** 5-30 seconds (matches V2)
- **Session handling:** Page refresh every 10 min (matches V2)
- **Continuous operation:** True loop (matches V2)
- **Plus V3 advantages:** Database, encryption, Docker, reliability

---

## 🎯 CONCLUSION

### V3 Implementation Quality: **7/10**
- ✅ **Excellent architecture:** Docker, PostgreSQL, TypeScript
- ✅ **Great security:** Encryption, isolation, no plaintext
- ✅ **Good reliability:** Auto-restart, health checks, persistence
- ❌ **Critical flaw:** Check frequency 60x too slow
- ❌ **Critical flaw:** No randomization (bot detection risk)
- ❌ **Missing feature:** No page refresh navigation
- ⚠️ **Suboptimal:** Cron-based instead of continuous loop

### Issues Found:
1. 🚨 **CRITICAL:** Check frequency (5 min vs 5-30 sec)
2. 🚨 **CRITICAL:** No randomization (bot detection)
3. 🚨 **CRITICAL:** No page refresh navigation
4. 🚨 **HIGH:** Not truly continuous (cron gaps)
5. ⚠️ **MEDIUM:** Concurrent run prevention too strict
6. ℹ️ **LOW:** No user notifications

### After Fixes, Expected Rating: **9.5/10**
- V3 will have **all V2 benefits** (speed, randomization, continuous)
- **Plus** V3 advantages (security, persistence, 24/7 operation)
- **Superior** for production deployment

---

## 🚀 ACTION ITEMS

### Immediate (Must Do):
1. ✅ Update `.env.example` - change `CHECK_INTERVAL_MIN=5` to reflect seconds or continuous mode
2. ✅ Implement randomization in checking loop
3. ✅ Add page refresh navigation every 10 minutes
4. ✅ Replace cron scheduler with continuous loop

### Soon (Should Do):
5. ⚠️ Add timeout to concurrent run prevention
6. ⚠️ Add notification system (webhooks)
7. ⚠️ Add monitoring dashboard (optional)

### Testing Required:
- ✅ Verify check frequency matches V2 (4-6 per minute)
- ✅ Confirm randomization is working
- ✅ Test session refresh under load
- ✅ Validate continuous loop during time window
- ✅ Ensure booking still works with changes

---

**End of Analysis**
