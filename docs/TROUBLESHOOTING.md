# Troubleshooting Guide

This guide helps you resolve common issues with the IELTS Appointment Monitor.

## 🚨 Common Issues

### Installation Issues

#### Node.js Version Compatibility

**Problem**: Error during installation or build
```
Error: The engine "node" is incompatible with this module
```

**Solution**:
```bash
# Check your Node.js version
node --version

# Ensure you have Node.js >= 16.0.0
# Update Node.js if needed from https://nodejs.org/
```

#### Permission Denied During Global Installation

**Problem**: 
```
Error: EACCES: permission denied, mkdir '/usr/local/lib/node_modules'
```

**Solution**:
```bash
# Option 1: Use npm prefix (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Then install globally
npm run install:global

# Option 2: Use sudo (not recommended)
sudo npm run install:global
```

#### Build Failures

**Problem**: TypeScript compilation errors

**Solution**:
```bash
# Clean and rebuild
npm run clean
npm install
npm run build

# If issues persist, check TypeScript version
npx tsc --version

# Update TypeScript if needed
npm install -D typescript@latest
```

### Configuration Issues

#### Invalid Configuration File

**Problem**: 
```
Configuration validation failed: Invalid city specified
```

**Solution**:
```bash
# Reset to default configuration
ielts-monitor configure --reset

# Or manually edit the config file
# Location: ~/.ielts-monitor/config.json (or project config/)
```

#### Configuration File Not Found

**Problem**:
```
Error: Configuration file not found
```

**Solution**:
```bash
# Run interactive configuration
ielts-monitor configure

# Or specify custom config path
ielts-monitor start --config /path/to/config.json
```

#### Invalid JSON in Configuration

**Problem**:
```
SyntaxError: Unexpected token in JSON
```

**Solution**:
```bash
# Validate your JSON configuration
cat config/monitor-config.json | jq .

# If jq is not installed, use online JSON validator
# Or reset configuration
ielts-monitor configure --reset
```

### Runtime Issues

#### Network Connection Problems

**Problem**: 
```
Error: connect ECONNREFUSED
Error: getaddrinfo ENOTFOUND irsafam.org
```

**Solutions**:
1. **Check Internet Connection**:
   ```bash
   # Test connectivity
   ping google.com
   curl -I https://irsafam.org
   ```

2. **Check Firewall Settings**:
   - Ensure outbound HTTPS (port 443) is allowed
   - Whitelist irsafam.org domain

3. **Proxy Configuration**:
   ```bash
   # If behind corporate proxy
   export HTTP_PROXY=http://proxy.company.com:8080
   export HTTPS_PROXY=http://proxy.company.com:8080
   ```

4. **DNS Issues**:
   ```bash
   # Try different DNS servers
   # Add to /etc/resolv.conf (Linux/macOS):
   nameserver 8.8.8.8
   nameserver 8.8.4.4
   ```

#### Website Structure Changes

**Problem**:
```
Warning: Could not parse appointment data
Error: Appointment parsing failed
```

**Solutions**:
1. **Check Website Status**:
   ```bash
   curl -I https://irsafam.org/timetable
   ```

2. **Update Application**:
   - Check for application updates
   - Website structure may have changed

3. **Temporary Workaround**:
   ```bash
   # Increase check interval to reduce load
   ielts-monitor configure
   # Set checkInterval to 60000 (1 minute) or higher
   ```

#### Memory Issues

**Problem**: High memory usage or crashes

**Solutions**:
1. **Monitor Memory Usage**:
   ```bash
   # Check memory usage
   ielts-monitor status
   
   # Or use system tools
   top -p $(pgrep -f ielts-monitor)
   ```

2. **Reduce Memory Usage**:
   ```bash
   # Increase check interval
   ielts-monitor configure
   # Set checkInterval to 60000 or higher
   
   # Limit log file size
   # Edit config to disable verbose logging
   ```

3. **Restart Monitoring**:
   ```bash
   ielts-monitor stop
   ielts-monitor start
   ```

### Notification Issues

#### Desktop Notifications Not Working

**Problem**: No desktop notifications appear

**Solutions**:

**Linux**:
```bash
# Install notification dependencies
sudo apt-get install libnotify-bin  # Ubuntu/Debian
sudo yum install libnotify           # CentOS/RHEL

# Test notifications
notify-send "Test" "Notification test"
```

**macOS**:
```bash
# Check notification permissions
# System Preferences > Security & Privacy > Privacy > Notifications
# Ensure Terminal or your terminal app has permission
```

**Windows**:
```bash
# Ensure Windows notifications are enabled
# Settings > System > Notifications & actions
```

#### Audio Alerts Not Playing

**Problem**: No sound when appointments are found

**Solutions**:

**Check Audio System**:
```bash
# Test system audio
# Linux: aplay /usr/share/sounds/alsa/Front_Left.wav
# macOS: afplay /System/Library/Sounds/Glass.aiff
# Windows: Use built-in sound test
```

**Configuration**:
```bash
# Verify audio is enabled in config
ielts-monitor configure
# Ensure notificationSettings.audio is true
```

### File System Issues

#### Permission Denied for Log Files

**Problem**:
```
Error: EACCES: permission denied, open 'logs/monitor.log'
```

**Solution**:
```bash
# Fix permissions
chmod 755 logs/
chmod 644 logs/*.log

# Or run with appropriate permissions
sudo ielts-monitor start  # Not recommended

# Better: Change ownership
sudo chown -R $USER:$USER logs/ data/ config/
```

#### Disk Space Issues

**Problem**:
```
Error: ENOSPC: no space left on device
```

**Solutions**:
1. **Check Disk Space**:
   ```bash
   df -h
   ```

2. **Clean Log Files**:
   ```bash
   # Rotate or clean old logs
   > logs/monitor.log
   > logs/errors.log
   
   # Or configure log rotation in the application
   ```

3. **Clean Old Data**:
   ```bash
   # Remove old appointment data
   rm -f data/appointments-*.json
   ```

### Process Management Issues

#### Multiple Instances Running

**Problem**:
```
Error: Another instance is already running
```

**Solution**:
```bash
# Find and stop existing processes
ps aux | grep ielts-monitor
kill <process-id>

# Or use the stop command
ielts-monitor stop

# Force stop if needed
pkill -f ielts-monitor
```

#### Process Won't Stop

**Problem**: Monitor continues running after stop command

**Solution**:
```bash
# Force stop
ielts-monitor stop --force

# Or kill process manually
ps aux | grep ielts-monitor
kill -9 <process-id>

# Check for zombie processes
ps aux | grep -E "(ielts|monitor)" | grep -v grep
```

## 🔍 Debugging

### Enable Debug Mode

```bash
# Set debug environment variable
DEBUG=* ielts-monitor start

# Or specific debug categories
DEBUG=ielts:* ielts-monitor start
DEBUG=ielts:scraper ielts-monitor start
```

### Verbose Logging

```bash
# Follow logs in real-time
ielts-monitor logs --follow

# Show more log lines
ielts-monitor logs --lines 200

# Check error logs specifically
tail -f logs/errors.log
```

### Configuration Debugging

```bash
# Validate configuration
ielts-monitor configure --validate

# Show current configuration
ielts-monitor status --json | jq .configuration

# Test configuration without starting
ielts-monitor start --dry-run
```

### Network Debugging

```bash
# Test website connectivity
curl -v https://irsafam.org/timetable

# Check with same user agent as application
curl -H "User-Agent: Mozilla/5.0 (compatible; IELTS-Monitor)" https://irsafam.org/timetable

# Test with proxy if needed
curl --proxy http://proxy:8080 https://irsafam.org/timetable
```

## 📊 Performance Optimization

### Reduce Resource Usage

1. **Increase Check Interval**:
   ```bash
   # Set to 60 seconds instead of 30
   ielts-monitor configure
   # Set checkInterval: 60000
   ```

2. **Limit Concurrent Operations**:
   - Monitor fewer cities simultaneously
   - Reduce the number of months being monitored

3. **Optimize Logging**:
   ```bash
   # Disable verbose logging in production
   # Edit configuration to reduce log verbosity
   ```

### Monitor Performance

```bash
# Check system resource usage
ielts-monitor status --watch

# Monitor with system tools
htop
iostat 1
```

## 🆘 Getting Help

### Collect Debug Information

When reporting issues, include:

1. **System Information**:
   ```bash
   node --version
   npm --version
   uname -a  # Linux/macOS
   systeminfo  # Windows
   ```

2. **Application Information**:
   ```bash
   ielts-monitor --version
   ielts-monitor status --json
   ```

3. **Log Files**:
   ```bash
   # Recent logs
   ielts-monitor logs --lines 50
   
   # Error logs
   cat logs/errors.log
   ```

4. **Configuration** (remove sensitive data):
   ```bash
   cat config/monitor-config.json
   ```

### Support Channels

1. **Check Documentation**:
   - [README.md](../README.md)
   - [CLI Usage Guide](CLI_USAGE.md)

2. **Search Existing Issues**:
   - Check repository issues for similar problems

3. **Create New Issue**:
   - Include debug information above
   - Describe steps to reproduce
   - Include error messages and logs

### Emergency Recovery

If the application is completely broken:

```bash
# Complete reset
ielts-monitor stop --force
rm -rf logs/* data/*
ielts-monitor configure --reset
npm run clean && npm run build
ielts-monitor start
```

## 📋 Checklist for Common Issues

Before reporting an issue, verify:

- [ ] Node.js version >= 16.0.0
- [ ] Application is built: `npm run build`
- [ ] Configuration is valid: `ielts-monitor configure --validate`
- [ ] No other instances running: `ps aux | grep ielts-monitor`
- [ ] Sufficient disk space: `df -h`
- [ ] Network connectivity: `curl -I https://irsafam.org`
- [ ] Permissions are correct: `ls -la logs/ data/ config/`
- [ ] Latest version installed
- [ ] Logs checked for specific errors: `ielts-monitor logs`

---

**Still having issues? Don't hesitate to create an issue with detailed information!**