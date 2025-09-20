#!/usr/bin/env ts-node

/**
 * Example: Telegram Integration
 * 
 * This example demonstrates how to use the Telegram notification system
 * with the IELTS Appointment Monitor.
 * 
 * Prerequisites:
 * 1. Create a Telegram bot via @BotFather
 * 2. Get your chat ID by messaging your bot and visiting:
 *    https://api.telegram.org/bot<YourBOTToken>/getUpdates
 * 3. Set environment variables or update the config below
 */

import { NotificationService, TelegramNotifier, EnvironmentConfigManager } from '../src/services';
import { Appointment, TelegramConfig } from '../src/models/types';

async function demonstrateTelegramIntegration() {
  console.log('🤖 Telegram Integration Example');
  console.log('================================\n');

  // Method 1: Using Environment Variables
  console.log('📋 Checking environment configuration...');
  EnvironmentConfigManager.printConfigStatus();

  const telegramConfig = EnvironmentConfigManager.createTelegramConfig();
  
  if (telegramConfig) {
    console.log('✅ Using environment configuration for Telegram');
    await testTelegramWithConfig(telegramConfig);
  } else {
    console.log('❌ No environment configuration found');
    console.log('💡 You can set the following environment variables:');
    console.log('   TELEGRAM_BOT_TOKEN=your_bot_token_here');
    console.log('   TELEGRAM_CHAT_ID=your_chat_id_here\n');
    
    // Method 2: Manual Configuration (for testing)
    console.log('📝 Using manual configuration for demonstration...');
    const manualConfig: TelegramConfig = {
      botToken: 'demo-token-replace-with-real',
      chatId: 'demo-chat-id-replace-with-real',
      messageFormat: 'detailed',
      enablePreview: false,
      retryAttempts: 3,
      retryDelay: 1000
    };
    
    console.log('⚠️  This will fail without real credentials, but shows the integration:');
    await testTelegramWithConfig(manualConfig);
  }
}

async function testTelegramWithConfig(config: TelegramConfig) {
  // Create sample appointments
  const sampleAppointments: Appointment[] = [
    {
      id: 'demo-1',
      date: '2024-03-15',
      time: '09:00-12:00',
      location: 'Isfahan IELTS Center',
      examType: 'Academic IELTS',
      city: 'Isfahan',
      status: 'available',
      price: 5500000
    },
    {
      id: 'demo-2',
      date: '2024-03-16',
      time: '14:00-17:00',
      location: 'Tehran IELTS Center',
      examType: 'General IELTS',
      city: 'Tehran',
      status: 'available'
    }
  ];

  // Test 1: Direct TelegramNotifier usage
  console.log('\n🔧 Testing TelegramNotifier directly...');
  const telegramNotifier = new TelegramNotifier(config);
  
  console.log(`   Configured: ${telegramNotifier.isConfigured()}`);
  
  if (telegramNotifier.isConfigured()) {
    console.log('   Testing connection...');
    const connectionTest = await telegramNotifier.testConnection();
    console.log(`   Connection: ${connectionTest.success ? '✅' : '❌'} ${connectionTest.message}`);
    
    if (connectionTest.success) {
      console.log('   Sending test notification...');
      const notificationResult = await telegramNotifier.sendNotification(sampleAppointments);
      console.log(`   Notification sent: ${notificationResult ? '✅' : '❌'}`);
    }
  }

  // Test 2: NotificationService integration
  console.log('\n📢 Testing NotificationService integration...');
  const notificationService = new NotificationService('logs', config);
  
  console.log(`   Telegram configured: ${notificationService.isTelegramConfigured()}`);
  
  if (notificationService.isTelegramConfigured()) {
    console.log('   Testing Telegram connection via NotificationService...');
    const serviceTest = await notificationService.testTelegramConnection();
    console.log(`   Service test: ${serviceTest.success ? '✅' : '❌'} ${serviceTest.message}`);
    
    if (serviceTest.success) {
      console.log('   Sending multi-channel notification...');
      const channels = {
        desktop: false, // Disable desktop for server environments
        audio: false,   // Disable audio for server environments
        logFile: true,  // Enable file logging
        telegram: true  // Enable Telegram notifications
      };
      
      try {
        const result = await notificationService.sendNotification(sampleAppointments, channels);
        console.log(`   Multi-channel result: ${result.deliveryStatus}`);
        console.log(`   Successful channels: ${result.channels.join(', ')}`);
        console.log(`   Appointments notified: ${result.appointmentCount}`);
      } catch (error) {
        console.log(`   ❌ Notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  // Test 3: Configuration examples
  console.log('\n⚙️  Configuration Examples:');
  console.log('   Simple message format:');
  const simpleConfig = { ...config, messageFormat: 'simple' as const };
  console.log(`   ${JSON.stringify(EnvironmentConfigManager.maskSensitiveConfig(simpleConfig), null, 2)}`);
  
  console.log('\n   Detailed message format with preview:');
  const detailedConfig = { ...config, messageFormat: 'detailed' as const, enablePreview: true };
  console.log(`   ${JSON.stringify(EnvironmentConfigManager.maskSensitiveConfig(detailedConfig), null, 2)}`);
}

// Run the example
if (require.main === module) {
  demonstrateTelegramIntegration().catch(error => {
    console.error('❌ Example failed:', error);
    process.exit(1);
  });
}

export { demonstrateTelegramIntegration };