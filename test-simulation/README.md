# IELTS Test Simulation Server

A lightweight Node.js/Express server that mimics the IELTS appointment booking website structure for testing the appointment monitoring system in a controlled environment.

## Overview

This simulation server provides:
- HTML pages that mimic the real IELTS website structure
- API endpoints to dynamically add/remove appointments
- Control scripts for testing different scenarios
- Realistic appointment data matching the monitoring system's expectations

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation

1. Navigate to the test-simulation directory:
```bash
cd test-simulation
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

The server will start on `http://localhost:3001`

## Usage

### Starting the Server

```bash
# Start the server
npm start

# Alternative (same as start)
npm run dev
```

The server serves:
- Main appointment page: `http://localhost:3001`
- API endpoints: `http://localhost:3001/api/appointments`

### Managing Appointments

#### Add New Appointments
```bash
# Add a single appointment with default values
npm run add-appointment

# Add multiple appointments
npm run add-appointment -- --count 3

# Add appointment with specific details
npm run add-appointment -- --date "2024-03-15" --time "14:00-17:00" --location "Tehran Test Center"
```

#### Clear All Appointments
```bash
# Remove all appointments (with confirmation)
npm run clear-all

# Force clear without confirmation
npm run clear-all -- --force
```

#### Reset to Demo State
```bash
# Restore default test appointments
npm run reset-demo
```

## Testing Scenarios

### Scenario 1: Empty to Available
Test monitoring system detection of new appointments:

```bash
# 1. Clear all appointments
npm run clear-all -- --force

# 2. Start monitoring system (in separate terminal)
# 3. Add new appointment
npm run add-appointment

# 4. Verify monitoring system detects the change
```

### Scenario 2: Multiple Appointments
Test handling of multiple simultaneous appointments:

```bash
# 1. Reset to clean state
npm run reset-demo

# 2. Add multiple appointments
npm run add-appointment -- --count 5

# 3. Monitor system response
```

### Scenario 3: Appointment Removal
Test monitoring system response to appointment removal:

```bash
# 1. Ensure appointments exist
npm run add-appointment -- --count 2

# 2. Clear appointments while monitoring
npm run clear-all -- --force
```

## Integration with Main Monitoring System

### Method 1: Environment Variable Override

Set the base URL to point to the simulation server:

```bash
# In the main project directory
IELTS_BASE_URL=http://localhost:3001 npm start
```

### Method 2: Configuration File Override

Create a test configuration file or modify existing config:

```json
{
  "baseUrl": "http://localhost:3001",
  "targetCities": ["Isfahan"],
  "examTypes": ["CDIELTS"],
  "checkInterval": 30000
}
```

### Method 3: Code Modification (Temporary)

For testing purposes, temporarily modify `WebScraperService.ts`:

```typescript
// In WebScraperService.ts
private buildRequestUrl(): string {
  // Temporary override for testing
  if (process.env.NODE_ENV === 'test') {
    return 'http://localhost:3001';
  }
  
  // Original logic...
}
```

## API Reference

### GET /api/appointments
Returns all current appointments as JSON.

**Response:**
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

### POST /api/appointments
Adds new appointment(s).

**Request Body:**
```json
{
  "date": "2024-03-15",
  "time": "14:00-17:00",
  "location": "Tehran Test Center",
  "examType": "IELTS",
  "city": "Tehran"
}
```

### DELETE /api/appointments
Removes all appointments.

**Response:** `204 No Content`

## File Structure

```
test-simulation/
├── server.js              # Main Express server
├── package.json           # Dependencies and scripts
├── README.md             # This file
├── public/               
│   ├── index.html         # Main appointment listing page
│   ├── styles.css         # CSS mimicking real site
│   └── appointments.js    # Client-side rendering
├── data/
│   └── appointments.json  # Dynamic appointment storage
└── scripts/
    ├── add-appointment.js # Add appointments script
    ├── clear-all.js       # Clear appointments script
    └── reset-demo.js      # Reset to demo state
```

## Troubleshooting

### Port Already in Use
If port 3001 is busy, set a different port:
```bash
PORT=3002 npm start
```

### Permission Errors
Ensure the process has write permissions to the `data/` directory:
```bash
chmod 755 data/
```

### Monitoring System Not Detecting Changes
1. Verify the monitoring system is configured to use `http://localhost:3001`
2. Check that the polling interval allows enough time for detection
3. Ensure CORS is properly configured (already handled by the server)

### Data File Corruption
If appointments.json becomes corrupted:
```bash
npm run reset-demo
```

## Development Notes

### Adding New Appointment Fields
To add new fields to appointments:

1. Update the default appointment structure in `scripts/add-appointment.js`
2. Modify the HTML template in `public/appointments.js`
3. Update CSS classes in `public/styles.css` if needed

### Modifying HTML Structure
The HTML structure in `public/index.html` and `public/appointments.js` should match the selectors expected by `WebScraperService`. Key classes include:
- `.appointment-card`
- `.timetable-item`
- `.exam-slot`
- `.appointment-item`

### Testing Integration
Always test changes with the actual monitoring system to ensure compatibility:

1. Start the simulation server
2. Configure monitoring system to use localhost:3001
3. Run through appointment addition/removal scenarios
4. Verify notifications and data parsing work correctly

## License

MIT License - Same as the main project.