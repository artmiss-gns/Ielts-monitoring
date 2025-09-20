# Security Configuration Guide

This document explains how to configure the IELTS Appointment Monitor securely for server deployment.

## Overview

The application supports secure configuration through environment variables and configuration files, with proper validation and sensitive data masking.

## Environment Variables

Copy `.env.example` to `.env` and configure the following variables:

### Required for Telegram Notifications
```bash
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

### Monitoring Configuration
```bash
MONITOR_CHECK_INTERVAL=300000          # Check interval in milliseconds (5 minutes)
MONITOR_CITIES=Isfahan,Tehran          # Comma-separated list of cities
MONITOR_EXAM_MODELS=Academic,General   # Comma-separated list of exam models
MONITOR_MONTHS=10,11,12               # Comma-separated list of months (1-12)
MONITOR_BASE_URL=https://irsafam.org/ielts/timetable  # Optional base URL
```

### Security Configuration
```bash
LOG_LEVEL=info                        # Log level: error, warn, info, debug
ENABLE_SECURE_LOGGING=true           # Enable secure logging features
MASK_SENSITIVE_DATA=true             # Mask sensitive data in logs
```

### Server Configuration (Optional)
```bash
HEALTH_CHECK_PORT=3000               # Port for health check endpoint
ENABLE_METRICS=false                 # Enable metrics collection
```

## Configuration Files

### Monitor Configuration
- **Example**: `config/monitor-config.example.json`
- **Actual**: `config/monitor-config.json` (excluded from Git)

The actual configuration file is automatically excluded from version control. Environment variables take precedence over file configuration.

### Telegram Configuration
- **Example**: `config/telegram-config.example.json`
- **Actual**: `config/telegram-config.json` (excluded from Git)

If Telegram credentials are provided via environment variables, the file configuration is not needed.

## Security Features

### 1. Sensitive Data Protection
- Configuration files containing sensitive data are excluded from Git
- Environment variables are used for sensitive configuration
- Sensitive data is automatically masked in logs when `MASK_SENSITIVE_DATA=true`

### 2. Configuration Validation
- All configuration is validated before use
- Invalid configurations cause the application to fail fast with clear error messages
- Type checking ensures configuration integrity

### 3. Secure Logging
- When `ENABLE_SECURE_LOGGING=true`, sensitive data is automatically masked in logs
- Log levels can be controlled via `LOG_LEVEL` environment variable
- Structured logging for better security monitoring

### 4. Server Deployment Features
- Health check endpoint can be enabled for monitoring
- Metrics collection can be enabled for observability
- Desktop and audio notifications are disabled by default for server environments

## Configuration Priority

Configuration is loaded in the following priority order (highest to lowest):

1. **Environment Variables** - Highest priority
2. **Configuration Files** - Medium priority  
3. **Default Values** - Lowest priority

## Example Secure Setup

1. **Copy environment template**:
   ```bash
   cp .env.example .env
   ```

2. **Configure environment variables**:
   ```bash
   # Edit .env file with your actual values
   TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
   TELEGRAM_CHAT_ID=-1001234567890
   MONITOR_CHECK_INTERVAL=300000
   ENABLE_SECURE_LOGGING=true
   MASK_SENSITIVE_DATA=true
   ```

3. **Verify configuration**:
   ```bash
   npm run dev
   ```

The application will validate all configuration on startup and report any issues.

## Security Best Practices

1. **Never commit sensitive data** - Use environment variables for secrets
2. **Use strong bot tokens** - Generate new Telegram bot tokens regularly
3. **Limit chat access** - Use private chats or restricted groups for notifications
4. **Monitor logs** - Enable secure logging and monitor for security events
5. **Regular updates** - Keep dependencies updated for security patches
6. **Access control** - Restrict access to configuration files and environment variables

## Troubleshooting

### Configuration Validation Errors
If you see configuration validation errors:
1. Check that all required environment variables are set
2. Verify that numeric values are valid integers
3. Ensure URLs are properly formatted
4. Check that array values are comma-separated without extra spaces

### Telegram Configuration Issues
If Telegram notifications aren't working:
1. Verify `TELEGRAM_BOT_TOKEN` is correct
2. Ensure `TELEGRAM_CHAT_ID` includes the correct chat ID (may be negative for groups)
3. Check that the bot has permission to send messages to the chat
4. Test the bot token using Telegram's Bot API

### Logging Issues
If logs aren't appearing as expected:
1. Check `LOG_LEVEL` setting
2. Verify `ENABLE_SECURE_LOGGING` is set correctly
3. Ensure the application has write permissions for log files
4. Check that `MASK_SENSITIVE_DATA` is configured as desired