#!/usr/bin/env node

const { addAppointment } = require('../data/dataManager');

/**
 * Command-line script to add new test appointments
 * Usage: node scripts/add-appointment.js [options]
 * 
 * Options:
 *   --id <id>              Appointment ID (required)
 *   --date <date>          Date in YYYY-MM-DD format (default: next week)
 *   --time <time>          Time in HH:MM, HH:MM AM/PM, or HH:MM-HH:MM format (default: 09:00-12:00)
 *   --location <location>  Location (default: Isfahan Test Center - Room A)
 *   --city <city>          City (default: Isfahan)
 *   --examType <type>      Exam type: IELTS or CDIELTS (default: CDIELTS)
 *   --status <status>      Status: available, full, or pending (default: available)
 *   --price <price>        Price in IRR (default: 4500000 for CDIELTS, 5200000 for IELTS)
 *   --registrationUrl <url> Registration URL (optional)
 *   --help                 Show this help message
 */

function showHelp() {
  console.log(`
Command-line script to add new test appointments

Usage: node scripts/add-appointment.js [options]

Options:
  --id <id>              Appointment ID (required)
  --date <date>          Date in YYYY-MM-DD format (default: next week)
  --time <time>          Time in HH:MM, HH:MM AM/PM, or HH:MM-HH:MM format (default: 09:00-12:00)
  --location <location>  Location (default: Isfahan Test Center - Room A)
  --city <city>          City (default: Isfahan)
  --examType <type>      Exam type: IELTS or CDIELTS (default: CDIELTS)
  --status <status>      Status: available, full, or pending (default: available)
  --price <price>        Price in IRR (default: 4500000 for CDIELTS, 5200000 for IELTS)
  --registrationUrl <url> Registration URL (optional)
  --help                 Show this help message

Examples:
  # Add a basic CDIELTS appointment with defaults
  node scripts/add-appointment.js --id apt-005

  # Add a custom IELTS appointment
  node scripts/add-appointment.js --id apt-006 --date 2024-12-25 --time "14:00" --examType IELTS --city Tehran

  # Add a full appointment with all details
  node scripts/add-appointment.js --id apt-007 --date 2024-12-30 --time "10:30-13:30" --location "Isfahan Test Center - Room B" --city Isfahan --examType CDIELTS --status available --price 4500000 --registrationUrl "https://example.com/register/apt-007"
`);
}

/**
 * Parses command line arguments
 * @returns {Object} Parsed arguments object
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const parsed = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help') {
      showHelp();
      process.exit(0);
    }
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1];
      
      if (!value || value.startsWith('--')) {
        console.error(`Error: Missing value for argument ${arg}`);
        process.exit(1);
      }
      
      parsed[key] = value;
      i++; // Skip the value in next iteration
    }
  }
  
  return parsed;
}

/**
 * Generates default date (one week from today)
 * @returns {string} Date in YYYY-MM-DD format
 */
function getDefaultDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7); // Add 7 days
  return date.toISOString().split('T')[0];
}

/**
 * Generates a unique appointment ID if not provided
 * @returns {string} Generated appointment ID
 */
function generateAppointmentId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `apt-${timestamp}-${random}`;
}

/**
 * Gets default price based on exam type
 * @param {string} examType - The exam type
 * @returns {number} Default price
 */
function getDefaultPrice(examType) {
  return examType === 'IELTS' ? 5200000 : 4500000;
}

/**
 * Validates and formats time input to match required HH:MM-HH:MM format
 * @param {string} timeInput - Time input from user (can be single time or range)
 * @returns {string} Formatted time string in HH:MM-HH:MM format
 */
function formatTime(timeInput) {
  // If already in HH:MM-HH:MM format, validate and return
  if (/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(timeInput)) {
    return timeInput;
  }
  
  // If it's a single time, convert to a 3-hour range (typical exam duration)
  const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i;
  const match = timeInput.match(timeRegex);
  
  if (match) {
    let startHours = parseInt(match[1]);
    const minutes = match[2];
    const period = match[3] ? match[3].toUpperCase() : null;
    
    // Convert to 24-hour format for calculation
    if (period === 'PM' && startHours !== 12) {
      startHours += 12;
    } else if (period === 'AM' && startHours === 12) {
      startHours = 0;
    }
    
    // Calculate end time (3 hours later)
    let endHours = startHours + 3;
    if (endHours >= 24) {
      endHours -= 24;
    }
    
    // Format as HH:MM-HH:MM
    const startTime = `${startHours.toString().padStart(2, '0')}:${minutes}`;
    const endTime = `${endHours.toString().padStart(2, '0')}:${minutes}`;
    
    return `${startTime}-${endTime}`;
  }
  
  // Try to parse 24-hour format
  const time24Regex = /^(\d{1,2}):(\d{2})$/;
  const match24 = timeInput.match(time24Regex);
  
  if (match24) {
    let startHours = parseInt(match24[1]);
    const minutes = match24[2];
    
    if (startHours > 23) {
      throw new Error(`Invalid hour: ${startHours}. Hours must be 0-23.`);
    }
    
    // Calculate end time (3 hours later)
    let endHours = startHours + 3;
    if (endHours >= 24) {
      endHours -= 24;
    }
    
    // Format as HH:MM-HH:MM
    const startTime = `${startHours.toString().padStart(2, '0')}:${minutes}`;
    const endTime = `${endHours.toString().padStart(2, '0')}:${minutes}`;
    
    return `${startTime}-${endTime}`;
  }
  
  throw new Error(`Invalid time format: ${timeInput}. Use HH:MM, HH:MM AM/PM, or HH:MM-HH:MM format.`);
}

/**
 * Creates appointment object with defaults and user input
 * @param {Object} args - Parsed command line arguments
 * @returns {Object} Complete appointment object
 */
function createAppointment(args) {
  // Required ID
  if (!args.id) {
    console.error('Error: Appointment ID is required. Use --id <id> or --help for usage.');
    process.exit(1);
  }
  
  // Set defaults for Isfahan/CDIELTS appointments
  const examType = args.examType || 'CDIELTS';
  const city = args.city || 'Isfahan';
  const defaultLocation = city === 'Isfahan' ? 'Isfahan Test Center - Room A' : `${city} Test Center - Main Hall`;
  
  const appointment = {
    id: args.id,
    date: args.date || getDefaultDate(),
    time: args.time ? formatTime(args.time) : '09:00-12:00',
    location: args.location || defaultLocation,
    city: city,
    examType: examType,
    status: args.status || 'available',
    price: args.price ? parseInt(args.price) : getDefaultPrice(examType)
  };
  
  // Add registration URL if provided
  if (args.registrationUrl) {
    appointment.registrationUrl = args.registrationUrl;
  } else if (appointment.status === 'available') {
    appointment.registrationUrl = `https://example.com/register/${appointment.id}`;
  }
  
  return appointment;
}

/**
 * Main execution function
 */
async function main() {
  try {
    const args = parseArguments();
    const appointment = createAppointment(args);
    
    console.log('Adding appointment with the following details:');
    console.log(JSON.stringify(appointment, null, 2));
    console.log('');
    
    const addedAppointment = await addAppointment(appointment);
    
    console.log('✅ Appointment added successfully!');
    console.log(`Appointment ID: ${addedAppointment.id}`);
    console.log(`Date: ${addedAppointment.date}`);
    console.log(`Time: ${addedAppointment.time}`);
    console.log(`Location: ${addedAppointment.location}`);
    console.log(`City: ${addedAppointment.city}`);
    console.log(`Exam Type: ${addedAppointment.examType}`);
    console.log(`Status: ${addedAppointment.status}`);
    console.log(`Price: ${addedAppointment.price ? addedAppointment.price.toLocaleString() + ' IRR' : 'Not specified'}`);
    if (addedAppointment.registrationUrl) {
      console.log(`Registration URL: ${addedAppointment.registrationUrl}`);
    }
    
  } catch (error) {
    console.error('❌ Error adding appointment:', error.message);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

module.exports = {
  parseArguments,
  createAppointment,
  formatTime,
  getDefaultDate,
  getDefaultPrice
};