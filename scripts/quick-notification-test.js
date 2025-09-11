#!/usr/bin/env node

const { NotificationService } = require('../dist/services/NotificationService');

/**
 * Quick notification test - sends a test notification immediately
 */
async function quickTest() {
  console.log('🔔 Quick Notification Test\n');
  
  const notificationService = new NotificationService();
  
  const testAppointment = {
    id: 'quick-test',
    date: new Date().toISOString().split('T')[0], // Today's date
    time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    location: 'Quick Test Center',
    examType: 'IELTS',
    city: 'Isfahan',
    status: 'available'
  };

  console.log('📋 Sending test notification for:');
  console.log(`   📅 ${testAppointment.date} at ${testAppointment.time}`);
  console.log(`   📍 ${testAppointment.location}`);
  console.log('');

  try {
    const result = await notificationService.sendNotification([testAppointment], {
      desktop: true,
      audio: true,
      logFile: true
    });

    console.log('✅ Notification sent successfully!');
    console.log(`📊 Status: ${result.deliveryStatus}`);
    console.log(`🔗 Channels: ${result.channels.join(', ')}`);
    console.log('');
    console.log('💡 You should see:');
    console.log('   • A desktop notification popup');
    console.log('   • Hear a system sound');
    console.log('   • A new entry in logs/notifications.log');

  } catch (error) {
    console.error('❌ Notification failed:', error.message);
    process.exit(1);
  }
}

quickTest();