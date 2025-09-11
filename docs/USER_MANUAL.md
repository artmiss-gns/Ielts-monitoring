# IELTS Appointment Monitor - User Manual

Complete guide for using the IELTS Appointment Monitor to track and get notified about available IELTS exam appointments.

## 📚 Table of Contents

1. [Getting Started](#-getting-started)
2. [Installation](#-installation)
3. [First Time Setup](#-first-time-setup)
4. [Basic Usage](#-basic-usage)
5. [Advanced Features](#-advanced-features)
6. [Configuration Guide](#-configuration-guide)
7. [Monitoring Dashboard](#-monitoring-dashboard)
8. [Notifications](#-notifications)
9. [Troubleshooting](#-troubleshooting)
10. [Tips and Best Practices](#-tips-and-best-practices)

## 🚀 Getting Started

### What is IELTS Appointment Monitor?

The IELTS Appointment Monitor is an automated tool that continuously checks the irsafam.org website for available IELTS exam appointments and notifies you immediately when new slots become available.

### Key Benefits

- **Never Miss an Appointment**: Automatic 24/7 monitoring
- **Instant Notifications**: Desktop, audio, and log notifications
- **Flexible Filtering**: Monitor specific cities, exam types, and months
- **Easy to Use**: Simple command-line interface
- **Reliable**: Built-in error recovery and retry mechanisms

### System Requirements

- **Operating System**: Windows 10+, macOS 10.14+, or Linux
- **Node.js**: Version 16.0.0 or higher
- **Memory**: 512MB RAM minimum
- **Storage**: 100MB free space
- **Internet**: Stable internet connection

## 💾 Installation

### Quick Installation (Recommended)

**Linux/macOS:**
```bash
# Download and run the installation script
curl -sSL https://raw.githubusercontent.com/your-repo/ielts-appointment-monitor/main/scripts/install.sh | bash
```

**Windows:**
```cmd
# Download and run the installation script
powershell -Command "& {Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/your-repo/ielts-appointment-monitor/main/scripts/install.bat' -OutFile 'install.bat'; .\install.bat}"
```

### Manual Installation

1. **Install Node.js** from [nodejs.org](https://nodejs.org/)
2. **Clone or download** the project
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Build the application:**
   ```bash
   npm run build:prod
   ```
5. **Install globally:**
   ```bash
   npm run install:global
   ```

### Verify Installation

```bash
# Check if installation was successful
ielts-monitor --version

# Get help
ielts-monitor --help
```

## 🎯 First Time Setup

### Step 1: Initial Configuration

Run the interactive configuration wizard:

```bash
ielts-monitor configure
```

You'll be prompted to set up:

1. **Cities to Monitor**: Choose from available cities
2. **Exam Types**: Select IELTS exam models
3. **Months**: Specify which months to check
4. **Check Frequency**: How often to check for appointments
5. **Notifications**: Configure notification preferences

### Step 2: Test Configuration

```bash
# Test your configuration
ielts-monitor configure --validate

# Do a dry run to test without starting
ielts-monitor start --dry-run
```

### Step 3: Start Monitoring

```bash
# Start monitoring with your configuration
ielts-monitor start
```

## 📖 Basic Usage

### Essential Commands

```bash
# Start monitoring
ielts-monitor start

# Check current status
ielts-monitor status

# View recent logs
ielts-monitor logs

# Stop monitoring
ielts-monitor stop

# Pause monitoring temporarily
ielts-monitor pause

# Resume paused monitoring
ielts-monitor resume
```

### Command Options

```bash
# Start with custom configuration
ielts-monitor start --config /path/to/config.json

# Run in background (daemon mode)
ielts-monitor start --daemon

# Watch status continuously
ielts-monitor status --watch

# Follow logs in real-time
ielts-monitor logs --follow

# Show more log lines
ielts-monitor logs --lines 100
```

### Basic Workflow

1. **Configure** your monitoring preferences
2. **Start** the monitoring process
3. **Check status** periodically to ensure it's running
4. **Review logs** to see monitoring activity
5. **Receive notifications** when appointments are found

## 🔧 Advanced Features

### Daemon Mode

Run monitoring in the background:

```bash
# Start in daemon mode
ielts-monitor start --daemon

# Check if daemon is running
ielts-monitor status

# Stop daemon
ielts-monitor stop
```

### Multiple Configurations

Manage different monitoring setups:

```bash
# Create named configurations
ielts-monitor configure --file urgent-config.json
ielts-monitor configure --file backup-config.json

# Start with specific configuration
ielts-monitor start --config urgent-config.json
```

### Scheduled Monitoring

Set up monitoring schedules (requires cron or task scheduler):

```bash
# Example cron job for business hours only
# 0 8 * * 1-5 /usr/local/bin/ielts-monitor start --config business-hours.json
# 0 18 * * 1-5 /usr/local/bin/ielts-monitor stop
```

### Log Management

```bash
# View different types of logs
ielts-monitor logs --type monitor    # General monitoring logs
ielts-monitor logs --type error      # Error logs only
ielts-monitor logs --type stats      # Statistics logs

# Export logs
ielts-monitor logs --export /path/to/export.log

# Clear old logs
ielts-monitor logs --clear --older-than 7d
```

## ⚙️ Configuration Guide

### Configuration File Location

- **Linux/macOS**: `~/.ielts-monitor/config.json`
- **Windows**: `%USERPROFILE%\.ielts-monitor\config.json`
- **Custom**: Specify with `--config` option

### Configuration Structure

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

#### Cities
- `isfahan` - Isfahan
- `tehran` - Tehran
- `mashhad` - Mashhad
- `shiraz` - Shiraz
- `tabriz` - Tabriz

#### Exam Models
- `cdielts` - Computer Delivered IELTS
- `ielts` - Paper-based IELTS
- `ukvi` - IELTS for UKVI

#### Months
- Numbers 1-12 representing January through December
- Example: `[12, 1, 2]` for December, January, February

#### Check Interval
- Time in milliseconds between checks
- Minimum recommended: 30000 (30 seconds)
- Default: 30000

### Configuration Examples

See [CONFIGURATION_EXAMPLES.md](CONFIGURATION_EXAMPLES.md) for detailed examples.

## 📊 Monitoring Dashboard

### Status Information

```bash
ielts-monitor status
```

Shows:
- **Current State**: Running, Stopped, Paused
- **Uptime**: How long monitoring has been active
- **Statistics**: Checks performed, appointments found
- **Last Check**: When the last check was performed
- **Next Check**: When the next check is scheduled
- **Configuration**: Current monitoring settings

### Real-time Monitoring

```bash
# Watch status with auto-refresh
ielts-monitor status --watch

# Get status as JSON for scripting
ielts-monitor status --json
```

### Statistics Tracking

The monitor tracks:
- Total monitoring time
- Number of checks performed
- Appointments found
- Notifications sent
- Errors encountered
- Success rate

## 🔔 Notifications

### Notification Types

1. **Desktop Notifications**
   - System tray notifications
   - Shows appointment details
   - Clickable for more information

2. **Audio Alerts**
   - Sound notification when appointments found
   - Customizable sound files
   - Can be disabled for silent monitoring

3. **Log File Notifications**
   - Persistent record in log files
   - Detailed appointment information
   - Searchable and exportable

### Notification Settings

```bash
# Configure notifications interactively
ielts-monitor configure

# Enable/disable specific notification types
ielts-monitor configure --notifications desktop=true,audio=false,log=true
```

### Notification Content

Notifications include:
- **City**: Where the appointment is available
- **Exam Type**: CDIELTS, IELTS, or UKVI
- **Date**: Appointment date
- **Time Slot**: Available time
- **Slots Available**: Number of open slots
- **Registration Link**: Direct link to register

### Custom Notification Sounds

```bash
# Set custom sound file (Linux/macOS)
ielts-monitor configure --audio-file /path/to/sound.wav

# Use system sounds (Windows)
ielts-monitor configure --audio-system-sound notification
```

## 🔍 Troubleshooting

### Common Issues

#### Monitor Won't Start
```bash
# Check configuration
ielts-monitor configure --validate

# Check for running instances
ielts-monitor status

# Force stop and restart
ielts-monitor stop --force
ielts-monitor start
```

#### No Notifications Received
```bash
# Test notifications
ielts-monitor test-notifications

# Check notification settings
ielts-monitor configure --show-notifications

# Verify system notification permissions
```

#### Network Connection Issues
```bash
# Test website connectivity
curl -I https://irsafam.org

# Check proxy settings if behind firewall
ielts-monitor configure --proxy

# Increase timeout settings
ielts-monitor configure --network-timeout 60000
```

#### High Memory Usage
```bash
# Check memory usage
ielts-monitor status --memory

# Reduce check frequency
ielts-monitor configure --check-interval 60000

# Enable low-memory mode
ielts-monitor configure --low-memory-mode
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=ielts:* ielts-monitor start

# Save debug logs to file
DEBUG=ielts:* ielts-monitor start 2>&1 | tee debug.log
```

### Getting Help

```bash
# Command help
ielts-monitor --help
ielts-monitor start --help

# Check logs for errors
ielts-monitor logs --type error

# Validate configuration
ielts-monitor configure --validate
```

## 💡 Tips and Best Practices

### Optimization Tips

1. **Check Interval**: Don't set too low (minimum 30 seconds recommended)
2. **City Selection**: Monitor fewer cities for better performance
3. **Time Range**: Limit months to reduce processing time
4. **Resource Monitoring**: Check system resources periodically

### Monitoring Strategy

1. **Start Broad**: Begin with multiple cities and exam types
2. **Narrow Down**: Focus on specific preferences as you learn patterns
3. **Peak Times**: Monitor more frequently during peak registration periods
4. **Backup Plans**: Have multiple city options configured

### Notification Management

1. **Test First**: Always test notifications before relying on them
2. **Multiple Channels**: Use both desktop and audio for important monitoring
3. **Log Review**: Regularly check logs even with notifications enabled
4. **Sound Levels**: Ensure audio notifications are audible but not disruptive

### System Maintenance

1. **Regular Updates**: Keep the application updated
2. **Log Rotation**: Clean old logs periodically
3. **Configuration Backup**: Keep backup copies of your configuration
4. **System Resources**: Monitor CPU and memory usage

### Security Considerations

1. **Network Safety**: Only monitor official IELTS websites
2. **Rate Limiting**: Respect server resources with appropriate intervals
3. **Data Privacy**: Configuration files contain preferences only
4. **System Security**: Keep your system and Node.js updated

### Automation Ideas

```bash
# Auto-start monitoring on system boot (Linux/macOS)
# Add to ~/.bashrc or ~/.zshrc:
# ielts-monitor start --daemon

# Windows Task Scheduler
# Create task to run: ielts-monitor start --daemon

# Monitoring script
#!/bin/bash
while true; do
    if ! ielts-monitor status --quiet; then
        ielts-monitor start --daemon
    fi
    sleep 300  # Check every 5 minutes
done
```

## 📞 Support and Resources

### Documentation
- [README.md](../README.md) - Overview and quick start
- [CLI_USAGE.md](CLI_USAGE.md) - Detailed CLI reference
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Problem solving guide
- [CONFIGURATION_EXAMPLES.md](CONFIGURATION_EXAMPLES.md) - Configuration examples
- [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) - For developers

### Getting Help
1. Check the troubleshooting guide
2. Review log files for error details
3. Test with minimal configuration
4. Search existing issues in the repository
5. Create a new issue with detailed information

### Community
- Report bugs and request features via GitHub issues
- Contribute improvements via pull requests
- Share configuration examples and tips
- Help other users in discussions

---

**Happy IELTS appointment hunting! 🎯**

*Remember: This tool helps you monitor appointments, but you still need to register manually when appointments become available.*