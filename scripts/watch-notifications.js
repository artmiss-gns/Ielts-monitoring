#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Watch notification log file for real-time updates
 */
function watchNotifications() {
  const logPath = path.join('logs', 'notifications.log');
  
  console.log('👀 Watching notification log file...');
  console.log(`📁 File: ${logPath}`);
  console.log('🔄 Press Ctrl+C to stop\n');

  // Ensure log directory exists
  const logDir = path.dirname(logPath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Create log file if it doesn't exist
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, '');
    console.log('📝 Created new notification log file');
  }

  // Read existing content
  let lastSize = 0;
  try {
    const stats = fs.statSync(logPath);
    lastSize = stats.size;
    
    if (lastSize > 0) {
      console.log('📚 Existing notifications:');
      const content = fs.readFileSync(logPath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      lines.forEach((line, index) => {
        try {
          const entry = JSON.parse(line);
          console.log(`   ${index + 1}. ${entry.timestamp} - ${entry.count} appointments`);
        } catch (error) {
          console.log(`   ${index + 1}. [Invalid entry]`);
        }
      });
      console.log('');
    }
  } catch (error) {
    console.log('📝 No existing notifications found\n');
  }

  console.log('⏳ Waiting for new notifications...\n');

  // Watch for file changes
  fs.watchFile(logPath, { interval: 500 }, (curr, prev) => {
    if (curr.size > lastSize) {
      // File has grown, read new content
      const stream = fs.createReadStream(logPath, {
        start: lastSize,
        encoding: 'utf8'
      });

      let buffer = '';
      stream.on('data', (chunk) => {
        buffer += chunk;
      });

      stream.on('end', () => {
        const newLines = buffer.trim().split('\n').filter(line => line.trim());
        
        newLines.forEach(line => {
          try {
            const entry = JSON.parse(line);
            const timestamp = new Date(entry.timestamp).toLocaleString();
            
            console.log('🔔 NEW NOTIFICATION!');
            console.log(`   ⏰ Time: ${timestamp}`);
            console.log(`   📊 Count: ${entry.count} appointments`);
            console.log(`   📋 Appointments:`);
            
            entry.appointments.forEach((apt, index) => {
              console.log(`      ${index + 1}. ${apt.date} at ${apt.time} - ${apt.location}`);
            });
            console.log('');
          } catch (error) {
            console.log('🔔 NEW NOTIFICATION! (Unable to parse details)');
          }
        });
      });

      lastSize = curr.size;
    }
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Stopping notification watcher...');
    fs.unwatchFile(logPath);
    process.exit(0);
  });
}

watchNotifications();