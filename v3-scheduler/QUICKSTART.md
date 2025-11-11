# V3 Quick Start Guide

## ⚡ 5-Minute Setup

### 1. Copy Environment File
```bash
cp .env.example .env
```

### 2. Edit Required Fields
```bash
# Minimum required configuration:
VISA_EMAIL=your_email@example.com
VISA_PASSWORD=your_password
DB_PASSWORD=any_secure_password
ENCRYPTION_KEY=run_this_command_to_generate_key
```

**Generate encryption key:**
```bash
openssl rand -hex 16
```
Copy output and paste into `ENCRYPTION_KEY=`

### 3. Run!
```bash
docker-compose up --build
```

### 4. Check Logs
```bash
# In another terminal
docker-compose logs -f scheduler
```

### Expected Output:
```
✅ Configuration valid
✅ Database connected
✅ Credentials saved (encrypted)
✅ Browser initialized
✅ Logged in successfully (User ID: 12345678)
✅ Scheduler started
🎯 V3 Scheduler is now running!
```

---

## 🛑 Stop Application
```bash
docker-compose down
```

---

## 🔍 View Database
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U visabot -d visa_scheduler

# View recent checks
SELECT * FROM appointment_checks ORDER BY check_time DESC LIMIT 5;

# View booking attempts
SELECT * FROM booking_attempts ORDER BY attempt_time DESC LIMIT 5;

# Exit
\q
```

---

## 🐛 Troubleshooting

### "ENCRYPTION_KEY must be 32 characters"
```bash
# Generate new key
openssl rand -hex 16

# Copy to .env
ENCRYPTION_KEY=<paste_here>
```

### "Login failed"
- Check email/password in `.env`
- Try logging in manually on website first

### "Database connection refused"
```bash
# Wait 10 seconds for database to start
docker-compose logs postgres

# Should see: "database system is ready"
```

### "Outside checking window"
- Normal! Application only runs 7pm-5am EST
- Wait for window to open, or change `CHECK_START_HOUR` in `.env`

---

## 📖 Full Documentation
See [README.md](./README.md) for complete guide.

---

## ✅ Success!
When you see logs like:
```
⏰ Scheduled check triggered
🔍 Checking 3 location(s): Toronto, Calgary, Vancouver
```

Your application is working! It will:
- Check every 5 minutes during 7pm-5am EST
- Book automatically when better dates found
- Continue checking for even earlier dates
- Run forever until you stop it

**That's it! 🎉**
