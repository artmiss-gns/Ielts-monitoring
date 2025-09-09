import { promises as fs } from 'fs';
import path from 'path';
import { Appointment, NotificationRecord, AppointmentComparison } from '../models/types';

/**
 * Represents a snapshot of appointments at a specific time
 */
export interface AppointmentSnapshot {
  timestamp: string; // ISO timestamp
  appointments: Appointment[];
}

/**
 * Configuration for data storage service
 */
export interface DataStorageConfig {
  dataDirectory: string;
  appointmentsFile: string;
  notificationsFile: string;
  maxHistoryDays: number;
}

/**
 * Service for managing appointment data persistence and comparison
 */
export class DataStorageService {
  private config: DataStorageConfig;

  constructor(config?: Partial<DataStorageConfig>) {
    this.config = {
      dataDirectory: 'data',
      appointmentsFile: 'appointments.json',
      notificationsFile: 'notifications.json',
      maxHistoryDays: 30,
      ...config
    };
  }

  /**
   * Ensures the data directory exists
   */
  private async ensureDataDirectory(): Promise<void> {
    try {
      await fs.access(this.config.dataDirectory);
    } catch {
      await fs.mkdir(this.config.dataDirectory, { recursive: true });
    }
  }

  /**
   * Gets the full path for a data file
   */
  private getFilePath(filename: string): string {
    return path.join(this.config.dataDirectory, filename);
  }

  /**
   * Saves current appointments to storage
   */
  async saveAppointments(appointments: Appointment[]): Promise<void> {
    await this.ensureDataDirectory();
    
    const snapshot: AppointmentSnapshot = {
      timestamp: new Date().toISOString(),
      appointments
    };

    const filePath = this.getFilePath(this.config.appointmentsFile);
    await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
  }

  /**
   * Retrieves the last saved appointments
   */
  async getLastAppointments(): Promise<Appointment[]> {
    try {
      const filePath = this.getFilePath(this.config.appointmentsFile);
      const data = await fs.readFile(filePath, 'utf-8');
      const snapshot: AppointmentSnapshot = JSON.parse(data);
      return snapshot.appointments || [];
    } catch (error) {
      // Return empty array if file doesn't exist or can't be read
      return [];
    }
  }

  /**
   * Detects new appointments by comparing current with previous
   */
  detectNewAppointments(current: Appointment[], previous: Appointment[]): AppointmentComparison {
    const previousIds = new Set(previous.map(apt => apt.id));
    const currentIds = new Set(current.map(apt => apt.id));

    const newAppointments = current.filter(apt => !previousIds.has(apt.id));
    const removedAppointments = previous.filter(apt => !currentIds.has(apt.id));
    const unchangedAppointments = current.filter(apt => previousIds.has(apt.id));

    return {
      newAppointments,
      removedAppointments,
      unchangedAppointments
    };
  }

  /**
   * Saves a notification record
   */
  async saveNotificationRecord(record: NotificationRecord): Promise<void> {
    await this.ensureDataDirectory();
    
    const filePath = this.getFilePath(this.config.notificationsFile);
    let notifications: NotificationRecord[] = [];

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      notifications = JSON.parse(data);
    } catch {
      // File doesn't exist or is invalid, start with empty array
    }

    notifications.push(record);
    await fs.writeFile(filePath, JSON.stringify(notifications, null, 2), 'utf-8');
  }

  /**
   * Retrieves notification history
   */
  async getNotificationHistory(): Promise<NotificationRecord[]> {
    try {
      const filePath = this.getFilePath(this.config.notificationsFile);
      const data = await fs.readFile(filePath, 'utf-8');
      const notifications = JSON.parse(data);
      
      // Convert timestamp strings back to Date objects
      return notifications.map((record: any) => ({
        ...record,
        timestamp: new Date(record.timestamp)
      }));
    } catch {
      return [];
    }
  }

  /**
   * Retrieves notification history within a date range
   */
  async getNotificationHistoryByDateRange(startDate: Date, endDate: Date): Promise<NotificationRecord[]> {
    const allNotifications = await this.getNotificationHistory();
    
    return allNotifications.filter(record => {
      const recordDate = new Date(record.timestamp);
      return recordDate >= startDate && recordDate <= endDate;
    });
  }

  /**
   * Cleans up old appointment and notification records
   */
  async cleanupOldRecords(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.maxHistoryDays);

    // Clean up old notifications
    const notifications = await this.getNotificationHistory();
    const recentNotifications = notifications.filter(record => 
      new Date(record.timestamp) >= cutoffDate
    );

    if (recentNotifications.length !== notifications.length) {
      const filePath = this.getFilePath(this.config.notificationsFile);
      await fs.writeFile(filePath, JSON.stringify(recentNotifications, null, 2), 'utf-8');
    }
  }

  /**
   * Gets storage statistics
   */
  async getStorageStats(): Promise<{
    totalNotifications: number;
    lastAppointmentCheck?: string;
    dataDirectorySize: number;
  }> {
    const notifications = await this.getNotificationHistory();
    
    let lastAppointmentCheck: string | undefined;
    try {
      const filePath = this.getFilePath(this.config.appointmentsFile);
      const data = await fs.readFile(filePath, 'utf-8');
      const snapshot: AppointmentSnapshot = JSON.parse(data);
      lastAppointmentCheck = snapshot.timestamp;
    } catch {
      // No previous appointment data
      lastAppointmentCheck = undefined;
    }

    // Calculate directory size
    let dataDirectorySize = 0;
    try {
      const files = await fs.readdir(this.config.dataDirectory);
      for (const file of files) {
        const filePath = path.join(this.config.dataDirectory, file);
        const stats = await fs.stat(filePath);
        dataDirectorySize += stats.size;
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    const result: {
      totalNotifications: number;
      lastAppointmentCheck?: string;
      dataDirectorySize: number;
    } = {
      totalNotifications: notifications.length,
      dataDirectorySize
    };

    if (lastAppointmentCheck !== undefined) {
      result.lastAppointmentCheck = lastAppointmentCheck;
    }

    return result;
  }

  /**
   * Clears all stored data (useful for testing or reset)
   */
  async clearAllData(): Promise<void> {
    try {
      const appointmentsPath = this.getFilePath(this.config.appointmentsFile);
      await fs.unlink(appointmentsPath);
    } catch {
      // File doesn't exist
    }

    try {
      const notificationsPath = this.getFilePath(this.config.notificationsFile);
      await fs.unlink(notificationsPath);
    } catch {
      // File doesn't exist
    }
  }
}