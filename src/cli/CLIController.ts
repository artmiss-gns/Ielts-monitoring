import chalk from 'chalk';
import { MonitorController, MonitorStatus } from '../services/MonitorController';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { DataInspectionService } from '../services/DataInspectionService';
// import { StatusLoggerService } from '../services/StatusLoggerService'; // TODO: Import when needed
import { InteractiveConfigPrompts } from './InteractiveConfigPrompts';
import { StatusDisplay } from './StatusDisplay';
import { LogViewer } from './LogViewer';
import { MonitorConfig } from '../models/types';

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
   * Handle status command
   */
  async statusCommand(options: { watch?: boolean; json?: boolean }): Promise<void> {
    try {
      if (options.watch) {
        // Continuous status monitoring
        await this.statusDisplay.startWatchMode(this.monitorController);
      } else {
        // Single status check
        const status = await this.monitorController.getStatus();
        
        if (options.json) {
          console.log(JSON.stringify(status, null, 2));
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
   * Handle logs command
   */
  async logsCommand(options: { follow?: boolean; lines?: string }): Promise<void> {
    try {
      const lines = parseInt(options.lines || '50', 10);
      
      if (options.follow) {
        console.log(chalk.blue('📋 Following monitor logs (Press Ctrl+C to exit)...\n'));
        await this.logViewer.followLogs(lines);
      } else {
        console.log(chalk.blue(`📋 Showing last ${lines} log entries:\n`));
        await this.logViewer.showLogs(lines);
      }
    } catch (error) {
      throw new Error(`Failed to view logs: ${error instanceof Error ? error.message : error}`);
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
    console.log(chalk.gray('─'.repeat(40)) + '\n');
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
}