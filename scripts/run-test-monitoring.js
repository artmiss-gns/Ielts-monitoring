#!/usr/bin/env node

const { MonitorController } = require('../dist/services/MonitorController');
const { TestWebScraperService } = require('../dist/services/TestWebScraperService');
const fs = require('fs-extra');
const path = require('path');

/**
 * Run monitoring system with test server configuration
 */
async function runTestMonitoring() {
  console.log('🚀 Starting IELTS Monitor with Test Server Configuration\n');

  // Load test configuration
  const configPath = path.join('config', 'test-config.json');
  let config;
  
  try {
    config = await fs.readJson(configPath);
    console.log('📋 Loaded test configuration:');
    console.log(`   🏙️  Cities: ${config.city.join(', ')}`);
    console.log(`   📚 Exam Models: ${config.examModel.join(', ')}`);
    console.log(`   📅 Months: ${config.months.join(', ')}`);
    console.log(`   ⏱️  Check Interval: ${config.checkInterval}ms`);
    console.log(`   🔔 Notifications: Desktop=${config.notificationSettings.desktop}, Audio=${config.notificationSettings.audio}, Log=${config.notificationSettings.logFile}`);
    console.log('');
  } catch (error) {
    console.error('❌ Failed to load test configuration:', error.message);
    process.exit(1);
  }

  // Create monitor controller with test server URL
  const TEST_SERVER_URL = 'http://localhost:3001';
  console.log(`🎯 Monitoring test server: ${TEST_SERVER_URL}`);
  console.log('');

  // Note: We'll use a custom approach since we need to replace the WebScraperService
  // with our TestWebScraperService for API-based monitoring
  
  const monitorController = new MonitorController({ 
    skipShutdownHandlers: false,
    baseUrl: TEST_SERVER_URL 
  });

  // Set up event listeners
  monitorController.on('status-changed', (status) => {
    console.log(`📊 Status changed: ${status}`);
  });

  monitorController.on('appointments-found', (appointments) => {
    console.log(`🔍 Found ${appointments.length} appointments`);
    if (appointments.length > 0) {
      appointments.forEach((apt, index) => {
        console.log(`   ${index + 1}. ${apt.date} at ${apt.time} - ${apt.location} (${apt.city})`);
      });
    }
  });

  monitorController.on('new-appointments', (appointments) => {
    console.log(`🆕 NEW APPOINTMENTS DETECTED! Count: ${appointments.length}`);
    appointments.forEach((apt, index) => {
      console.log(`   🎉 ${index + 1}. ${apt.date} at ${apt.time} - ${apt.location} (${apt.city})`);
    });
    console.log('');
  });

  monitorController.on('check-completed', (count) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`✅ [${timestamp}] Check completed - ${count} appointments found`);
  });

  monitorController.on('notification-sent', (count) => {
    console.log(`🔔 Notification sent for ${count} appointments`);
  });

  monitorController.on('error', (error) => {
    console.error(`❌ Monitor error: ${error.message}`);
  });

  // Start monitoring
  try {
    console.log('🏁 Starting monitoring...');
    await monitorController.startMonitoring(config);
    
    console.log('✅ Monitoring started successfully!');
    console.log('');
    console.log('💡 Instructions:');
    console.log('   1. Keep this terminal open to see monitoring activity');
    console.log('   2. In another terminal, add appointments to trigger notifications:');
    console.log('');
    console.log('   curl -X POST http://localhost:3001/api/appointments \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"id":"test-1","date":"2024-03-15","time":"09:00","location":"Test Center","examType":"IELTS","city":"Isfahan","status":"available"}\'');
    console.log('');
    console.log('   3. Watch for notifications in this terminal!');
    console.log('   4. Press Ctrl+C to stop monitoring');
    console.log('');

  } catch (error) {
    console.error('❌ Failed to start monitoring:', error.message);
    process.exit(1);
  }

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down monitoring...');
    try {
      await monitorController.stopMonitoring();
      console.log('✅ Monitoring stopped successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error.message);
      process.exit(1);
    }
  });
}

// Check if test server is running
async function checkTestServer() {
  const axios = require('axios');
  const TEST_SERVER_URL = 'http://localhost:3001';
  
  try {
    await axios.get(`${TEST_SERVER_URL}/health`);
    return true;
  } catch (error) {
    return false;
  }
}

// Main execution
async function main() {
  // Check if test server is running
  const serverRunning = await checkTestServer();
  
  if (!serverRunning) {
    console.log('❌ Test server is not running!');
    console.log('');
    console.log('🚀 Please start the test server first:');
    console.log('   node test-simulation/server.js');
    console.log('');
    console.log('Then run this script again.');
    process.exit(1);
  }

  await runTestMonitoring();
}

main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});