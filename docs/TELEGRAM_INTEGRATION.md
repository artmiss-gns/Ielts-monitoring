# Telegram Integration Guide

This guide explains how to set up and use Telegram notifications with the IELTS Appointment Monitor.

## Overview

The Telegram integration allows you to receive appointment notifications directly in Telegram, making it perfect for server deployments where desktop notifications aren't available.

## Features

- 🤖 **Bot Integration**: Uses Telegram Bot API for reliable message delivery
- 📱 **Rich Messages**: Supports both simple and detailed message formats
- 🔄 **Retry Logic**: Automatic retry mechanism for failed notifications
- 🛡️ **Error Handling**: Graceful fallback when Telegram is unavailable
- 🔧 **Easy Configuration**: Environment variable or JSON configuration
- 🧪 **Connection Testing**: Built-in tools to test your setup

## Setup Instructions

### Step 1: Create a Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Start a chat and send `/newbot`
3. Follow the instructions to create your bot
4. Save the **Bot Token** (looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### Step 2: Set Up Channel or Chat

#### Option A: Telegram Channel (Recommended for Public Notifications)

1. Create a new Telegram channel
2. Add your bot as an administrator with "Post Messages" permission
3. Use the channel username (e.g., `@your_channel_name`) as the Chat ID

#### Option B: Private Chat

1. Start a chat with your new bot
2. Send any message to the bot
3. Visit: `https://api.telegram.org/bot<YourBOTToken>/getUpdates`
4. Look for `"chat":{"id":123456789}` in the response
5. Save the **Chat ID** (the number after `"id":`)

### Step 3: Configure the Application

#### Option A: Environment Variables (Recommended)

Create a `.env` file or set environment variables:

```bash
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=@your_channel_name  # For channels, or chat ID for private chats

# Optional
TELEGRAM_MESSAGE_FORMAT=detailed  # 'simple' or 'detailed'
TELEGRAM_ENABLE_PREVIEW=false     # 'true' or 'false'
TELEGRAM_IS_CHANNEL=true          # Set to true for channels (auto-detected)
TELEGRAM_RETRY_ATTEMPTS=3         # Number of retry attempts
TELEGRAM_RETRY_DELAY=1000         # Delay between retries (ms)
```

#### Option B: Configuration File

Create `config/telegram-config.json`:

```json
{
  "botToken": "your_bot_token_here",
  "chatId": "your_chat_id_here",
  "messageFormat": "detailed",
  "enablePreview": false,
  "retryAttempts": 3,
  "retryDelay": 1000
}
```

## Usage Examples

### Basic Usage

```typescript
import { NotificationService, EnvironmentConfigManager } from './src/services';

// Load configuration from environment
const telegramConfig = EnvironmentConfigManager.createTelegramConfig();

// Create notification service with Telegram support
const notificationService = new NotificationService('logs', telegramConfig);

// Send notifications
const channels = {
  desktop: false,  // Disable for server environments
  audio: false,    // Disable for server environments
  logFile: true,   // Enable file logging
  telegram: true   // Enable Telegram notifications
};

await notificationService.sendNotification(appointments, channels);
```

### Testing Your Setup

```typescript
import { TelegramNotifier } from './src/services';

const telegramNotifier = new TelegramNotifier(config);

// Test connection
const result = await telegramNotifier.testConnection();
console.log(result.success ? 'Connected!' : `Failed: ${result.message}`);
```

### Advanced Configuration

```typescript
import { NotificationService } from './src/services';

const notificationService = new NotificationService('logs');

// Configure Telegram after initialization
notificationService.configureTelegram({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  chatId: process.env.TELEGRAM_CHAT_ID!,
  messageFormat: 'detailed',
  enablePreview: false,
  retryAttempts: 5,
  retryDelay: 2000
});

// Check if configured
if (notificationService.isTelegramConfigured()) {
  const testResult = await notificationService.testTelegramConnection();
  console.log('Telegram test:', testResult);
}
```

## Message Formats

### Simple Format

```
🎯 2 New IELTS Appointments Available!

📅 2024-03-15 at 09:00-12:00 - Isfahan Center
📅 2024-03-16 at 14:00-17:00 - Tehran Center

⚡ Book now before they're filled!
```

### Detailed Format

```
🎯 2 New IELTS Appointments Available!

📅 Date: 2024-03-15
🕐 Time: 09:00-12:00
📍 Location: Isfahan IELTS Center
📝 Exam Type: Academic IELTS
🏙️ City: Isfahan
💰 Price: 5,500,000 Toman

📅 Date: 2024-03-16
🕐 Time: 14:00-17:00
📍 Location: Tehran IELTS Center
📝 Exam Type: General IELTS
🏙️ City: Tehran

🕒 Detected at: Mar 15, 2024, 10:30 AM (Tehran time)
⚡ Book quickly - appointments fill fast!
```

## CLI Integration

The enhanced CLI includes Telegram testing commands:

```bash
# Test Telegram configuration
ielts-monitor telegram-test

# Validate all configuration
ielts-monitor config-validate

# Check server status (includes Telegram status)
ielts-monitor server-status
```

## Troubleshooting

### Common Issues

1. **"Telegram bot not initialized"**
   - Check your bot token format
   - Ensure the bot token is valid and active

2. **"Connection failed: Unauthorized"**
   - Verify your bot token is correct
   - Make sure you've started a chat with the bot

3. **"Connection failed: Bad Request"**
   - Check your chat ID is correct
   - Ensure the chat ID is a number, not a username

4. **"No available appointments to notify about"**
   - This is normal - only available appointments trigger notifications
   - Check that your appointments have `status: 'available'`

### Testing Commands

```bash
# Check environment configuration
node -e "
const { EnvironmentConfigManager } = require('./dist/services');
EnvironmentConfigManager.printConfigStatus();
"

# Test Telegram connection
node -e "
const { TelegramNotifier } = require('./dist/services');
const config = {
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID,
  messageFormat: 'detailed',
  enablePreview: false
};
const notifier = new TelegramNotifier(config);
notifier.testConnection().then(result => console.log(result));
"
```

### Debug Mode

Enable debug logging to see detailed Telegram communication:

```bash
MONITOR_LOG_LEVEL=debug npm start
```

## Security Considerations

- ✅ **Never commit bot tokens** - Use environment variables or secure config files
- ✅ **Restrict bot permissions** - Bots only need to send messages
- ✅ **Use private chats** - Avoid sending sensitive data to public groups
- ✅ **Monitor bot usage** - Check for unauthorized access in BotFather
- ✅ **Rotate tokens regularly** - Generate new tokens periodically

## Integration with Monitoring

The Telegram integration works seamlessly with the existing monitoring system:

```typescript
import { MonitorController } from './src/services';

const monitor = new MonitorController(config);

// Configure notifications to use Telegram
monitor.on('appointmentsFound', async (appointments) => {
  const channels = {
    desktop: false,
    audio: false,
    logFile: true,
    telegram: true  // Enable Telegram notifications
  };
  
  await notificationService.sendNotification(appointments, channels);
});
```

## Performance Notes

- Telegram API has rate limits (30 messages per second)
- The retry mechanism handles temporary failures
- Messages are sent asynchronously to avoid blocking
- Failed notifications are logged for debugging

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Enable debug logging
3. Test your configuration with the provided examples
4. Verify your bot and chat setup in Telegram

For additional help, check the main documentation or create an issue with your configuration (remember to mask sensitive data).