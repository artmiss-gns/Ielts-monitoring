#!/usr/bin/env node

/**
 * Test script for Telegram Channel integration
 * 
 * Usage:
 * node scripts/test-telegram-channel.js <BOT_TOKEN> <CHANNEL_ID>
 * 
 * Example:
 * node scripts/test-telegram-channel.js "123456789:ABCdefGHI..." "@my_ielts_channel"
 */

const TelegramBot = require('node-telegram-bot-api');

async function testTelegramChannel(botToken, channelId) {
  console.log('🤖 Testing Telegram Channel Integration');
  console.log('=====================================\n');

  try {
    // Initialize bot
    console.log('1. Initializing bot...');
    const bot = new TelegramBot(botToken, { polling: false });

    // Test bot info
    console.log('2. Getting bot information...');
    const botInfo = await bot.getMe();
    console.log(`   ✅ Bot: @${botInfo.username} (${botInfo.first_name})`);

    // Test channel access
    console.log('3. Testing channel access...');
    const testMessage = `🤖 <b>IELTS Monitor Channel Test</b>

This is a test message to verify that the bot can post to this channel.

📢 <i>This channel will receive IELTS appointment alerts when new slots become available.</i>

🕒 <i>Test sent at: ${new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })} (Tehran time)</i>`;

    const result = await bot.sendMessage(channelId, testMessage, {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });

    console.log(`   ✅ Message sent successfully!`);
    console.log(`   📱 Message ID: ${result.message_id}`);
    console.log(`   📢 Channel: ${channelId}`);

    // Test sample appointment notification
    console.log('4. Testing appointment notification format...');
    const sampleAppointmentMessage = `🎯 <b>2 New IELTS Appointments Available!</b>

📅 <b>Date:</b> 2024-03-15
🕐 <b>Time:</b> 09:00-12:00
📍 <b>Location:</b> Isfahan IELTS Center
📝 <b>Exam Type:</b> Academic IELTS
🏙️ <b>City:</b> Isfahan
💰 <b>Price:</b> 5,500,000 Toman

📅 <b>Date:</b> 2024-03-16
🕐 <b>Time:</b> 14:00-17:00
📍 <b>Location:</b> Tehran IELTS Center
📝 <b>Exam Type:</b> General IELTS
🏙️ <b>City:</b> Tehran

🕒 <i>Detected at: ${new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })} (Tehran time)</i>
⚡ <b>Book quickly - appointments fill fast!</b>

📢 <i>Join this channel for instant IELTS appointment alerts!</i>`;

    const sampleResult = await bot.sendMessage(channelId, sampleAppointmentMessage, {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });

    console.log(`   ✅ Sample notification sent!`);
    console.log(`   📱 Message ID: ${sampleResult.message_id}`);

    console.log('\n🎉 All tests passed! Your Telegram channel is ready for IELTS notifications.');
    console.log('\n📋 Configuration for your .env file:');
    console.log(`TELEGRAM_BOT_TOKEN=${botToken}`);
    console.log(`TELEGRAM_CHAT_ID=${channelId}`);
    console.log(`TELEGRAM_IS_CHANNEL=true`);
    console.log(`TELEGRAM_MESSAGE_FORMAT=detailed`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('Unauthorized')) {
      console.log('\n💡 Troubleshooting:');
      console.log('   - Check that your bot token is correct');
      console.log('   - Make sure the bot is active');
    } else if (error.message.includes('Forbidden') || error.message.includes('chat not found')) {
      console.log('\n💡 Troubleshooting:');
      console.log('   - Make sure the bot is added to the channel as an administrator');
      console.log('   - Check that the channel ID is correct (@channelname or -100xxxxxxxxx)');
      console.log('   - Ensure the bot has "Post Messages" permission in the channel');
    } else if (error.message.includes('Bad Request')) {
      console.log('\n💡 Troubleshooting:');
      console.log('   - Check that the channel ID format is correct');
      console.log('   - For public channels, use @channelname');
      console.log('   - For private channels, use the numeric ID starting with -100');
    }
    
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length !== 2) {
  console.log('Usage: node scripts/test-telegram-channel.js <BOT_TOKEN> <CHANNEL_ID>');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/test-telegram-channel.js "123456789:ABCdef..." "@my_channel"');
  console.log('  node scripts/test-telegram-channel.js "123456789:ABCdef..." "-1001234567890"');
  process.exit(1);
}

const [botToken, channelId] = args;

// Run the test
testTelegramChannel(botToken, channelId).catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});