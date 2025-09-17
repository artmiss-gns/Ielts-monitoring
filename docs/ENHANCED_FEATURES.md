# Enhanced Monitoring Features Guide

This guide covers the new enhanced monitoring features introduced in the IELTS Appointment Monitor.

## 🔍 Inspection System

The inspection system provides detailed analysis of appointment data and website parsing results, making it easier to debug issues and understand system behavior.

### Quick Start

```bash
# View latest inspection data
ielts-monitor inspect

# Get detailed analysis
ielts-monitor inspect --detailed

# Export data for analysis
ielts-monitor inspect --export data.json --format json
```

## 📊 Inspection Commands Reference

### Basic Inspection

```bash
ielts-monitor inspect
```

Shows a summary of the latest inspection data including:
- Inspection ID and timestamp
- Website URL and page title
- Appointment counts (total, available, filled)
- Parsing notes and detected elements
- Basic statistics

### Detailed Inspection

```bash
ielts-monitor inspect --detailed
```

Provides comprehensive analysis including:
- Complete inspection report with all metadata
- Detailed appointment breakdown by status
- Raw HTML snippets for debugging
- Performance metrics and timing information
- Element detection analysis

### Export Inspection Data

```bash
# Export to JSON (structured data)
ielts-monitor inspect --export appointments.json --format json

# Export to CSV (spreadsheet-friendly)
ielts-monitor inspect --export appointments.csv --format csv

# Export to text (human-readable)
ielts-monitor inspect --export appointments.txt --format text

# Export with record limit
ielts-monitor inspect --export recent.json --format json --limit 10

# Export to console (no file)
ielts-monitor inspect --export console --format json
```

### View Specific Inspection

```bash
# View specific inspection by ID
ielts-monitor inspect --id inspection_1234567890_abc123
```

## 📈 Understanding Inspection Data

### Inspection Record Structure

Each inspection record contains:

```json
{
  "id": "inspection_1758122786837_4e1d2df7p",
  "timestamp": "2025-09-17T15:56:26.837Z",
  "data": {
    "url": "https://irsafam.org/ielts/timetable?city[]=isfahan&exam_model[]=cdielts",
    "pageTitle": "ثبت‌نام آزمون آیلتس | زمان‌بندی و مراکز برگزاری در ایران",
    "detectedElements": ["appointment-table", "status-indicators"],
    "parsingNotes": "Found Persian no-appointments indicator",
    "rawAppointmentHtml": ["<div>HTML snippets</div>"],
    "checkResult": {
      "type": "no-slots",
      "appointmentCount": 0,
      "availableCount": 0,
      "filledCount": 0,
      "timestamp": "2025-09-17T15:56:26.837Z",
      "url": "https://irsafam.org/ielts/timetable?...",
      "appointments": []
    }
  }
}
```

### Check Result Types

- **`available`**: Appointments are available for booking
- **`filled`**: All appointments are filled/unavailable
- **`no-slots`**: No appointment slots exist for the criteria
- **`mixed`**: Mix of available and filled appointments

### Statistics Explained

- **Total Records**: Number of inspection records stored locally
- **Latest/Oldest Inspection**: Time range of collected data
- **Avg Appointments/Check**: Average number of appointments found per check
- **Availability Rate**: Percentage of appointments that were available for booking

## 🛠️ Debugging with Inspection Data

### Common Debugging Scenarios

#### 1. No Appointments Detected

```bash
ielts-monitor inspect --detailed
```

Check:
- **Parsing Notes**: Look for error messages or parsing issues
- **Page Title**: Verify the correct page was loaded
- **Detected Elements**: See if expected page elements were found
- **Raw HTML**: Examine actual website content

#### 2. Parsing Errors

```bash
ielts-monitor inspect --export debug.json --format json
```

Analyze:
- **Raw HTML snippets**: Check for website structure changes
- **Detected Elements**: Verify expected elements are present
- **Parsing Notes**: Review detailed parsing analysis

#### 3. Performance Issues

```bash
ielts-monitor inspect
```

Monitor:
- **Response Times**: Check if website is responding slowly
- **Check Frequency**: Verify monitoring interval is appropriate
- **Statistics**: Look for trends in performance metrics

#### 4. Language Detection Issues

```bash
ielts-monitor inspect --detailed
```

Verify:
- **Page Title**: Should show Persian title if website loaded correctly
- **Parsing Notes**: Should mention Persian content detection
- **Element Detection**: Should identify Persian-specific elements

## 📤 Export Formats

### JSON Format

Structured data suitable for programmatic analysis:

```json
[
  {
    "id": "inspection_123",
    "timestamp": "2025-09-17T15:56:26.837Z",
    "data": {
      "url": "https://...",
      "pageTitle": "...",
      "checkResult": { ... }
    }
  }
]
```

### CSV Format

Spreadsheet-friendly format:

```csv
ID,Timestamp,URL,PageTitle,CheckType,TotalAppointments,AvailableCount,FilledCount,ParsingNotes
inspection_123,2025-09-17T15:56:26.837Z,https://...,Page Title,no-slots,0,0,0,"Parsing notes"
```

### Text Format

Human-readable format with detailed summaries:

```
=== INSPECTION SUMMARY ===
ID: inspection_123
Timestamp: 9/17/2025, 6:56:26 PM
URL: https://...
Page Title: ثبت‌نام آزمون آیلتس

--- PARSING RESULTS ---
Check Type: NO-SLOTS
Total Appointments: 0
Available Appointments: 0
Filled Appointments: 0

--- PARSING NOTES ---
Found Persian no-appointments indicator
=== END INSPECTION ===
```

## 🔧 Configuration

### Inspection Data Storage

Inspection data is stored in:
- **Location**: `data/inspection-data.json`
- **Max Records**: 50 (configurable)
- **Cleanup**: Automatic cleanup of old records
- **Format**: JSON with compression for large datasets

### Customizing Inspection Behavior

The inspection system can be configured through the DataInspectionService:

```javascript
// Example configuration (for developers)
const inspectionService = new DataInspectionService({
  dataDirectory: 'data',
  inspectionFile: 'inspection-data.json',
  maxInspectionRecords: 50,
  cleanupIntervalHours: 24
});
```

## 🚀 Advanced Usage

### Automated Analysis

```bash
# Export recent data for analysis
ielts-monitor inspect --export recent.json --format json --limit 20

# Get statistics for monitoring trends
ielts-monitor inspect | grep "Availability Rate"

# Check for specific patterns
ielts-monitor inspect --detailed | grep -i "error\|failed\|timeout"
```

### Integration with Other Tools

```bash
# Export to CSV for Excel analysis
ielts-monitor inspect --export analysis.csv --format csv

# Export to JSON for programmatic processing
ielts-monitor inspect --export data.json --format json
cat data.json | jq '.[] | select(.data.checkResult.availableCount > 0)'

# Monitor trends over time
ielts-monitor inspect --export console --format text | grep "Availability Rate"
```

## 📋 Best Practices

1. **Regular Inspection**: Check inspection data regularly to ensure monitoring is working correctly

2. **Export for Analysis**: Export data periodically for trend analysis and debugging

3. **Monitor Performance**: Keep an eye on response times and parsing efficiency

4. **Debug Issues Early**: Use detailed inspection when you notice unusual behavior

5. **Clean Up Data**: The system automatically cleans up old records, but you can manually manage data if needed

## 🆘 Troubleshooting

### Common Issues

**No inspection data available**
```bash
# Start monitoring first to generate data
ielts-monitor start
# Wait for at least one check cycle, then inspect
ielts-monitor inspect
```

**Export fails**
```bash
# Check file permissions
ls -la data/
# Ensure directory exists and is writable
mkdir -p data && chmod 755 data
```

**Inspection shows parsing errors**
```bash
# Check detailed report for specific error messages
ielts-monitor inspect --detailed
# Look for network issues, website changes, or parsing problems
```

**Performance issues**
```bash
# Check response times in inspection data
ielts-monitor inspect | grep -i "time\|performance"
# Consider adjusting check interval if website is slow
```

---

The enhanced inspection system provides powerful tools for monitoring, debugging, and analyzing your IELTS appointment monitoring system. Use these features to ensure optimal performance and quickly identify any issues.