import chalk from 'chalk';
import { MonitorController, MonitorStatus } from '../services/MonitorController';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { DataInspectionService } from '../services/DataInspectionService';

import { TelegramNotifier } from '../services/TelegramNotifier';
import { EnvironmentConfigManager } from '../services/EnvironmentConfigManager';
// import { StatusLoggerService } from '../services/StatusLoggerService'; // TODO: Import when needed
import { InteractiveConfigPrompts } from './InteractiveConfigPrompts';
import { StatusDisplay } from './StatusDisplay';
import { LogViewer } from './LogViewer';
import { MonitorConfig, ValidationResult } from '../models/types';

/**
 * CLI Controller handles all command-line interface operations
 */
export class CLIController {
  private monitorController: MonitorController;
  private configManager: ConfigurationManager;
  private dataInspectionService: DataInspectionService;

  // private statusLogger: StatusLoggerService; // TODO: Use for advanced logging features
  private interactivePrompts: InteractiveConfigPrompts;
  private statusDisplay: StatusDisplay;
  private logViewer: LogViewer;

  constructor() {
    this.monitorController = new MonitorController();
    this.configManager = new ConfigurationManager();
    this.dataInspectionService = new DataInspectionService();

    // this.statusLogger = new StatusLoggerService(); // TODO: Initialize when needed
    this.interactivePrompts = new InteractiveConfigPrompts();
    this.statusDisplay = new StatusDisplay();
    this.logViewer = new LogViewer();

    // Setup event listeners for real-time updates
    this.setupEventListeners();
  }

  /**
   * Handle start command
   */
  async startCommand(options: { config?: string; daemon?: boolean }): Promise<void> {
    console.log(chalk.blue('🚀 Starting IELTS Appointment Monitor...\n'));

    try {
      // Load configuration
      let config: MonitorConfig;
      
      if (options.config) {
        // Use custom config file path
        const customConfigManager = new ConfigurationManager(options.config);
        config = await customConfigManager.loadConfig();
      } else {
        // Check if config exists, if not prompt for interactive setup
        if (!(await this.configManager.configExists())) {
          console.log(chalk.yellow('⚙️  No configuration found. Let\'s set up your monitoring preferences.\n'));
          config = await this.interactivePrompts.promptForConfiguration();
          await this.configManager.saveConfig(config);
          console.log(chalk.green('✅ Configuration saved successfully!\n'));
        } else {
          config = await this.configManager.loadConfig();
        }
      }

      // Display configuration summary
      this.displayConfigurationSummary(config);

      // Start monitoring
      await this.monitorController.startMonitoring(config);

      if (options.daemon) {
        console.log(chalk.green('✅ Monitor started in daemon mode'));
        console.log(chalk.gray('Use "ielts-monitor status" to check monitoring status'));
        console.log(chalk.gray('Use "ielts-monitor stop" to stop monitoring'));
      } else {
        console.log(chalk.green('✅ Monitor started successfully!'));
        console.log(chalk.gray('Press Ctrl+C to stop monitoring\n'));
        
        // Start real-time status display
        await this.statusDisplay.startRealTimeDisplay(this.monitorController);
      }

    } catch (error) {
      throw new Error(`Failed to start monitoring: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Handle stop command
   */
  async stopCommand(): Promise<void> {
    console.log(chalk.blue('🛑 Stopping IELTS Appointment Monitor...\n'));

    try {
      const status = await this.monitorController.getStatus();
      
      if (status.status === MonitorStatus.STOPPED) {
        console.log(chalk.yellow('⚠️  Monitor is not currently running'));
        return;
      }

      await this.monitorController.stopMonitoring();
      console.log(chalk.green('✅ Monitor stopped successfully'));

      // Display final statistics if available
      if (status.statistics) {
        console.log('\n' + chalk.blue('📊 Final Session Statistics:'));
        this.statusDisplay.displayStatistics(status.statistics);
      }

    } catch (error) {
      throw new Error(`Failed to stop monitoring: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Handle status command with enhanced server-friendly options
   */
  async statusCommand(options: { watch?: boolean; json?: boolean; simple?: boolean }): Promise<void> {
    try {
      if (options.watch) {
        // Continuous status monitoring
        await this.statusDisplay.startWatchMode(this.monitorController);
      } else {
        // Single status check
        const status = await this.monitorController.getStatus();
        
        if (options.json) {
          console.log(JSON.stringify(status, null, 2));
        } else if (options.simple) {
          // Simple status for server environments
          this.displaySimpleStatus(status);
        } else {
          this.statusDisplay.displayStatus(status);
        }
      }
    } catch (error) {
      throw new Error(`Failed to get status: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Handle configure command
   */
  async configureCommand(options: { file?: string; reset?: boolean }): Promise<void> {
    console.log(chalk.blue('⚙️  IELTS Monitor Configuration\n'));

    try {
      const configManager = options.file ? 
        new ConfigurationManager(options.file) : 
        this.configManager;

      if (options.reset) {
        // Reset to default configuration
        await configManager.resetToDefault();
        console.log(chalk.green('✅ Configuration reset to default values'));
        
        const defaultConfig = configManager.getDefaultConfig();
        this.displayConfigurationSummary(defaultConfig);
        return;
      }

      // Interactive configuration
      let currentConfig: MonitorConfig;
      
      try {
        currentConfig = await configManager.loadConfig();
        console.log(chalk.gray('Current configuration loaded. You can modify the settings below.\n'));
      } catch {
        console.log(chalk.yellow('No existing configuration found. Creating new configuration.\n'));
        currentConfig = configManager.getDefaultConfig();
      }

      // Prompt for new configuration
      const newConfig = await this.interactivePrompts.promptForConfiguration(currentConfig);
      
      // Save configuration
      await configManager.saveConfig(newConfig);
      console.log(chalk.green('\n✅ Configuration saved successfully!'));
      
      // Display summary
      this.displayConfigurationSummary(newConfig);

      // Ask if user wants to restart monitoring with new config
      const isRunning = this.monitorController.getCurrentStatus() !== MonitorStatus.STOPPED;
      if (isRunning) {
        const shouldRestart = await this.interactivePrompts.confirmRestart();
        if (shouldRestart) {
          console.log(chalk.blue('\n🔄 Restarting monitor with new configuration...\n'));
          await this.monitorController.updateConfiguration(newConfig);
          console.log(chalk.green('✅ Monitor restarted with new configuration'));
        }
      }

    } catch (error) {
      throw new Error(`Failed to configure monitor: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Handle pause command
   */
  async pauseCommand(): Promise<void> {
    console.log(chalk.blue('⏸️  Pausing IELTS Appointment Monitor...\n'));

    try {
      const status = this.monitorController.getCurrentStatus();
      
      if (status !== MonitorStatus.RUNNING) {
        console.log(chalk.yellow(`⚠️  Cannot pause monitor - current status: ${status}`));
        return;
      }

      await this.monitorController.pauseMonitoring();
      console.log(chalk.green('✅ Monitor paused successfully'));
      console.log(chalk.gray('Use "ielts-monitor resume" to continue monitoring'));

    } catch (error) {
      throw new Error(`Failed to pause monitoring: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Handle resume command
   */
  async resumeCommand(): Promise<void> {
    console.log(chalk.blue('▶️  Resuming IELTS Appointment Monitor...\n'));

    try {
      const status = this.monitorController.getCurrentStatus();
      
      if (status !== MonitorStatus.PAUSED) {
        console.log(chalk.yellow(`⚠️  Cannot resume monitor - current status: ${status}`));
        return;
      }

      await this.monitorController.resumeMonitoring();
      console.log(chalk.green('✅ Monitor resumed successfully'));

    } catch (error) {
      throw new Error(`Failed to resume monitoring: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Handle logs command with enhanced filtering
   */
  async logsCommand(options: { 
    follow?: boolean; 
    lines?: string;
    level?: string;
    type?: string;
    since?: string;
  }): Promise<void> {
    try {
      const lines = parseInt(options.lines || '50', 10);
      
      // Build filter options (only include defined values)
      const filterOptions: { level?: string; type?: string; since?: string } = {};
      if (options.level) filterOptions.level = options.level;
      if (options.type) filterOptions.type = options.type;
      if (options.since) filterOptions.since = options.since;

      if (options.follow) {
        console.log(chalk.blue('📋 Following monitor logs (Press Ctrl+C to exit)...\n'));
        if (Object.keys(filterOptions).length > 0) {
          console.log(chalk.gray('Filters applied:'));
          if (filterOptions.level) console.log(chalk.gray(`  • Level: ${filterOptions.level}`));
          if (filterOptions.type) console.log(chalk.gray(`  • Type: ${filterOptions.type}`));
          if (filterOptions.since) console.log(chalk.gray(`  • Since: ${filterOptions.since}`));
          console.log('');
        }
        await this.logViewer.followLogs(lines, Object.keys(filterOptions).length > 0 ? filterOptions : undefined);
      } else {
        let description = `📋 Showing last ${lines} log entries`;
        if (Object.keys(filterOptions).length > 0) {
          const filters = [];
          if (filterOptions.level) filters.push(`level=${filterOptions.level}`);
          if (filterOptions.type) filters.push(`type=${filterOptions.type}`);
          if (filterOptions.since) filters.push(`since=${filterOptions.since}`);
          description += ` (${filters.join(', ')})`;
        }
        console.log(chalk.blue(`${description}:\n`));
        await this.logViewer.showLogs(lines, Object.keys(filterOptions).length > 0 ? filterOptions : undefined);
      }
    } catch (error) {
      throw new Error(`Failed to view logs: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Handle server-status command - enhanced status for server environments
   */
  async serverStatusCommand(options: { json?: boolean; detailed?: boolean }): Promise<void> {
    console.log(chalk.blue('🖥️  Server Status Report\n'));

    try {
      const status = await this.monitorController.getStatus();
      const enhancedStats = await this.monitorController.getEnhancedStatistics();

      if (options.json) {
        const serverStatus = {
          ...status,
          enhancedStatistics: enhancedStats,
          environment: EnvironmentConfigManager.loadEnvironmentConfig(),
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          nodeVersion: process.version
        };
        console.log(JSON.stringify(serverStatus, null, 2));
        return;
      }

      // Display formatted server status
      this.displayServerStatus(status, enhancedStats, options.detailed);

    } catch (error) {
      throw new Error(`Failed to get server status: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Handle telegram-test command - test Telegram configuration
   */
  async telegramTestCommand(): Promise<void> {
    console.log(chalk.blue('📱 Testing Telegram Configuration\n'));

    try {
      // Check environment variables first
      const envValidation = EnvironmentConfigManager.validateTelegramEnvironment();
      
      if (!envValidation.isValid) {
        console.log(chalk.red('❌ Telegram environment variables not configured'));
        console.log(chalk.yellow('Missing variables:'));
        envValidation.missingVars.forEach(varName => {
          console.log(`   • ${varName}`);
        });
        console.log(chalk.gray('\nTo configure Telegram:'));
        console.log(chalk.gray('1. Get a bot token from @BotFather on Telegram'));
        console.log(chalk.gray('2. Get your chat ID or channel ID'));
        console.log(chalk.gray('3. Set environment variables:'));
        console.log(chalk.gray('   export TELEGRAM_BOT_TOKEN="your_bot_token"'));
        console.log(chalk.gray('   export TELEGRAM_CHAT_ID="your_chat_id"'));
        return;
      }

      console.log(chalk.green('✅ Environment variables configured'));

      // Create Telegram configuration
      const telegramConfig = EnvironmentConfigManager.createTelegramConfig();
      if (!telegramConfig) {
        console.log(chalk.red('❌ Failed to create Telegram configuration'));
        return;
      }

      // Display configuration (masked)
      const maskedConfig = EnvironmentConfigManager.maskSensitiveConfig(telegramConfig);
      console.log(chalk.blue('\n📋 Configuration:'));
      console.log(`   Bot Token: ${maskedConfig.botToken}`);
      console.log(`   Target: ${telegramConfig.isChannel ? 'Channel' : 'Chat'} ${maskedConfig.chatId}`);
      console.log(`   Message Format: ${telegramConfig.messageFormat}`);
      console.log(`   Enable Preview: ${telegramConfig.enablePreview}`);

      // Test connection
      console.log(chalk.blue('\n🔄 Testing connection...'));
      const telegramNotifier = new TelegramNotifier(telegramConfig);
      const testResult = await telegramNotifier.testConnection();

      if (testResult.success) {
        console.log(chalk.green('✅ Telegram test successful!'));
        console.log(chalk.gray(`   ${testResult.message}`));
        console.log(chalk.gray('\n💡 Check your Telegram chat/channel for the test message'));
      } else {
        console.log(chalk.red('❌ Telegram test failed'));
        console.log(chalk.yellow(`   ${testResult.message}`));
        console.log(chalk.gray('\n🔧 Troubleshooting tips:'));
        console.log(chalk.gray('• Verify your bot token is correct'));
        console.log(chalk.gray('• Ensure the bot has access to the chat/channel'));
        console.log(chalk.gray('• For channels, make sure the bot is added as an admin'));
        console.log(chalk.gray('• For private chats, start a conversation with the bot first'));
      }

    } catch (error) {
      throw new Error(`Telegram test failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Handle config-validate command - validate configuration
   */
  async configValidateCommand(options: { file?: string; fix?: boolean }): Promise<void> {
    console.log(chalk.blue('🔍 Configuration Validation\n'));

    try {
      const configManager = options.file ? 
        new ConfigurationManager(options.file) : 
        this.configManager;

      // Load configuration
      let config: MonitorConfig;
      try {
        config = await configManager.loadConfig();
        console.log(chalk.green('✅ Configuration file loaded successfully'));
      } catch (error) {
        console.log(chalk.red('❌ Failed to load configuration'));
        console.log(chalk.yellow(`   Error: ${error instanceof Error ? error.message : error}`));
        return;
      }

      // Validate configuration
      const validation = configManager.validateConfig(config);
      
      if (validation.isValid) {
        console.log(chalk.green('\n✅ Configuration is valid!'));
        this.displayConfigurationSummary(config);
        
        // Additional server-specific validations
        await this.performServerValidations(config);
        
      } else {
        console.log(chalk.red('\n❌ Configuration validation failed'));
        console.log(chalk.yellow('Errors found:'));
        validation.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error}`);
        });

        if (options.fix) {
          console.log(chalk.blue('\n🔧 Attempting to fix configuration...'));
          const fixedConfig = await this.attemptConfigFix(config, validation);
          if (fixedConfig) {
            await configManager.saveConfig(fixedConfig);
            console.log(chalk.green('✅ Configuration fixed and saved'));
            this.displayConfigurationSummary(fixedConfig);
          } else {
            console.log(chalk.yellow('⚠️  Could not automatically fix all issues'));
          }
        } else {
          console.log(chalk.gray('\n💡 Use --fix flag to attempt automatic fixes'));
        }
      }

      // Environment configuration status
      console.log(chalk.blue('\n🌍 Environment Configuration:'));
      EnvironmentConfigManager.printConfigStatus();

    } catch (error) {
      throw new Error(`Configuration validation failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Handle appointment-scan command - manual appointment scan
   */
  async appointmentScanCommand(options: { 
    detailed?: boolean; 
    json?: boolean;
    city?: string;
    examModel?: string;
    months?: string;
  }): Promise<void> {
    console.log(chalk.blue('🔍 Manual Appointment Scan\n'));

    try {
      // Load configuration for defaults
      let config: MonitorConfig;
      try {
        config = await this.configManager.loadConfig();
      } catch {
        config = this.configManager.getDefaultConfig();
        console.log(chalk.yellow('⚠️  Using default configuration (no config file found)'));
      }

      // Override with command line options
      const scanFilters = {
        city: options.city ? options.city.split(',').map(c => c.trim()) : config.city,
        examModel: options.examModel ? options.examModel.split(',').map(e => e.trim()) : config.examModel,
        months: options.months ? options.months.split(',').map(m => parseInt(m.trim())) : config.months
      };

      console.log(chalk.blue('📋 Scan Parameters:'));
      console.log(`   Cities: ${scanFilters.city.join(', ')}`);
      console.log(`   Exam Models: ${scanFilters.examModel.join(', ')}`);
      console.log(`   Months: ${scanFilters.months.map(m => this.getMonthName(m)).join(', ')}`);
      console.log(`   Base URL: ${config.baseUrl || 'https://irsafam.org/ielts/timetable'}\n`);

      // Initialize web scraper
      const webScraper = new (await import('../services/WebScraperService')).WebScraperService(config.baseUrl);
      await webScraper.initialize();

      console.log(chalk.blue('🔄 Scanning for appointments...'));
      const startTime = Date.now();

      try {
        const checkResult = await webScraper.fetchAppointmentsWithStatus(scanFilters);
        const duration = Date.now() - startTime;

        if (options.json) {
          console.log(JSON.stringify({
            ...checkResult,
            scanDuration: duration,
            scanParameters: scanFilters
          }, null, 2));
          return;
        }

        // Display results
        console.log(chalk.green(`\n✅ Scan completed in ${duration}ms`));
        console.log(chalk.blue('\n📊 Results Summary:'));
        console.log(`   Status: ${checkResult.type}`);
        console.log(`   Total Appointments: ${checkResult.appointmentCount}`);
        console.log(`   Available: ${chalk.green(checkResult.availableCount.toString())}`);
        console.log(`   Filled: ${chalk.yellow(checkResult.filledCount.toString())}`);

        if (checkResult.appointments.length > 0) {
          console.log(chalk.blue('\n📅 Found Appointments:'));
          
          const availableAppointments = checkResult.appointments.filter(apt => apt.status === 'available');
          const filledAppointments = checkResult.appointments.filter(apt => apt.status === 'filled');

          if (availableAppointments.length > 0) {
            console.log(chalk.green(`\n🎯 Available Appointments (${availableAppointments.length}):`));
            availableAppointments.forEach((apt, index) => {
              console.log(`   ${index + 1}. ${apt.date} ${apt.time} - ${apt.city} (${apt.examType})`);
              if (options.detailed && apt.location) {
                console.log(`      Location: ${apt.location}`);
              }
              if (options.detailed && apt.price) {
                console.log(`      Price: ${apt.price.toLocaleString()} Toman`);
              }
            });
          }

          if (filledAppointments.length > 0 && options.detailed) {
            console.log(chalk.yellow(`\n📋 Filled Appointments (${filledAppointments.length}):`));
            filledAppointments.slice(0, 5).forEach((apt, index) => {
              console.log(`   ${index + 1}. ${apt.date} ${apt.time} - ${apt.city} (${apt.examType})`);
            });
            if (filledAppointments.length > 5) {
              console.log(`   ... and ${filledAppointments.length - 5} more filled appointments`);
            }
          }
        } else {
          console.log(chalk.yellow('\n📭 No appointments found for the specified criteria'));
        }

        // Save inspection data
        const inspectionData = {
          url: checkResult.url,
          pageTitle: 'Manual Scan',
          detectedElements: [`${checkResult.appointmentCount} appointments detected`],
          parsingNotes: `Scan completed in ${duration}ms`,
          rawAppointmentHtml: [],
          checkResult
        };

        await this.dataInspectionService.saveInspectionData(inspectionData);
        console.log(chalk.gray('\n💾 Scan results saved for inspection'));

      } finally {
        await webScraper.close();
      }

    } catch (error) {
      throw new Error(`Appointment scan failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Handle inspect command - display latest parsed appointment data
   */
  async inspectCommand(options: { 
    detailed?: boolean; 
    export?: string; 
    format?: 'json' | 'text' | 'csv';
    limit?: string;
    id?: string;
  }): Promise<void> {
    console.log(chalk.blue('🔍 IELTS Appointment Data Inspection\n'));

    try {
      if (options.export) {
        // Export inspection data
        const format = options.format || 'json';
        const limit = options.limit ? parseInt(options.limit, 10) : undefined;
        
        console.log(chalk.blue(`📤 Exporting inspection data in ${format.toUpperCase()} format...`));
        
        const exportData = await this.dataInspectionService.exportInspectionData(format, limit);
        
        // Write to file or output to console
        if (options.export === 'console') {
          console.log('\n' + chalk.gray('='.repeat(50)));
          console.log(exportData);
          console.log(chalk.gray('='.repeat(50)));
        } else {
          const fs = await import('fs/promises');
          await fs.writeFile(options.export, exportData, 'utf-8');
          console.log(chalk.green(`✅ Inspection data exported to: ${options.export}`));
        }
        return;
      }

      if (options.id) {
        // Show specific inspection record by ID
        const record = await this.dataInspectionService.getInspectionDataById(options.id);
        
        if (!record) {
          console.log(chalk.yellow(`⚠️  No inspection record found with ID: ${options.id}`));
          return;
        }

        if (options.detailed) {
          const detailedOutput = await this.dataInspectionService.createDetailedInspectionOutput(record);
          console.log(detailedOutput);
        } else {
          const summary = this.dataInspectionService.formatInspectionSummary(record);
          console.log(summary);
        }
        return;
      }

      // Show latest inspection data
      const latestRecord = await this.dataInspectionService.getLatestInspectionData();
      
      if (!latestRecord) {
        console.log(chalk.yellow('⚠️  No inspection data available'));
        console.log(chalk.gray('Run the monitor at least once to generate inspection data'));
        return;
      }

      console.log(chalk.green('✅ Latest inspection data found\n'));

      if (options.detailed) {
        const detailedOutput = await this.dataInspectionService.createDetailedInspectionOutput(latestRecord);
        console.log(detailedOutput);
      } else {
        const summary = this.dataInspectionService.formatInspectionSummary(latestRecord);
        console.log(summary);
      }

      // Show inspection statistics
      console.log(chalk.blue('\n📊 Inspection Statistics:'));
      const stats = await this.dataInspectionService.getInspectionStats();
      console.log(chalk.gray('─'.repeat(40)));
      console.log(`${chalk.cyan('Total Records:')} ${stats.totalRecords}`);
      if (stats.latestInspection) {
        console.log(`${chalk.cyan('Latest Inspection:')} ${new Date(stats.latestInspection).toLocaleString()}`);
      }
      if (stats.oldestInspection) {
        console.log(`${chalk.cyan('Oldest Inspection:')} ${new Date(stats.oldestInspection).toLocaleString()}`);
      }
      console.log(`${chalk.cyan('Avg Appointments/Check:')} ${stats.averageAppointmentsPerCheck}`);
      console.log(`${chalk.cyan('Availability Rate:')} ${stats.availabilityRate}%`);
      console.log(chalk.gray('─'.repeat(40)));

      // Show usage hints
      console.log(chalk.gray('\n💡 Usage hints:'));
      console.log(chalk.gray('  • Use --detailed for comprehensive analysis'));
      console.log(chalk.gray('  • Use --export <file> to save data'));
      console.log(chalk.gray('  • Use --id <inspection-id> to view specific record'));

    } catch (error) {
      throw new Error(`Failed to inspect data: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Display configuration summary
   */
  private displayConfigurationSummary(config: MonitorConfig): void {
    console.log(chalk.blue('📋 Configuration Summary:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`${chalk.cyan('Cities:')} ${config.city.join(', ')}`);
    console.log(`${chalk.cyan('Exam Models:')} ${config.examModel.join(', ')}`);
    console.log(`${chalk.cyan('Months:')} ${config.months.map(m => this.getMonthName(m)).join(', ')}`);
    console.log(`${chalk.cyan('Check Interval:')} ${config.checkInterval / 1000} seconds`);
    console.log(`${chalk.cyan('Base URL:')} ${config.baseUrl || 'https://irsafam.org/ielts/timetable'}`);
    console.log(`${chalk.cyan('Notifications:')}`);
    console.log(`  • Desktop: ${config.notificationSettings.desktop ? chalk.green('✓') : chalk.red('✗')}`);
    console.log(`  • Audio: ${config.notificationSettings.audio ? chalk.green('✓') : chalk.red('✗')}`);
    console.log(`  • Log File: ${config.notificationSettings.logFile ? chalk.green('✓') : chalk.red('✗')}`);
    console.log(`  • Telegram: ${this.getTelegramStatusDisplay(config.notificationSettings.telegram)}`);
    console.log(chalk.gray('─'.repeat(40)) + '\n');
  }

  /**
   * Get Telegram status display with appropriate symbols and warnings
   */
  private getTelegramStatusDisplay(enabled?: boolean): string {
    if (!enabled) {
      return chalk.red('✗');
    }
    
    const telegramValidation = EnvironmentConfigManager.validateTelegramEnvironment();
    if (telegramValidation.isValid) {
      return chalk.green('✓');
    } else {
      return chalk.yellow('⚠️  (credentials missing)');
    }
  }

  /**
   * Get month name from number
   */
  private getMonthName(month: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || `Month ${month}`;
  }

  /**
   * Setup event listeners for real-time updates
   */
  private setupEventListeners(): void {
    this.monitorController.on('status-changed', (status: MonitorStatus) => {
      // Only log status changes if not in daemon mode
      if (process.stdout.isTTY) {
        const statusColor = this.getStatusColor(status);
        console.log(`${chalk.gray('[' + new Date().toLocaleTimeString() + ']')} Status: ${statusColor(status)}`);
      }
    });

    this.monitorController.on('new-appointments', (appointments) => {
      if (process.stdout.isTTY) {
        console.log(`${chalk.gray('[' + new Date().toLocaleTimeString() + ']')} ${chalk.green('🎉 New appointments found:')} ${appointments.length}`);
      }
    });

    this.monitorController.on('error', (error) => {
      if (process.stdout.isTTY) {
        console.log(`${chalk.gray('[' + new Date().toLocaleTimeString() + ']')} ${chalk.red('❌ Error:')} ${error.message}`);
      }
    });
  }

  /**
   * Get color for status display
   */
  private getStatusColor(status: MonitorStatus): (text: string) => string {
    switch (status) {
      case MonitorStatus.RUNNING:
        return chalk.green;
      case MonitorStatus.PAUSED:
        return chalk.yellow;
      case MonitorStatus.STOPPED:
        return chalk.gray;
      case MonitorStatus.ERROR:
        return chalk.red;
      case MonitorStatus.STARTING:
      case MonitorStatus.STOPPING:
        return chalk.blue;
      default:
        return chalk.white;
    }
  }

  /**
   * Display enhanced server status
   */
  private displayServerStatus(
    status: any, 
    enhancedStats: any, 
    detailed?: boolean
  ): void {
    const statusColor = this.getStatusColor(status.status);
    
    console.log(chalk.blue('📊 Monitor Status:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`${chalk.cyan('Status:')} ${statusColor(status.status.toUpperCase())}`);
    
    if (status.session) {
      const uptime = status.session.endTime ? 
        status.session.endTime.getTime() - status.session.startTime.getTime() :
        Date.now() - new Date(status.session.startTime).getTime();
      
      console.log(`${chalk.cyan('Session ID:')} ${status.session.sessionId}`);
      console.log(`${chalk.cyan('Started:')} ${new Date(status.session.startTime).toLocaleString()}`);
      console.log(`${chalk.cyan('Uptime:')} ${this.formatDuration(uptime)}`);
      console.log(`${chalk.cyan('Checks Performed:')} ${status.session.checksPerformed}`);
      console.log(`${chalk.cyan('Notifications Sent:')} ${status.session.notificationsSent}`);
      console.log(`${chalk.cyan('Errors:')} ${status.session.errors.length}`);
    }

    if (status.statistics) {
      console.log(chalk.blue('\n📈 Statistics:'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`${chalk.cyan('Total Checks:')} ${status.statistics.totalChecks}`);
      console.log(`${chalk.cyan('Successful Checks:')} ${status.statistics.successfulChecks}`);
      console.log(`${chalk.cyan('Failed Checks:')} ${status.statistics.failedChecks}`);
      console.log(`${chalk.cyan('Success Rate:')} ${status.statistics.successRate}%`);
      console.log(`${chalk.cyan('Avg Check Duration:')} ${status.statistics.averageCheckDuration}ms`);
      console.log(`${chalk.cyan('Total Appointments Found:')} ${status.statistics.totalAppointmentsFound}`);
      console.log(`${chalk.cyan('Available Appointments:')} ${status.statistics.availableAppointments}`);
    }

    if (enhancedStats.trackingStats) {
      console.log(chalk.blue('\n🎯 Appointment Tracking:'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`${chalk.cyan('Total Tracked:')} ${enhancedStats.trackingStats.totalTracked}`);
      console.log(`${chalk.cyan('Currently Available:')} ${enhancedStats.trackingStats.currentlyAvailable}`);
      console.log(`${chalk.cyan('Total Notifications:')} ${enhancedStats.trackingStats.totalNotificationsSent}`);
      console.log(`${chalk.cyan('Unique Appointments:')} ${enhancedStats.trackingStats.uniqueAppointmentsSeen}`);
    }

    // System information
    console.log(chalk.blue('\n💻 System Information:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`${chalk.cyan('Node.js Version:')} ${process.version}`);
    console.log(`${chalk.cyan('Platform:')} ${process.platform} ${process.arch}`);
    console.log(`${chalk.cyan('Process Uptime:')} ${this.formatDuration(process.uptime() * 1000)}`);
    
    const memUsage = process.memoryUsage();
    console.log(`${chalk.cyan('Memory Usage:')} ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB RSS`);
    console.log(`${chalk.cyan('Heap Used:')} ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);

    // Environment configuration
    const envConfig = EnvironmentConfigManager.loadEnvironmentConfig();
    const telegramConfigured = !!(envConfig.telegramBotToken && envConfig.telegramChatId);
    
    console.log(chalk.blue('\n🌍 Environment:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`${chalk.cyan('Telegram:')} ${telegramConfigured ? chalk.green('✓ Configured') : chalk.red('✗ Not configured')}`);
    
    if (envConfig.logLevel) {
      console.log(`${chalk.cyan('Log Level:')} ${envConfig.logLevel}`);
    }
    
    if (envConfig.monitorCheckInterval) {
      console.log(`${chalk.cyan('Check Interval:')} ${envConfig.monitorCheckInterval / 1000}s`);
    }

    // Recent status changes (if detailed)
    if (detailed && enhancedStats.recentStatusChanges && enhancedStats.recentStatusChanges.length > 0) {
      console.log(chalk.blue('\n🔄 Recent Status Changes:'));
      console.log(chalk.gray('─'.repeat(50)));
      enhancedStats.recentStatusChanges.slice(0, 10).forEach((change: any, index: number) => {
        const time = new Date(change.timestamp).toLocaleTimeString();
        console.log(`   ${index + 1}. [${time}] ${change.appointment.date} ${change.appointment.time} - ${change.oldStatus} → ${change.newStatus}`);
      });
    }

    console.log(chalk.gray('─'.repeat(50)));
  }

  /**
   * Perform server-specific validations
   */
  private async performServerValidations(config: MonitorConfig): Promise<void> {
    console.log(chalk.blue('\n🔧 Server-Specific Validations:'));
    
    // Check Telegram configuration
    const telegramValidation = EnvironmentConfigManager.validateTelegramEnvironment();
    if (telegramValidation.isValid) {
      console.log(`${chalk.green('✅')} Telegram environment variables configured`);
      
      // Test Telegram connection if configured
      try {
        const telegramConfig = EnvironmentConfigManager.createTelegramConfig();
        if (telegramConfig) {
          const telegramNotifier = new TelegramNotifier(telegramConfig);
          const testResult = await telegramNotifier.testConnection();
          if (testResult.success) {
            console.log(`${chalk.green('✅')} Telegram connection test passed`);
          } else {
            console.log(`${chalk.yellow('⚠️ ')} Telegram connection test failed: ${testResult.message}`);
          }
        }
      } catch (error) {
        console.log(`${chalk.yellow('⚠️ ')} Telegram connection test error: ${error instanceof Error ? error.message : error}`);
      }
    } else {
      console.log(`${chalk.yellow('⚠️ ')} Telegram not configured (missing: ${telegramValidation.missingVars.join(', ')})`);
    }

    // Check desktop notifications (should be disabled for server)
    if (config.notificationSettings.desktop) {
      console.log(`${chalk.yellow('⚠️ ')} Desktop notifications enabled (not recommended for server deployment)`);
    } else {
      console.log(`${chalk.green('✅')} Desktop notifications disabled (good for server deployment)`);
    }

    // Check audio notifications (should be disabled for server)
    if (config.notificationSettings.audio) {
      console.log(`${chalk.yellow('⚠️ ')} Audio notifications enabled (not recommended for server deployment)`);
    } else {
      console.log(`${chalk.green('✅')} Audio notifications disabled (good for server deployment)`);
    }

    // Check log file notifications
    if (config.notificationSettings.logFile) {
      console.log(`${chalk.green('✅')} Log file notifications enabled (recommended for server deployment)`);
    } else {
      console.log(`${chalk.yellow('⚠️ ')} Log file notifications disabled (consider enabling for server deployment)`);
    }

    // Check check interval (should be reasonable for server)
    if (config.checkInterval < 60000) { // Less than 1 minute
      console.log(`${chalk.yellow('⚠️ ')} Check interval is very frequent (${config.checkInterval / 1000}s) - consider increasing for server deployment`);
    } else if (config.checkInterval > 600000) { // More than 10 minutes
      console.log(`${chalk.yellow('⚠️ ')} Check interval is quite long (${config.checkInterval / 1000}s) - consider decreasing for better responsiveness`);
    } else {
      console.log(`${chalk.green('✅')} Check interval is appropriate for server deployment (${config.checkInterval / 1000}s)`);
    }
  }

  /**
   * Attempt to fix common configuration issues
   */
  private async attemptConfigFix(config: MonitorConfig, _validation: ValidationResult): Promise<MonitorConfig | null> {
    const fixedConfig = { ...config };
    let hasChanges = false;

    // Fix notification settings for server deployment
    if (config.notificationSettings.desktop) {
      fixedConfig.notificationSettings.desktop = false;
      hasChanges = true;
      console.log(`   🔧 Disabled desktop notifications for server deployment`);
    }

    if (config.notificationSettings.audio) {
      fixedConfig.notificationSettings.audio = false;
      hasChanges = true;
      console.log(`   🔧 Disabled audio notifications for server deployment`);
    }

    if (!config.notificationSettings.logFile) {
      fixedConfig.notificationSettings.logFile = true;
      hasChanges = true;
      console.log(`   🔧 Enabled log file notifications for server deployment`);
    }

    // Fix check interval if too frequent
    if (config.checkInterval < 60000) {
      fixedConfig.checkInterval = 300000; // 5 minutes
      hasChanges = true;
      console.log(`   🔧 Increased check interval to 5 minutes for server deployment`);
    }

    // Add server-specific defaults if missing
    if (!config.security) {
      fixedConfig.security = {
        enableSecureLogging: true,
        maskSensitiveData: true,
        logLevel: 'info'
      };
      hasChanges = true;
      console.log(`   🔧 Added security configuration with secure defaults`);
    }

    if (!config.server) {
      fixedConfig.server = {
        enableHealthCheck: false,
        enableMetrics: false
      };
      hasChanges = true;
      console.log(`   🔧 Added server configuration with defaults`);
    }

    return hasChanges ? fixedConfig : null;
  }

  /**
   * Display simple status for server environments
   */
  private displaySimpleStatus(status: any): void {
    const statusColor = this.getStatusColor(status.status);
    
    console.log(`Status: ${statusColor(status.status.toUpperCase())}`);
    
    if (status.session) {
      const uptime = status.session.endTime ? 
        status.session.endTime.getTime() - status.session.startTime.getTime() :
        Date.now() - new Date(status.session.startTime).getTime();
      
      console.log(`Uptime: ${this.formatDuration(uptime)}`);
      console.log(`Checks: ${status.session.checksPerformed}`);
      console.log(`Notifications: ${status.session.notificationsSent}`);
      console.log(`Errors: ${status.session.errors.length}`);
    }

    if (status.statistics) {
      console.log(`Success Rate: ${status.statistics.successRate}%`);
      console.log(`Available Appointments: ${status.statistics.availableAppointments}`);
    }

    // Environment status
    const envConfig = EnvironmentConfigManager.loadEnvironmentConfig();
    const telegramConfigured = !!(envConfig.telegramBotToken && envConfig.telegramChatId);
    console.log(`Telegram: ${telegramConfigured ? 'Configured' : 'Not configured'}`);
  }



  /**
   * Handle notification tracking command - show notification tracking status and statistics
   */
  async notificationTrackingCommand(options: { 
    detailed?: boolean; 
    json?: boolean;
    stats?: boolean;
    history?: string;
    recent?: string;
  }, appointmentDetectionService?: any): Promise<void> {
    // Only show header if not JSON output
    if (!options.json) {
      console.log(chalk.blue('🔔 Notification Tracking Status\n'));
    }

    try {
      // Initialize appointment detection service to access tracking data
      let appointmentDetection;
      if (appointmentDetectionService) {
        appointmentDetection = appointmentDetectionService;
      } else {
        const { AppointmentDetectionService } = await import('../services/AppointmentDetectionService');
        appointmentDetection = new AppointmentDetectionService();
        await appointmentDetection.initialize();
      }

      if (options.history) {
        // Show history for specific appointment
        const history = appointmentDetection.getAppointmentHistory(options.history);
        
        if (!history) {
          console.log(chalk.yellow(`⚠️  No tracking history found for appointment ID: ${options.history}`));
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(history, null, 2));
          return;
        }

        console.log(chalk.blue(`📋 Appointment History: ${options.history}`));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(`${chalk.cyan('Current Status:')} ${history.appointment.status}`);
        console.log(`${chalk.cyan('First Seen:')} ${history.firstSeen.toLocaleString()}`);
        console.log(`${chalk.cyan('Last Seen:')} ${history.lastSeen.toLocaleString()}`);
        console.log(`${chalk.cyan('Notifications Sent:')} ${history.notificationsSent}`);
        
        console.log(chalk.blue('\n📊 Status History:'));
        history.statusHistory.forEach((change: any, index: number) => {
          const statusColor = change.newStatus === 'available' ? chalk.green : chalk.yellow;
          console.log(`   ${index + 1}. ${change.timestamp.toLocaleString()} - ${change.previousStatus} → ${statusColor(change.newStatus)} (${change.reason})`);
        });
        
        return;
      }

      // Get tracking statistics
      const stats = appointmentDetection.getTrackingStatistics();
      
      if (options.json) {
        const recentMinutes = parseInt(options.recent || '60', 10);
        const recentChanges = appointmentDetection.getRecentStatusChanges(recentMinutes);
        
        console.log(JSON.stringify({
          statistics: stats,
          recentStatusChanges: recentChanges
        }, null, 2));
        return;
      }

      // Display statistics
      console.log(chalk.blue('📊 Notification Tracking Statistics:'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`${chalk.cyan('Total Tracked Appointments:')} ${stats.totalTracked}`);
      console.log(`${chalk.cyan('Currently Available:')} ${chalk.green(stats.availableCount.toString())}`);
      console.log(`${chalk.cyan('Currently Filled:')} ${chalk.yellow(stats.filledCount.toString())}`);
      console.log(`${chalk.cyan('Currently Pending:')} ${chalk.blue(stats.pendingCount.toString())}`);
      console.log(`${chalk.cyan('Not Registerable:')} ${chalk.red(stats.notRegistrableCount.toString())}`);
      console.log(`${chalk.cyan('Total Notifications Sent:')} ${stats.totalNotificationsSent}`);
      console.log(`${chalk.cyan('Notified Appointment Keys:')} ${stats.notifiedAppointmentKeysCount}`);
      
      if (stats.averageTrackingDuration > 0) {
        console.log(`${chalk.cyan('Average Tracking Duration:')} ${this.formatDuration(stats.averageTrackingDuration)}`);
      }

      if (options.stats) {
        return; // Only show stats, not detailed information
      }

      // Show recent status changes
      const recentMinutes = parseInt(options.recent || '60', 10);
      const recentChanges = appointmentDetection.getRecentStatusChanges(recentMinutes);
      
      if (recentChanges.length > 0) {
        console.log(chalk.blue(`\n🔄 Recent Status Changes (last ${recentMinutes} minutes):`));
        console.log(chalk.gray('─'.repeat(50)));
        
        recentChanges.slice(0, 10).forEach((change: any, index: number) => {
          const statusColor = change.newStatus === 'available' ? chalk.green : chalk.yellow;
          console.log(`   ${index + 1}. ${change.timestamp.toLocaleString()} - ${change.previousStatus} → ${statusColor(change.newStatus)}`);
          if (options.detailed) {
            console.log(`      Reason: ${change.reason}`);
          }
        });
        
        if (recentChanges.length > 10) {
          console.log(`   ... and ${recentChanges.length - 10} more changes`);
        }
      } else {
        console.log(chalk.yellow(`\n📭 No status changes in the last ${recentMinutes} minutes`));
      }

      // Show detailed tracking information if requested
      if (options.detailed) {
        console.log(chalk.blue('\n🔍 Detailed Tracking Information:'));
        console.log(chalk.gray('─'.repeat(50)));
        
        // Show notification decision details for recent appointments
        const currentStatus = await this.monitorController.getStatus();
        if (currentStatus.session) {
          console.log(`${chalk.cyan('Current Session:')} ${currentStatus.session.sessionId}`);
          console.log(`${chalk.cyan('Session Start:')} ${currentStatus.session.startTime.toLocaleString()}`);
          console.log(`${chalk.cyan('Checks Performed:')} ${currentStatus.session.checksPerformed}`);
          console.log(`${chalk.cyan('Session Notifications:')} ${currentStatus.session.notificationsSent}`);
        }
        
        console.log(chalk.gray('\n💡 Use --history <appointmentId> to see detailed history for a specific appointment'));
      }

      console.log(chalk.gray('\n💡 Usage hints:'));
      console.log(chalk.gray('  • Use --detailed for comprehensive tracking information'));
      console.log(chalk.gray('  • Use --stats to show only statistics'));
      console.log(chalk.gray('  • Use --recent <minutes> to adjust recent changes timeframe'));
      console.log(chalk.gray('  • Use --json for machine-readable output'));

    } catch (error) {
      throw new Error(`Failed to get notification tracking status: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Handle clear command - clear stored data
   */
  async clearCommand(options: { 
    appointments?: boolean; 
    notifications?: boolean; 
    inspection?: boolean;
    all?: boolean;
    force?: boolean;
  }): Promise<void> {
    console.log(chalk.blue('🧹 Clear Stored Data\n'));

    try {
      // Determine what to clear
      const clearAll = options.all;
      const clearAppointments = clearAll || options.appointments;
      const clearNotifications = clearAll || options.notifications;
      const clearInspection = clearAll || options.inspection;

      // If no specific options, default to clearing all
      const shouldClearAll = !clearAppointments && !clearNotifications && !clearInspection;
      
      if (shouldClearAll) {
        console.log(chalk.yellow('No specific data type specified. This will clear ALL stored data.'));
      }

      // Show what will be cleared
      console.log(chalk.blue('📋 Data to be cleared:'));
      if (shouldClearAll || clearAppointments) {
        console.log('  • Appointment tracking data');
        console.log('  • Previous appointment snapshots');
      }
      if (shouldClearAll || clearNotifications) {
        console.log('  • Notification history');
        console.log('  • Notified appointment keys');
      }
      if (shouldClearAll || clearInspection) {
        console.log('  • Inspection/debugging data');
        console.log('  • Raw HTML analysis data');
      }

      // Confirmation prompt (unless forced)
      if (!options.force) {
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question(chalk.yellow('\nAre you sure you want to clear this data? (y/N): '), resolve);
        });
        
        rl.close();

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log(chalk.gray('Operation cancelled.'));
          return;
        }
      }

      console.log(chalk.blue('\n🔄 Clearing data...'));

      let clearedCount = 0;

      // Clear appointment data
      if (shouldClearAll || clearAppointments) {
        await this.clearAppointmentDataOnly();
        console.log(chalk.green('✅ Appointment data cleared'));
        clearedCount++;
      }

      // Clear notification data
      if (shouldClearAll || clearNotifications) {
        await this.clearNotificationDataOnly();
        console.log(chalk.green('✅ Notification data cleared'));
        clearedCount++;
      }

      // Clear inspection data
      if (shouldClearAll || clearInspection) {
        await this.clearInspectionDataOnly();
        console.log(chalk.green('✅ Inspection data cleared'));
        clearedCount++;
      }

      console.log(chalk.green(`\n✅ Successfully cleared ${clearedCount} data type(s)`));
      console.log(chalk.gray('The monitor will start fresh on the next run.'));

    } catch (error) {
      throw new Error(`Failed to clear data: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Clear only appointment data (keep notifications and inspection data)
   */
  private async clearAppointmentDataOnly(): Promise<void> {
    const fs = await import('fs/promises');
    
    const filesToClear = [
      'data/appointments.json',
      'data/appointment-tracking.json'
    ];

    for (const filePath of filesToClear) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // File doesn't exist, which is fine
        if ((error as any).code !== 'ENOENT') {
          throw error;
        }
      }
    }
  }

  /**
   * Clear only inspection data (keep appointments and notifications)
   */
  private async clearInspectionDataOnly(): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
      const inspectionPath = path.join('data', 'inspection-data.json');
      await fs.unlink(inspectionPath);
    } catch (error) {
      // File doesn't exist, which is fine
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Clear only notification data (keep appointments)
   */
  private async clearNotificationDataOnly(): Promise<void> {
    const fs = await import('fs/promises');
    
    const filesToClear = [
      'data/notifications.json',
      'data/notified-appointments.json'
    ];

    for (const filePath of filesToClear) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // File doesn't exist, which is fine
        if ((error as any).code !== 'ENOENT') {
          throw error;
        }
      }
    }
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 60) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}