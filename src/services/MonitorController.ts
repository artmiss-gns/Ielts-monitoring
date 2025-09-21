import { EventEmitter } from 'events';
import { 
  MonitorConfig, 
  MonitoringSession, 
  Appointment, 
  ErrorLog 
} from '../models/types';
import { ConfigurationManager } from './ConfigurationManager';
import { WebScraperService } from './WebScraperService';
import { DataStorageService } from './DataStorageService';
import { NotificationService } from './NotificationService';
import { StatusLoggerService, MonitoringStatistics } from './StatusLoggerService';
import { ErrorHandlerService } from './ErrorHandlerService';
import { AppointmentDetectionService } from './AppointmentDetectionService';
import { EnvironmentConfigManager } from './EnvironmentConfigManager';
import { generateId } from '../models/utils';

/**
 * Monitor status enumeration
 */
export enum MonitorStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  PAUSED = 'paused',
  STOPPING = 'stopping',
  ERROR = 'error'
}

/**
 * Monitor Controller events
 */
export interface MonitorControllerEvents {
  'status-changed': (status: MonitorStatus) => void;
  'appointments-found': (appointments: Appointment[]) => void;
  'new-appointments': (appointments: Appointment[]) => void;
  'check-completed': (appointmentCount: number) => void;
  'error': (error: Error) => void;
  'notification-sent': (appointmentCount: number) => void;
}

/**
 * Monitor Controller class - Central orchestrator for IELTS appointment monitoring
 */
export class MonitorController extends EventEmitter {
  private status: MonitorStatus = MonitorStatus.STOPPED;
  private currentSession: MonitoringSession | null = null;
  private monitoringTimer: NodeJS.Timeout | null = null;
  private config: MonitorConfig | null = null;
  private isShuttingDown: boolean = false;

  // Service dependencies
  private configManager: ConfigurationManager;
  private webScraper: WebScraperService;
  private dataStorage: DataStorageService;
  private notificationService: NotificationService;
  private statusLogger: StatusLoggerService;
  private errorHandler: ErrorHandlerService;
  private appointmentDetection: AppointmentDetectionService;

  constructor(options?: { skipShutdownHandlers?: boolean; baseUrl?: string }) {
    super();
    
    // Initialize services
    this.configManager = new ConfigurationManager();
    this.webScraper = new WebScraperService(options?.baseUrl);
    this.dataStorage = new DataStorageService();
    
    // Initialize NotificationService with Telegram configuration from environment
    const telegramConfig = EnvironmentConfigManager.createTelegramConfig();
    this.notificationService = new NotificationService('logs', telegramConfig || undefined);
    
    this.statusLogger = new StatusLoggerService();
    this.errorHandler = new ErrorHandlerService(this.statusLogger, this.notificationService);
    this.appointmentDetection = new AppointmentDetectionService();

    // Setup graceful shutdown handlers (skip in tests)
    if (!options?.skipShutdownHandlers) {
      this.setupShutdownHandlers();
    }
  }

  /**
   * Start monitoring with the provided or loaded configuration
   */
  async startMonitoring(config?: MonitorConfig): Promise<void> {
    if (this.status === MonitorStatus.RUNNING) {
      throw new Error('Monitoring is already running');
    }

    try {
      this.setStatus(MonitorStatus.STARTING);
      
      // Load or use provided configuration
      this.config = config || await this.configManager.loadConfig();
      
      // Reinitialize WebScraperService with baseUrl from config if provided
      if (this.config.baseUrl) {
        this.webScraper = new WebScraperService(this.config.baseUrl);
      }
      
      // Initialize services
      await this.initializeServices();
      
      // Initialize appointment detection service
      await this.appointmentDetection.initialize();
      
      // Create new monitoring session
      this.currentSession = {
        sessionId: generateId(),
        startTime: new Date(),
        checksPerformed: 0,
        notificationsSent: 0,
        errors: [],
        configuration: this.config
      };

      // Start status logging
      await this.statusLogger.startSession(this.currentSession.sessionId, this.config);
      
      // Start monitoring loop
      this.startMonitoringLoop();
      
      this.setStatus(MonitorStatus.RUNNING);
      await this.statusLogger.logInfo('Monitoring started', { 
        sessionId: this.currentSession.sessionId,
        config: this.config 
      });
      
    } catch (error) {
      this.setStatus(MonitorStatus.ERROR);
      await this.handleError(error as Error, 'Failed to start monitoring');
      throw error;
    }
  }

  /**
   * Pause monitoring temporarily
   */
  async pauseMonitoring(): Promise<void> {
    if (this.status !== MonitorStatus.RUNNING) {
      throw new Error('Cannot pause monitoring - not currently running');
    }

    this.setStatus(MonitorStatus.PAUSED);
    
    if (this.monitoringTimer) {
      clearTimeout(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    await this.statusLogger.logInfo('Monitoring paused', { 
      sessionId: this.currentSession?.sessionId 
    });
  }

  /**
   * Resume monitoring from paused state
   */
  async resumeMonitoring(): Promise<void> {
    if (this.status !== MonitorStatus.PAUSED) {
      throw new Error('Cannot resume monitoring - not currently paused');
    }

    this.setStatus(MonitorStatus.RUNNING);
    this.startMonitoringLoop();
    
    await this.statusLogger.logInfo('Monitoring resumed', { 
      sessionId: this.currentSession?.sessionId 
    });
  }

  /**
   * Stop monitoring gracefully
   */
  async stopMonitoring(): Promise<void> {
    if (this.status === MonitorStatus.STOPPED) {
      return;
    }

    this.setStatus(MonitorStatus.STOPPING);
    this.isShuttingDown = true;

    // Clear monitoring timer
    if (this.monitoringTimer) {
      clearTimeout(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    // Finalize current session
    if (this.currentSession) {
      this.currentSession.endTime = new Date();
      await this.statusLogger.endSession();
    }

    // Cleanup services
    await this.cleanupServices();

    this.setStatus(MonitorStatus.STOPPED);
    await this.statusLogger.logInfo('Monitoring stopped', { 
      sessionId: this.currentSession?.sessionId 
    });

    this.currentSession = null;
    this.isShuttingDown = false;
  }

  /**
   * Get enhanced monitoring statistics including appointment tracking
   */
  async getEnhancedStatistics(): Promise<{
    trackingStats: any;
    recentStatusChanges: any[];
    monitoringStats: any;
  }> {
    const trackingStats = this.appointmentDetection.getTrackingStatistics();
    const recentStatusChanges = this.appointmentDetection.getRecentStatusChanges(60); // Last hour
    const monitoringStats = await this.statusLogger.getStatistics();
    
    return {
      trackingStats,
      recentStatusChanges,
      monitoringStats
    };
  }

  /**
   * Get current monitoring status and statistics
   */
  async getStatus(): Promise<{
    status: MonitorStatus;
    statistics?: MonitoringStatistics;
    session?: MonitoringSession;
    config?: MonitorConfig;
  }> {
    const result: any = {
      status: this.status
    };

    if (this.currentSession) {
      result.session = { ...this.currentSession };
      result.statistics = await this.statusLogger.getStatistics();
    }

    if (this.config) {
      result.config = { ...this.config };
    }

    return result;
  }

  /**
   * Update configuration and restart monitoring if running
   */
  async updateConfiguration(newConfig: MonitorConfig): Promise<void> {
    const wasRunning = this.status === MonitorStatus.RUNNING;
    
    if (wasRunning) {
      await this.pauseMonitoring();
    }

    // Validate and save new configuration
    await this.configManager.saveConfig(newConfig);
    this.config = newConfig;

    if (wasRunning) {
      await this.resumeMonitoring();
    }

    await this.statusLogger.logInfo('Configuration updated', { 
      sessionId: this.currentSession?.sessionId,
      newConfig 
    });
  }

  /**
   * Initialize all services
   */
  private async initializeServices(): Promise<void> {
    try {
      await this.webScraper.initialize();
      await this.statusLogger.logInfo('Services initialized successfully');
    } catch (error) {
      await this.statusLogger.logError(error as Error, 'Failed to initialize services');
      throw error;
    }
  }

  /**
   * Cleanup services on shutdown
   */
  private async cleanupServices(): Promise<void> {
    try {
      await this.webScraper.close();
      await this.statusLogger.logInfo('Services cleaned up successfully');
    } catch (error) {
      await this.statusLogger.logError(error as Error, 'Error during service cleanup');
    }
  }

  /**
   * Start the monitoring loop
   */
  private startMonitoringLoop(): void {
    if (!this.config || this.isShuttingDown) {
      return;
    }

    const performCheck = async () => {
      if (this.status !== MonitorStatus.RUNNING || this.isShuttingDown) {
        return;
      }

      try {
        await this.performMonitoringCheck();
      } catch (error) {
        await this.handleError(error as Error, 'Error during monitoring check');
      }

      // Schedule next check
      if (this.status === MonitorStatus.RUNNING && !this.isShuttingDown) {
        this.monitoringTimer = setTimeout(performCheck, this.config!.checkInterval);
      }
    };

    // Start first check immediately
    setImmediate(performCheck);
  }

  /**
   * Perform a single monitoring check
   */
  private async performMonitoringCheck(): Promise<void> {
    if (!this.config || !this.currentSession) {
      return;
    }

    const checkStartTime = new Date();
    console.log(`\n🔄 [${checkStartTime.toLocaleTimeString()}] Starting monitoring check #${this.currentSession.checksPerformed + 1}`);

    try {
      // Fetch current appointments with enhanced status detection
      const filters = {
        city: this.config.city,
        examModel: this.config.examModel,
        months: this.config.months
      };

      const checkResult = await this.webScraper.fetchAppointmentsWithStatus(filters);
      
      this.emit('appointments-found', checkResult.appointments);

      // Use enhanced appointment detection service
      const detectionResult = await this.appointmentDetection.processAppointments(checkResult);
      
      // Save current appointments for backward compatibility
      await this.dataStorage.saveAppointments(checkResult.appointments);

      // Update session statistics
      this.currentSession.checksPerformed++;
      
      // Enhanced logging for detection results with comprehensive status information
      const checkEndTime = new Date();
      const duration = checkEndTime.getTime() - checkStartTime.getTime();
      
      console.log(`✅ [${checkEndTime.toLocaleTimeString()}] Check completed in ${duration}ms`);
      console.log(`📊 Status: ${checkResult.type} | Total: ${checkResult.appointmentCount} | Available: ${checkResult.availableCount} | Filled: ${checkResult.filledCount}`);
      
      // Get tracking statistics
      const trackingStats = this.appointmentDetection.getTrackingStatistics();
      console.log(`🔍 Tracking: ${trackingStats.totalTracked} appointments | Notifications sent: ${trackingStats.totalNotificationsSent}`);
      
      // Log new available appointments
      if (detectionResult.newAvailableAppointments.length > 0) {
        console.log(`🎉 Found ${detectionResult.newAvailableAppointments.length} NEW AVAILABLE appointment(s)!`);
        detectionResult.newAvailableAppointments.forEach((apt, index) => {
          console.log(`   ${index + 1}. ${apt.date} ${apt.time} - ${apt.city} (${apt.examType}) [${apt.status.toUpperCase()}]`);
        });
      }
      
      // Log status changes
      if (detectionResult.statusChangedAppointments.length > 0) {
        console.log(`🔄 ${detectionResult.statusChangedAppointments.length} appointment(s) changed status`);
        detectionResult.statusChangedAppointments.forEach((apt, index) => {
          console.log(`   ${index + 1}. ${apt.date} ${apt.time} - ${apt.city} (${apt.examType}) [${apt.status.toUpperCase()}]`);
        });
      }
      
      // Log removed appointments
      if (detectionResult.removedAppointments.length > 0) {
        console.log(`📤 ${detectionResult.removedAppointments.length} appointment(s) were removed since last check`);
        detectionResult.removedAppointments.forEach((apt, index) => {
          console.log(`   ${index + 1}. ${apt.appointment.date} ${apt.appointment.time} - ${apt.appointment.city}`);
        });
      }
      
      // Log when no new appointments are found
      if (detectionResult.newAvailableAppointments.length === 0) {
        if (checkResult.type === 'no-slots') {
          console.log(`📭 No appointment slots available for the selected criteria`);
        } else if (checkResult.type === 'filled') {
          console.log(`📋 ${checkResult.appointmentCount} appointment(s) found but all are filled/pending`);
        } else {
          console.log(`📋 ${checkResult.appointmentCount} appointment(s) found (no new available ones)`);
        }
      }
      
      // Log the check with enhanced status information
      await this.statusLogger.logAppointmentCheck(checkResult, duration);
      this.emit('check-completed', checkResult.appointments.length);

      // Send notifications ONLY for new available appointments that should be notified
      const notifiableAppointments = this.appointmentDetection.getNotifiableAppointments(
        detectionResult.newAvailableAppointments
      );
      
      // Enhanced logging for notification decisions
      if (detectionResult.newAvailableAppointments.length > 0) {
        const notificationDecisions = this.appointmentDetection.getNotificationDecisionDetails(
          detectionResult.newAvailableAppointments
        );
        
        console.log(`🔍 Notification Decision Analysis:`);
        notificationDecisions.forEach((decision, index) => {
          const statusIcon = decision.shouldNotify ? '✅' : '🔕';
          console.log(`   ${index + 1}. ${statusIcon} ${decision.appointmentKey} - ${decision.reason}`);
          if (decision.lastNotificationTime) {
            console.log(`      Last notified: ${decision.lastNotificationTime.toLocaleString()}`);
          }
          if (decision.notificationCount > 0) {
            console.log(`      Total notifications: ${decision.notificationCount}`);
          }
        });
      }
      
      if (notifiableAppointments.length > 0) {
        await this.sendNotifications(notifiableAppointments);
        this.emit('new-appointments', notifiableAppointments);
        
        // Mark appointments as notified
        await this.appointmentDetection.markAsNotified(notifiableAppointments);
      } else if (detectionResult.newAvailableAppointments.length > 0) {
        // Enhanced logging when notifications are suppressed due to duplicate prevention
        const suppressedCount = detectionResult.newAvailableAppointments.length - notifiableAppointments.length;
        await this.statusLogger.logWarn('Notification suppressed: Duplicate prevention', {
          newAvailableCount: detectionResult.newAvailableAppointments.length,
          notifiableCount: notifiableAppointments.length,
          suppressedCount: suppressedCount,
          suppressedAppointments: detectionResult.newAvailableAppointments
            .filter(apt => !notifiableAppointments.includes(apt))
            .map(apt => this.appointmentDetection.generateAppointmentKey ? 
              this.appointmentDetection.generateAppointmentKey(apt) : 
              `${apt.date}-${apt.time}-${apt.city}`
            )
        });
        console.log(`🔕 ${suppressedCount} appointment(s) found but notifications suppressed (duplicate prevention)`);
        console.log(`📧 ${notifiableAppointments.length} appointment(s) eligible for notification`);
      }

      // Log next check time
      const nextCheckTime = new Date(Date.now() + this.config.checkInterval);
      console.log(`⏰ Next check scheduled for ${nextCheckTime.toLocaleTimeString()}`);

    } catch (error) {
      const checkEndTime = new Date();
      const duration = checkEndTime.getTime() - checkStartTime.getTime();
      console.log(`❌ [${checkEndTime.toLocaleTimeString()}] Check failed after ${duration}ms`);
      await this.handleError(error as Error, 'Monitoring check failed');
    }
  }

  /**
   * Send notifications for new appointments (only available ones)
   */
  private async sendNotifications(appointments: Appointment[]): Promise<void> {
    if (!this.config || !this.currentSession) {
      return;
    }

    try {
      // Double-check that we only have available appointments
      const availableAppointments = appointments.filter(apt => apt.status === 'available');
      
      if (availableAppointments.length === 0) {
        await this.statusLogger.logWarn('Notification suppressed: No available appointments', {
          totalAppointments: appointments.length,
          appointmentStatuses: appointments.map(apt => apt.status)
        });
        return;
      }

      // Log notification-worthy event with enhanced tracking information
      await this.statusLogger.logNotificationWorthyEvent(
        availableAppointments, 
        'new_available_appointments_detected'
      );

      // Get tracking statistics for logging
      const trackingStats = this.appointmentDetection.getTrackingStatistics();
      
      const notificationRecord = await this.notificationService.sendNotification(
        availableAppointments,
        this.config.notificationSettings
      );

      // Update session statistics
      this.currentSession.notificationsSent++;
      
      await this.statusLogger.logNotification(notificationRecord);
      this.emit('notification-sent', availableAppointments.length);

      // Log successful notification with enhanced details
      await this.statusLogger.logInfo('Notification sent successfully', {
        availableAppointmentCount: availableAppointments.length,
        channels: notificationRecord.channels,
        deliveryStatus: notificationRecord.deliveryStatus,
        trackingStats: {
          totalTracked: trackingStats.totalTracked,
          totalNotificationsSent: trackingStats.totalNotificationsSent
        }
      });

      console.log(`📧 Notification sent for ${availableAppointments.length} appointment(s) via ${notificationRecord.channels.join(', ')}`);

    } catch (error) {
      await this.handleError(error as Error, 'Failed to send notifications');
    }
  }

  /**
   * Handle errors with logging and recovery using ErrorHandlerService
   */
  private async handleError(error: Error, context: string): Promise<void> {
    const errorLog: ErrorLog = {
      timestamp: new Date(),
      error: error.message,
      context,
      ...(error.stack && { stack: error.stack })
    };

    // Add to session errors
    if (this.currentSession) {
      this.currentSession.errors.push(errorLog);
    }

    // Use enhanced error handling
    const enhancedError = this.errorHandler.enhanceError(error, {
      operation: context,
      component: 'MonitorController',
      timestamp: new Date(),
      ...(this.currentSession?.sessionId && { sessionId: this.currentSession.sessionId })
    });

    const recovered = await this.errorHandler.handleError(enhancedError);
    
    // Emit error event
    this.emit('error', error);

    // If not recovered and critical, stop monitoring
    if (!recovered && enhancedError.severity === 'critical') {
      await this.stopMonitoring();
      this.setStatus(MonitorStatus.ERROR);
    }
  }



  /**
   * Set monitoring status and emit event
   */
  private setStatus(newStatus: MonitorStatus): void {
    const oldStatus = this.status;
    this.status = newStatus;
    
    if (oldStatus !== newStatus) {
      this.emit('status-changed', newStatus);
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const gracefulShutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      
      try {
        await this.stopMonitoring();
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      await this.statusLogger.logError(error, 'Uncaught exception');
      await this.stopMonitoring();
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, _promise) => {
      const error = new Error(`Unhandled rejection: ${reason}`);
      await this.statusLogger.logError(error, 'Unhandled promise rejection');
      await this.stopMonitoring();
      process.exit(1);
    });
  }

  /**
   * Get current monitoring status
   */
  getCurrentStatus(): MonitorStatus {
    return this.status;
  }

  /**
   * Check if monitoring is active
   */
  isActive(): boolean {
    return this.status === MonitorStatus.RUNNING;
  }

  /**
   * Check if monitoring is paused
   */
  isPaused(): boolean {
    return this.status === MonitorStatus.PAUSED;
  }

  /**
   * Get current session information
   */
  getCurrentSession(): MonitoringSession | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  /**
   * Manually trigger a monitoring check (for testing)
   */
  async triggerCheck(): Promise<void> {
    if (this.status === MonitorStatus.RUNNING) {
      await this.performMonitoringCheck();
    }
  }
}