#!/usr/bin/env node

/**
 * Simple desktop notification test using native macOS/Linux commands
 */
async function testDesktopNotification() {
  console.log('🖥️  Testing Desktop Notifications\n');

  const testMessage = 'IELTS Appointment Available!\nNew appointment: 2024-03-15 at 09:00 (Isfahan Test Center)';

  if (process.platform === 'darwin') {
    // macOS
    console.log('📱 Testing macOS notification...');
    try {
      const { exec } = require('child_process');
      const command = `osascript -e 'display notification "${testMessage}" with title "IELTS Monitor"'`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.log('❌ macOS notification failed:', error.message);
        } else {
          console.log('✅ macOS notification sent successfully!');
        }
      });
    } catch (error) {
      console.log('❌ macOS notification error:', error.message);
    }
  } else if (process.platform === 'linux') {
    // Linux
    console.log('🐧 Testing Linux notification...');
    try {
      const { exec } = require('child_process');
      const command = `notify-send "IELTS Monitor" "${testMessage}"`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.log('❌ Linux notification failed:', error.message);
          console.log('💡 Try installing: sudo apt-get install libnotify-bin');
        } else {
          console.log('✅ Linux notification sent successfully!');
        }
      });
    } catch (error) {
      console.log('❌ Linux notification error:', error.message);
    }
  } else if (process.platform === 'win32') {
    // Windows
    console.log('🪟 Testing Windows notification...');
    try {
      const { exec } = require('child_process');
      const command = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('${testMessage}', 'IELTS Monitor')"`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.log('❌ Windows notification failed:', error.message);
        } else {
          console.log('✅ Windows notification sent successfully!');
        }
      });
    } catch (error) {
      console.log('❌ Windows notification error:', error.message);
    }
  } else {
    console.log('❓ Unknown platform:', process.platform);
    console.log('💡 Desktop notifications may not be supported');
  }

  console.log('\n💡 If you see a notification popup, desktop notifications are working!');
  console.log('🔧 If not, check your system notification settings.');
}

testDesktopNotification();