# Design Document

## Overview

The test simulation server is a lightweight Node.js/Express application that mimics the IELTS appointment booking website (irsafam.org) structure and behavior. It serves HTML pages with appointment data that can be dynamically modified through API endpoints, allowing developers to test the monitoring system's detection and notification capabilities in a controlled environment.

## Architecture

### High-Level Architecture

```
test-simulation/
├── server.js              # Main Express server
├── package.json           # Dependencies (express, cors)
├── public/               
│   ├── index.html         # Main appointment listing page
│   ├── styles.css         # CSS mimicking real site structure
│   └── appointments.js    # Client-side appointment rendering
├── data/
│   └── appointments.json  # Dynamic appointment data store
└── scripts/
    ├── add-appointment.js # Script to add new appointments
    ├── clear-all.js       # Script to clear appointments
    └── reset-demo.js      # Script to reset to demo state
```

### Server Components

1. **Express Web Server** (Port 3001)
   - Serves static HTML pages mimicking IELTS site structure
   - Provides REST API for appointment management
   - Uses CORS to allow cross-origin requests

2. **Data Store** (JSON file)
   - Simple file-based storage for appointment data
   - Matches the `Appointment` interface from main project
   - Persists between server restarts

3. **Control Scripts**
   - Command-line utilities to modify appointment data
   - Trigger new appointments for testing scenarios

## Components and Interfaces

### Web Server Endpoints

#### Static Routes
- `GET /` - Main appointment listing page (mimics irsafam.org/ielts/timetable)
- `GET /styles.css` - CSS styling to match real site structure
- `GET /appointments.js` - Client-side JavaScript for dynamic updates

#### API Routes
- `GET /api/appointments` - Returns current appointment data as JSON
- `POST /api/appointments` - Adds new appointment(s)
- `DELETE /api/appointments` - Clears all appointments
- `PUT /api/appointments/:id` - Updates specific appointment

### HTML Structure

The main page (`/`) will mimic the real IELTS website structure that the scraper expects:

```html
<!DOCTYPE html>
<html>
<head>
    <title>IELTS Test Simulation - Appointment Timetable</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div class="container">
        <h1>IELTS Appointment Timetable - Test Simulation</h1>
        <div id="appointments-container">
            <!-- Appointment cards will be rendered here -->
        </div>
    </div>
    <script src="/appointments.js"></script>
</body>
</html>
```

### Appointment Card Structure

Each appointment will be rendered as a card matching the selectors the scraper looks for:

```html
<div class="appointment-card exam timetable-item">
    <div class="appointment-date">2024-01-15</div>
    <div class="appointment-time">09:00-12:00</div>
    <div class="appointment-location">Isfahan Test Center</div>
    <div class="appointment-type">CDIELTS</div>
    <div class="appointment-city">Isfahan</div>
    <div class="appointment-status available">Available</div>
    <div class="appointment-price">2,500,000 Toman</div>
    <a href="/register/123" class="registration-link">Register</a>
</div>
```

## Data Models

### Appointment Data Structure

The simulation uses the same `Appointment` interface as the main project:

```typescript
interface Appointment {
  id: string;
  date: string;        // YYYY-MM-DD format
  time: string;        // HH:MM-HH:MM format
  location: string;
  examType: string;    // "IELTS" or "CDIELTS"
  city: string;
  status: 'available' | 'full' | 'pending';
  price?: number;
  registrationUrl?: string;
}
```

### Default Test Data

The server starts with sample appointments matching the current config (Isfahan, CDIELTS):

```json
[
  {
    "id": "test-appointment-1",
    "date": "2024-02-15",
    "time": "09:00-12:00",
    "location": "Isfahan Test Center",
    "examType": "CDIELTS",
    "city": "Isfahan",
    "status": "available",
    "price": 2500000,
    "registrationUrl": "/register/test-1"
  }
]
```

## Error Handling

### Server Error Handling
- Graceful handling of file I/O errors when reading/writing appointment data
- Proper HTTP status codes for API responses
- Fallback to empty appointments array if data file is corrupted

### Script Error Handling
- Validation of appointment data before adding
- Clear error messages for invalid operations
- Automatic creation of data directory/file if missing

## Testing Strategy

### Manual Testing Workflow

1. **Start the simulation server**
   ```bash
   cd test-simulation
   npm start
   ```

2. **Configure monitoring system** to point to `http://localhost:3001`
   - Temporarily modify the base URL in WebScraperService
   - Or use environment variable override

3. **Test scenarios**:
   - Start with no appointments
   - Add appointments using trigger script
   - Verify monitoring system detects changes
   - Check notifications are sent correctly

### Trigger Scripts Usage

```bash
# Add a new appointment
node scripts/add-appointment.js

# Add multiple appointments
node scripts/add-appointment.js --count 3

# Clear all appointments
node scripts/clear-all.js

# Reset to demo state
node scripts/reset-demo.js
```

### Integration with Main Project

The simulation server can be integrated with the main monitoring system by:

1. **Environment Variable Override**:
   ```bash
   IELTS_BASE_URL=http://localhost:3001 npm start
   ```

2. **Configuration Override**:
   - Modify `WebScraperService.buildRequestUrl()` to use test URL when in test mode

3. **Test Configuration**:
   - Create a separate config file for testing that points to localhost

## Implementation Notes

### CSS Classes for Scraper Compatibility

The CSS will include all the classes that the scraper looks for:
- `.appointment-card`
- `.timetable-item`
- `.exam-slot`
- `.appointment-item`
- `[data-appointment]`
- `.card`

### Dynamic Updates

The client-side JavaScript will:
- Poll the `/api/appointments` endpoint every 5 seconds
- Re-render appointment cards when data changes
- Provide visual feedback when appointments are added/removed

### Port Configuration

- Default port: 3001 (different from typical development servers)
- Configurable via environment variable: `PORT=3001`
- Automatic port detection if 3001 is busy

This design ensures the simulation server provides a realistic testing environment while remaining completely isolated from the main codebase.