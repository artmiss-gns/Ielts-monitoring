# Testing with the Main IELTS Monitor System

## 🎯 The Real Deal - Using the Actual Main System

Now we'll test with the **actual main IELTS monitoring system** (not a custom script) configured to watch your test server!

## 📋 What We're Testing

1. **Main CLI System** - Using `ielts-monitor start` command
2. **Real Web Scraping** - Scraping the HTML page at localhost:3001
3. **Configuration-based** - Using config/monitor-config.json
4. **Complete Integration** - All real components working together

## 🚀 Step-by-Step Testing

### Step 1: Start the Test Simulation Server

In **Terminal 1**:
```bash
node test-simulation/server.js
```

You should see:
```
IELTS Test Simulation Server running on http://localhost:3001
```

### Step 2: Verify the HTML Interface Works

Open your browser and go to: http://localhost:3001

You should see the IELTS Test Center page with "No appointments available" initially.

### Step 3: Start the Main IELTS Monitor System

In **Terminal 2**:
```bash
npm run dev
# or
node dist/index.js start
```

You should see the main system start up and begin monitoring localhost:3001!

### Step 4: Add Appointments to Trigger Detection

In **Terminal 3**:

#### Add a test appointment:
```bash
curl -X POST http://localhost:3001/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "id": "main-test-1",
    "date": "2024-03-15",
    "time": "09:00",
    "location": "Isfahan Test Center",
    "examType": "IELTS",
    "city": "Isfahan",
    "status": "available"
  }'
```

#### Or use the helper script:
```bash
node scripts/add-test-appointment.js
```

### Step 5: Watch the Magic! ✨

**In Terminal 2** (main monitor), you should see:
- The system detecting new appointments
- Web scraping activity
- Notifications being sent
- Real-time monitoring logs

**In your browser** (refresh localhost:3001):
- The appointment should appear on the HTML page
- The scraper should detect it from the HTML

**System notifications**:
- Desktop notification popup
- Audio alert
- Log file entry

## 🔧 Configuration

The system uses `config/monitor-config.json`:

```json
{
  "city": ["Isfahan", "Tehran"],
  "examModel": ["IELTS", "CDIELTS"],
  "months": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  "checkInterval": 5000,
  "baseUrl": "http://localhost:3001",
  "notificationSettings": {
    "desktop": true,
    "audio": true,
    "logFile": true
  }
}
```

Key points:
- `baseUrl`: Points to your test server instead of irsafam.org
- `checkInterval`: 5000ms = checks every 5 seconds
- All notification types enabled

## 🎮 CLI Commands

### Start monitoring:
```bash
node dist/index.js start
```

### Check status:
```bash
node dist/index.js status
```

### Stop monitoring:
```bash
node dist/index.js stop
```

### View logs:
```bash
node dist/index.js logs
```

## 🔍 What Should Happen

1. **System starts** and reads config/monitor-config.json
2. **WebScraperService** connects to localhost:3001 (not irsafam.org)
3. **Every 5 seconds** it scrapes the HTML page for appointments
4. **When you add appointments** via API, they appear on the HTML page
5. **Next scrape cycle** detects the new appointments
6. **Notifications sent** through all enabled channels
7. **Real-time monitoring** continues until you stop it

## 🐛 Troubleshooting

### "Configuration not found" error:
```bash
# Make sure config directory exists
mkdir -p config
# Verify the config file exists
cat config/monitor-config.json
```

### "Cannot connect to localhost:3001":
- Ensure test server is running in Terminal 1
- Check: `curl http://localhost:3001/health`

### No appointments detected:
- Verify appointments appear on the HTML page: http://localhost:3001
- Check that appointments match filter criteria (city, exam type)
- Look for scraping errors in the monitor logs

## ✅ Success Indicators

When everything works correctly:

1. **Monitor starts** with "Monitoring started successfully"
2. **Regular check logs** every 5 seconds
3. **New appointments detected** when you add them
4. **Notifications sent** (desktop + audio + log file)
5. **HTML page updates** show the appointments
6. **Scraper finds them** on the next check cycle

## 🎉 This is the Real System!

Unlike our previous test scripts, this is using:
- ✅ The actual main CLI application
- ✅ Real WebScraperService with HTML parsing
- ✅ Real configuration system
- ✅ Complete monitoring workflow
- ✅ All production components

Perfect for validating the entire system before production deployment!