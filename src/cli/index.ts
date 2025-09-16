#!/usr/bin/env node

/**
 * IELTS Appointment Monitor CLI
 * Command-line interface for managing appointment monitoring
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { CLIController } from './CLIController';
import * as packageJson from '../../package.json';

const program = new Command();
const cliController = new CLIController();

// Configure main program
program
  .name('ielts-monitor')
  .description('Automated monitoring system for IELTS exam appointments')
  .version(packageJson.version, '-v, --version', 'display version number');

// Start command
program
  .command('start')
  .description('Start monitoring IELTS appointments')
  .option('-c, --config <path>', 'path to configuration file')
  .option('-d, --daemon', 'run in daemon mode (background)')
  .action(async (options) => {
    try {
      await cliController.startCommand(options);
    } catch (error) {
      console.error(chalk.red('Error starting monitor:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Stop command
program
  .command('stop')
  .description('Stop the monitoring process')
  .action(async () => {
    try {
      await cliController.stopCommand();
    } catch (error) {
      console.error(chalk.red('Error stopping monitor:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show current monitoring status and statistics')
  .option('-w, --watch', 'continuously watch status (refresh every 5 seconds)')
  .option('-j, --json', 'output status in JSON format')
  .action(async (options) => {
    try {
      await cliController.statusCommand(options);
    } catch (error) {
      console.error(chalk.red('Error getting status:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Configure command
program
  .command('configure')
  .alias('config')
  .description('Configure monitoring settings interactively')
  .option('-f, --file <path>', 'configuration file path')
  .option('-r, --reset', 'reset to default configuration')
  .action(async (options) => {
    try {
      await cliController.configureCommand(options);
    } catch (error) {
      console.error(chalk.red('Error configuring monitor:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Pause command
program
  .command('pause')
  .description('Pause monitoring temporarily')
  .action(async () => {
    try {
      await cliController.pauseCommand();
    } catch (error) {
      console.error(chalk.red('Error pausing monitor:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Resume command
program
  .command('resume')
  .description('Resume paused monitoring')
  .action(async () => {
    try {
      await cliController.resumeCommand();
    } catch (error) {
      console.error(chalk.red('Error resuming monitor:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Logs command
program
  .command('logs')
  .description('View monitoring logs')
  .option('-f, --follow', 'follow log output (tail -f behavior)')
  .option('-n, --lines <number>', 'number of lines to show', '50')
  .action(async (options) => {
    try {
      await cliController.logsCommand(options);
    } catch (error) {
      console.error(chalk.red('Error viewing logs:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Inspect command
program
  .command('inspect')
  .description('Display latest parsed appointment data for inspection and debugging')
  .option('-d, --detailed', 'show detailed inspection output with raw HTML analysis')
  .option('-e, --export <file>', 'export inspection data to file (use "console" to output to terminal)')
  .option('-f, --format <format>', 'export format: json, text, or csv', 'json')
  .option('-l, --limit <number>', 'limit number of records to export')
  .option('-i, --id <id>', 'show specific inspection record by ID')
  .action(async (options) => {
    try {
      await cliController.inspectCommand(options);
    } catch (error) {
      console.error(chalk.red('Error inspecting data:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Global error handlers for CLI
process.on('uncaughtException', (error) => {
  console.error(chalk.red('💥 Uncaught Exception:'), error.message);
  console.error(chalk.gray('Stack trace:'), error.stack);
  console.error(chalk.yellow('The application will exit. Please report this issue.'));
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('💥 Unhandled Promise Rejection:'), reason);
  console.error(chalk.yellow('The application will exit. Please report this issue.'));
  process.exit(1);
});

// Parse command line arguments with error handling
try {
  program.parse();
  
  // Show help if no command provided
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
} catch (error) {
  console.error(chalk.red('CLI Error:'), error instanceof Error ? error.message : error);
  process.exit(1);
}