# IELTS Appointment Monitor

🎯 **Automated monitoring system for IELTS exam appointments on irsafam.org website**

Never miss an IELTS appointment again! This tool continuously monitors the irsafam.org website for new appointment slots and sends instant notifications when they become available.

## ✨ Features

- 🔄 **Continuous Monitoring**: Automatically checks for new appointments every 30 seconds
- 🎯 **Smart Filtering**: Monitor specific cities, exam types, and months
- 📢 **Multi-Channel Notifications**: Desktop notifications, audio alerts, and file logging
- 🖥️ **CLI Interface**: Easy-to-use command-line interface with colored output
- 📊 **Status Tracking**: Real-time monitoring statistics and history
- 🛡️ **Error Recovery**: Robust error handling with automatic retry mechanisms
- ⚙️ **Configurable**: Flexible configuration options for personalized monitoring
- 🔍 **Enhanced Inspection**: Detailed appointment data analysis and debugging tools *(NEW!)*
- 📈 **Performance Monitoring**: Track parsing performance and system efficiency *(NEW!)*
- 📤 **Data Export**: Export inspection data in JSON, CSV, and text formats *(NEW!)*
- 🌐 **Multi-language Support**: Handles Persian and English content seamlessly *(NEW!)*

## 🚀 Quick Start

### Prerequisites

- Node.js >= 16.0.0
- npm or yarn

### Installation Options

#### Option 1: Global Installation (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd ielts-appointment-monitor

# Install dependencies and build
npm install
npm run build:prod

# Install globally for system-wide access
npm run install:global

# Now you can use the CLI from anywhere
ielts-monitor --help
```

#### Option 2: Local Installation

```bash
# Clone and install
git clone <repository-url>
cd ielts-appointment-monitor
npm install
npm run build

# Use the CLI locally
node dist/cli/index.js --help
```

#### Option 3: Package Installation

```bash
# Create a distributable package
npm run package

# This creates ielts-appointment-monitor-1.0.0.tgz
# Install the package globally
npm install -g ielts-appointment-monitor-1.0.0.tgz
```

### First Time Setup

1. **Configure your monitoring preferences:**
   ```bash
   ielts-monitor configure
   ```

2. **Start monitoring:**
   ```bash
   ielts-monitor start
   ```

3. **Check status:**
   ```bash
   ielts-monitor status
   ```

4. **Inspect monitoring results:** *(NEW!)*
   ```bash
   ielts-monitor inspect --detailed
   ```

### Example Enhanced Monitoring Session

```bash
# Start monitoring
$ ielts-monitor start
🚀 Starting IELTS Appointment Monitor...
✅ Monitor started successfully!

# Real-time output shows enhanced parsing
📊 [6:56:26 PM] Enhanced scraping result:
   Type: no-slots
   Total appointments: 0
   Available: 0
   Filled/Pending: 0
   Status: No appointment slots available

# Inspect detailed results
$ ielts-monitor inspect --detailed
🔍 IELTS Appointment Data Inspection

DETAILED INSPECTION REPORT
==================================================
Inspection ID: inspection_1758122786837_4e1d2df7p
URL: https://irsafam.org/ielts/timetable?city[]=isfahan
Page Title: ثبت‌نام آزمون آیلتس | زمان‌بندی و مراکز برگزاری در ایران

CHECK RESULTS SUMMARY
-------------------------
Result Type: no-slots
Total Appointments Found: 0
Available for Booking: 0
Filled/Unavailable: 0

PARSING ANALYSIS
-------------------------
Found Persian no-appointments indicator
==================================================
```

## 📖 Usage

### Basic Commands

```bash
# Start monitoring with default configuration
ielts-monitor start

# Configure monitoring settings
ielts-monitor configure

# Check current status
ielts-monitor status

# View logs
ielts-monitor logs

# Inspect latest appointment data (NEW!)
ielts-monitor inspect

# Stop monitoring
ielts-monitor stop

# Pause/resume monitoring
ielts-monitor pause
ielts-monitor resume
```

### Advanced Usage

```bash
# Start with custom configuration file
ielts-monitor start --config ./my-config.json

# Run in background (daemon mode)
ielts-monitor start --daemon

# Watch status continuously
ielts-monitor status --watch

# Follow logs in real-time
ielts-monitor logs --follow

# Get status as JSON
ielts-monitor status --json

# Enhanced inspection commands (NEW!)
ielts-monitor inspect --detailed                    # Detailed inspection report
ielts-monitor inspect --export data.json --format json  # Export to JSON
ielts-monitor inspect --export data.csv --format csv    # Export to CSV
ielts-monitor inspect --id inspection_123456789         # View specific inspection
```

## ⚙️ Configuration

The application uses a JSON configuration file to store your monitoring preferences. On first run, you'll be prompted to set up your configuration.

### Configuration Options

| Option | Description | Example |
|--------|-------------|---------|
| `city` | Cities to monitor | `["isfahan", "tehran"]` |
| `examModel` | IELTS exam types | `["cdielts", "ielts"]` |
| `months` | Months to check (1-12) | `[12, 1, 2]` |
| `checkInterval` | Check frequency (milliseconds) | `30000` |
| `notificationSettings` | Notification preferences | See below |

### Example Configuration

```json
{
  "city": ["isfahan", "tehran"],
  "examModel": ["cdielts"],
  "months": [12, 1, 2, 3],
  "checkInterval": 30000,
  "notificationSettings": {
    "desktop": true,
    "audio": true,
    "logFile": true
  }
}
```

### Available Options

**Cities:**
- `isfahan` - Isfahan
- `tehran` - Tehran  
- `mashhad` - Mashhad
- `shiraz` - Shiraz
- `tabriz` - Tabriz

**Exam Models:**
- `cdielts` - Computer Delivered IELTS
- `ielts` - Paper-based IELTS
- `ukvi` - IELTS for UKVI

## 📊 Monitoring Features

### Real-time Status Display

The CLI provides live updates with colored output:

- 🟢 **Green**: Monitoring active, successful operations
- 🟡 **Yellow**: Warnings, paused status
- 🔴 **Red**: Errors, stopped status
- 🔵 **Blue**: Information messages
- ⚪ **Gray**: Timestamps and secondary info

### 🔍 Enhanced Inspection System *(NEW!)*

The enhanced inspection system provides detailed analysis of appointment data and website parsing results:

#### Inspection Commands

```bash
# View latest inspection data
ielts-monitor inspect

# Get detailed inspection report
ielts-monitor inspect --detailed

# Export inspection data
ielts-monitor inspect --export appointments.json --format json
ielts-monitor inspect --export appointments.csv --format csv
ielts-monitor inspect --export appointments.txt --format text

# View specific inspection by ID
ielts-monitor inspect --id inspection_1234567890_abc123

# Export with limits
ielts-monitor inspect --export recent.json --format json --limit 10
```

#### What Inspection Data Includes

- **Website Response Analysis**: Page title, URL, and response status
- **Appointment Breakdown**: Total, available, and filled appointment counts
- **Raw HTML Snippets**: Original website HTML for debugging
- **Parsing Notes**: Detailed analysis of parsing process
- **Performance Metrics**: Response times and parsing efficiency
- **Element Detection**: Key page elements identified during parsing
- **Statistics**: Availability rates and historical trends

#### Example Inspection Output

```
DETAILED INSPECTION REPORT
==================================================

Inspection ID: inspection_1758122786837_4e1d2df7p
Timestamp: 9/17/2025, 6:56:26 PM
URL: https://irsafam.org/ielts/timetable?city[]=isfahan&exam_model[]=cdielts
Page Title: ثبت‌نام آزمون آیلتس | زمان‌بندی و مراکز برگزاری در ایران

CHECK RESULTS SUMMARY
-------------------------
Result Type: no-slots
Total Appointments Found: 0
Available for Booking: 0
Filled/Unavailable: 0
Check Timestamp: 9/17/2025, 6:56:26 PM

PARSING ANALYSIS
-------------------------
Found Persian no-appointments indicator

APPOINTMENT BREAKDOWN
-------------------------
No appointments found for the specified criteria

==================================================
```

#### Inspection Statistics

The system tracks comprehensive statistics:

- **Total Records**: Number of inspection records stored
- **Latest/Oldest Inspection**: Timestamp range of collected data
- **Average Appointments per Check**: Historical appointment availability
- **Availability Rate**: Percentage of appointments that were available
- **Performance Metrics**: Average response times and parsing efficiency

### Notification Channels

1. **Desktop Notifications**: System notifications with appointment details
2. **Audio Alerts**: Sound notifications when new appointments are found
3. **File Logging**: Persistent log files with full appointment history
4. **Console Output**: Real-time colored console updates

### Statistics Tracking

- Total monitoring time
- Number of checks performed
- Appointments found
- Notifications sent
- Error count and recovery

## 🛠️ Development

### Setup Development Environment

```bash
# Clone and install dependencies
git clone <repository-url>
cd ielts-appointment-monitor
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

### Build and Package

```bash
# Build for production
npm run build:prod

# Create distributable package
npm run package

# Create platform-specific executables
npm run package:linux    # Creates executable for Linux
npm run package:macos    # Creates executable for macOS  
npm run package:windows  # Creates batch file for Windows
```

### Project Structure

```
├── src/                    # Source code
│   ├── cli/               # Command-line interface
│   ├── models/            # Data models and types
│   ├── services/          # Core services
│   └── utils/             # Utility functions
├── config/                # Configuration files
├── logs/                  # Application logs
├── data/                  # Data storage
├── docs/                  # Documentation
├── dist/                  # Built output
└── __tests__/             # Test files
```

## 🔧 Troubleshooting

### Common Issues

**Permission Denied**
```bash
# Ensure write permissions for directories
chmod 755 logs/ data/ config/
```

**Network Timeouts**
- Check internet connection
- Verify firewall settings
- Try increasing check interval

**Configuration Errors**
```bash
# Reset to default configuration
ielts-monitor configure --reset
```

**Multiple Instances**
- Only one monitoring instance can run at a time
- Use `ielts-monitor stop` before starting a new session

### Getting Help

```bash
# General help
ielts-monitor --help

# Command-specific help
ielts-monitor start --help
ielts-monitor configure --help
ielts-monitor inspect --help

# Check logs for detailed error information
ielts-monitor logs --lines 100

# View current status
ielts-monitor status

# Inspect latest parsing results for debugging
ielts-monitor inspect --detailed
```

### 🔍 Debugging with Inspection Data

The enhanced inspection system helps troubleshoot monitoring issues:

```bash
# Check if website parsing is working correctly
ielts-monitor inspect --detailed

# Export inspection data for analysis
ielts-monitor inspect --export debug.json --format json

# View parsing statistics
ielts-monitor inspect  # Shows statistics at the bottom

# Check specific inspection record
ielts-monitor inspect --id <inspection-id>
```

**Common Debugging Scenarios:**

1. **No appointments detected**: Check inspection data to see if website structure changed
2. **Parsing errors**: Review raw HTML snippets in detailed inspection report
3. **Performance issues**: Check response times in inspection statistics
4. **Language detection**: Verify Persian/English content handling in parsing notes

### Debug Mode

For troubleshooting, you can run with additional logging:

```bash
# Set debug environment variable
DEBUG=* ielts-monitor start

# Or check logs in real-time
ielts-monitor logs --follow
```

## 📝 Logging

The application maintains comprehensive logs:

- **Monitor Logs**: `logs/monitor.log` - General monitoring activity
- **Error Logs**: `logs/errors.log` - Error details and stack traces  
- **Statistics**: `logs/statistics.json` - Monitoring statistics
- **Notifications**: Embedded in monitor logs with timestamps
- **Inspection Data**: `data/inspection-data.json` - Detailed parsing results and debugging information *(NEW!)*

### Enhanced Logging Features *(NEW!)*

The enhanced monitoring system provides detailed logging:

- **Real-time Parsing Results**: Live updates on appointment detection
- **Performance Metrics**: Response times and parsing efficiency
- **Website Structure Analysis**: Detected page elements and parsing notes
- **Raw HTML Collection**: Original website content for debugging
- **Multi-language Content**: Proper handling of Persian and English text
- **Statistics Tracking**: Historical availability rates and trends

## 🔒 Privacy & Security

- No personal data is collected or transmitted
- All data stays local on your machine
- Configuration files contain only monitoring preferences
- Network requests only go to the official irsafam.org website

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run tests: `npm test`
5. Commit changes: `git commit -am 'Add feature'`
6. Push to branch: `git push origin feature-name`
7. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 📚 Documentation

- **[Enhanced Features Guide](docs/ENHANCED_FEATURES.md)** - Detailed guide for inspection system and advanced features *(NEW!)*
- **[CLI Usage Guide](docs/CLI_USAGE.md)** - Complete command-line interface reference
- **[Configuration Guide](docs/CONFIGURATION.md)** - Advanced configuration options
- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Common issues and solutions

## 🆘 Support

If you encounter issues or have questions:

1. Check the [troubleshooting section](#-troubleshooting)
2. Review the [Enhanced Features Guide](docs/ENHANCED_FEATURES.md) for inspection and debugging
3. Review the [CLI usage guide](docs/CLI_USAGE.md)
4. Check existing issues in the repository
5. Create a new issue with detailed information

## 🎯 Roadmap

- [ ] Web dashboard interface
- [ ] Email notification support
- [ ] Multiple website support
- [ ] Appointment booking automation
- [ ] Mobile app notifications
- [ ] Docker containerization

---

**Happy IELTS appointment hunting! 🎯**