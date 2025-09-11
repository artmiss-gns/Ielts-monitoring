# Configuration Examples

This document provides comprehensive examples of different configuration setups for the IELTS Appointment Monitor.

## 📋 Basic Configuration

### Minimal Setup
Monitor IELTS appointments in Isfahan for the next 3 months:

```json
{
  "city": ["isfahan"],
  "examModel": ["cdielts"],
  "months": [12, 1, 2],
  "checkInterval": 30000,
  "notificationSettings": {
    "desktop": true,
    "audio": true,
    "logFile": true
  }
}
```

### Single City, Multiple Exam Types
Monitor both computer-delivered and paper-based IELTS in Tehran:

```json
{
  "city": ["tehran"],
  "examModel": ["cdielts", "ielts"],
  "months": [1, 2, 3],
  "checkInterval": 45000,
  "notificationSettings": {
    "desktop": true,
    "audio": false,
    "logFile": true
  }
}
```

## 🌍 Multi-City Configurations

### Major Cities Coverage
Monitor appointments in major Iranian cities:

```json
{
  "city": ["tehran", "isfahan", "mashhad", "shiraz"],
  "examModel": ["cdielts"],
  "months": [12, 1, 2, 3, 4],
  "checkInterval": 60000,
  "notificationSettings": {
    "desktop": true,
    "audio": true,
    "logFile": true
  }
}
```

### Regional Focus
Focus on specific regions (example: Central Iran):

```json
{
  "city": ["isfahan", "yazd", "kashan"],
  "examModel": ["cdielts", "ielts"],
  "months": [1, 2, 3],
  "checkInterval": 30000,
  "notificationSettings": {
    "desktop": true,
    "audio": true,
    "logFile": true
  }
}
```

## 🎯 Exam Type Specific Configurations

### Computer-Delivered IELTS Only
Optimized for CD-IELTS monitoring:

```json
{
  "city": ["tehran", "isfahan"],
  "examModel": ["cdielts"],
  "months": [12, 1, 2],
  "checkInterval": 20000,
  "notificationSettings": {
    "desktop": true,
    "audio": true,
    "logFile": true
  }
}
```

### UKVI IELTS Focus
For UK visa applications:

```json
{
  "city": ["tehran", "isfahan", "mashhad"],
  "examModel": ["ukvi"],
  "months": [1, 2, 3, 4],
  "checkInterval": 30000,
  "notificationSettings": {
    "desktop": true,
    "audio": true,
    "logFile": true
  }
}
```

### All Exam Types
Monitor all available IELTS exam types:

```json
{
  "city": ["tehran"],
  "examModel": ["cdielts", "ielts", "ukvi"],
  "months": [12, 1, 2, 3],
  "checkInterval": 45000,
  "notificationSettings": {
    "desktop": true,
    "audio": false,
    "logFile": true
  }
}
```

## ⏰ Timing Configurations

### High Frequency Monitoring
For urgent appointment needs (use carefully):

```json
{
  "city": ["isfahan"],
  "examModel": ["cdielts"],
  "months": [12, 1],
  "checkInterval": 15000,
  "notificationSettings": {
    "desktop": true,
    "audio": true,
    "logFile": true
  }
}
```

### Conservative Monitoring
Gentle monitoring to avoid server load:

```json
{
  "city": ["tehran", "isfahan"],
  "examModel": ["cdielts"],
  "months": [1, 2, 3, 4, 5, 6],
  "checkInterval": 120000,
  "notificationSettings": {
    "desktop": true,
    "audio": false,
    "logFile": true
  }
}
```

### Business Hours Only
Monitor during typical business hours (requires custom scheduling):

```json
{
  "city": ["tehran"],
  "examModel": ["cdielts"],
  "months": [1, 2, 3],
  "checkInterval": 30000,
  "schedule": {
    "enabled": true,
    "startHour": 8,
    "endHour": 18,
    "weekdaysOnly": true
  },
  "notificationSettings": {
    "desktop": true,
    "audio": false,
    "logFile": true
  }
}
```

## 🔔 Notification Configurations

### Silent Monitoring
Log-only notifications for background monitoring:

```json
{
  "city": ["isfahan", "tehran"],
  "examModel": ["cdielts"],
  "months": [12, 1, 2],
  "checkInterval": 60000,
  "notificationSettings": {
    "desktop": false,
    "audio": false,
    "logFile": true
  }
}
```

### Audio Alerts Only
For users who prefer sound notifications:

```json
{
  "city": ["tehran"],
  "examModel": ["cdielts", "ielts"],
  "months": [1, 2, 3],
  "checkInterval": 30000,
  "notificationSettings": {
    "desktop": false,
    "audio": true,
    "logFile": true
  }
}
```

### Maximum Notifications
All notification channels enabled:

```json
{
  "city": ["isfahan"],
  "examModel": ["cdielts"],
  "months": [12, 1, 2],
  "checkInterval": 30000,
  "notificationSettings": {
    "desktop": true,
    "audio": true,
    "logFile": true,
    "email": {
      "enabled": true,
      "smtp": {
        "host": "smtp.gmail.com",
        "port": 587,
        "secure": false,
        "auth": {
          "user": "your-email@gmail.com",
          "pass": "your-app-password"
        }
      },
      "to": ["your-email@gmail.com"],
      "subject": "IELTS Appointment Found!"
    }
  }
}
```

## 🎓 Use Case Specific Configurations

### Student Configuration
For students with flexible timing:

```json
{
  "city": ["isfahan", "tehran", "shiraz"],
  "examModel": ["cdielts", "ielts"],
  "months": [1, 2, 3, 4, 5, 6],
  "checkInterval": 45000,
  "notificationSettings": {
    "desktop": true,
    "audio": true,
    "logFile": true
  }
}
```

### Professional Configuration
For working professionals with specific timing needs:

```json
{
  "city": ["tehran"],
  "examModel": ["cdielts"],
  "months": [2, 3, 4],
  "checkInterval": 30000,
  "preferences": {
    "preferredDays": ["saturday", "sunday"],
    "preferredTimes": ["morning", "evening"]
  },
  "notificationSettings": {
    "desktop": true,
    "audio": false,
    "logFile": true
  }
}
```

### Urgent Application
For urgent visa or university applications:

```json
{
  "city": ["tehran", "isfahan", "mashhad", "shiraz", "tabriz"],
  "examModel": ["cdielts", "ielts", "ukvi"],
  "months": [12, 1, 2],
  "checkInterval": 20000,
  "notificationSettings": {
    "desktop": true,
    "audio": true,
    "logFile": true
  }
}
```

## 🔧 Advanced Configurations

### Development/Testing Configuration
For developers testing the application:

```json
{
  "city": ["isfahan"],
  "examModel": ["cdielts"],
  "months": [12],
  "checkInterval": 10000,
  "debug": {
    "enabled": true,
    "verbose": true,
    "mockData": false
  },
  "notificationSettings": {
    "desktop": true,
    "audio": false,
    "logFile": true
  }
}
```

### Backup Configuration
Minimal configuration for backup monitoring:

```json
{
  "city": ["tehran"],
  "examModel": ["cdielts"],
  "months": [1, 2],
  "checkInterval": 300000,
  "notificationSettings": {
    "desktop": false,
    "audio": false,
    "logFile": true
  }
}
```

### Load Testing Configuration
For testing server response (use responsibly):

```json
{
  "city": ["isfahan"],
  "examModel": ["cdielts"],
  "months": [12],
  "checkInterval": 5000,
  "testing": {
    "enabled": true,
    "maxRequests": 100,
    "respectRateLimit": true
  },
  "notificationSettings": {
    "desktop": false,
    "audio": false,
    "logFile": true
  }
}
```

## 📊 Performance Optimized Configurations

### Low Resource Usage
Optimized for systems with limited resources:

```json
{
  "city": ["isfahan"],
  "examModel": ["cdielts"],
  "months": [1, 2],
  "checkInterval": 90000,
  "performance": {
    "lowMemoryMode": true,
    "reducedLogging": true,
    "cacheSize": 50
  },
  "notificationSettings": {
    "desktop": true,
    "audio": false,
    "logFile": false
  }
}
```

### High Performance
For systems that can handle intensive monitoring:

```json
{
  "city": ["tehran", "isfahan", "mashhad", "shiraz"],
  "examModel": ["cdielts", "ielts", "ukvi"],
  "months": [12, 1, 2, 3, 4, 5],
  "checkInterval": 15000,
  "performance": {
    "parallelRequests": 3,
    "cacheSize": 1000,
    "detailedLogging": true
  },
  "notificationSettings": {
    "desktop": true,
    "audio": true,
    "logFile": true
  }
}
```

## 🌐 Network Specific Configurations

### Proxy Configuration
For users behind corporate firewalls:

```json
{
  "city": ["tehran"],
  "examModel": ["cdielts"],
  "months": [1, 2, 3],
  "checkInterval": 45000,
  "network": {
    "proxy": {
      "host": "proxy.company.com",
      "port": 8080,
      "auth": {
        "username": "your-username",
        "password": "your-password"
      }
    },
    "timeout": 30000,
    "retries": 3
  },
  "notificationSettings": {
    "desktop": true,
    "audio": false,
    "logFile": true
  }
}
```

### Slow Connection Configuration
Optimized for slow internet connections:

```json
{
  "city": ["isfahan"],
  "examModel": ["cdielts"],
  "months": [1, 2],
  "checkInterval": 120000,
  "network": {
    "timeout": 60000,
    "retries": 5,
    "retryDelay": 10000
  },
  "notificationSettings": {
    "desktop": true,
    "audio": false,
    "logFile": true
  }
}
```

## 📱 Platform Specific Configurations

### Windows Configuration
Optimized for Windows systems:

```json
{
  "city": ["tehran", "isfahan"],
  "examModel": ["cdielts"],
  "months": [1, 2, 3],
  "checkInterval": 30000,
  "platform": {
    "windows": {
      "useWindowsNotifications": true,
      "soundFile": "C:\\Windows\\Media\\notify.wav"
    }
  },
  "notificationSettings": {
    "desktop": true,
    "audio": true,
    "logFile": true
  }
}
```

### macOS Configuration
Optimized for macOS systems:

```json
{
  "city": ["tehran", "isfahan"],
  "examModel": ["cdielts"],
  "months": [1, 2, 3],
  "checkInterval": 30000,
  "platform": {
    "macos": {
      "useNativeNotifications": true,
      "soundName": "Glass"
    }
  },
  "notificationSettings": {
    "desktop": true,
    "audio": true,
    "logFile": true
  }
}
```

### Linux Configuration
Optimized for Linux systems:

```json
{
  "city": ["tehran", "isfahan"],
  "examModel": ["cdielts"],
  "months": [1, 2, 3],
  "checkInterval": 30000,
  "platform": {
    "linux": {
      "useLibnotify": true,
      "soundCommand": "paplay /usr/share/sounds/alsa/Front_Left.wav"
    }
  },
  "notificationSettings": {
    "desktop": true,
    "audio": true,
    "logFile": true
  }
}
```

## 🔒 Security Configurations

### Secure Configuration
With enhanced security settings:

```json
{
  "city": ["tehran"],
  "examModel": ["cdielts"],
  "months": [1, 2, 3],
  "checkInterval": 30000,
  "security": {
    "validateSSL": true,
    "userAgent": "Mozilla/5.0 (compatible; IELTS-Monitor)",
    "maxRedirects": 3,
    "allowInsecureConnections": false
  },
  "notificationSettings": {
    "desktop": true,
    "audio": false,
    "logFile": true
  }
}
```

## 📝 Configuration Validation

### Valid Configuration Checklist

✅ **Required Fields:**
- `city`: Array of valid city names
- `examModel`: Array of valid exam types
- `months`: Array of numbers (1-12)
- `checkInterval`: Number (minimum 5000ms recommended)
- `notificationSettings`: Object with boolean values

✅ **Valid Cities:**
- `isfahan`, `tehran`, `mashhad`, `shiraz`, `tabriz`, `yazd`, `kashan`

✅ **Valid Exam Models:**
- `cdielts` (Computer Delivered IELTS)
- `ielts` (Paper-based IELTS)
- `ukvi` (IELTS for UKVI)

✅ **Recommended Check Intervals:**
- Minimum: 15000ms (15 seconds)
- Recommended: 30000ms (30 seconds)
- Conservative: 60000ms (1 minute)
- Very conservative: 120000ms (2 minutes)

### Configuration Validation Command

```bash
# Validate your configuration
ielts-monitor configure --validate

# Test configuration without starting
ielts-monitor start --dry-run --config your-config.json
```

## 🚨 Important Notes

1. **Rate Limiting**: Don't set `checkInterval` below 15000ms to avoid overwhelming the server
2. **Resource Usage**: More cities and exam types = higher resource usage
3. **Network Courtesy**: Be respectful of the target website's resources
4. **Legal Compliance**: Ensure your monitoring complies with the website's terms of service
5. **Data Privacy**: Configuration files may contain sensitive information - protect them appropriately

## 📞 Support

If you need help with configuration:

1. Use the interactive configuration: `ielts-monitor configure`
2. Check the troubleshooting guide: `docs/TROUBLESHOOTING.md`
3. Validate your configuration: `ielts-monitor configure --validate`
4. Test with dry run: `ielts-monitor start --dry-run`

---

**Happy monitoring! 🎯**