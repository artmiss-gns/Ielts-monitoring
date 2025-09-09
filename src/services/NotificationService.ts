import notifier from 'node-notifier';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Appointment, NotificationRecord } from '../models/types';

/**
 * Notification Service handles multi-channel notifications for new appointments
 */
export class NotificationService {
  private readonly logFilePath: string;
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 1000; // 1 second

  constructor(logDirectory: string = 'logs') {
    this.logFilePath = path.join(logDirectory, 'notifications.log');
    this.ensureLogDirectory();
  }

  /**
   * Send notifications through all enabled channels
   */
  async sendNotification(
    appointments: Appointment[],
    channels: {
      desktop: boolean;
      audio: boolean;
      logFile: boolean;
    }
  ): Promise<NotificationRecord> {
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
   */
  private async sendDesktopNotification(appointments: Appointment[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const appointmentText = appointments.length === 1 
        ? `New appointment available: ${appointments[0].date} at ${appointments[0].time}`
        : `${appointments.length} new appointments available`;

      const message = appointments.length <= 3 
        ? appointments.map(apt => `${apt.date} at ${apt.time} (${apt.location})`).join('\n')
        : `${appointmentText}\nCheck the application for details`;

      notifier.notify({
        title: 'IELTS Appointments Available!',
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
   */
  private async logNotification(appointments: Appointment[]): Promise<void> {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      event: 'NEW_APPOINTMENTS_FOUND',
      count: appointments.length,
      appointments: appointments.map(apt => ({
        id: apt.id,
        date: apt.date,
        time: apt.time,
        location: apt.location,
        examType: apt.examType,
        city: apt.city
      }))
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    await fs.appendFile(this.logFilePath, logLine, 'utf8');
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
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}