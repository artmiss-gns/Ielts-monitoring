#!/usr/bin/env node

/**
 * Script to add mixed appointment statuses for testing detection logic
 * This script adds both filled and available appointments to test the detection algorithm
 */

const fs = require('fs').promises;
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'appointments.json');

// Sample appointments with mixed statuses
const mixedAppointments = [
  // Filled appointments (should be detected as filled)
  {
    "id": "filled-test-1",
    "date": "2025-12-01",
    "time": "ظهر (۱۳:۳۰ - ۱۶:۳۰)",
    "location": "اصفهان (ایده نواندیش)",
    "city": "Isfahan",
    "examType": "cdielts - (Ac/Gt)",
    "price": "۲۹۱,۱۱۵,۰۰۰ ریال",
    "persianDate": "۱۴۰۴/۰۹/۱۰",
    "status": "filled",
    "filledIndicators": ["disabled", "تکمیل ظرفیت"],
    "availableIndicators": [],
    "registrationUrl": null
  },
  {
    "id": "filled-test-2",
    "date": "2025-12-08",
    "time": "صبح (۰۹:۰۰ - ۱۲:۰۰)",
    "location": "تهران (مرکز آزمون)",
    "city": "Tehran",
    "examType": "cdielts - (Ac/Gt)",
    "price": "۲۹۱,۱۱۵,۰۰۰ ریال",
    "persianDate": "۱۴۰۴/۰۹/۱۷",
    "status": "filled",
    "filledIndicators": ["disabled", "تکمیل ظرفیت"],
    "availableIndicators": [],
    "registrationUrl": null
  },
  
  // Available appointments (should be detected as available)
  {
    "id": "available-test-1",
    "date": "2025-12-15",
    "time": "ظهر (۱۳:۳۰ - ۱۶:۳۰)",
    "location": "اصفهان (ایده نواندیش)",
    "city": "Isfahan",
    "examType": "cdielts - (Ac/Gt)",
    "price": "۲۹۱,۱۱۵,۰۰۰ ریال",
    "persianDate": "۱۴۰۴/۰۹/۲۴",
    "status": "available",
    "filledIndicators": [],
    "availableIndicators": ["قابل ثبت نام", "active-button"],
    "registrationUrl": "https://irsafam.org/ielts/register/available-test-1"
  },
  {
    "id": "available-test-2",
    "date": "2025-12-22",
    "time": "صبح (۰۹:۰۰ - ۱۲:۰۰)",
    "location": "شیراز (مرکز آزمون)",
    "city": "Shiraz",
    "examType": "cdielts - (Ac/Gt)",
    "price": "۲۹۱,۱۱۵,۰۰۰ ریال",
    "persianDate": "۱۴۰۴/۱۰/۰۱",
    "status": "available",
    "filledIndicators": [],
    "availableIndicators": ["قابل ثبت نام", "active-button"],
    "registrationUrl": "https://irsafam.org/ielts/register/available-test-2"
  },
  
  // Edge case: appointment with unclear status (should be detected as unknown)
  {
    "id": "unclear-test-1",
    "date": "2025-12-29",
    "time": "ظهر (۱۳:۳۰ - ۱۶:۳۰)",
    "location": "مشهد (مرکز آزمون)",
    "city": "Mashhad",
    "examType": "cdielts - (Ac/Gt)",
    "price": "۲۹۱,۱۱۵,۰۰۰ ریال",
    "persianDate": "۱۴۰۴/۱۰/۰۸",
    "status": "unknown",
    "filledIndicators": [],
    "availableIndicators": [],
    "registrationUrl": null
  }
];

async function readAppointments() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log('No existing appointments file, starting with empty array');
    return [];
  }
}

async function writeAppointments(appointments) {
  try {
    // Ensure data directory exists
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(appointments, null, 2));
  } catch (error) {
    console.error('Error writing appointments:', error);
    throw error;
  }
}

async function addMixedAppointments() {
  try {
    console.log('Adding mixed appointment statuses for testing...');
    
    // Read existing appointments
    const existingAppointments = await readAppointments();
    console.log(`Found ${existingAppointments.length} existing appointments`);
    
    // Remove any existing test appointments to avoid duplicates
    const filteredAppointments = existingAppointments.filter(apt => 
      !apt.id.includes('test') && !apt.id.includes('unclear')
    );
    
    // Add new mixed appointments
    const allAppointments = [...filteredAppointments, ...mixedAppointments];
    
    // Write back to file
    await writeAppointments(allAppointments);
    
    console.log(`Successfully added ${mixedAppointments.length} mixed test appointments`);
    console.log(`Total appointments: ${allAppointments.length}`);
    
    // Summary of what was added
    const filledCount = mixedAppointments.filter(apt => apt.status === 'filled').length;
    const availableCount = mixedAppointments.filter(apt => apt.status === 'available').length;
    const unknownCount = mixedAppointments.filter(apt => apt.status === 'unknown').length;
    
    console.log('\nAdded appointments summary:');
    console.log(`- Filled appointments: ${filledCount}`);
    console.log(`- Available appointments: ${availableCount}`);
    console.log(`- Unknown status appointments: ${unknownCount}`);
    
    console.log('\nTest appointments added successfully!');
    console.log('You can now test the detection logic against http://localhost:3001/ielts/timetable');
    
  } catch (error) {
    console.error('Error adding mixed appointments:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  addMixedAppointments();
}

module.exports = { addMixedAppointments, mixedAppointments };