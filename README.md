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

# Check logs for detailed error information
ielts-monitor logs --lines 100

# View current status
ielts-monitor status
```

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

## 🆘 Support

If you encounter issues or have questions:

1. Check the [troubleshooting section](#-troubleshooting)
2. Review the [CLI usage guide](docs/CLI_USAGE.md)
3. Check existing issues in the repository
4. Create a new issue with detailed information

## 🎯 Roadmap

- [ ] Web dashboard interface
- [ ] Email notification support
- [ ] Multiple website support
- [ ] Appointment booking automation
- [ ] Mobile app notifications
- [ ] Docker containerization

---

**Happy IELTS appointment hunting! 🎯**