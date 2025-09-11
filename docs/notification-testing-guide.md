# Notification System Testing Guide

## Overview

The IELTS Appointment Monitor supports three types of notifications:
- 🖥️ **Desktop Notifications** - System popup notifications
- 🔊 **Audio Alerts** - System sounds/beeps
- 📝 **Log File Notifications** - Written to `logs/notifications.log`

## Quick Test (Recommended)

The fastest way to test if notifications are working:

```bash
node scripts/quick-notification-test.js
```

This will immediately send a test notification using all three channels. You should see:
- A desktop notification popup
- Hear a system sound
- A new entry in `logs/notifications.log`

## Comprehensive Testing

For thorough testing of all notification features:

```bash
node scripts/test-notifications.js
```

This runs 6 different tests:
1. Desktop notification only
2. Audio alert only  
3. Log file notification only
4. All notifications together
5. Single appointment notification
6. Notification history review

## Interactive Testing

For hands-on testing where you choose what to test:

```bash
node scripts/test-notifications.js --interactive
```

This gives you a menu to test specific notification types one by one.

## Real-time Monitoring

To watch for notifications as they happen:

```bash
# In one terminal, start the watcher
node scripts/watch-notifications.js

# In another terminal, trigger notifications
node scripts/quick-notification-test.js
```

The watcher will show new notifications in real-time as they're logged.

## Testing with the Full System

### 1. Start the Test Server
```bash
node test-simulation/server.js
```

### 2. Start Notification Monitoring
```bash
# In another terminal
node scripts/watch-notifications.js
```

### 3. Run the Monitoring System
```bash
# In another terminal
npm run dev
# or
node dist/index.js
```

### 4. Add Test Appointments
```bash
# Add appointments to trigger notifications
curl -X POST http://localhost:3001/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-1",
    "date": "2024-03-15",
    "time": "09:00",
    "location": "Test Center",
    "examType": "IELTS",
    "city": "Isfahan",
    "status": "available"
  }'
```

## Troubleshooting

### Desktop Notifications Not Showing

**macOS:**
- Check System Preferences > Notifications & Focus
- Ensure Terminal/Node.js has notification permissions
- Try: `System Preferences > Security & Privacy > Privacy > Notifications`

**Windows:**
- Check Windows Settings > System > Notifications & actions
- Ensure notifications are enabled for the system

**Linux:**
- Install `libnotify-bin`: `sudo apt-get install libnotify-bin`
- Check if notification daemon is running: `ps aux | grep notification`

### Audio Alerts Not Playing

**macOS:**
- Check System Preferences > Sound > Sound Effects
- Ensure system volume is up
- Try manually: `afplay /System/Library/Sounds/Glass.aiff`

**Windows:**
- Check system volume and sound settings
- Ensure system sounds are enabled

**Linux:**
- Install audio packages: `sudo apt-get install alsa-utils pulseaudio-utils`
- Test audio: `paplay /usr/share/sounds/alsa/Front_Left.wav`

### Log File Issues

**Permission Errors:**
```bash
# Ensure logs directory is writable
mkdir -p logs
chmod 755 logs
```

**File Not Created:**
- Check if the `logs/` directory exists
- Verify write permissions in the project directory

## Notification Configuration

The notification system uses this configuration structure:

```typescript
const notificationSettings = {
  desktop: true,   // Enable desktop notifications
  audio: true,     // Enable audio alerts
  logFile: true    // Enable log file notifications
};
```

## Log File Format

Notifications are logged in JSON format:

```json
{
  "timestamp": "2024-03-15T10:30:00.000Z",
  "event": "NEW_APPOINTMENTS_FOUND",
  "count": 2,
  "appointments": [
    {
      "id": "apt-1",
      "date": "2024-03-20",
      "time": "09:00",
      "location": "Isfahan Center",
      "examType": "IELTS",
      "city": "Isfahan"
    }
  ]
}
```

## Testing Checklist

- [ ] Desktop notifications appear as system popups
- [ ] Audio alerts play system sounds
- [ ] Log entries are written to `logs/notifications.log`
- [ ] Multiple appointments show correctly in notifications
- [ ] Single appointments show detailed information
- [ ] Notification history can be retrieved
- [ ] All notification channels work together
- [ ] Error handling works when channels fail

## Integration with Monitoring System

To test notifications with the full monitoring system:

1. **Configure monitoring** with notification settings
2. **Start monitoring** with `npm run dev`
3. **Add appointments** to the test server
4. **Verify notifications** are triggered automatically

The monitoring system will automatically send notifications when new appointments are detected during its checking cycle.

## Performance Notes

- Desktop notifications have a 10-second timeout
- Audio alerts include a 500ms delay to ensure sound plays
- Log file writes are asynchronous and shouldn't block the system
- Failed notifications are retried up to 3 times with exponential backoff

## Security Considerations

- Log files may contain appointment details - ensure proper file permissions
- Desktop notifications are visible to anyone using the computer
- Audio alerts will be audible to anyone nearby

---

**Need Help?** 
- Check the console output for detailed error messages
- Review the `logs/notifications.log` file for notification history
- Ensure all system permissions are properly configured