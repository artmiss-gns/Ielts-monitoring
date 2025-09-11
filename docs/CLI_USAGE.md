# IELTS Monitor CLI Usage Guide

The IELTS Monitor CLI provides a comprehensive command-line interface for managing IELTS appointment monitoring.

## Installation

After building the project, you can use the CLI directly:

```bash
npm run build
node dist/cli/index.js --help
```

Or if installed globally:

```bash
ielts-monitor --help
```

## Commands

### `start` - Start Monitoring

Start monitoring IELTS appointments with the configured settings.

```bash
ielts-monitor start [options]
```

**Options:**
- `-c, --config <path>` - Path to custom configuration file
- `-d, --daemon` - Run in daemon mode (background)

**Examples:**
```bash
# Start with default configuration
ielts-monitor start

# Start with custom config file
ielts-monitor start --config ./my-config.json

# Start in daemon mode
ielts-monitor start --daemon
```

### `stop` - Stop Monitoring

Stop the currently running monitoring process.

```bash
ielts-monitor stop
```

### `status` - Show Status

Display current monitoring status and statistics.

```bash
ielts-monitor status [options]
```

**Options:**
- `-w, --watch` - Continuously watch status (refresh every 5 seconds)
- `-j, --json` - Output status in JSON format

**Examples:**
```bash
# Show current status
ielts-monitor status

# Watch status continuously
ielts-monitor status --watch

# Get status as JSON
ielts-monitor status --json
```

### `configure` - Configure Settings

Configure monitoring settings interactively.

```bash
ielts-monitor configure [options]
```

**Aliases:** `config`

**Options:**
- `-f, --file <path>` - Configuration file path
- `-r, --reset` - Reset to default configuration

**Examples:**
```bash
# Interactive configuration
ielts-monitor configure

# Reset to defaults
ielts-monitor configure --reset

# Configure specific file
ielts-monitor configure --file ./custom-config.json
```

### `pause` - Pause Monitoring

Temporarily pause the monitoring process.

```bash
ielts-monitor pause
```

### `resume` - Resume Monitoring

Resume paused monitoring.

```bash
ielts-monitor resume
```

### `logs` - View Logs

View monitoring logs.

```bash
ielts-monitor logs [options]
```

**Options:**
- `-f, --follow` - Follow log output (tail -f behavior)
- `-n, --lines <number>` - Number of lines to show (default: 50)

**Examples:**
```bash
# Show last 50 log entries
ielts-monitor logs

# Show last 100 log entries
ielts-monitor logs --lines 100

# Follow logs in real-time
ielts-monitor logs --follow
```

## Configuration

The CLI uses a JSON configuration file to store monitoring settings. On first run, you'll be prompted to configure your preferences.

### Configuration Options

- **Cities**: List of cities to monitor (e.g., isfahan, tehran, mashhad)
- **Exam Models**: Types of IELTS exams to monitor (cdielts, ielts, ukvi)
- **Months**: Months to check for appointments (1-12)
- **Check Interval**: How often to check for new appointments (in seconds)
- **Base URL**: URL to monitor for appointments (defaults to https://irsafam.org/ielts/timetable)
- **Notifications**: Enable/disable desktop, audio, and log file notifications

### Example Configuration

```json
{
  "city": ["isfahan", "tehran"],
  "examModel": ["cdielts"],
  "months": [12, 1, 2],
  "checkInterval": 30000,
  "baseUrl": "https://irsafam.org/ielts/timetable",
  "notificationSettings": {
    "desktop": true,
    "audio": true,
    "logFile": true
  }
}
```

### URL Configuration

The `baseUrl` setting allows you to:

- **Production Use**: Use the default `https://irsafam.org/ielts/timetable` for real monitoring
- **Testing**: Use `http://localhost:3000/ielts/timetable` for local testing
- **Alternative Sites**: Monitor other IELTS appointment websites with similar structure

**Note**: When using localhost URLs, the system automatically switches to API mode for testing.

## Real-time Features

### Status Display

When running in interactive mode (not daemon), the CLI provides real-time updates:

- **Check Completed**: Shows when each monitoring check is completed
- **New Appointments**: Highlights when new appointments are found
- **Error Notifications**: Displays any errors that occur during monitoring
- **Status Changes**: Shows when the monitoring status changes

### Colored Output

The CLI uses colored output to improve readability:

- 🟢 **Green**: Success messages, running status
- 🟡 **Yellow**: Warnings, paused status
- 🔴 **Red**: Errors, stopped status
- 🔵 **Blue**: Information, starting/stopping status
- ⚪ **Gray**: Timestamps, secondary information

## Error Handling

The CLI provides comprehensive error handling:

- **Configuration Errors**: Invalid settings are caught and explained
- **Network Errors**: Connection issues are logged and monitoring continues
- **Permission Errors**: File access issues are reported clearly
- **Graceful Shutdown**: Ctrl+C properly stops monitoring and saves state

## Tips and Best Practices

1. **First Time Setup**: Run `ielts-monitor configure` to set up your preferences
2. **Daemon Mode**: Use `--daemon` flag for background monitoring
3. **Log Monitoring**: Use `ielts-monitor logs --follow` to watch real-time activity
4. **Status Checking**: Use `ielts-monitor status --watch` for continuous monitoring
5. **Configuration Backup**: Keep a backup of your configuration file
6. **Check Interval**: Don't set intervals too low to avoid overwhelming the server

## Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure you have write permissions for log and config directories
2. **Port Already in Use**: Only one instance can run at a time
3. **Network Timeouts**: Check your internet connection and firewall settings
4. **Configuration Errors**: Use `ielts-monitor configure --reset` to restore defaults

### Getting Help

- Use `ielts-monitor --help` for command overview
- Use `ielts-monitor <command> --help` for specific command help
- Check logs with `ielts-monitor logs` for detailed error information
- Use `ielts-monitor status` to check current system state

## Exit Codes

- `0`: Success
- `1`: General error (configuration, network, etc.)
- `2`: Invalid command or arguments
- `130`: Interrupted by user (Ctrl+C)