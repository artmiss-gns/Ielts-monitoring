#!/usr/bin/env node

const { NotificationService } = require('../dist/services/NotificationService');
const fs = require('fs-extra');
const path = require('path');

/**
 * Test notification system with sample appointments
 */
async function testNotifications() {
  console.log('🔔 Testing IELTS Appointment Notification System\n');
  
  const notificationService = new NotificationService();
  
  // Sample appointments for testing
  const testAppointments = [
    {
      id: 'test-notification-1',
      date: '2024-03-15',
      time: '09:00',
      location: 'Isfahan Test Center',
      examType: 'IELTS',
      city: 'Isfahan',
      status: 'available'
    },
    {
      id: 'test-notification-2',
      date: '2024-03-20',
      time: '14:30',
      location: 'Tehran Test Center',
      examType: 'IELTS',
      city: 'Tehran',
      status: 'available'
    }
  ];

  console.log('📋 Test appointments:');
  testAppointments.forEach((apt, index) => {
    console.log(`   ${index + 1}. ${apt.date} at ${apt.time} - ${apt.location}`);
  });
  console.log('');

  // Test 1: Desktop notification only
  console.log('🖥️  Test 1: Desktop Notification');
  console.log('   This should show a desktop notification popup...');
  try {
    const result1 = await notificationService.sendNotification(testAppointments, {
      desktop: true,
      audio: false,
      logFile: false
    });
    console.log(`   ✅ Desktop notification: ${result1.deliveryStatus}`);
    console.log(`   📊 Channels used: ${result1.channels.join(', ')}`);
  } catch (error) {
    console.log(`   ❌ Desktop notification failed: ${error.message}`);
  }
  console.log('');

  // Wait a moment between tests
  await delay(2000);

  // Test 2: Audio alert only
  console.log('🔊 Test 2: Audio Alert');
  console.log('   This should play a system sound...');
  try {
    const result2 = await notificationService.sendNotification(testAppointments, {
      desktop: false,
      audio: true,
      logFile: false
    });
    console.log(`   ✅ Audio alert: ${result2.deliveryStatus}`);
    console.log(`   📊 Channels used: ${result2.channels.join(', ')}`);
  } catch (error) {
    console.log(`   ❌ Audio alert failed: ${error.message}`);
  }
  console.log('');

  // Wait a moment between tests
  await delay(2000);

  // Test 3: Log file notification only
  console.log('📝 Test 3: Log File Notification');
  console.log('   This should write to logs/notifications.log...');
  try {
    const result3 = await notificationService.sendNotification(testAppointments, {
      desktop: false,
      audio: false,
      logFile: true
    });
    console.log(`   ✅ Log file notification: ${result3.deliveryStatus}`);
    console.log(`   📊 Channels used: ${result3.channels.join(', ')}`);
    
    // Check if log file was created
    const logPath = path.join('logs', 'notifications.log');
    if (await fs.pathExists(logPath)) {
      const logContent = await fs.readFile(logPath, 'utf8');
      const lines = logContent.trim().split('\n');
      console.log(`   📄 Log file has ${lines.length} entries`);
    }
  } catch (error) {
    console.log(`   ❌ Log file notification failed: ${error.message}`);
  }
  console.log('');

  // Wait a moment between tests
  await delay(2000);

  // Test 4: All notifications enabled
  console.log('🎯 Test 4: All Notification Channels');
  console.log('   This should trigger desktop, audio, and log file notifications...');
  try {
    const result4 = await notificationService.sendNotification(testAppointments, {
      desktop: true,
      audio: true,
      logFile: true
    });
    console.log(`   ✅ All notifications: ${result4.deliveryStatus}`);
    console.log(`   📊 Channels used: ${result4.channels.join(', ')}`);
    console.log(`   📈 Appointment count: ${result4.appointmentCount}`);
  } catch (error) {
    console.log(`   ❌ All notifications failed: ${error.message}`);
  }
  console.log('');

  // Test 5: Single appointment notification
  console.log('📱 Test 5: Single Appointment Notification');
  console.log('   This should show a notification for just one appointment...');
  try {
    const singleAppointment = [testAppointments[0]];
    const result5 = await notificationService.sendNotification(singleAppointment, {
      desktop: true,
      audio: false,
      logFile: true
    });
    console.log(`   ✅ Single appointment notification: ${result5.deliveryStatus}`);
    console.log(`   📊 Channels used: ${result5.channels.join(', ')}`);
  } catch (error) {
    console.log(`   ❌ Single appointment notification failed: ${error.message}`);
  }
  console.log('');

  // Test 6: Check notification history
  console.log('📚 Test 6: Notification History');
  try {
    const history = await notificationService.getNotificationHistory(5);
    console.log(`   📊 Found ${history.length} notifications in history`);
    
    if (history.length > 0) {
      console.log('   📋 Recent notifications:');
      history.forEach((record, index) => {
        console.log(`      ${index + 1}. ${record.timestamp.toISOString()} - ${record.appointmentCount} appointments`);
      });
    }

    const stats = await notificationService.getNotificationStats();
    console.log(`   📈 Statistics:`);
    console.log(`      Total notifications: ${stats.totalNotifications}`);
    console.log(`      Total appointments: ${stats.totalAppointments}`);
    console.log(`      Average per notification: ${stats.averageAppointmentsPerNotification.toFixed(1)}`);
    if (stats.lastNotification) {
      console.log(`      Last notification: ${stats.lastNotification.toISOString()}`);
    }
  } catch (error) {
    console.log(`   ❌ History check failed: ${error.message}`);
  }
  console.log('');

  // Final summary
  console.log('=' .repeat(60));
  console.log('🎉 Notification Testing Complete!');
  console.log('=' .repeat(60));
  console.log('');
  console.log('💡 What to expect:');
  console.log('   • Desktop notifications should appear as system popups');
  console.log('   • Audio alerts should play system sounds');
  console.log('   • Log entries should be written to logs/notifications.log');
  console.log('');
  console.log('🔍 To verify:');
  console.log('   • Check your system notifications');
  console.log('   • Listen for audio alerts');
  console.log('   • Check logs/notifications.log file');
  console.log('');
}

/**
 * Interactive notification test
 */
async function interactiveTest() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  console.log('🎮 Interactive Notification Test');
  console.log('This will let you test specific notification types.\n');

  const notificationService = new NotificationService();
  
  const testAppointment = {
    id: 'interactive-test',
    date: '2024-04-01',
    time: '10:00',
    location: 'Interactive Test Center',
    examType: 'IELTS',
    city: 'Isfahan',
    status: 'available'
  };

  while (true) {
    console.log('\n📋 Choose a notification type to test:');
    console.log('1. Desktop notification');
    console.log('2. Audio alert');
    console.log('3. Log file notification');
    console.log('4. All notifications');
    console.log('5. View notification history');
    console.log('6. Exit');

    const choice = await question('\nEnter your choice (1-6): ');

    switch (choice.trim()) {
      case '1':
        console.log('\n🖥️  Sending desktop notification...');
        try {
          await notificationService.sendNotification([testAppointment], {
            desktop: true,
            audio: false,
            logFile: false
          });
          console.log('✅ Desktop notification sent! Check your system notifications.');
        } catch (error) {
          console.log(`❌ Failed: ${error.message}`);
        }
        break;

      case '2':
        console.log('\n🔊 Playing audio alert...');
        try {
          await notificationService.sendNotification([testAppointment], {
            desktop: false,
            audio: true,
            logFile: false
          });
          console.log('✅ Audio alert played! Did you hear it?');
        } catch (error) {
          console.log(`❌ Failed: ${error.message}`);
        }
        break;

      case '3':
        console.log('\n📝 Writing to log file...');
        try {
          await notificationService.sendNotification([testAppointment], {
            desktop: false,
            audio: false,
            logFile: true
          });
          console.log('✅ Log entry written! Check logs/notifications.log');
        } catch (error) {
          console.log(`❌ Failed: ${error.message}`);
        }
        break;

      case '4':
        console.log('\n🎯 Sending all notification types...');
        try {
          const result = await notificationService.sendNotification([testAppointment], {
            desktop: true,
            audio: true,
            logFile: true
          });
          console.log(`✅ All notifications sent! Status: ${result.deliveryStatus}`);
          console.log(`📊 Channels: ${result.channels.join(', ')}`);
        } catch (error) {
          console.log(`❌ Failed: ${error.message}`);
        }
        break;

      case '5':
        console.log('\n📚 Notification History:');
        try {
          const history = await notificationService.getNotificationHistory(10);
          if (history.length === 0) {
            console.log('No notifications found in history.');
          } else {
            history.forEach((record, index) => {
              console.log(`${index + 1}. ${record.timestamp.toLocaleString()} - ${record.appointmentCount} appointments`);
            });
          }
        } catch (error) {
          console.log(`❌ Failed: ${error.message}`);
        }
        break;

      case '6':
        console.log('\n👋 Goodbye!');
        rl.close();
        return;

      default:
        console.log('\n❌ Invalid choice. Please enter 1-6.');
    }
  }
}

/**
 * Utility function for delays
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--interactive') || args.includes('-i')) {
    await interactiveTest();
  } else {
    await testNotifications();
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n👋 Testing interrupted. Goodbye!');
  process.exit(0);
});

// Run the tests
main().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});