# Enhanced Test Simulation Server

This enhanced version of the test simulation server provides comprehensive testing capabilities for the IELTS appointment detection algorithm, specifically designed to validate the mixed appointment status detection logic.

## Features

### Mixed Appointment Status Support
- **Filled Appointments**: Appointments with `disabled` class and `تکمیل ظرفیت` text
- **Available Appointments**: Appointments with active registration buttons and `قابل ثبت نام` text  
- **Unknown Status**: Appointments without clear status indicators

### IELTS-Compatible HTML Structure
The server generates HTML that matches the real IELTS website structure:
```html
<a class="exam__item ielts [disabled]">
  <time>
    <date><span>27 Oct</span><span>2025</span></date>
  </time>
  <em>ظهر (۱۳:۳۰ - ۱۶:۳۰)</em>
  <h5>اصفهان (ایده نواندیش)</h5>
  <span class="exam_type">cdielts - (Ac/Gt)</span>
  <h6>۲۹۱,۱۱۵,۰۰۰ ریال</h6>
  <span class="farsi_date">۱۴۰۴/۰۸/۰۵</span>
  <span class="btn [disable|register]">[تکمیل ظرفیت|قابل ثبت نام]</span>
</a>
```

## Usage

### 1. Start the Server
```bash
npm start
```
The server will run on `http://localhost:3001`

### 2. Add Mixed Test Data
```bash
npm run add-mixed
```
This adds a variety of appointments with different statuses:
- 2 filled appointments (with `disabled` class and `تکمیل ظرفیت`)
- 2 available appointments (with active buttons and `قابل ثبت نام`)
- 1 unknown status appointment (without clear indicators)

### 3. View the IELTS Timetable
Navigate to: `http://localhost:3001/ielts/timetable`

This page displays appointments using the exact HTML structure that the detection algorithm expects.

### 4. Test Detection Logic
```bash
npm run test-detection
```
This runs a comprehensive test of the detection algorithm against the simulation server.

### 5. Validate Mixed Detection
```bash
npm run validate-detection
```
This runs a complete validation workflow that:
- Starts the server
- Adds mixed test data
- Tests the detection logic
- Validates the results
- Generates a detailed report

## API Endpoints

### Core Endpoints
- `GET /api/appointments` - Get all appointments
- `POST /api/appointments` - Add a new appointment
- `PUT /api/appointments/:id` - Update an appointment
- `DELETE /api/appointments` - Clear all appointments
- `POST /api/reset-test-data` - Reset to default test data

### Web Pages
- `GET /` - Main index page
- `GET /ielts/timetable` - IELTS-compatible timetable page
- `GET /health` - Server health check

## Test Data Structure

Each appointment includes:
```json
{
  "id": "appointment-id",
  "date": "2025-11-10",
  "time": "ظهر (۱۳:۳۰ - ۱۶:۳۰)",
  "location": "اصفهان (ایده نواندیش)",
  "city": "Isfahan",
  "examType": "cdielts - (Ac/Gt)",
  "price": "۲۹۱,۱۱۵,۰۰۰ ریال",
  "persianDate": "۱۴۰۴/۰۸/۱۹",
  "status": "available|filled|unknown",
  "filledIndicators": ["disabled", "تکمیل ظرفیت"],
  "availableIndicators": ["قابل ثبت نام", "active-button"],
  "registrationUrl": "https://example.com/register"
}
```

## Detection Algorithm Validation

The server validates that the detection algorithm:

### ✅ Correctly Identifies Filled Appointments
- Detects `disabled` CSS class
- Recognizes `تکمیل ظرفیت` text
- Identifies `btn disable` button class
- Never marks filled appointments as available

### ✅ Correctly Identifies Available Appointments  
- Detects active registration buttons
- Recognizes `قابل ثبت نام` text
- Identifies clickable registration links
- Only marks as available when explicit indicators are present

### ✅ Conservative Unknown Status Handling
- Marks unclear appointments as `unknown`
- Never defaults to `available` without explicit indicators
- Prioritizes filled indicators over available indicators

## Integration with WebScraperService

The WebScraperService automatically detects localhost URLs and switches to API mode, making it seamless to test against this simulation server:

```typescript
const webScraperService = new WebScraperService('http://localhost:3001');
const appointments = await webScraperService.fetchAppointments(filters);
```

## Validation Reports

The validation scripts generate detailed reports in the `logs/` directory:
- `detection-test-results-*.json` - Detailed detection results
- `validation-report-*.json` - Complete validation workflow results

These reports include:
- Total appointments processed
- Status breakdown (filled/available/unknown)
- Detection accuracy metrics
- Sample HTML for each appointment type
- Validation check results

## Requirements Satisfied

This enhanced server satisfies the following task requirements:

- **4.2**: Test detection logic against simulation server with mixed appointment statuses ✅
- **4.3**: Validate that available appointments in simulation are correctly detected as "available" ✅  
- **4.5**: Document detection results and HTML patterns found ✅

The server provides a comprehensive testing environment that ensures the appointment detection algorithm works correctly with both filled and available appointments, preventing false positive notifications.