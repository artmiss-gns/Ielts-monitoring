#!/usr/bin/env node

const { clearAllAppointments, readAppointments } = require('../data/dataManager');
const readline = require('readline');

/**
 * Command-line script to remove all appointments
 * Usage: node scripts/clear-all.js [options]
 * 
 * Options:
 *   --force    Skip confirmation prompt
 *   --help     Show this help message
 */

function showHelp() {
  console.log(`
Command-line script to remove all appointments

Usage: node scripts/clear-all.js [options]

Options:
  --force    Skip confirmation prompt and clear all appointments immediately
  --help     Show this help message

Examples:
  # Clear all appointments with confirmation
  node scripts/clear-all.js

  # Clear all appointments without confirmation
  node scripts/clear-all.js --force

Warning: This operation is destructive and cannot be undone!
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
 * Main execution function
 */
async function main() {
  try {
    const args = parseArguments();
    
    if (args.help) {
      showHelp();
      process.exit(0);
    }
    
    // Check current appointments count
    const currentAppointments = await readAppointments();
    const appointmentCount = currentAppointments.length;
    
    if (appointmentCount === 0) {
      console.log('ℹ️  No appointments found. Nothing to clear.');
      process.exit(0);
    }
    
    console.log(`Found ${appointmentCount} appointment${appointmentCount === 1 ? '' : 's'} in the system:`);
    
    // Show current appointments
    currentAppointments.forEach((apt, index) => {
      console.log(`  ${index + 1}. ${apt.id} - ${apt.date} ${apt.time} (${apt.examType}, ${apt.city})`);
    });
    
    console.log('');
    
    // Ask for confirmation unless --force is used
    if (!args.force) {
      const confirmed = await askConfirmation(
        `⚠️  Are you sure you want to delete ALL ${appointmentCount} appointment${appointmentCount === 1 ? '' : 's'}? This cannot be undone. (y/N): `
      );
      
      if (!confirmed) {
        console.log('❌ Operation cancelled by user.');
        process.exit(0);
      }
    } else {
      console.log('🔥 Force mode enabled - clearing all appointments without confirmation...');
    }
    
    // Clear all appointments
    await clearAllAppointments();
    
    console.log('✅ All appointments have been successfully cleared!');
    console.log(`Removed ${appointmentCount} appointment${appointmentCount === 1 ? '' : 's'} from the system.`);
    
  } catch (error) {
    console.error('❌ Error clearing appointments:', error.message);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

module.exports = {
  parseArguments,
  askConfirmation
};