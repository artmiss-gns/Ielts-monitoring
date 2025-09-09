import chalk from 'chalk';
import { MonitorController, MonitorStatus } from '../services/MonitorController';
import { MonitoringStatistics } from '../services/StatusLoggerService';

/**
 * Status display component for CLI
 */
export class StatusDisplay {
  private watchInterval: NodeJS.Timeout | null = null;

  /**
   * Display current status information
   */
  async displayStatus(status: any): Promise<void> {
    console.log(chalk.blue('📊 IELTS Monitor Status\n'));
    
    // Display current status
    const statusColor = this.getStatusColor(status.status);
    console.log(`${chalk.cyan('Status:')} ${statusColor(status.status.toUpperCase())}`);
    
    if (status.session) {
      console.log(`${chalk.cyan('Session ID:')} ${status.session.sessionId}`);
      console.log(`${chalk.cyan('Started:')} ${new Date(status.session.startTime).toLocaleString()}`);
      
      if (status.session.endTime) {
        console.log(`${chalk.cyan('Ended:')} ${new Date(status.session.endTime).toLocaleString()}`);
      }
      
      const duration = this.calculateDuration(
        new Date(status.session.startTime), 
        status.session.endTime ? new Date(status.session.endTime) : new Date()
      );
      console.log(`${chalk.cyan('Duration:')} ${duration}`);
    }

    // Display configuration if available
    if (status.config) {
      console.log('\n' + chalk.blue('⚙️  Configuration:'));
      console.log(`${chalk.cyan('Cities:')} ${status.config.city.join(', ')}`);
      console.log(`${chalk.cyan('Exam Models:')} ${status.config.examModel.join(', ')}`);
      console.log(`${chalk.cyan('Months:')} ${status.config.months.map((m: number) => this.getMonthName(m)).join(', ')}`);
      console.log(`${chalk.cyan('Check Interval:')} ${status.config.checkInterval / 1000} seconds`);
    }

    // Display statistics if available
    if (status.statistics) {
      console.log('\n' + chalk.blue('📈 Statistics:'));
      this.displayStatistics(status.statistics);
    }

    // Display recent errors if any
    if (status.session?.errors && status.session.errors.length > 0) {
      console.log('\n' + chalk.red('⚠️  Recent Errors:'));
      const recentErrors = status.session.errors.slice(-3); // Show last 3 errors
      recentErrors.forEach((error: any) => {
        console.log(`  ${chalk.gray(new Date(error.timestamp).toLocaleTimeString())} - ${error.error}`);
      });
    }
  }

  /**
   * Display statistics information
   */
  displayStatistics(stats: MonitoringStatistics): void {
    console.log(`${chalk.cyan('Checks Performed:')} ${stats.checksPerformed.toLocaleString()}`);
    console.log(`${chalk.cyan('Notifications Sent:')} ${stats.notificationsSent.toLocaleString()}`);
    console.log(`${chalk.cyan('Errors Encountered:')} ${stats.errorsEncountered.toLocaleString()}`);
    
    if (stats.uptime) {
      console.log(`${chalk.cyan('Uptime:')} ${this.formatDuration(stats.uptime)}`);
    }
    
    if (stats.averageCheckInterval) {
      console.log(`${chalk.cyan('Avg Check Interval:')} ${(stats.averageCheckInterval / 1000).toFixed(1)}s`);
    }
    
    if (stats.lastCheckTime) {
      console.log(`${chalk.cyan('Last Check:')} ${new Date(stats.lastCheckTime).toLocaleString()}`);
    }
    
    if (stats.lastNotificationTime) {
      console.log(`${chalk.cyan('Last Notification:')} ${new Date(stats.lastNotificationTime).toLocaleString()}`);
    }
  }

  /**
   * Start real-time status display
   */
  async startRealTimeDisplay(monitorController: MonitorController): Promise<void> {
    console.log(chalk.blue('📊 Real-time Monitoring Status\n'));
    console.log(chalk.gray('Press Ctrl+C to stop monitoring\n'));

    // Display initial status
    await this.displayRealTimeStatus(monitorController);

    // Setup event listeners for real-time updates
    monitorController.on('check-completed', async (appointmentCount: number) => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`${chalk.gray(`[${timestamp}]`)} ${chalk.blue('🔍 Check completed')} - ${appointmentCount} appointments found`);
    });

    monitorController.on('new-appointments', (appointments: any[]) => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`${chalk.gray(`[${timestamp}]`)} ${chalk.green('🎉 NEW APPOINTMENTS FOUND!')} - ${appointments.length} new slots`);
      
      // Display appointment details
      appointments.forEach((apt, index) => {
        console.log(`  ${index + 1}. ${apt.date} ${apt.time} - ${apt.location} (${apt.examType})`);
      });
    });

    monitorController.on('error', (error: Error) => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`${chalk.gray(`[${timestamp}]`)} ${chalk.red('❌ Error:')} ${error.message}`);
    });

    monitorController.on('status-changed', (status: MonitorStatus) => {
      const timestamp = new Date().toLocaleTimeString();
      const statusColor = this.getStatusColor(status);
      console.log(`${chalk.gray(`[${timestamp}]`)} ${chalk.blue('📊 Status changed:')} ${statusColor(status)}`);
    });

    // Periodic status updates every 30 seconds
    const statusUpdateInterval = setInterval(async () => {
      if (monitorController.getCurrentStatus() === MonitorStatus.RUNNING) {
        console.log(chalk.gray('\n' + '─'.repeat(50)));
        await this.displayRealTimeStatus(monitorController);
        console.log(chalk.gray('─'.repeat(50) + '\n'));
      }
    }, 30000);

    // Cleanup on exit
    process.on('SIGINT', () => {
      clearInterval(statusUpdateInterval);
    });
  }

  /**
   * Start watch mode for continuous status monitoring
   */
  async startWatchMode(monitorController: MonitorController): Promise<void> {
    console.log(chalk.blue('👀 Watch Mode - Status updates every 5 seconds'));
    console.log(chalk.gray('Press Ctrl+C to exit\n'));

    const updateStatus = async () => {
      // Clear screen and move cursor to top
      process.stdout.write('\x1B[2J\x1B[0f');
      
      console.log(chalk.blue('👀 IELTS Monitor - Watch Mode'));
      console.log(chalk.gray(`Last updated: ${new Date().toLocaleString()}\n`));
      
      try {
        const status = await monitorController.getStatus();
        await this.displayStatus(status);
      } catch (error) {
        console.log(chalk.red('Error getting status:'), error instanceof Error ? error.message : error);
      }
      
      console.log(chalk.gray('\nPress Ctrl+C to exit watch mode'));
    };

    // Initial display
    await updateStatus();

    // Setup interval for updates
    this.watchInterval = setInterval(updateStatus, 5000);

    // Handle cleanup
    process.on('SIGINT', () => {
      if (this.watchInterval) {
        clearInterval(this.watchInterval);
        this.watchInterval = null;
      }
      console.log(chalk.gray('\nExiting watch mode...'));
      process.exit(0);
    });
  }

  /**
   * Display real-time status summary
   */
  private async displayRealTimeStatus(monitorController: MonitorController): Promise<void> {
    try {
      const status = await monitorController.getStatus();
      const timestamp = new Date().toLocaleTimeString();
      
      console.log(`${chalk.gray(`[${timestamp}]`)} ${chalk.blue('📊 Status Update:')}`);
      
      if (status.session) {
        const duration = this.calculateDuration(new Date(status.session.startTime), new Date());
        console.log(`  Running for: ${duration}`);
        console.log(`  Checks performed: ${status.session.checksPerformed}`);
        console.log(`  Notifications sent: ${status.session.notificationsSent}`);
        
        if (status.session.errors.length > 0) {
          console.log(`  Errors: ${status.session.errors.length}`);
        }
      }
    } catch (error) {
      console.log(chalk.red('Error getting real-time status:'), error instanceof Error ? error.message : error);
    }
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
   * Calculate duration between two dates
   */
  private calculateDuration(start: Date, end: Date): string {
    const diffMs = end.getTime() - start.getTime();
    return this.formatDuration(diffMs);
  }

  /**
   * Format duration in milliseconds to human readable string
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
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
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
}