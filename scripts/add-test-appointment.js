#!/usr/bin/env node

const axios = require('axios');

/**
 * Add a test appointment to the simulation server
 */
async function addTestAppointment() {
  const TEST_SERVER_URL = 'http://localhost:3001';
  
  // Generate a unique appointment
  const timestamp = Date.now();
  const testAppointment = {
    id: `test-${timestamp}`,
    date: '2024-03-15',
    time: '09:00',
    location: 'Isfahan Test Center',
    examType: 'IELTS',
    city: 'Isfahan',
    status: 'available'
  };

  console.log('➕ Adding test appointment to simulation server...');
  console.log(`📋 Appointment details:`);
  console.log(`   ID: ${testAppointment.id}`);
  console.log(`   Date: ${testAppointment.date}`);
  console.log(`   Time: ${testAppointment.time}`);
  console.log(`   Location: ${testAppointment.location}`);
  console.log(`   City: ${testAppointment.city}`);
  console.log('');

  try {
    const response = await axios.post(`${TEST_SERVER_URL}/api/appointments`, testAppointment);
    
    if (response.status === 201) {
      console.log('✅ Appointment added successfully!');
      console.log('🔔 The monitoring system should detect this new appointment and send notifications.');
      console.log('');
      console.log('💡 Check your monitoring terminal for notifications!');
    } else {
      console.log('⚠️  Unexpected response:', response.status);
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Cannot connect to test server!');
      console.log('');
      console.log('🚀 Please start the test server first:');
      console.log('   node test-simulation/server.js');
    } else {
      console.error('❌ Failed to add appointment:', error.message);
    }
    process.exit(1);
  }
}

// Allow custom appointment data via command line arguments
function parseCustomAppointment() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    return null;
  }

  // Simple format: date time location city
  // Example: node add-test-appointment.js 2024-04-01 14:30 "Tehran Center" Tehran
  if (args.length >= 4) {
    const timestamp = Date.now();
    return {
      id: `custom-${timestamp}`,
      date: args[0],
      time: args[1],
      location: args[2],
      city: args[3],
      examType: 'IELTS',
      status: 'available'
    };
  }

  return null;
}

// Main execution
async function main() {
  const customAppointment = parseCustomAppointment();
  
  if (customAppointment) {
    console.log('📝 Using custom appointment data...');
    // Override the default appointment with custom data
    const TEST_SERVER_URL = 'http://localhost:3001';
    
    console.log('➕ Adding custom appointment to simulation server...');
    console.log(`📋 Appointment details:`);
    console.log(`   ID: ${customAppointment.id}`);
    console.log(`   Date: ${customAppointment.date}`);
    console.log(`   Time: ${customAppointment.time}`);
    console.log(`   Location: ${customAppointment.location}`);
    console.log(`   City: ${customAppointment.city}`);
    console.log('');

    try {
      const response = await axios.post(`${TEST_SERVER_URL}/api/appointments`, customAppointment);
      
      if (response.status === 201) {
        console.log('✅ Custom appointment added successfully!');
        console.log('🔔 The monitoring system should detect this new appointment and send notifications.');
      }
    } catch (error) {
      console.error('❌ Failed to add custom appointment:', error.message);
      process.exit(1);
    }
  } else {
    await addTestAppointment();
  }
}

main();