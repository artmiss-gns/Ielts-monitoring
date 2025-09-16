import * as fs from 'fs-extra';
import * as path from 'path';
import { MonitoringSession, ErrorLog, NotificationRecord, Appointment, CheckResult } from '../models/types';

/**
 * Statistics for monitoring session
 */
export interface MonitoringStatistics {
  sessionId: string;
  startTime: Date;
  uptime: number; // in milliseconds
  checksPerformed: number;
  notificationsSent: number;
  errorsEncountered: number;
  lastCheckTime?: Date;
  lastNotificationTime?: Date;
  averageCheckInterval?: number;
}

/**
 * Log entry for system events
 */
export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  event: string;
  details?: any;
  sessionId?: string;
}

/**
 * Enhanced appointment logging details
 */
export interface AppointmentLogDetails {
  checkType: 'available' | 'filled' | 'no-slots';
  totalAppointments: number;
  availableAppointments: number;
  filledAppointments: number;
  appointmentDetails: Array<{
    id: string;
    date: string;
    time: string;
    location: string;
    examType: string;
    status: 'available' | 'filled' | 'pending';
  }>;
  url: string;
  checkDuration?: number; // in milliseconds
}

/**
 * Configuration for status logger
 */
export interface StatusLoggerConfig {
  logDirectory: string;
  maxLogFileSize: number; // in bytes
  maxLogFiles: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableDetailedAppointmentLogging: boolean;
}

/**
 * Status Logger Service for tracking monitoring statistics and system events
 */
export class StatusLoggerService {
  private config: StatusLoggerConfig;
  private currentSession: MonitoringSession | null = null;
  private logEntries: LogEntry[] = [];
  private logFilePath: string;
  private statisticsFilePath: string;

  constructor(config?: Partial<StatusLoggerConfig>) {
    this.config = {
      logDirectory: path.join(process.cwd(), 'logs'),
      maxLogFileSize: 10 * 1024 * 1024, // 10MB
      maxLogFiles: 5,
      logLevel: 'info',
      enableDetailedAppointmentLogging: true,
      ...config
    };

    this.logFilePath = path.join(this.config.logDirectory, 'monitor.log');
    this.statisticsFilePath = path.join(this.config.logDirectory, 'statistics.json');
    
    this.ensureLogDirectory();
  }

  /**
   * Start a new monitoring session
   */
  async startSession(sessionId: string, configuration: any): Promise<void> {
    this.currentSession = {
      sessionId,
      startTime: new Date(),
      checksPerformed: 0,
      notificationsSent: 0,
      errors: [],
      configuration
    };

    await this.logEvent('info', 'session_started', {
      sessionId,
      configuration
    });

    await this.saveStatistics();
  }

  /**
   * End the current monitoring session
   */
  async endSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.endTime = new Date();
    
    await this.logEvent('info', 'session_ended', {
      sessionId: this.currentSession.sessionId,
      duration: this.getUptime(),
      checksPerformed: this.currentSession.checksPerformed,
      notificationsSent: this.currentSession.notificationsSent
    });

    await this.saveStatistics();
    this.currentSession = null;
  }

  /**
   * Log a monitoring check
   */
  async logCheck(appointmentCount: number): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active monitoring session');
    }

    this.currentSession.checksPerformed++;
    
    await this.logEvent('info', 'check_performed', {
      appointmentCount,
      checkNumber: this.currentSession.checksPerformed
    });

    await this.saveStatistics();
  }

  /**
   * Log detailed appointment check results with enhanced information
   */
  async logAppointmentCheck(checkResult: CheckResult, checkDuration?: number): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active monitoring session');
    }

    this.currentSession.checksPerformed++;

    const appointmentLogDetails: AppointmentLogDetails = {
      checkType: checkResult.type,
      totalAppointments: checkResult.appointmentCount,
      availableAppointments: checkResult.availableCount,
      filledAppointments: checkResult.filledCount,
      appointmentDetails: checkResult.appointments.map(apt => ({
        id: apt.id,
        date: apt.date,
        time: apt.time,
        location: apt.location,
        examType: apt.examType,
        status: apt.status
      })),
      url: checkResult.url,
      ...(checkDuration !== undefined && { checkDuration })
    };

    // Log at different levels based on result type
    const logLevel = this.getLogLevelForCheckType(checkResult.type);
    
    await this.logEvent(logLevel, 'appointment_check_detailed', {
      ...appointmentLogDetails,
      checkNumber: this.currentSession.checksPerformed
    });

    // Log individual appointments if detailed logging is enabled
    if (this.config.enableDetailedAppointmentLogging && checkResult.appointments.length > 0) {
      await this.logAppointmentDetails(checkResult.appointments, checkResult.type);
    }

    await this.saveStatistics();
  }

  /**
   * Log detailed information about individual appointments
   */
  async logAppointmentDetails(appointments: Appointment[], checkType: 'available' | 'filled' | 'no-slots'): Promise<void> {
    for (const appointment of appointments) {
      const logLevel = appointment.status === 'available' ? 'info' : 'debug';
      
      await this.logEvent(logLevel, 'appointment_detected', {
        appointmentId: appointment.id,
        date: appointment.date,
        time: appointment.time,
        location: appointment.location,
        examType: appointment.examType,
        city: appointment.city,
        status: appointment.status,
        checkType,
        price: appointment.price,
        registrationUrl: appointment.registrationUrl ? 'present' : 'not_present'
      });
    }
  }

  /**
   * Log appointment status summary with counts
   */
  async logAppointmentSummary(
    availableCount: number, 
    filledCount: number, 
    totalCount: number,
    context?: string
  ): Promise<void> {
    const summaryDetails = {
      availableAppointments: availableCount,
      filledAppointments: filledCount,
      totalAppointments: totalCount,
      availabilityRatio: totalCount > 0 ? (availableCount / totalCount) : 0,
      context: context || 'monitoring_check'
    };

    // Use different log levels based on availability
    let logLevel: 'info' | 'warn' | 'debug' = 'debug';
    if (availableCount > 0) {
      logLevel = 'info'; // Available appointments are important
    } else if (filledCount > 0) {
      logLevel = 'debug'; // Filled appointments are less critical
    }

    await this.logEvent(logLevel, 'appointment_summary', summaryDetails);
  }

  /**
   * Log notification-worthy events (only truly available appointments)
   */
  async logNotificationWorthyEvent(appointments: Appointment[], reason: string): Promise<void> {
    const availableAppointments = appointments.filter(apt => apt.status === 'available');
    
    if (availableAppointments.length === 0) {
      await this.logEvent('debug', 'notification_suppressed', {
        reason: 'no_available_appointments',
        totalAppointments: appointments.length,
        filledAppointments: appointments.filter(apt => apt.status === 'filled').length,
        context: reason
      });
      return;
    }

    await this.logEvent('info', 'notification_worthy_event', {
      availableAppointmentCount: availableAppointments.length,
      appointments: availableAppointments.map(apt => ({
        id: apt.id,
        date: apt.date,
        time: apt.time,
        location: apt.location,
        examType: apt.examType
      })),
      reason,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log an error with context
   */
  async logError(error: Error | string, context?: string): Promise<void> {
    const errorLog: ErrorLog = {
      timestamp: new Date(),
      error: error instanceof Error ? error.message : error,
      ...(context && { context }),
      ...(error instanceof Error && error.stack && { stack: error.stack })
    };

    if (this.currentSession) {
      this.currentSession.errors.push(errorLog);
    }

    await this.logEvent('error', 'error_occurred', {
      error: errorLog.error,
      context: errorLog.context,
      stack: errorLog.stack
    });

    await this.saveStatistics();
  }

  /**
   * Log a notification sent
   */
  async logNotification(notificationRecord: NotificationRecord): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active monitoring session');
    }

    this.currentSession.notificationsSent++;

    await this.logEvent('info', 'notification_sent', {
      appointmentCount: notificationRecord.appointmentCount,
      channels: notificationRecord.channels,
      deliveryStatus: notificationRecord.deliveryStatus
    });

    await this.saveStatistics();
  }

  /**
   * Log an info message
   */
  async logInfo(message: string, details?: any): Promise<void> {
    await this.logEvent('info', message, details);
  }

  /**
   * Log a warning message
   */
  async logWarn(message: string, details?: any): Promise<void> {
    await this.logEvent('warn', message, details);
  }

  /**
   * Log a debug message
   */
  async logDebug(message: string, details?: any): Promise<void> {
    await this.logEvent('debug', message, details);
  }

  /**
   * Get current monitoring statistics
   */
  getStatistics(): MonitoringStatistics | null {
    if (!this.currentSession) {
      return null;
    }

    const uptime = this.getUptime();
    const averageCheckInterval = this.currentSession.checksPerformed > 1 
      ? uptime / (this.currentSession.checksPerformed - 1)
      : undefined;

    const stats: MonitoringStatistics = {
      sessionId: this.currentSession.sessionId,
      startTime: this.currentSession.startTime,
      uptime,
      checksPerformed: this.currentSession.checksPerformed,
      notificationsSent: this.currentSession.notificationsSent,
      errorsEncountered: this.currentSession.errors.length
    };

    const lastCheckTime = this.getLastEventTime('check_performed');
    const lastNotificationTime = this.getLastEventTime('notification_sent');

    if (lastCheckTime) {
      stats.lastCheckTime = lastCheckTime;
    }
    if (lastNotificationTime) {
      stats.lastNotificationTime = lastNotificationTime;
    }
    if (averageCheckInterval !== undefined) {
      stats.averageCheckInterval = averageCheckInterval;
    }

    return stats;
  }

  /**
   * Export logs in specified format
   */
  async exportLogs(format: 'json' | 'csv' | 'txt', outputPath?: string): Promise<string> {
    const logs = await this.getAllLogs();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultPath = path.join(this.config.logDirectory, `export-${timestamp}.${format}`);
    const exportPath = outputPath || defaultPath;

    switch (format) {
      case 'json':
        await fs.writeJson(exportPath, logs, { spaces: 2 });
        break;
      case 'csv':
        await this.exportToCsv(logs, exportPath);
        break;
      case 'txt':
        await this.exportToText(logs, exportPath);
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    return exportPath;
  }

  /**
   * Clean up old log files
   */
  async cleanupLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.logDirectory);
      const logFiles = files
        .filter(file => file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.config.logDirectory, file),
          stats: fs.statSync(path.join(this.config.logDirectory, file))
        }))
        .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

      // Remove excess log files
      if (logFiles.length > this.config.maxLogFiles) {
        const filesToRemove = logFiles.slice(this.config.maxLogFiles);
        for (const file of filesToRemove) {
          await fs.remove(file.path);
        }
      }

      // Rotate current log file if it's too large
      await this.rotateLogFileIfNeeded();
    } catch (error) {
      console.error('Error during log cleanup:', error);
    }
  }

  /**
   * Get all historical statistics
   */
  async getHistoricalStatistics(): Promise<MonitoringStatistics[]> {
    try {
      if (await fs.pathExists(this.statisticsFilePath)) {
        return await fs.readJson(this.statisticsFilePath);
      }
      return [];
    } catch (error) {
      console.error('Error reading historical statistics:', error);
      return [];
    }
  }

  // Private helper methods

  private async ensureLogDirectory(): Promise<void> {
    await fs.ensureDir(this.config.logDirectory);
  }

  private getUptime(): number {
    if (!this.currentSession) {
      return 0;
    }
    const endTime = this.currentSession.endTime || new Date();
    return endTime.getTime() - this.currentSession.startTime.getTime();
  }

  private getLastEventTime(eventType: string): Date | undefined {
    const events = this.logEntries
      .filter(entry => entry.event === eventType)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return events.length > 0 ? events[0].timestamp : undefined;
  }

  private getLogLevelForCheckType(checkType: 'available' | 'filled' | 'no-slots'): 'info' | 'warn' | 'debug' {
    switch (checkType) {
      case 'available':
        return 'info'; // Available appointments are important
      case 'filled':
        return 'debug'; // Filled appointments are less critical for notifications
      case 'no-slots':
        return 'debug'; // No slots is informational
      default:
        return 'debug';
    }
  }

  private shouldLogAtLevel(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevelIndex = levels.indexOf(this.config.logLevel);
    const eventLevelIndex = levels.indexOf(level);
    return eventLevelIndex >= configLevelIndex;
  }

  private async logEvent(level: 'debug' | 'info' | 'warn' | 'error', event: string, details?: any): Promise<void> {
    // Check if we should log at this level
    if (!this.shouldLogAtLevel(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      event,
      ...(details && { details }),
      ...(this.currentSession?.sessionId && { sessionId: this.currentSession.sessionId })
    };

    this.logEntries.push(logEntry);

    // Write to log file
    await this.writeToLogFile(logEntry);

    // Keep only recent entries in memory (last 1000)
    if (this.logEntries.length > 1000) {
      this.logEntries = this.logEntries.slice(-1000);
    }
  }

  private async writeToLogFile(logEntry: LogEntry): Promise<void> {
    const logLine = `${logEntry.timestamp.toISOString()} [${logEntry.level.toUpperCase()}] ${logEntry.event}`;
    const details = logEntry.details ? ` - ${JSON.stringify(logEntry.details)}` : '';
    const sessionInfo = logEntry.sessionId ? ` (Session: ${logEntry.sessionId})` : '';
    const fullLogLine = `${logLine}${details}${sessionInfo}\n`;

    await fs.appendFile(this.logFilePath, fullLogLine);
  }

  private async rotateLogFileIfNeeded(): Promise<void> {
    try {
      if (await fs.pathExists(this.logFilePath)) {
        const stats = await fs.stat(this.logFilePath);
        if (stats.size > this.config.maxLogFileSize) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const rotatedPath = path.join(
            this.config.logDirectory,
            `monitor-${timestamp}.log`
          );
          await fs.move(this.logFilePath, rotatedPath);
        }
      }
    } catch (error) {
      console.error('Error rotating log file:', error);
    }
  }

  private async getAllLogs(): Promise<LogEntry[]> {
    // Return in-memory logs plus any from log files
    const allLogs = [...this.logEntries];
    
    try {
      const files = await fs.readdir(this.config.logDirectory);
      const logFiles = files.filter(file => file.endsWith('.log'));
      
      for (const file of logFiles) {
        const filePath = path.join(this.config.logDirectory, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const parsed = this.parseLogLine(line);
            if (parsed) {
              allLogs.push(parsed);
            }
          } catch (error) {
            // Skip malformed log lines
          }
        }
      }
    } catch (error) {
      console.error('Error reading log files:', error);
    }

    return allLogs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private parseLogLine(line: string): LogEntry | null {
    const regex = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z) \[(\w+)\] (\w+)(?: - (.+?))?(?: \(Session: (.+?)\))?$/;
    const match = line.match(regex);
    
    if (!match) {
      return null;
    }

    const [, timestamp, level, event, detailsStr, sessionId] = match;
    let details;
    
    if (detailsStr) {
      try {
        details = JSON.parse(detailsStr);
      } catch {
        details = detailsStr;
      }
    }

    return {
      timestamp: new Date(timestamp),
      level: level.toLowerCase() as 'debug' | 'info' | 'warn' | 'error',
      event,
      details,
      sessionId
    };
  }

  private async exportToCsv(logs: LogEntry[], outputPath: string): Promise<void> {
    const headers = 'Timestamp,Level,Event,Details,SessionId\n';
    const rows = logs.map(log => {
      const details = log.details ? JSON.stringify(log.details).replace(/"/g, '""') : '';
      return `"${log.timestamp.toISOString()}","${log.level}","${log.event}","${details}","${log.sessionId || ''}"`;
    }).join('\n');
    
    await fs.writeFile(outputPath, headers + rows);
  }

  private async exportToText(logs: LogEntry[], outputPath: string): Promise<void> {
    const content = logs.map(log => {
      const details = log.details ? ` - ${JSON.stringify(log.details)}` : '';
      const sessionInfo = log.sessionId ? ` (Session: ${log.sessionId})` : '';
      return `${log.timestamp.toISOString()} [${log.level.toUpperCase()}] ${log.event}${details}${sessionInfo}`;
    }).join('\n');
    
    await fs.writeFile(outputPath, content);
  }

  private async saveStatistics(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    try {
      const currentStats = this.getStatistics();
      if (!currentStats) {
        return;
      }

      let historicalStats = await this.getHistoricalStatistics();
      
      // Update or add current session stats
      const existingIndex = historicalStats.findIndex(
        stats => stats.sessionId === currentStats.sessionId
      );
      
      if (existingIndex >= 0) {
        historicalStats[existingIndex] = currentStats;
      } else {
        historicalStats.push(currentStats);
      }

      // Keep only last 100 sessions
      if (historicalStats.length > 100) {
        historicalStats = historicalStats.slice(-100);
      }

      await fs.writeJson(this.statisticsFilePath, historicalStats, { spaces: 2 });
    } catch (error) {
      console.error('Error saving statistics:', error);
    }
  }
}