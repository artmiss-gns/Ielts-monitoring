import notifier from 'node-notifier';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Appointment, NotificationRecord, TelegramConfig } from '../models/types';
import { TelegramNotifier } from './TelegramNotifier';

/**
 * Notification Service handles multi-channel notifications for new appointments
 */
export class NotificationService {
  private readonly logFilePath: string;
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 1000; // 1 second
  private telegramNotifier: TelegramNotifier | null = null;

  constructor(logDirectory: string = 'logs', telegramConfig?: TelegramConfig) {
    this.logFilePath = path.join(logDirectory, 'notifications.log');
    this.ensureLogDirectory();
    
    if (telegramConfig) {
      this.telegramNotifier = new TelegramNotifier(telegramConfig);
    }
  }

  /**
   * Send notifications through all enabled channels
   * Enhanced filtering to prevent false positives - Requirements 3.1, 3.2, 3.4, 3.5
   */
  async sendNotification(
    appointments: Appointment[],
    channels: {
      desktop: boolean;
      audio: boolean;
      logFile: boolean;
      telegram?: boolean;
    }
  ): Promise<NotificationRecord> {
    // Enhanced filtering to prevent false positives - Requirements 3.1, 3.2, 3.4, 3.5
    // Only notify about appointments with confirmed 'available' status
    const filteringResult = this.filterAppointmentsForNotification(appointments);
    
    // Log comprehensive filtering results - Requirements 3.4, 3.5
    this.logFilteringResults(filteringResult);
    
    // Validate that no filled appointments trigger notifications - Requirement 3.5
    this.validateNoFilledAppointments(filteringResult.availableAppointments);
    
    if (filteringResult.availableAppointments.length === 0) {
      const errorMessage = `No available appointments to notify about. Status breakdown: ${JSON.stringify(filteringResult.statusBreakdown)}`;
      
      // Log the rejection with detailed reasoning - Requirement 3.4
      console.log('🚫 Notification rejected:', {
        reason: 'No available appointments',
        totalAppointments: appointments.length,
        statusBreakdown: filteringResult.statusBreakdown,
        filteredAppointments: filteringResult.filteredAppointments.map(apt => ({
          id: apt.id,
          status: apt.status,
          reason: this.getFilterReason(apt.status)
        }))
      });
      
      throw new Error(errorMessage);
    }

    const record: NotificationRecord = {
      timestamp: new Date(),
      appointmentCount: appointments.length,
      appointments,
      channels: [],
      deliveryStatus: 'success'
    };

    const results: boolean[] = [];

    // Desktop notification
    if (channels.desktop) {
      const success = await this.sendDesktopNotificationWithRetry(appointments);
      results.push(success);
      if (success) record.channels.push('desktop');
    }

    // Audio alert
    if (channels.audio) {
      const success = await this.playAudioAlertWithRetry();
      results.push(success);
      if (success) record.channels.push('audio');
    }

    // Telegram notification
    if (channels.telegram && this.telegramNotifier) {
      const success = await this.sendTelegramNotificationWithRetry(appointments);
      results.push(success);
      if (success) record.channels.push('telegram');
    }

    // File logging
    if (channels.logFile) {
      const success = await this.logNotificationWithRetry(appointments);
      results.push(success);
      if (success) record.channels.push('logFile');
    }

    // Determine overall delivery status
    const successCount = results.filter(r => r).length;
    const totalChannels = results.length;

    if (successCount === 0) {
      record.deliveryStatus = 'failed';
    } else if (successCount < totalChannels) {
      record.deliveryStatus = 'partial';
    } else {
      record.deliveryStatus = 'success';
    }

    return record;
  }

  /**
   * Send desktop notification with retry mechanism
   */
  private async sendDesktopNotificationWithRetry(appointments: Appointment[]): Promise<boolean> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.sendDesktopNotification(appointments);
        return true;
      } catch (error) {
        console.error(`Desktop notification attempt ${attempt} failed:`, error);
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }
    return false;
  }

  /**
   * Play audio alert with retry mechanism
   */
  private async playAudioAlertWithRetry(): Promise<boolean> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.playAudioAlert();
        return true;
      } catch (error) {
        console.error(`Audio alert attempt ${attempt} failed:`, error);
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }
    return false;
  }

  /**
   * Send Telegram notification with retry mechanism
   */
  private async sendTelegramNotificationWithRetry(appointments: Appointment[]): Promise<boolean> {
    if (!this.telegramNotifier) {
      console.error('Telegram notifier not configured');
      return false;
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const success = await this.telegramNotifier.sendNotification(appointments);
        if (success) return true;
      } catch (error) {
        console.error(`Telegram notification attempt ${attempt} failed:`, error);
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }
    return false;
  }

  /**
   * Log notification with retry mechanism
   */
  private async logNotificationWithRetry(appointments: Appointment[]): Promise<boolean> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.logNotification(appointments);
        return true;
      } catch (error) {
        console.error(`Notification logging attempt ${attempt} failed:`, error);
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }
    return false;
  }

  /**
   * Send desktop notification using node-notifier
   * Enhanced filtering validation - Requirements 3.1, 3.5
   */
  private async sendDesktopNotification(appointments: Appointment[]): Promise<void> {
    return new Promise((resolve, reject) => {
      // Double-check filtering at desktop notification level - Requirement 3.5
      const filteringResult = this.filterAppointmentsForNotification(appointments);
      const { availableAppointments, filteredAppointments } = filteringResult;
      
      // Log any appointments that were filtered at this stage - Requirement 3.4
      if (filteredAppointments.length > 0) {
        console.warn('⚠️ Desktop notification: Additional filtering applied:', {
          filteredCount: filteredAppointments.length,
          filteredAppointments: filteredAppointments.map(apt => ({
            id: apt.id,
            status: apt.status,
            details: `${apt.date} ${apt.time}`,
            reason: this.getFilterReason(apt.status)
          }))
        });
      }
      
      // Validate no filled appointments made it through - Requirement 3.5
      this.validateNoFilledAppointments(availableAppointments);
      
      if (availableAppointments.length === 0) {
        const errorMessage = `Desktop notification rejected: No available appointments. Status breakdown: ${JSON.stringify(filteringResult.statusBreakdown)}`;
        console.error('🚫 Desktop notification error:', errorMessage);
        reject(new Error(errorMessage));
        return;
      }

      const appointmentText = availableAppointments.length === 1 
        ? `New AVAILABLE appointment: ${availableAppointments[0].date} at ${availableAppointments[0].time}`
        : `${availableAppointments.length} new AVAILABLE appointments`;

      const message = availableAppointments.length <= 3 
        ? availableAppointments.map(apt => `${apt.date} at ${apt.time} (${apt.location}) - AVAILABLE`).join('\n')
        : `${appointmentText}\nCheck the application for details`;

      notifier.notify({
        title: 'IELTS Appointments Available for Booking!',
        message,
        sound: true,
        wait: false,
        timeout: 10,
        icon: path.join(__dirname, '../../assets/icon.png') // Optional icon
      }, (err, _response) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Play audio alert using system beep or custom sound
   */
  private async playAudioAlert(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Try to play system beep first
      try {
        // For cross-platform compatibility
        if (process.platform === 'win32') {
          // Windows system beep
          process.stdout.write('\x07');
        } else if (process.platform === 'darwin') {
          // macOS system beep
          require('child_process').exec('afplay /System/Library/Sounds/Glass.aiff', (error: any) => {
            if (error) {
              // Fallback to terminal bell
              process.stdout.write('\x07');
            }
          });
        } else {
          // Linux/Unix system beep
          require('child_process').exec('paplay /usr/share/sounds/alsa/Front_Left.wav || echo -e "\\a"', (error: any) => {
            if (error) {
              // Fallback to terminal bell
              process.stdout.write('\x07');
            }
          });
        }
        
        // Add a small delay to ensure sound plays
        setTimeout(() => resolve(), 500);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Log notification to file with timestamp
   * Enhanced filtering and validation - Requirements 3.1, 3.4, 3.5
   */
  private async logNotification(appointments: Appointment[]): Promise<void> {
    const timestamp = new Date().toISOString();
    
    // Apply comprehensive filtering - Requirements 3.1, 3.2
    const filteringResult = this.filterAppointmentsForNotification(appointments);
    const { availableAppointments, filteredAppointments, statusBreakdown } = filteringResult;
    
    // Validate no filled appointments are being logged as notifications - Requirement 3.5
    this.validateNoFilledAppointments(availableAppointments);
    
    // Create comprehensive log entry with filtering details - Requirement 3.4
    const logEntry = {
      timestamp,
      event: 'NEW_AVAILABLE_APPOINTMENTS_FOUND',
      count: availableAppointments.length,
      totalCount: appointments.length,
      statusBreakdown,
      filteredCount: filteredAppointments.length,
      
      // Enhanced filtering details - Requirement 3.4
      filteringDetails: {
        availableAppointments: availableAppointments.length,
        filledAppointments: filteredAppointments.filter(apt => apt.status === 'filled').length,
        unknownAppointments: filteredAppointments.filter(apt => apt.status === 'unknown').length,
        pendingAppointments: filteredAppointments.filter(apt => apt.status === 'pending').length,
        notRegisterableAppointments: filteredAppointments.filter(apt => apt.status === 'not-registerable').length
      },
      
      // Detailed filtering reasons - Requirement 3.4
      filteredReasons: filteredAppointments.map(apt => ({
        id: apt.id,
        status: apt.status,
        reason: this.getFilterReason(apt.status),
        appointmentDetails: `${apt.date} ${apt.time} at ${apt.location}`
      })),
      
      // Only log available appointments - Requirement 3.1
      appointments: availableAppointments.map(apt => ({
        id: apt.id,
        date: apt.date,
        time: apt.time,
        location: apt.location,
        examType: apt.examType,
        city: apt.city,
        status: apt.status // Should always be 'available'
      })),
      
      // Validation confirmation - Requirement 3.5
      validationPassed: {
        noFilledAppointments: !availableAppointments.some(apt => apt.status === 'filled'),
        noUnknownAppointments: !availableAppointments.some(apt => apt.status === 'unknown'),
        allAvailable: availableAppointments.every(apt => apt.status === 'available')
      }
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    await fs.appendFile(this.logFilePath, logLine, 'utf8');
    
    // Log summary to console - Requirement 3.4
    console.log(`📝 Logged ${availableAppointments.length} available appointments (filtered out ${filteredAppointments.length})`);
  }

  /**
   * Get notification history from log file
   */
  async getNotificationHistory(limit?: number): Promise<NotificationRecord[]> {
    try {
      if (!await fs.pathExists(this.logFilePath)) {
        return [];
      }

      const content = await fs.readFile(this.logFilePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      const records: NotificationRecord[] = [];
      
      for (const line of lines) {
        try {
          const logEntry = JSON.parse(line);
          if (logEntry.event === 'NEW_APPOINTMENTS_FOUND') {
            records.push({
              timestamp: new Date(logEntry.timestamp),
              appointmentCount: logEntry.count,
              appointments: logEntry.appointments,
              channels: ['logFile'], // Historical records only show they were logged
              deliveryStatus: 'success'
            });
          }
        } catch (parseError) {
          // Skip malformed log entries
          continue;
        }
      }

      // Sort by timestamp (newest first) and apply limit
      records.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      return limit ? records.slice(0, limit) : records;
    } catch (error) {
      console.error('Error reading notification history:', error);
      return [];
    }
  }

  /**
   * Clear notification history
   */
  async clearNotificationHistory(): Promise<void> {
    try {
      if (await fs.pathExists(this.logFilePath)) {
        await fs.remove(this.logFilePath);
      }
    } catch (error) {
      console.error('Error clearing notification history:', error);
      throw error;
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(): Promise<{
    totalNotifications: number;
    totalAppointments: number;
    lastNotification?: Date;
    averageAppointmentsPerNotification: number;
  }> {
    const history = await this.getNotificationHistory();
    
    if (history.length === 0) {
      return {
        totalNotifications: 0,
        totalAppointments: 0,
        averageAppointmentsPerNotification: 0
      };
    }

    const totalNotifications = history.length;
    const totalAppointments = history.reduce((sum, record) => sum + record.appointmentCount, 0);
    const lastNotification = history[0]?.timestamp;
    const averageAppointmentsPerNotification = totalAppointments / totalNotifications;

    return {
      totalNotifications,
      totalAppointments,
      lastNotification,
      averageAppointmentsPerNotification
    };
  }

  /**
   * Ensure log directory exists
   */
  private async ensureLogDirectory(): Promise<void> {
    const logDir = path.dirname(this.logFilePath);
    await fs.ensureDir(logDir);
  }

  /**
   * Configure Telegram notifications
   */
  configureTelegram(config: TelegramConfig): void {
    this.telegramNotifier = new TelegramNotifier(config);
  }

  /**
   * Test Telegram connection
   */
  async testTelegramConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.telegramNotifier) {
      return {
        success: false,
        message: 'Telegram notifier not configured'
      };
    }

    return await this.telegramNotifier.testConnection();
  }

  /**
   * Check if Telegram is configured and ready
   */
  isTelegramConfigured(): boolean {
    return this.telegramNotifier?.isConfigured() || false;
  }

  /**
   * Filter appointments for notifications - Requirements 3.1, 3.2
   * Only allows confirmed 'available' appointments to trigger notifications
   */
  private filterAppointmentsForNotification(appointments: Appointment[]): {
    availableAppointments: Appointment[];
    filteredAppointments: Appointment[];
    statusBreakdown: Record<string, number>;
  } {
    const availableAppointments = appointments.filter(apt => apt.status === 'available');
    const filteredAppointments = appointments.filter(apt => apt.status !== 'available');
    
    // Create status breakdown for logging
    const statusBreakdown = appointments.reduce((counts, apt) => {
      counts[apt.status] = (counts[apt.status] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    return {
      availableAppointments,
      filteredAppointments,
      statusBreakdown
    };
  }

  /**
   * Log comprehensive filtering results - Requirements 3.4, 3.5
   */
  private logFilteringResults(filteringResult: {
    availableAppointments: Appointment[];
    filteredAppointments: Appointment[];
    statusBreakdown: Record<string, number>;
  }): void {
    const { availableAppointments, filteredAppointments, statusBreakdown } = filteringResult;
    
    if (filteredAppointments.length > 0) {
      console.log('🔍 Notification Filtering Results:', {
        totalAppointments: availableAppointments.length + filteredAppointments.length,
        availableAppointments: availableAppointments.length,
        filteredOut: filteredAppointments.length,
        statusBreakdown,
        filteredStatuses: filteredAppointments.map(apt => apt.status)
      });
      
      // Log each filtered appointment with detailed reasoning - Requirement 3.4
      filteredAppointments.forEach(apt => {
        const reason = this.getFilterReason(apt.status);
        console.log(`🚫 Filtered appointment ${apt.id}: status='${apt.status}' - ${reason}`);
        console.log(`   Details: ${apt.date} ${apt.time} at ${apt.location} (${apt.examType})`);
      });
      
      // Log summary by status type
      const statusSummary = Object.entries(statusBreakdown)
        .filter(([status]) => status !== 'available')
        .map(([status, count]) => `${count} ${status}`)
        .join(', ');
      
      if (statusSummary) {
        console.log(`📊 Filtered appointments summary: ${statusSummary}`);
      }
    } else {
      console.log('✅ All appointments are available - no filtering needed');
    }
  }

  /**
   * Validate that no filled appointments trigger notifications - Requirement 3.5
   */
  private validateNoFilledAppointments(availableAppointments: Appointment[]): void {
    const filledAppointments = availableAppointments.filter(apt => 
      apt.status === 'filled' || apt.status === 'unknown'
    );
    
    if (filledAppointments.length > 0) {
      const error = new Error(
        `CRITICAL: Filled/unknown appointments passed filtering validation! ` +
        `This should never happen. Appointments: ${filledAppointments.map(apt => 
          `${apt.id}(${apt.status})`
        ).join(', ')}`
      );
      
      console.error('🚨 VALIDATION FAILURE:', error.message);
      throw error;
    }
  }

  /**
   * Get human-readable reason for filtering out appointments - Requirements 3.4, 3.5
   */
  private getFilterReason(status: string): string {
    switch (status) {
      case 'filled':
        return 'Appointment is filled/unavailable for booking - prevents false positive notifications';
      case 'unknown':
        return 'Status could not be determined - conservative filtering to prevent false positives';
      case 'pending':
        return 'Appointment is in pending status - not yet available for booking';
      case 'not-registerable':
        return 'Appointment is not available for registration';
      default:
        return `Appointment has non-available status: ${status} - filtered to prevent false notifications`;
    }
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}