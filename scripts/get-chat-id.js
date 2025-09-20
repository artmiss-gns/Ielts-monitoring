#!/usr/bin/env node

/**
 * Helper script to get your Telegram Chat ID
 * Usage: node scripts/get-chat-id.js <bot-token>
 */

const https = require('https');

const botToken = process.argv[2] || '8302810862:AAGV-QplGCReLxKgB56ASE-0zkvZxdQMjxk';

if (!botToken) {
  console.error('❌ Please provide a bot token');
  console.log('Usage: node scripts/get-chat-id.js <bot-token>');
  process.exit(1);
}

console.log('🤖 Getting Chat ID for your Telegram bot...');
console.log('📋 Make sure you have:');
console.log('   1. Started a chat with your bot in Telegram');
console.log('   2. Sent at least one message to the bot');
console.log('');

const url = `https://api.telegram.org/bot${botToken}/getUpdates`;

https.get(url, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (!response.ok) {
        console.error('❌ Error from Telegram API:', response.description);
        if (response.error_code === 401) {
          console.log('💡 This usually means your bot token is invalid.');
          console.log('   Check your token with @BotFather in Telegram.');
        }
        return;
      }
      
      if (response.result.length === 0) {
        console.log('❌ No messages found!');
        console.log('💡 To fix this:');
        console.log('   1. Open Telegram and find your bot');
        console.log('   2. Send a message to your bot (like "Hello")');
        console.log('   3. Run this script again');
        return;
      }
      
      // Get the most recent message
      const latestMessage = response.result[response.result.length - 1];
      const chatId = latestMessage.message.chat.id;
      const chatType = latestMessage.message.chat.type;
      const firstName = latestMessage.message.chat.first_name || 'Unknown';
      
      console.log('✅ Found your chat information:');
      console.log('');
      console.log(`📱 Chat ID: ${chatId}`);
      console.log(`👤 Name: ${firstName}`);
      console.log(`💬 Chat Type: ${chatType}`);
      console.log('');
      console.log('🔧 Use this Chat ID in your configuration:');
      console.log(`   TELEGRAM_CHAT_ID=${chatId}`);
      console.log('');
      console.log('📋 Full configuration:');
      console.log(`   TELEGRAM_BOT_TOKEN=${botToken}`);
      console.log(`   TELEGRAM_CHAT_ID=${chatId}`);
      
    } catch (error) {
      console.error('❌ Error parsing response:', error.message);
      console.log('Raw response:', data);
    }
  });
  
}).on('error', (error) => {
  console.error('❌ Network error:', error.message);
});