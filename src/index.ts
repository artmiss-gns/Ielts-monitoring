/**
 * IELTS Appointment Monitor
 * Main entry point for the application
 */

// Setup global error handling before importing other modules
process.on('uncaughtException', (error: Error) => {
  console.error('💥 Uncaught Exception:', error.message);
  console.error('Stack:', error.stack);
  console.error('The application will exit to prevent undefined behavior.');
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('💥 Unhandled Promise Rejection at:', promise);
  console.error('Reason:', reason);
  console.error('The application will exit to prevent undefined behavior.');
  process.exit(1);
});

// Import and run CLI
import './cli/index';