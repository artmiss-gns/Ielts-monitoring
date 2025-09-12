#!/usr/bin/env node

const { writeAppointments, readAppointments } = require('../data/dataManager');
const readline = require('readline');

/**
 * Command-line script to restore default test appointments
 * Usage: node scripts/reset-demo.js [options]
 * 
 * Options:
 *   --force    Skip confirmation prompt
 *   --help     Show this help message
 */

function showHelp() {
  console.log(`
Command-line script to restore default test appointments

Usage: node scripts/reset-demo.js [options]

Options:
  --force    Skip confirmation prompt and reset to demo state immediately
  --help     Show this help message

Examples:
  # Reset to demo appointments with confirmation
  node scripts/reset-demo.js

  # Reset to demo appointments without confirmation
  node scripts/reset-demo.js --force

Warning: This operation will replace all existing appointments with demo data!
`);
}

/**
 * Parses command line arguments
 * @returns {Object} Parsed arguments object
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const parsed = {
    force: false,
    help: false
  };
  
  for (const arg of args) {
    if (arg === '--help') {
      parsed.help = true;
    } else if (arg === '--force') {
      parsed.force = true;
    } else {
      console.error(`Error: Unknown argument ${arg}`);
      console.error('Use --help for usage information.');
      process.exit(1);
    }
  }
  
  return parsed;
}

/**
 * Prompts user for confirmation
 * @param {string} message - Confirmation message
 * @returns {Promise<boolean>} True if user confirms, false otherwise
 */
function askConfirmation(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(message, (answer) => {
      rl.close();
      const confirmed = ['y', 'yes', 'Y', 'YES', 'Yes'].includes(answer.trim());
      resolve(confirmed);
    });
  });
}

/**
 * Gets the default demo appointments
 * @returns {Array} Array of default appointment objects
 */
function getDefaultAppointments() {
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  const twoWeeksLater = new Date(today);
  twoWeeksLater.setDate(today.getDate() + 14);
  const threeWeeksLater = new Date(today);
  threeWeeksLater.setDate(today.getDate() + 21);
  
  const formatDate = (date) => date.toISOString().split('T')[0];
  
  return [
    {
      "id": "demo-apt-001",
      "date": formatDate(nextWeek),
      "time": "09:00-12:00",
      "location": "Isfahan Test Center - Room A",
      "city": "Isfahan",
      "examType": "CDIELTS",
      "status": "available",
      "price": 4500000,
      "registrationUrl": "https://example.com/register/demo-apt-001"
    },
    {
      "id": "demo-apt-002",
      "date": formatDate(nextWeek),
      "time": "14:00-17:00",
      "location": "Isfahan Test Center - Room B",
      "city": "Isfahan",
      "examType": "CDIELTS",
      "status": "full",
      "price": 4500000,
      "registrationUrl": null
    },
    {
      "id": "demo-apt-003",
      "date": formatDate(twoWeeksLater),
      "time": "10:30-13:30",
      "location": "Tehran Test Center - Main Hall",
      "city": "Tehran",
      "examType": "IELTS",
      "status": "available",
      "price": 5200000,
      "registrationUrl": "https://example.com/register/demo-apt-003"
    },
    {
      "id": "demo-apt-004",
      "date": formatDate(threeWeeksLater),
      "time": "13:00-16:00",
      "location": "Shiraz Test Center - Room 1",
      "city": "Shiraz",
      "examType": "CDIELTS",
      "status": "pending",
      "price": 4300000,
      "registrationUrl": "https://example.com/register/demo-apt-004"
    },
    {
      "id": "demo-apt-005",
      "date": formatDate(threeWeeksLater),
      "time": "09:00-12:00",
      "location": "Isfahan Test Center - Room A",
      "city": "Isfahan",
      "examType": "IELTS",
      "status": "available",
      "price": 5200000,
      "registrationUrl": "https://example.com/register/demo-apt-005"
    }
  ];
}

/**
 * Main execution function
 */
async function main() {
  try {
    const args = parseArguments();
    
    if (args.help) {
      showHelp();
      process.exit(0);
    }
    
    // Check current appointments
    const currentAppointments = await readAppointments();
    const currentCount = currentAppointments.length;
    const defaultAppointments = getDefaultAppointments();
    const defaultCount = defaultAppointments.length;
    
    console.log(`Current appointments in system: ${currentCount}`);
    console.log(`Demo appointments to be restored: ${defaultCount}`);
    console.log('');
    
    // Show what will be restored
    console.log('Demo appointments that will be restored:');
    defaultAppointments.forEach((apt, index) => {
      console.log(`  ${index + 1}. ${apt.id} - ${apt.date} ${apt.time} (${apt.examType}, ${apt.city}, ${apt.status})`);
    });
    console.log('');
    
    // Ask for confirmation unless --force is used
    if (!args.force) {
      let confirmationMessage;
      if (currentCount > 0) {
        confirmationMessage = `⚠️  This will replace all ${currentCount} existing appointment${currentCount === 1 ? '' : 's'} with ${defaultCount} demo appointments. Continue? (y/N): `;
      } else {
        confirmationMessage = `📝 This will create ${defaultCount} demo appointments. Continue? (y/N): `;
      }
      
      const confirmed = await askConfirmation(confirmationMessage);
      
      if (!confirmed) {
        console.log('❌ Operation cancelled by user.');
        process.exit(0);
      }
    } else {
      console.log('🔥 Force mode enabled - resetting to demo appointments without confirmation...');
    }
    
    // Write default appointments
    await writeAppointments(defaultAppointments);
    
    console.log('✅ Demo appointments have been successfully restored!');
    console.log(`System now contains ${defaultCount} demo appointments.`);
    
    if (currentCount > 0) {
      console.log(`Previous ${currentCount} appointment${currentCount === 1 ? '' : 's'} ${currentCount === 1 ? 'has' : 'have'} been replaced.`);
    }
    
  } catch (error) {
    console.error('❌ Error resetting to demo appointments:', error.message);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

module.exports = {
  parseArguments,
  askConfirmation,
  getDefaultAppointments
};