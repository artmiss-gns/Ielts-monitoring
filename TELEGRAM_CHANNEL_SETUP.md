# Quick Telegram Channel Setup Guide

## 🚀 Ready to Test Your Telegram Channel Integration!

The implementation now supports **Telegram Channels** instead of private chats. This is perfect for public IELTS appointment notifications that anyone can subscribe to.

## 📋 What You Need to Provide

1. **Bot Token** - From @BotFather
2. **Channel Username** - Your channel's @username or numeric ID

## 🔧 Quick Setup Steps

### 1. Create Your Channel
1. Open Telegram and create a new channel
2. Make it public and choose a username (e.g., `@ielts_appointments_iran`)
3. Add a description like "Instant IELTS appointment alerts for Iran"

### 2. Add Your Bot as Admin
1. Go to your channel settings
2. Add your bot as an administrator
3. Give it "Post Messages" permission (that's all it needs)

### 3. Test the Integration

Run this command with your credentials:

```bash
node scripts/test-telegram-channel.js "YOUR_BOT_TOKEN" "@your_channel_username"
```

Example:
```bash
node scripts/test-telegram-channel.js "123456789:ABCdefGHIjklMNOpqrsTUVwxyz" "@ielts_appointments_iran"
```

### 4. Configure Your Environment

Add to your `.env` file:
```bash
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=@your_channel_username
TELEGRAM_IS_CHANNEL=true
TELEGRAM_MESSAGE_FORMAT=detailed
```

## 🎯 What the Bot Will Do

- **Post rich notifications** when new IELTS appointments are found
- **Include all appointment details** (date, time, location, price, etc.)
- **Add channel-specific messaging** to encourage subscriptions
- **Handle errors gracefully** and retry failed posts

## 📱 Sample Channel Message

When appointments are found, your channel will receive messages like:

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

📢 Join this channel for instant IELTS appointment alerts!
```

## 🛠️ Ready to Test?

Just provide me with:
1. Your bot token
2. Your channel username (e.g., `@your_channel_name`)

And I'll run the test script to verify everything works perfectly!

## 🔒 Security Note

- Your bot token will only be used for testing
- The channel will be public (anyone can join and see messages)
- No personal data is stored or transmitted