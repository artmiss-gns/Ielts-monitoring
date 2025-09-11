# End-to-End IELTS Monitor Testing Guide

## 🎯 Complete Testing Scenario

This guide shows you how to test the complete IELTS monitoring system using the test simulation server, exactly as you requested!

## 📋 What We'll Test

1. **IELTS Monitor Service** - Configured to watch the test server instead of irsafam.org
2. **Test Simulation Server** - Running on localhost:3001
3. **Real-time Detection** - Monitor detects new appointments when you add them
4. **Notifications** - System sends notifications when new appointments are found

## 🚀 Step-by-Step Testing

### Step 1: Start the Test Simulation Server

In **Terminal 1**:
```bash
node test-simulation/server.js
```

You should see:
```
IELTS Test Simulation Server running on http://localhost:3001
Press Ctrl+C to stop the server
```

### Step 2: Start the IELTS Monitor (Configured for Test Server)

In **Terminal 2**:
```bash
node scripts/run-test-monitoring.js
```

You should see:
```
🚀 Starting IELTS Monitor with Test Server Configuration

📋 Loaded test configuration:
   🏙️  Cities: Isfahan, Tehran
   📚 Exam Models: IELTS
   📅 Months: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12
   ⏱️  Check Interval: 5000ms
   🔔 Notifications: Desktop=true, Audio=true, Log=true

🎯 Monitoring test server: http://localhost:3001

🏁 Starting monitoring...
✅ Monitoring started successfully!

💡 Instructions:
   1. Keep this terminal open to see monitoring activity
   2. In another terminal, add appointments to trigger notifications
   3. Watch for notifications in this terminal!
   4. Press Ctrl+C to stop monitoring

✅ [19:30:15] Check completed - 0 appointments found
```

### Step 3: Add Test Appointments (This Triggers Notifications!)

In **Terminal 3**:

#### Option A: Use the helper script
```bash
node scripts/add-test-appointment.js
```

#### Option B: Use curl directly
```bash
curl -X POST http://localhost:3001/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-1",
    "date": "2024-03-15",
    "time": "09:00",
    "location": "Isfahan Test Center",
    "examType": "IELTS",
    "city": "Isfahan",
    "status": "available"
  }'
```

#### Option C: Add multiple appointments
```bash
# Add first appointment
node scripts/add-test-appointment.js

# Wait a few seconds, then add another
curl -X POST http://localhost:3001/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-2",
    "date": "2024-03-20",
    "time": "14:30",
    "location": "Tehran Test Center",
    "examType": "IELTS",
    "city": "Tehran",
    "status": "available"
  }'
```

### Step 4: Watch the Magic Happen! ✨

In **Terminal 2** (the monitoring terminal), you should see:

```
🔍 Fetching appointments from test server API: http://localhost:3001
📊 Found 1 appointments matching filters
🔍 Found 1 appointments
   1. 2024-03-15 at 09:00 - Isfahan Test Center (Isfahan)
🆕 NEW APPOINTMENTS DETECTED! Count: 1
   🎉 1. 2024-03-15 at 09:00 - Isfahan Test Center (Isfahan)

🔔 Notification sent for 1 appointments
✅ [19:30:20] Check completed - 1 appointments found
```

**You should also see/hear:**
- 🖥️ **Desktop notification popup**
- 🔊 **System sound/beep**
- 📝 **New entry in logs/notifications.log**

## 🔍 Advanced Testing Scenarios

### Test Different Cities
```bash
# Add appointment for Tehran (should be detected)
curl -X POST http://localhost:3001/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "id": "tehran-1",
    "date": "2024-04-01",
    "time": "10:00",
    "location": "Tehran Center",
    "examType": "IELTS",
    "city": "Tehran",
    "status": "available"
  }'

# Add appointment for Shiraz (should be filtered out)
curl -X POST http://localhost:3001/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "id": "shiraz-1",
    "date": "2024-04-01",
    "time": "10:00",
    "location": "Shiraz Center",
    "examType": "IELTS",
    "city": "Shiraz",
    "status": "available"
  }'
```

### Test Appointment Updates
```bash
# Update an existing appointment
curl -X PUT http://localhost:3001/api/appointments/test-1 \
  -H "Content-Type: application/json" \
  -d '{
    "time": "11:00",
    "status": "full"
  }'
```

### Clear All Appointments
```bash
curl -X DELETE http://localhost:3001/api/appointments
```

## 📊 Monitoring What Happens

### Watch Notification Log in Real-Time
In **Terminal 4**:
```bash
node scripts/watch-notifications.js
```

### Check Test Server Status
```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/appointments
```

## 🎛️ Configuration Options

You can modify `config/test-config.json` to change:

```json
{
  "city": ["Isfahan", "Tehran"],           // Cities to monitor
  "examModel": ["IELTS"],                  // Exam types
  "months": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // Months
  "checkInterval": 5000,                   // Check every 5 seconds
  "notificationSettings": {
    "desktop": true,                       // Desktop notifications
    "audio": true,                         // Sound alerts
    "logFile": true                        // Log to file
  }
}
```

## 🔧 Troubleshooting

### Monitor Not Starting
- Ensure test server is running first
- Check that port 3001 is not blocked
- Verify the build completed successfully

### No Notifications
- Check notification permissions on your system
- Verify `logs/notifications.log` is being created
- Test notifications separately: `node scripts/quick-notification-test.js`

### Appointments Not Detected
- Verify appointments match the filter criteria (city, exam type, months)
- Check the monitoring terminal for error messages
- Ensure appointments have all required fields

## 🎉 Expected Results

When everything works correctly, you should see:

1. **Monitor starts** and begins checking every 5 seconds
2. **New appointments are detected** when you add them via API
3. **Notifications are sent** through all enabled channels
4. **Real-time updates** in the monitoring terminal
5. **Log entries** created in `logs/notifications.log`

## 🛑 Stopping the Test

To stop everything:
1. Press **Ctrl+C** in the monitoring terminal (Terminal 2)
2. Press **Ctrl+C** in the test server terminal (Terminal 1)
3. Press **Ctrl+C** in any other terminals

## 📝 Summary

This setup gives you a complete end-to-end test of the IELTS monitoring system:

- ✅ **Real monitoring service** running
- ✅ **Configured for test server** instead of production
- ✅ **Real-time appointment detection**
- ✅ **Actual notifications** (desktop, audio, log)
- ✅ **Configurable filters** (city, exam type, months)
- ✅ **Complete integration test**

Perfect for testing before deploying to production! 🚀