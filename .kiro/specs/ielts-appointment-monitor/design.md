# Design Document

## Overview

The IELTS Appointment Monitor is a Node.js application that continuously monitors the irsafam.org website for new IELTS exam appointments. The system uses web scraping to check appointment availability, compares results against previous checks to detect new slots, and sends immediate notifications through multiple channels when new appointments are found.

## Architecture

The application follows a modular architecture with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLI Interface │    │  Configuration  │    │  Notification   │
│                 │    │    Manager      │    │    Service      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴───────────┐
                    │   Monitor Controller    │
                    │  (Main orchestrator)    │
                    └─────────────┬───────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
┌─────────┴───────┐    ┌─────────┴───────┐    ┌─────────┴───────┐
│  Web Scraper    │    │  Data Storage   │    │  Status Logger  │
│   Service       │    │    Service      │    │    Service      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Components and Interfaces

### 1. Monitor Controller
**Purpose:** Central orchestrator that manages the monitoring lifecycle
**Key Methods:**
- `startMonitoring(config)` - Initiates monitoring with specified configuration
- `pauseMonitoring()` - Temporarily pauses monitoring
- `stopMonitoring()` - Gracefully stops monitoring and saves state
- `getStatus()` - Returns current monitoring status and statistics

### 2. Web Scraper Service
**Purpose:** Handles HTTP requests and HTML parsing of the IELTS website
**Key Methods:**
- `fetchAppointments(filters)` - Retrieves current appointments from website
- `parseAppointmentData(html)` - Extracts appointment information from HTML
- `buildRequestUrl(filters)` - Constructs URL with proper query parameters

**Implementation Details:**
- Uses Puppeteer for robust web scraping to handle dynamic content
- Implements retry logic with exponential backoff for network failures
- Handles anti-bot measures with random delays and user-agent rotation
- Parses appointment cards to extract: date, time, location, availability status

### 3. Data Storage Service
**Purpose:** Manages appointment data persistence and comparison
**Key Methods:**
- `saveAppointments(appointments)` - Stores current appointment snapshot
- `getLastAppointments()` - Retrieves previous appointment data
- `detectNewAppointments(current, previous)` - Identifies newly available slots
- `getNotificationHistory()` - Returns history of sent notifications

**Storage Format:**
```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "appointments": [
    {
      "id": "unique-appointment-id",
      "date": "2025-02-15",
      "time": "09:00-12:00",
      "location": "Isfahan Center",
      "examType": "CDIELTS",
      "status": "available"
    }
  ]
}
```

### 4. Notification Service
**Purpose:** Handles multi-channel notification delivery
**Key Methods:**
- `sendDesktopNotification(appointments)` - Shows system notification
- `playAudioAlert()` - Plays notification sound
- `logNotification(appointments)` - Records notification in history

**Notification Channels:**
- Desktop notifications using `node-notifier`
- Audio alerts using system beep or custom sound file
- Console logging with colored output for visibility
- File logging for persistent notification history

### 5. Configuration Manager
**Purpose:** Manages user configuration and validation
**Key Methods:**
- `loadConfig()` - Loads configuration from file or prompts user
- `validateConfig(config)` - Validates configuration parameters
- `saveConfig(config)` - Persists configuration to file

**Configuration Schema:**
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

### 6. Status Logger Service
**Purpose:** Tracks monitoring statistics and system health
**Key Methods:**
- `logCheck(appointmentCount)` - Records each monitoring check
- `logError(error)` - Records errors with context
- `getStatistics()` - Returns monitoring statistics
- `exportLogs(format)` - Exports logs in specified format

## Data Models

### Appointment Model
```typescript
interface Appointment {
  id: string;
  date: string; // ISO date format
  time: string; // Time range (e.g., "09:00-12:00")
  location: string;
  examType: string;
  city: string;
  status: 'available' | 'full' | 'pending';
  price?: number;
  registrationUrl?: string;
}
```

### MonitoringSession Model
```typescript
interface MonitoringSession {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  checksPerformed: number;
  notificationsSent: number;
  errors: ErrorLog[];
  configuration: MonitorConfig;
}
```

### NotificationRecord Model
```typescript
interface NotificationRecord {
  timestamp: Date;
  appointmentCount: number;
  appointments: Appointment[];
  channels: string[]; // ['desktop', 'audio', 'log']
  deliveryStatus: 'success' | 'partial' | 'failed';
}
```

## Error Handling

### Network Errors
- Implement exponential backoff retry strategy (1s, 2s, 4s, 8s, max 60s)
- Log network failures with request details
- Continue monitoring after temporary failures
- Alert user if failures persist for more than 5 minutes

### Parsing Errors
- Gracefully handle HTML structure changes
- Log parsing failures with page content sample
- Notify user of potential website changes
- Provide fallback parsing strategies

### Notification Failures
- Retry failed notifications up to 3 times
- Log notification delivery status
- Continue monitoring even if notifications fail
- Provide alternative notification methods

## Testing Strategy

### Unit Testing
- Test each service component in isolation
- Mock external dependencies (HTTP requests, file system)
- Validate configuration parsing and validation logic
- Test appointment comparison and detection algorithms

### Integration Testing
- Test complete monitoring workflow end-to-end
- Verify notification delivery across all channels
- Test error recovery and retry mechanisms
- Validate data persistence and retrieval

### Manual Testing
- Test against live website with various filter combinations
- Verify notification timing and content accuracy
- Test monitoring pause/resume functionality
- Validate configuration management and user interface

### Performance Testing
- Monitor memory usage during extended monitoring sessions
- Test system resource consumption with frequent checks
- Validate application stability over 24+ hour periods
- Test concurrent notification handling